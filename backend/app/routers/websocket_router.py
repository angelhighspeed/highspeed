import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.customer_model import Customer
from app.models.plan_model import Plan
from app.models.invoice_model import Invoice
from app.models.ticket_model import Ticket

router = APIRouter()

def get_stats():
    db: Session = SessionLocal()

    try:
        invoices = db.query(Invoice).all()
        tickets = db.query(Ticket).all()

        pending_invoices = [i for i in invoices if i.status == "pending"]
        paid_invoices = [i for i in invoices if i.status == "paid"]

        open_tickets = [t for t in tickets if t.status == "open"]
        closed_tickets = [t for t in tickets if t.status == "closed"]

        return {
            "customers": db.query(Customer).count(),
            "plans": db.query(Plan).count(),
            "invoices": len(invoices),
            "pending_invoices": len(pending_invoices),
            "paid_invoices": len(paid_invoices),
            "total_pending_amount": sum(i.amount for i in pending_invoices),
            "total_paid_amount": sum(i.amount for i in paid_invoices),
            "open_tickets": len(open_tickets),
            "closed_tickets": len(closed_tickets),
        }

    finally:
        db.close()


@router.websocket("/ws/dashboard")
async def dashboard_websocket(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            await websocket.send_json(get_stats())
            await asyncio.sleep(5)

    except WebSocketDisconnect:
        pass