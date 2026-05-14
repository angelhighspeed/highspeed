from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer

from app.database import Base, engine

# MODELOS
from app.models.router_model import Router
from app.models.installation_model import Installation
from app.models.customer_model import Customer
from app.models.plan_model import Plan
from app.models.invoice_model import Invoice
from app.models.user_model import User
from app.models.ticket_model import Ticket

# ROUTERS
from app.routers.router_router import router as router_router
from app.routers.billing_router import router as billing_router
from app.routers.installation_router import router as installation_router
from app.routers.customer_router import router as customer_router
from app.routers.plan_router import router as plan_router
from app.routers.dashboard_clients_router import router as dashboard_clients_router
from app.routers.invoice_router import router as invoice_router
from app.routers.auth_router import router as auth_router
from app.routers.mikrotik_router import router as mikrotik_router
from app.routers.dashboard_router import router as dashboard_router
from app.routers.ticket_router import router as ticket_router
from app.routers.websocket_router import router as websocket_router

security = HTTPBearer()

app = FastAPI(
    title="HighSpeed ISP CRM",
    swagger_ui_parameters={"persistAuthorization": True}
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CREAR TABLAS
Base.metadata.create_all(bind=engine)

# ROUTERS
app.include_router(dashboard_clients_router)
app.include_router(router_router)
app.include_router(billing_router)
app.include_router(installation_router)
app.include_router(customer_router)
app.include_router(plan_router)
app.include_router(invoice_router)
app.include_router(auth_router)
app.include_router(mikrotik_router)
app.include_router(dashboard_router)
app.include_router(ticket_router)
app.include_router(websocket_router)

@app.get("/")
def root():
    return {"status": "online"}