from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.invoice_model import Invoice
from app.models.customer_model import Customer
from app.schemas.invoice_schema import InvoiceCreate, InvoiceResponse
from app.auth.dependencies import require_roles
from app.services.mikrotik_service import enable_pppoe_secret

router = APIRouter()

def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


@router.get("/invoices", response_model=list[InvoiceResponse])
def get_invoices(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "cobrador"]))
):
    return db.query(Invoice).all()


@router.post("/invoices", response_model=InvoiceResponse)
def create_invoice(
    invoice: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "cobrador"]))
):
    new_invoice = Invoice(
        customer_id=invoice.customer_id,
        amount=invoice.amount,
        due_date=invoice.due_date,
        status="pending"
    )

    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)

    return new_invoice


@router.put("/invoices/{invoice_id}/pay", response_model=InvoiceResponse)
def pay_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "cobrador"]))
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()

    if not invoice:
        return {"error": "Factura no encontrada"}

    invoice.status = "paid"

    customer = db.query(Customer).filter(Customer.id == invoice.customer_id).first()

    if customer:
        try:
            enable_pppoe_secret(customer.name)
        except Exception as e:
            print("Error reconectando PPPoE:", e)

    db.commit()
    db.refresh(invoice)

    return invoice