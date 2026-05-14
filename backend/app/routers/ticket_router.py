from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.ticket_model import Ticket
from app.schemas.ticket_schema import TicketCreate, TicketResponse
from app.auth.dependencies import require_roles

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/tickets", response_model=list[TicketResponse])
def get_tickets(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico", "operador"]))
):
    return db.query(Ticket).all()

@router.post("/tickets", response_model=TicketResponse)
def create_ticket(
    ticket: TicketCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico", "operador"]))
):
    new_ticket = Ticket(
        customer_id=ticket.customer_id,
        title=ticket.title,
        description=ticket.description,
        status="open"
    )

    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    return new_ticket

@router.put("/tickets/{ticket_id}/close", response_model=TicketResponse)
def close_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico"]))
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        return {"error": "Ticket no encontrado"}

    ticket.status = "closed"

    db.commit()
    db.refresh(ticket)

    return ticket