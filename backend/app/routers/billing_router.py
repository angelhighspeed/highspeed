from datetime import date, datetime
import json
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.auth.dependencies import require_roles

from app.models.invoice_model import Invoice
from app.models.customer_model import Customer

from app.services.mikrotik_service import (
    disable_pppoe_secret,
    remove_pppoe_active,
)

router = APIRouter()

SETTINGS_FILE = Path("cut_settings.json")


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def get_cut_settings():
    if not SETTINGS_FILE.exists():
        return {
            "cuts_enabled": False,
        }

    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception:
        return {
            "cuts_enabled": False,
        }


def save_cut_settings(cuts_enabled: bool):
    data = {
        "cuts_enabled": cuts_enabled,
    }

    with open(SETTINGS_FILE, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)

    return data


def parse_date(value):
    if value is None:
        return None

    if isinstance(value, date):
        return value

    if isinstance(value, datetime):
        return value.date()

    try:
        return datetime.fromisoformat(str(value)).date()
    except Exception:
        return None


@router.get("/billing/cut-status")
def get_billing_cut_status(
    current_user: dict = Depends(
        require_roles([
            "admin",
            "cobrador",
        ])
    ),
):
    settings = get_cut_settings()

    return {
        "status": "ok",
        "cuts_enabled": bool(settings.get("cuts_enabled", False)),
        "message": (
            "Los cortes están habilitados"
            if settings.get("cuts_enabled", False)
            else "Los cortes están deshabilitados"
        ),
    }


@router.post("/billing/cut-disable")
def disable_billing_cuts(
    current_user: dict = Depends(
        require_roles([
            "admin",
        ])
    ),
):
    settings = save_cut_settings(False)

    return {
        "status": "ok",
        "cuts_enabled": settings["cuts_enabled"],
        "message": "Cortes deshabilitados. No se suspenderán clientes.",
    }


@router.post("/billing/cut-enable")
def enable_billing_cuts(
    current_user: dict = Depends(
        require_roles([
            "admin",
        ])
    ),
):
    settings = save_cut_settings(True)

    return {
        "status": "ok",
        "cuts_enabled": settings["cuts_enabled"],
        "message": "Cortes habilitados. La suspensión de vencidos podrá ejecutarse.",
    }


@router.post("/billing/suspend-overdue")
def suspend_overdue_customers(
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "cobrador",
        ])
    ),
):
    settings = get_cut_settings()

    if not settings.get("cuts_enabled", False):
        return {
            "status": "disabled",
            "message": "Los cortes están deshabilitados. No se suspendió ningún cliente.",
            "cuts_enabled": False,
            "overdue_invoices": 0,
            "customers_processed": 0,
            "suspended_customers": 0,
            "mikrotik_disabled": 0,
            "active_connections_removed": 0,
            "errors": [],
        }

    today = date.today()

    invoices = (
        db.query(Invoice)
        .filter(Invoice.status == "pending")
        .all()
    )

    overdue_invoices = []

    for invoice in invoices:
        due_date = parse_date(invoice.due_date)

        # Corta desde el día siguiente al vencimiento.
        # Si vence el 15, corta desde el 16.
        if due_date and due_date < today:
            overdue_invoices.append(invoice)

    processed_customers = set()

    suspended_customers = 0
    already_suspended = 0
    mikrotik_disabled = 0
    active_connections_removed = 0
    skipped_without_customer = 0
    skipped_without_pppoe = 0
    errors = []

    for invoice in overdue_invoices:
        try:
            customer_id = invoice.customer_id

            if customer_id in processed_customers:
                continue

            customer = (
                db.query(Customer)
                .filter(Customer.id == customer_id)
                .first()
            )

            if not customer:
                skipped_without_customer += 1
                continue

            processed_customers.add(customer.id)

            if customer.status == "suspended":
                already_suspended += 1
            else:
                customer.status = "suspended"
                suspended_customers += 1

            if not customer.pppoe_username:
                skipped_without_pppoe += 1
                continue

            try:
                disable_pppoe_secret(customer.pppoe_username)
                mikrotik_disabled += 1
            except Exception as e:
                errors.append({
                    "customer_id": customer.id,
                    "pppoe_username": customer.pppoe_username,
                    "action": "disable_pppoe_secret",
                    "error": str(e),
                })

            try:
                result = remove_pppoe_active(customer.pppoe_username)
                active_connections_removed += int(result.get("removed", 0) or 0)
            except Exception as e:
                errors.append({
                    "customer_id": customer.id,
                    "pppoe_username": customer.pppoe_username,
                    "action": "remove_pppoe_active",
                    "error": str(e),
                })

        except Exception as e:
            errors.append({
                "invoice_id": invoice.id,
                "customer_id": invoice.customer_id,
                "error": str(e),
            })

    db.commit()

    return {
        "status": "ok",
        "message": "Suspensión de clientes vencidos finalizada",
        "cuts_enabled": True,
        "today": str(today),
        "overdue_invoices": len(overdue_invoices),
        "customers_processed": len(processed_customers),
        "suspended_customers": suspended_customers,
        "already_suspended": already_suspended,
        "mikrotik_disabled": mikrotik_disabled,
        "active_connections_removed": active_connections_removed,
        "skipped_without_customer": skipped_without_customer,
        "skipped_without_pppoe": skipped_without_pppoe,
        "errors": errors,
    }