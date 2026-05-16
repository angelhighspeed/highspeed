from fastapi import APIRouter, Depends
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


@router.get("/customers/financial-summary")
def get_customers_financial_summary(
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "cobrador",
            "operador",
            "tecnico",
        ])
    ),
):
    customers = (
        db.query(Customer)
        .order_by(Customer.id.desc())
        .all()
    )

    customer_ids = [
        customer.id
        for customer in customers
    ]

    invoices = (
        db.query(Invoice)
        .filter(Invoice.customer_id.in_(customer_ids))
        .all()
        if customer_ids
        else []
    )

    invoices_by_customer = {}

    for invoice in invoices:
        if invoice.customer_id not in invoices_by_customer:
            invoices_by_customer[invoice.customer_id] = []

        invoices_by_customer[invoice.customer_id].append(invoice)

    result = []

    for customer in customers:
        customer_invoices = invoices_by_customer.get(customer.id, [])

        paid_invoices = [
            invoice for invoice in customer_invoices
            if invoice.status == "paid"
        ]

        pending_invoices = [
            invoice for invoice in customer_invoices
            if invoice.status == "pending"
        ]

        total_billed = sum(
            float(invoice.amount or 0)
            for invoice in customer_invoices
        )

        total_paid = sum(
            float(invoice.amount or 0)
            for invoice in paid_invoices
        )

        total_pending = sum(
            float(invoice.amount or 0)
            for invoice in pending_invoices
        )

        customer_name = f"{customer.name or ''} {customer.last_name or ''}".strip()

        result.append({
            "id": customer.id,
            "name": customer_name,
            "first_name": customer.name,
            "last_name": customer.last_name,
            "pppoe_username": customer.pppoe_username,
            "ip": customer.remote_address,
            "phone": customer.phone,
            "zone": customer.zone,
            "status": customer.status,

            "total_invoices": len(customer_invoices),
            "paid_invoices": len(paid_invoices),
            "pending_invoices": len(pending_invoices),

            "total_billed": total_billed,
            "total_paid": total_paid,
            "total_pending": total_pending,

            "account_status": "debt" if total_pending > 0 else "up_to_date",
        })

    return {
        "status": "ok",
        "total_customers": len(result),
        "customers": result,
    }