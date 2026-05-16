from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine
from app.auth.dependencies import require_roles
from app.models.customer_model import Customer


router = APIRouter()


class TicketCreate(BaseModel):
    customer_id: int
    title: str
    description: str = ""
    priority: str = "medium"
    assigned_technician: str = ""
    category: str = ""


class TicketUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    assigned_technician: str | None = None
    category: str | None = None
    solution: str | None = None
    status: str | None = None


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def now_string():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_table_columns(table_name: str):
    dialect = engine.dialect.name

    with engine.begin() as conn:
        if dialect == "sqlite":
            rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
            return [row[1] for row in rows]

        rows = conn.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = :table_name
                """
            ),
            {"table_name": table_name},
        ).fetchall()

        return [row[0] for row in rows]


def ensure_ticket_columns():
    dialect = engine.dialect.name

    try:
        if dialect == "postgresql":
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS customer_id INTEGER"))
                conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS title VARCHAR"))
                conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS description TEXT"))
                conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'open'"))
                conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority VARCHAR DEFAULT 'medium'"))
                conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_technician VARCHAR"))
                conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category VARCHAR"))
                conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS solution TEXT"))
                conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS created_at VARCHAR"))
                conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS updated_at VARCHAR"))
                conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at VARCHAR"))
            return

        if dialect == "sqlite":
            columns = get_table_columns("tickets")

            alters = {
                "customer_id": "ALTER TABLE tickets ADD COLUMN customer_id INTEGER",
                "title": "ALTER TABLE tickets ADD COLUMN title VARCHAR",
                "description": "ALTER TABLE tickets ADD COLUMN description TEXT",
                "status": "ALTER TABLE tickets ADD COLUMN status VARCHAR DEFAULT 'open'",
                "priority": "ALTER TABLE tickets ADD COLUMN priority VARCHAR DEFAULT 'medium'",
                "assigned_technician": "ALTER TABLE tickets ADD COLUMN assigned_technician VARCHAR",
                "category": "ALTER TABLE tickets ADD COLUMN category VARCHAR",
                "solution": "ALTER TABLE tickets ADD COLUMN solution TEXT",
                "created_at": "ALTER TABLE tickets ADD COLUMN created_at VARCHAR",
                "updated_at": "ALTER TABLE tickets ADD COLUMN updated_at VARCHAR",
                "closed_at": "ALTER TABLE tickets ADD COLUMN closed_at VARCHAR",
            }

            with engine.begin() as conn:
                for column, statement in alters.items():
                    if column not in columns:
                        conn.execute(text(statement))
    except Exception as e:
        print("No se pudieron asegurar columnas de tickets:", e)


ensure_ticket_columns()


def get_first_attr(obj, names, default=None):
    if obj is None:
        return default

    for name in names:
        if hasattr(obj, name):
            value = getattr(obj, name)

            if value not in [None, ""]:
                return value

    return default


def serialize_customer(customer: Customer | None):
    if not customer:
        return {}

    return {
        "customer_name": f"{get_first_attr(customer, ['name', 'first_name', 'nombre'], '') or ''} {get_first_attr(customer, ['last_name', 'lastname', 'apellido'], '') or ''}".strip(),
        "customer_pppoe_username": get_first_attr(customer, ["pppoe_username", "username_pppoe", "username"], ""),
        "customer_ip": get_first_attr(customer, ["remote_address", "ip", "ip_address"], ""),
        "customer_phone": get_first_attr(customer, ["phone", "telefono", "cellphone", "mobile"], ""),
        "customer_zone": get_first_attr(customer, ["zone", "zona", "localidad"], ""),
        "customer_status": get_first_attr(customer, ["status", "estado", "state"], ""),
    }


def normalize_ticket(row, customer: Customer | None = None):
    item = dict(row)

    if not item.get("status"):
        item["status"] = "open"

    if not item.get("priority"):
        item["priority"] = "medium"

    if "assigned_technician" not in item:
        item["assigned_technician"] = ""

    if "category" not in item:
        item["category"] = ""

    if "solution" not in item:
        item["solution"] = ""

    item.update(serialize_customer(customer))

    return item


def get_ticket_or_404(db: Session, ticket_id: int):
    rows = db.execute(
        text("SELECT * FROM tickets WHERE id = :id"),
        {"id": ticket_id},
    ).mappings().all()

    if not rows:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")

    return dict(rows[0])


def update_ticket_status(db: Session, ticket_id: int, status: str):
    ticket = get_ticket_or_404(db, ticket_id)

    columns = get_table_columns("tickets")
    updates = {}
    updates["status"] = status

    if "updated_at" in columns:
        updates["updated_at"] = now_string()

    if status == "closed" and "closed_at" in columns:
        updates["closed_at"] = now_string()

    if status != "closed" and "closed_at" in columns:
        updates["closed_at"] = None

    valid_updates = {
        key: value
        for key, value in updates.items()
        if key in columns
    }

    set_clause = ", ".join([f"{key} = :{key}" for key in valid_updates.keys()])

    params = {"id": ticket_id, **valid_updates}

    db.execute(
        text(f"UPDATE tickets SET {set_clause} WHERE id = :id"),
        params,
    )

    db.commit()

    return get_ticket_or_404(db, ticket_id)


@router.get("/tickets")
def get_tickets(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico", "operador", "cobrador"])),
):
    ensure_ticket_columns()

    rows = db.execute(
        text("SELECT * FROM tickets ORDER BY id DESC")
    ).mappings().all()

    customer_ids = [
        row.get("customer_id")
        for row in rows
        if row.get("customer_id") is not None
    ]

    customers_by_id = {}

    if customer_ids:
        customers = (
            db.query(Customer)
            .filter(Customer.id.in_(customer_ids))
            .all()
        )

        customers_by_id = {
            customer.id: customer for customer in customers
        }

    return [
        normalize_ticket(row, customers_by_id.get(row.get("customer_id")))
        for row in rows
    ]


@router.post("/tickets")
def create_ticket(
    data: TicketCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico", "operador"])),
):
    ensure_ticket_columns()

    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if not data.title:
        raise HTTPException(status_code=400, detail="Ingresá el título del ticket")

    columns = get_table_columns("tickets")

    payload = {
        "customer_id": data.customer_id,
        "title": data.title,
        "description": data.description or "",
        "status": "open",
        "priority": data.priority or "medium",
        "assigned_technician": data.assigned_technician or "",
        "category": data.category or "",
        "solution": "",
        "created_at": now_string(),
        "updated_at": now_string(),
        "closed_at": None,
    }

    payload = {
        key: value
        for key, value in payload.items()
        if key in columns
    }

    keys = list(payload.keys())
    columns_sql = ", ".join(keys)
    values_sql = ", ".join([f":{key}" for key in keys])

    dialect = engine.dialect.name

    if dialect == "postgresql":
        result = db.execute(
            text(f"INSERT INTO tickets ({columns_sql}) VALUES ({values_sql}) RETURNING id"),
            payload,
        )

        ticket_id = result.scalar()

    else:
        result = db.execute(
            text(f"INSERT INTO tickets ({columns_sql}) VALUES ({values_sql})"),
            payload,
        )

        ticket_id = result.lastrowid

    db.commit()

    ticket = get_ticket_or_404(db, ticket_id)

    return {
        "status": "ok",
        "message": "Ticket creado correctamente.",
        "ticket": normalize_ticket(ticket, customer),
    }


@router.put("/tickets/{ticket_id}")
def update_ticket(
    ticket_id: int,
    data: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico", "operador"])),
):
    ensure_ticket_columns()
    get_ticket_or_404(db, ticket_id)

    columns = get_table_columns("tickets")

    payload = data.model_dump(exclude_unset=True)

    if "updated_at" in columns:
        payload["updated_at"] = now_string()

    valid_payload = {
        key: value
        for key, value in payload.items()
        if key in columns
    }

    if not valid_payload:
        return {
            "status": "ok",
            "message": "No hubo cambios para aplicar.",
            "ticket": get_ticket_or_404(db, ticket_id),
        }

    set_clause = ", ".join([f"{key} = :{key}" for key in valid_payload.keys()])

    db.execute(
        text(f"UPDATE tickets SET {set_clause} WHERE id = :id"),
        {"id": ticket_id, **valid_payload},
    )

    db.commit()

    ticket = get_ticket_or_404(db, ticket_id)
    customer = db.query(Customer).filter(Customer.id == ticket.get("customer_id")).first()

    return {
        "status": "ok",
        "message": "Ticket actualizado.",
        "ticket": normalize_ticket(ticket, customer),
    }


@router.put("/tickets/{ticket_id}/start")
def start_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico", "operador"])),
):
    ticket = update_ticket_status(db, ticket_id, "in_progress")
    customer = db.query(Customer).filter(Customer.id == ticket.get("customer_id")).first()

    return {
        "status": "ok",
        "message": "Ticket marcado en proceso.",
        "ticket": normalize_ticket(ticket, customer),
    }


@router.put("/tickets/{ticket_id}/close")
def close_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico", "operador"])),
):
    ticket = update_ticket_status(db, ticket_id, "closed")
    customer = db.query(Customer).filter(Customer.id == ticket.get("customer_id")).first()

    return {
        "status": "ok",
        "message": "Ticket cerrado.",
        "ticket": normalize_ticket(ticket, customer),
    }


@router.put("/tickets/{ticket_id}/reopen")
def reopen_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico", "operador"])),
):
    ticket = update_ticket_status(db, ticket_id, "open")
    customer = db.query(Customer).filter(Customer.id == ticket.get("customer_id")).first()

    return {
        "status": "ok",
        "message": "Ticket reabierto.",
        "ticket": normalize_ticket(ticket, customer),
    }
