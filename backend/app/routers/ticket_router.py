from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine
from app.auth.dependencies import require_roles
from app.models.ticket_model import Ticket
from app.models.customer_model import Customer


router = APIRouter()


class TicketCreate(BaseModel):
    customer_id: int
    title: str
    description: Optional[str] = ""
    priority: Optional[str] = "medium"
    assigned_technician: Optional[str] = ""


class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_technician: Optional[str] = None


def ensure_ticket_columns():
    dialect = engine.dialect.name

    try:
        if dialect == "postgresql":
            with engine.begin() as conn:
                conn.execute(
                    text(
                        """
                        ALTER TABLE tickets
                        ADD COLUMN IF NOT EXISTS priority VARCHAR DEFAULT 'medium'
                        """
                    )
                )

                conn.execute(
                    text(
                        """
                        ALTER TABLE tickets
                        ADD COLUMN IF NOT EXISTS assigned_technician VARCHAR
                        """
                    )
                )

                conn.execute(
                    text(
                        """
                        ALTER TABLE tickets
                        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
                        """
                    )
                )

                conn.execute(
                    text(
                        """
                        ALTER TABLE tickets
                        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
                        """
                    )
                )

                conn.execute(
                    text(
                        """
                        ALTER TABLE tickets
                        ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP
                        """
                    )
                )

            return

        if dialect == "sqlite":
            with engine.begin() as conn:
                result = conn.execute(text("PRAGMA table_info(tickets)"))
                columns = [row[1] for row in result.fetchall()]

                if "priority" not in columns:
                    conn.execute(
                        text(
                            "ALTER TABLE tickets ADD COLUMN priority VARCHAR DEFAULT 'medium'"
                        )
                    )

                if "assigned_technician" not in columns:
                    conn.execute(
                        text(
                            "ALTER TABLE tickets ADD COLUMN assigned_technician VARCHAR"
                        )
                    )

                if "created_at" not in columns:
                    conn.execute(
                        text("ALTER TABLE tickets ADD COLUMN created_at DATETIME")
                    )

                if "updated_at" not in columns:
                    conn.execute(
                        text("ALTER TABLE tickets ADD COLUMN updated_at DATETIME")
                    )

                if "closed_at" not in columns:
                    conn.execute(
                        text("ALTER TABLE tickets ADD COLUMN closed_at DATETIME")
                    )

            return

    except Exception as e:
        print("Error verificando columnas de tickets:", e)


def get_db():
    ensure_ticket_columns()

    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def normalize_priority(priority: Optional[str]):
    value = (priority or "medium").strip().lower()

    allowed = {
        "low",
        "medium",
        "high",
        "baja",
        "media",
        "alta",
    }

    if value not in allowed:
        return "medium"

    if value == "baja":
        return "low"

    if value == "media":
        return "medium"

    if value == "alta":
        return "high"

    return value


def normalize_status(status: Optional[str]):
    value = (status or "open").strip().lower()

    allowed = {
        "open",
        "in_progress",
        "closed",
        "abierto",
        "en_proceso",
        "cerrado",
    }

    if value not in allowed:
        return "open"

    if value == "abierto":
        return "open"

    if value == "en_proceso":
        return "in_progress"

    if value == "cerrado":
        return "closed"

    return value


