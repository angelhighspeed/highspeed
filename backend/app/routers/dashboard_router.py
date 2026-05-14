from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.customer_model import Customer
from app.models.plan_model import Plan
from app.models.invoice_model import Invoice
from app.auth.dependencies import require_roles

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/dashboard/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "cobrador", "operador"]))
):
    invoices = db.query(Invoice).all()

    pending_invoices = [i for i in invoices if i.status == "pending"]
    paid_invoices = [i for i in invoices if i.status == "paid"]

    return {
        "customers": db.query(Customer).count(),
        "plans": db.query(Plan).count(),
        "invoices": len(invoices),
        "pending_invoices": len(pending_invoices),
        "paid_invoices": len(paid_invoices),
        "total_pending_amount": sum(i.amount for i in pending_invoices),
        "total_paid_amount": sum(i.amount for i in paid_invoices),
    }