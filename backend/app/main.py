import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import Base, engine, SessionLocal

# Importar modelos para que SQLAlchemy los registre
from app.models.customer_model import Customer
from app.models.plan_model import Plan
from app.models.invoice_model import Invoice
from app.models.ticket_model import Ticket
from app.models.installation_model import Installation
from app.models.router_model import Router

# Routers
from app.routers.auth_router import router as auth_router

from app.routers.customer_actions_router import router as customer_actions_router
from app.routers.customer_router import router as customer_router
from app.routers.customer_payment_history_router import (
    router as customer_payment_history_router,
)
from app.routers.customer_finance_router import router as customer_finance_router

from app.routers.plan_router import router as plan_router

from app.routers.invoice_router import router as invoice_router
from app.routers.invoice_export_router import router as invoice_export_router
from app.routers.invoice_pdf_router import router as invoice_pdf_router
from app.routers.invoice_receipt_router import router as invoice_receipt_router

from app.routers.cashbox_router import router as cashbox_router
from app.routers.company_settings_router import router as company_settings_router
from app.routers.user_management_router import router as user_management_router

from app.routers.ticket_router import router as ticket_router
from app.routers.installation_router import router as installation_router
from app.routers.router_router import router as router_router
from app.routers.mikrotik_router import router as mikrotik_router

from app.routers.billing_router import router as billing_router
from app.routers.billing_generate_router import router as billing_generate_router

from app.routers.dashboard_router import router as dashboard_router
from app.routers.dashboard_clients_router import router as dashboard_clients_router


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="HighSpeed ISP CRM",
    version="0.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(dashboard_clients_router)
app.include_router(router_router)

app.include_router(billing_router)
app.include_router(billing_generate_router)

app.include_router(installation_router)

# IMPORTANTE:
# customer_actions_router va antes que customer_router para que funcionen:
# /customers/list-all
# /customers/{id}/activate
# /customers/{id}/suspend
# /customers/{id}/delete
app.include_router(customer_actions_router)
app.include_router(customer_payment_history_router)
app.include_router(customer_finance_router)
app.include_router(customer_router)

app.include_router(plan_router)

app.include_router(invoice_router)
app.include_router(invoice_export_router)
app.include_router(invoice_pdf_router)
app.include_router(invoice_receipt_router)

app.include_router(cashbox_router)
app.include_router(company_settings_router)
app.include_router(user_management_router)

app.include_router(auth_router)
app.include_router(mikrotik_router)
app.include_router(dashboard_router)
app.include_router(ticket_router)


def get_dashboard_stats_for_ws(db: Session):
    invoices = db.query(Invoice).all()

    pending_invoices = [
        invoice for invoice in invoices
        if invoice.status == "pending"
    ]

    paid_invoices = [
        invoice for invoice in invoices
        if invoice.status == "paid"
    ]

    total_pending_amount = sum(
        float(invoice.amount or 0)
        for invoice in pending_invoices
    )

    total_paid_amount = sum(
        float(invoice.amount or 0)
        for invoice in paid_invoices
    )

    return {
        "invoices": len(invoices),
        "pending_invoices": len(pending_invoices),
        "paid_invoices": len(paid_invoices),
        "total_pending_amount": total_pending_amount,
        "total_paid_amount": total_paid_amount,
    }


@app.websocket("/ws/dashboard")
async def dashboard_websocket(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            db = SessionLocal()

            try:
                stats = get_dashboard_stats_for_ws(db)
                await websocket.send_json(stats)

            finally:
                db.close()

            await asyncio.sleep(5)

    except WebSocketDisconnect:
        pass


@app.get("/")
def root():
    return {
        "message": "HighSpeed ISP CRM API funcionando",
        "status": "ok",
    }
