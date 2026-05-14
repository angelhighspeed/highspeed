from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)

    # Datos de conexión
    pppoe_username = Column(String, nullable=True)
    pppoe_password = Column(String, nullable=True)
    remote_address = Column(String, nullable=True)
    local_address = Column(String, nullable=True)
    mac_cpe = Column(String, nullable=True)
    coordinates = Column(String, nullable=True)
    router_id = Column(Integer, ForeignKey("routers.id"), nullable=True)
    zone = Column(String, nullable=True)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=True)

    # Datos del cliente
    name = Column(String)
    last_name = Column(String, nullable=True)
    dni = Column(String, nullable=True)
    email = Column(String, nullable=True)
    external_id = Column(String, nullable=True)
    address = Column(String, nullable=True)
    locality = Column(String, nullable=True)
    city = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    contract_type = Column(String, nullable=True)

    # Configuración avanzada
    status = Column(String, default="active")
    notes = Column(String, nullable=True)

    # Facturación
    billing_type = Column(String, default="prepaid")
    invoice_day = Column(String, nullable=True)
    payment_day = Column(String, nullable=True)
    cut_day = Column(String, nullable=True)