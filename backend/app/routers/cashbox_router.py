from datetime import datetime, date, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.auth.dependencies import require_roles
from app.models.invoice_model import Invoice
from app.models.customer_model import Customer


router = APIRouter()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def parse_report_date(value: Optional[str]):
    if not value:
        return date.today()

    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except Exception:
        return date.today()


def format_datetime(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")

    return str(value)


@router.get("/cashbox/daily")
def get_daily_cashbox(
    report_date: Optional[str] = Query(
        default=None,
        description="Fecha en formato YYYY-MM-DD. Si no se envía, usa hoy.",
    ),
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "cobrador",
        ])
    ),
):
    selected_date = parse_report_date(report_date)

    start_datetime = datetime.combine(selected_date, time.min)
    end_datetime = datetime.combine(selected_date + timedelta(days=1), time.min)

    invoices = (
        db.query(Invoice)
        .filter(Invoice.status == "paid")
        .filter(Invoice.paid_at >= start_datetime)
        .filter(Invoice.paid_at < end_datetime)
        .order_by(Invoice.paid_at.desc())
        .all()
    )

    customer_ids = list({
        invoice.customer_id
        for invoice in invoices
        if invoice.customer_id
    })

    customers = (
        db.query(Customer)
        .filter(Customer.id.in_(customer_ids))
        .all()
        if customer_ids
        else []
    )

    customers_by_id = {
        customer.id: customer
        for customer in customers
    }

    total_amount = 0
    total_payments = 0

    by_method = {}

    payments = []

    for invoice in invoices:
        customer = customers_by_id.get(invoice.customer_id)

        amount = float(invoice.amount or 0)
        method = invoice.payment_method or "Sin método"

        total_amount += amount
        total_payments += 1

        if method not in by_method:
            by_method[method] = {
                "payment_method": method,
                "count": 0,
                "total": 0,
            }

        by_method[method]["count"] += 1
        by_method[method]["total"] += amount

        customer_name = f"Cliente ID {invoice.customer_id}"

        if customer:
            customer_name = f"{customer.name or ''} {customer.last_name or ''}".strip()

        payments.append({
            "invoice_id": invoice.id,
            "customer_id": invoice.customer_id,
            "customer_name": customer_name,
            "pppoe_username": customer.pppoe_username if customer else None,
            "ip": customer.remote_address if customer else None,
            "phone": customer.phone if customer else None,
            "zone": customer.zone if customer else None,
            "amount": amount,
            "payment_method": method,
            "payment_note": invoice.payment_note or "",
            "paid_at": format_datetime(invoice.paid_at),
        })

    return {
        "status": "ok",
        "date": str(selected_date),
        "total_payments": total_payments,
        "total_amount": total_amount,
        "by_method": list(by_method.values()),
        "payments": payments,
    }