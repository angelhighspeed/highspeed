from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.invoice_model import Invoice
from app.models.customer_model import Customer

from app.auth.dependencies import require_roles
from app.services.mikrotik_service import disable_pppoe_secret

router = APIRouter()

def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


@router.post("/billing/suspend-overdue")
def suspend_overdue_customers(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin"]))
):

    suspended = []

    invoices = (
        db.query(Invoice)
        .filter(Invoice.status == "pending")
        .all()
    )

    for invoice in invoices:

        customer = (
            db.query(Customer)
            .filter(Customer.id == invoice.customer_id)
            .first()
        )

        if not customer:
            continue

        try:
            result = disable_pppoe_secret(customer.name)

            suspended.append({
                "customer": customer.name,
                "invoice_id": invoice.id,
                "mikrotik_result": result
            })

        except Exception as e:

            suspended.append({
                "customer": customer.name,
                "invoice_id": invoice.id,
                "error": str(e)
            })

    return {
        "message": "Proceso completado",
        "suspended": suspended
    }