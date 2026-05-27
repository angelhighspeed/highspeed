from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.auth.dependencies import require_roles
from app.models.customer_model import Customer
from app.models.invoice_model import Invoice


router = APIRouter()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def format_datetime(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")

    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")

    return str(value)


def format_date(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")

    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")

    return str(value)


@router.get("/customers/{customer_id}/payment-history")
def get_customer_payment_history(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "cobrador",
            "operador",
        ])
    ),
):
    customer = (
        db.query(Customer)
        .filter(Customer.id == customer_id)
        .first()
    )

    if not customer:
        raise HTTPException(
            status_code=404,
            detail="Cliente no encontrado",
        )

    invoices = (
        db.query(Invoice)
        .filter(Invoice.customer_id == customer_id)
        .order_by(Invoice.id.desc())
        .all()
    )

    total_invoices = len(invoices)

    paid_invoices = [
        invoice for invoice in invoices
        if invoice.status == "paid"
    ]

    pending_invoices = [
        invoice for invoice in invoices
        if invoice.status == "pending"
    ]

    total_billed = sum(
        float(invoice.amount or 0)
        for invoice in invoices
    )

    total_paid = sum(
        float(invoice.amount or 0)
        for invoice in paid_invoices
    )

    total_pending = sum(
        float(invoice.amount or 0)
        for invoice in pending_invoices
    )

    invoice_items = []

    for invoice in invoices:
        invoice_items.append({
            "invoice_id": invoice.id,
            "customer_id": invoice.customer_id,
            "amount": float(invoice.amount or 0),
            "due_date": format_date(invoice.due_date),
            "status": invoice.status,
            "created_at": format_datetime(getattr(invoice, "created_at", None)),
            "paid_at": format_datetime(getattr(invoice, "paid_at", None)),
            "payment_method": getattr(invoice, "payment_method", None),
            "payment_note": getattr(invoice, "payment_note", None),
            "receipt_url": (
                f"/invoices/{invoice.id}/receipt-pdf"
                if invoice.status == "paid"
                else None
            ),
        })

    customer_name = f"{customer.name or ''} {customer.last_name or ''}".strip()

    return {
        "status": "ok",
        "customer": {
            "id": customer.id,
            "name": customer_name,
            "pppoe_username": customer.pppoe_username,
            "ip": customer.remote_address,
            "phone": customer.phone,
            "zone": customer.zone,
            "status": customer.status,
        },
        "summary": {
            "total_invoices": total_invoices,
            "paid_invoices": len(paid_invoices),
            "pending_invoices": len(pending_invoices),
            "total_billed": total_billed,
            "total_paid": total_paid,
            "total_pending": total_pending,
        },
        "invoices": invoice_items,
    }