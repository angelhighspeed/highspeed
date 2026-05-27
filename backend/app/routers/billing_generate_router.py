from datetime import date, datetime
from calendar import monthrange

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.auth.dependencies import require_roles

from app.models.customer_model import Customer
from app.models.plan_model import Plan
from app.models.invoice_model import Invoice


router = APIRouter()


class GenerateMonthlyBillingRequest(BaseModel):
    year: int | None = None
    month: int | None = None
    due_day: int = 10


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def safe_number(value):
    try:
        if value is None:
            return 0

        return float(value)
    except Exception:
        return 0


def parse_invoice_date(value):
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


def already_has_invoice_for_month(db: Session, customer_id: int, year: int, month: int):
    invoices = (
        db.query(Invoice)
        .filter(Invoice.customer_id == customer_id)
        .all()
    )

    for invoice in invoices:
        due_date = parse_invoice_date(invoice.due_date)

        if not due_date:
            continue

        if due_date.year == year and due_date.month == month:
            return True

    return False


@router.post("/billing/generate-monthly")
def generate_monthly_billing(
    data: GenerateMonthlyBillingRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "cobrador",
        ])
    ),
):
    today = date.today()

    year = data.year or today.year
    month = data.month or today.month

    last_day = monthrange(year, month)[1]
    due_day = min(max(data.due_day, 1), last_day)

    due_date = date(year, month, due_day)

    customers = (
        db.query(Customer)
        .filter(Customer.status == "active")
        .all()
    )

    created = 0
    skipped_without_plan = 0
    skipped_without_price = 0
    skipped_existing = 0
    errors = []

    for customer in customers:
        try:
            if not customer.plan_id:
                skipped_without_plan += 1
                continue

            plan = (
                db.query(Plan)
                .filter(Plan.id == customer.plan_id)
                .first()
            )

            if not plan:
                skipped_without_plan += 1
                continue

            amount = safe_number(getattr(plan, "price", 0))

            if amount <= 0:
                skipped_without_price += 1
                continue

            if already_has_invoice_for_month(
                db,
                customer.id,
                year,
                month,
            ):
                skipped_existing += 1
                continue

            invoice = Invoice(
                customer_id=customer.id,
                amount=amount,
                due_date=due_date,
                status="pending",
            )

            db.add(invoice)
            created += 1

        except Exception as e:
            errors.append({
                "customer_id": customer.id,
                "pppoe_username": customer.pppoe_username,
                "error": str(e),
            })

    db.commit()

    return {
        "status": "ok",
        "message": "Facturación mensual generada",
        "year": year,
        "month": month,
        "due_date": str(due_date),
        "active_customers": len(customers),
        "created": created,
        "skipped_existing": skipped_existing,
        "skipped_without_plan": skipped_without_plan,
        "skipped_without_price": skipped_without_price,
        "errors": errors,
    }