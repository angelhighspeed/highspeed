from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.database import SessionLocal
from app.models.customer_model import Customer
from app.models.invoice_model import Invoice
from app.routers.customer_actions_router import (
    get_customer_name,
    get_customer_pppoe_username,
    get_customer_status,
    mikrotik_action,
    serialize_customer,
    set_customer_status,
)

router = APIRouter(prefix="/auto-cut", tags=["auto-cut"])

PENDING_STATUSES = {"pending", "unpaid", "vencida", "overdue", "debt", "deuda"}
PAID_STATUSES = {"paid", "pagada", "cancelled", "cancelada", "cancelado"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def parse_due_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None

    raw_value = str(value).strip()
    formats = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%y", "%d-%m-%y"]

    for date_format in formats:
        try:
            return datetime.strptime(raw_value, date_format).date()
        except ValueError:
            continue

    return None


def is_invoice_unpaid(invoice: Invoice) -> bool:
    status = str(invoice.status or "").strip().lower()

    if invoice.paid_at is not None:
        return False

    if status in PAID_STATUSES:
        return False

    if status in PENDING_STATUSES:
        return True

    return True


def is_customer_already_suspended(customer: Customer) -> bool:
    status = str(get_customer_status(customer) or "").strip().lower()
    return status in {"suspended", "suspendido", "cut", "cortado"}


def should_skip_customer(customer: Customer) -> bool:
    status = str(get_customer_status(customer) or "").strip().lower()

    if status == "deleted":
        return True

    if not get_customer_pppoe_username(customer):
        return True

    return False


def append_customer_note(customer: Customer, note: str):
    previous_notes = customer.notes or ""
    customer.notes = f"{previous_notes}\n{note}".strip()


def build_cut_candidates(db: Session, grace_days: int = 0):
    today = date.today()
    limit_date = today - timedelta(days=max(int(grace_days or 0), 0))

    invoices = db.query(Invoice).all()
    customers = {customer.id: customer for customer in db.query(Customer).all()}

    candidates_by_customer = {}

    for invoice in invoices:
        due_date = parse_due_date(invoice.due_date)

        if due_date is None:
            continue

        if due_date > limit_date:
            continue

        if not is_invoice_unpaid(invoice):
            continue

        customer = customers.get(invoice.customer_id)

        if customer is None:
            continue

        if should_skip_customer(customer):
            continue

        if is_customer_already_suspended(customer):
            continue

        if customer.id not in candidates_by_customer:
            candidates_by_customer[customer.id] = {
                "customer_id": customer.id,
                "customer_name": get_customer_name(customer),
                "current_status": get_customer_status(customer),
                "pppoe_username": get_customer_pppoe_username(customer),
                "router_id": customer.router_id,
                "phone": customer.phone,
                "address": customer.address,
                "cut_day": customer.cut_day,
                "oldest_due_date": str(due_date),
                "total_debt": 0,
                "overdue_invoices": [],
                "reason": "Factura vencida",
            }

        item = candidates_by_customer[customer.id]
        item["overdue_invoices"].append(
            {
                "invoice_id": invoice.id,
                "amount": invoice.amount,
                "due_date": invoice.due_date,
                "status": invoice.status,
            }
        )
        item["total_debt"] += float(invoice.amount or 0)

        current_oldest = parse_due_date(item["oldest_due_date"])
        if current_oldest is None or due_date < current_oldest:
            item["oldest_due_date"] = str(due_date)

    return list(candidates_by_customer.values())


@router.get("/preview")
def preview_auto_cut(
    grace_days: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "operador", "cobrador"])),
):
    candidates = build_cut_candidates(db, grace_days=grace_days)

    return {
        "status": "ok",
        "mode": "preview",
        "message": "Vista previa. No se modificó ningún cliente.",
        "grace_days": grace_days,
        "count": len(candidates),
        "candidates": candidates,
    }


@router.post("/run")
def run_auto_cut(
    grace_days: int = Query(0, ge=0),
    dry_run: bool = Query(True),
    apply_mikrotik: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "operador"])),
):
    candidates = build_cut_candidates(db, grace_days=grace_days)

    if dry_run:
        return {
            "status": "ok",
            "mode": "dry_run",
            "message": "Simulación realizada. No se modificaron clientes ni MikroTik.",
            "grace_days": grace_days,
            "apply_mikrotik": apply_mikrotik,
            "count": len(candidates),
            "candidates": candidates,
        }

    now_text = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    results = []

    for candidate in candidates:
        customer = db.query(Customer).filter(Customer.id == candidate["customer_id"]).first()

        if customer is None:
            continue

        set_customer_status(customer, "suspended")
        append_customer_note(
            customer,
            (
                f"[{now_text}] Corte automático por factura vencida. "
                f"Deuda: {candidate['total_debt']}. "
                f"Facturas: {', '.join(str(item['invoice_id']) for item in candidate['overdue_invoices'])}."
            ),
        )

        mikrotik_result = {
            "status": "skipped",
            "message": "MikroTik no aplicado. apply_mikrotik=false.",
        }

        if apply_mikrotik:
            mikrotik_result = mikrotik_action(db, customer, "disable")

        results.append(
            {
                "customer": serialize_customer(customer),
                "candidate": candidate,
                "mikrotik": mikrotik_result,
            }
        )

    db.commit()

    return {
        "status": "ok",
        "mode": "executed",
        "message": (
            "Corte automático aplicado con MikroTik."
            if apply_mikrotik
            else "Corte automático interno aplicado. No se tocó MikroTik."
        ),
        "grace_days": grace_days,
        "apply_mikrotik": apply_mikrotik,
        "count": len(results),
        "results": results,
    }


@router.post("/reconnect/{customer_id}")
def reconnect_customer(
    customer_id: int,
    apply_mikrotik: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "operador"])),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()

    if customer is None:
        return {
            "status": "error",
            "message": "Cliente no encontrado.",
        }

    now_text = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    set_customer_status(customer, "active")
    append_customer_note(customer, f"[{now_text}] Reconexión desde corte automático.")

    mikrotik_result = {
        "status": "skipped",
        "message": "MikroTik no aplicado. apply_mikrotik=false.",
    }

    if apply_mikrotik:
        mikrotik_result = mikrotik_action(db, customer, "enable")

    db.commit()
    db.refresh(customer)

    return {
        "status": "ok",
        "message": (
            "Cliente reconectado con MikroTik."
            if apply_mikrotik
            else "Cliente reconectado internamente. No se tocó MikroTik."
        ),
        "customer": serialize_customer(customer),
        "mikrotik": mikrotik_result,
    }
