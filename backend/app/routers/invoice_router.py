from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine
from app.auth.dependencies import require_roles
from app.models.invoice_model import Invoice


router = APIRouter()


class InvoiceCreate(BaseModel):
    customer_id: int
    amount: float
    due_date: Optional[str] = None


class InvoicePayRequest(BaseModel):
    payment_method: Optional[str] = "Efectivo"
    payment_note: Optional[str] = ""


def ensure_invoice_columns():
    """
    Agrega columnas faltantes en la tabla invoices.
    Compatible con PostgreSQL y SQLite.
    """

    dialect = engine.dialect.name

    try:
        if dialect == "postgresql":
            with engine.begin() as conn:
                conn.execute(
                    text(
                        """
                        ALTER TABLE invoices
                        ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP
                        """
                    )
                )

                conn.execute(
                    text(
                        """
                        ALTER TABLE invoices
                        ADD COLUMN IF NOT EXISTS payment_method VARCHAR
                        """
                    )
                )

                conn.execute(
                    text(
                        """
                        ALTER TABLE invoices
                        ADD COLUMN IF NOT EXISTS payment_note TEXT
                        """
                    )
                )

                conn.execute(
                    text(
                        """
                        ALTER TABLE invoices
                        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
                        """
                    )
                )

            return

        if dialect == "sqlite":
            with engine.begin() as conn:
                result = conn.execute(text("PRAGMA table_info(invoices)"))
                columns = [row[1] for row in result.fetchall()]

                if "paid_at" not in columns:
                    conn.execute(
                        text("ALTER TABLE invoices ADD COLUMN paid_at DATETIME")
                    )

                if "payment_method" not in columns:
                    conn.execute(
                        text("ALTER TABLE invoices ADD COLUMN payment_method VARCHAR")
                    )

                if "payment_note" not in columns:
                    conn.execute(
                        text("ALTER TABLE invoices ADD COLUMN payment_note TEXT")
                    )

                if "created_at" not in columns:
                    conn.execute(
                        text("ALTER TABLE invoices ADD COLUMN created_at DATETIME")
                    )

            return

    except Exception as e:
        print("Error verificando columnas de invoices:", e)


def get_db():
    ensure_invoice_columns()

    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@router.get("/invoices")
def get_invoices(
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "cobrador",
        ])
    ),
):
    try:
        invoices = (
            db.query(Invoice)
            .order_by(Invoice.id.desc())
            .all()
        )

        return invoices

    except Exception as e:
        db.rollback()
        ensure_invoice_columns()

        invoices = (
            db.query(Invoice)
            .order_by(Invoice.id.desc())
            .all()
        )

        return invoices


@router.post("/invoices")
def create_invoice(
    invoice_data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "cobrador",
        ])
    ),
):
    invoice = Invoice(
        customer_id=invoice_data.customer_id,
        amount=invoice_data.amount,
        due_date=invoice_data.due_date,
        status="pending",
        created_at=datetime.now(),
    )

    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    return invoice


@router.put("/invoices/{invoice_id}/pay")
def pay_invoice(
    invoice_id: int,
    payment_data: Optional[InvoicePayRequest] = Body(default=None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "cobrador",
        ])
    ),
):
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id)
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Factura no encontrada",
        )

    if payment_data is None:
        payment_data = InvoicePayRequest()

    invoice.status = "paid"
    invoice.paid_at = datetime.now()
    invoice.payment_method = payment_data.payment_method or "Efectivo"
    invoice.payment_note = payment_data.payment_note or ""

    db.commit()
    db.refresh(invoice)

    return {
        "status": "ok",
        "message": "Factura marcada como pagada",
        "invoice": invoice,
    }