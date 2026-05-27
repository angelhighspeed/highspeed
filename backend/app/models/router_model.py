from sqlalchemy import Column, Integer, String, Boolean
from app.database import Base

class Router(Base):
    __tablename__ = "routers"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String)
    host = Column(String)
    username = Column(String)
    password = Column(String)

    api_port = Column(Integer, default=8728)
    www_port = Column(Integer, default=80)

    lan_interface = Column(String, default="ether2")
    ip_ranges = Column(String, nullable=True)
    comments = Column(String, nullable=True)
    coordinates = Column(String, nullable=True)
    version = Column(String, nullable=True)
    zone = Column(String, default="General")

    cut_type = Column(String, default="pppoe")

    add_client_mikrotik = Column(Boolean, default=True)
    traffic_history = Column(Boolean, default=True)
    simple_queue_control = Column(Boolean, default=True)
    pppoe_control = Column(Boolean, default=True)
    hotspot_control = Column(Boolean, default=False)
    ipv6_enabled = Column(Boolean, default=False)

    billing_type = Column(String, default="prepaid")
    invoice_day = Column(String, default="25")
    payment_day = Column(String, default="1")
    reminder_day = Column(String, default="26")
    cut_day = Column(String, default="8")
    suspend_after_invoices = Column(Integer, default=1)

    auto_cut = Column(Boolean, default=True)
    auto_invoice = Column(Boolean, default=True)
    auto_notifications = Column(Boolean, default=False)