def format_datetime(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")

    return str(value)


def serialize_ticket(ticket: Ticket, customer: Optional[Customer] = None):
    customer_name = None

    if customer:
        customer_name = f"{customer.name or ''} {customer.last_name or ''}".strip()

    return {
        "id": ticket.id,
        "customer_id": ticket.customer_id,
        "customer_name": customer_name,
        "customer_pppoe_username": customer.pppoe_username if customer else None,
        "customer_ip": customer.remote_address if customer else None,
        "customer_phone": customer.phone if customer else None,
        "customer_zone": customer.zone if customer else None,

        "title": ticket.title,
        "description": ticket.description,
        "status": ticket.status,
        "priority": ticket.priority,
        "assigned_technician": ticket.assigned_technician,

        "created_at": format_datetime(ticket.created_at),
        "updated_at": format_datetime(ticket.updated_at),
        "closed_at": format_datetime(ticket.closed_at),
    }


@router.get("/tickets")
def get_tickets(
    status: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "tecnico",
            "operador",
        ])
    ),
):
    query = db.query(Ticket)

    if status:
        query = query.filter(Ticket.status == normalize_status(status))

    if priority:
        query = query.filter(Ticket.priority == normalize_priority(priority))

    tickets = (
        query
        .order_by(Ticket.id.desc())
        .all()
    )

    customer_ids = list({
        ticket.customer_id
        for ticket in tickets
        if ticket.customer_id
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

    return [
        serialize_ticket(
            ticket,
            customers_by_id.get(ticket.customer_id),
        )
        for ticket in tickets
    ]


@router.post("/tickets")
def create_ticket(
    ticket_data: TicketCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "tecnico",
            "operador",
        ])
    ),
):
    customer = (
        db.query(Customer)
        .filter(Customer.id == ticket_data.customer_id)
        .first()
    )

    if not customer:
        raise HTTPException(
            status_code=404,
            detail="Cliente no encontrado",
        )

    ticket = Ticket(
        customer_id=ticket_data.customer_id,
        title=ticket_data.title,
        description=ticket_data.description or "",
        status="open",
        priority=normalize_priority(ticket_data.priority),
        assigned_technician=ticket_data.assigned_technician or "",
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    return serialize_ticket(ticket, customer)


@router.put("/tickets/{ticket_id}")
def update_ticket(
    ticket_id: int,
    ticket_data: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "tecnico",
            "operador",
        ])
    ),
):
    ticket = (
        db.query(Ticket)
        .filter(Ticket.id == ticket_id)
        .first()
    )

    if not ticket:
        raise HTTPException(
            status_code=404,
            detail="Ticket no encontrado",
        )

    if ticket_data.title is not None:
        ticket.title = ticket_data.title

    if ticket_data.description is not None:
        ticket.description = ticket_data.description

    if ticket_data.priority is not None:
        ticket.priority = normalize_priority(ticket_data.priority)

    if ticket_data.assigned_technician is not None:
        ticket.assigned_technician = ticket_data.assigned_technician

    if ticket_data.status is not None:
        new_status = normalize_status(ticket_data.status)
        ticket.status = new_status

        if new_status == "closed":
            ticket.closed_at = datetime.now()
        else:
            ticket.closed_at = None

    ticket.updated_at = datetime.now()

    db.commit()
    db.refresh(ticket)

    customer = (
        db.query(Customer)
        .filter(Customer.id == ticket.customer_id)
        .first()
    )

    return serialize_ticket(ticket, customer)


@router.put("/tickets/{ticket_id}/start")
def start_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "tecnico",
        ])
    ),
):
    ticket = (
        db.query(Ticket)
        .filter(Ticket.id == ticket_id)
        .first()
    )

    if not ticket:
        raise HTTPException(
            status_code=404,
            detail="Ticket no encontrado",
        )

    ticket.status = "in_progress"
    ticket.updated_at = datetime.now()
    ticket.closed_at = None

    db.commit()
    db.refresh(ticket)

    customer = (
        db.query(Customer)
        .filter(Customer.id == ticket.customer_id)
        .first()
    )

    return serialize_ticket(ticket, customer)


@router.put("/tickets/{ticket_id}/close")
def close_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "tecnico",
        ])
    ),
):
    ticket = (
        db.query(Ticket)
        .filter(Ticket.id == ticket_id)
        .first()
    )

    if not ticket:
        raise HTTPException(
            status_code=404,
            detail="Ticket no encontrado",
        )

    ticket.status = "closed"
    ticket.updated_at = datetime.now()
    ticket.closed_at = datetime.now()

    db.commit()
    db.refresh(ticket)

    customer = (
        db.query(Customer)
        .filter(Customer.id == ticket.customer_id)
        .first()
    )

    return serialize_ticket(ticket, customer)