from pydantic import BaseModel

class RouterCreate(BaseModel):
    name: str
    host: str
    username: str
    password: str

    api_port: int = 8728
    www_port: int = 80

    lan_interface: str = "ether2"
    ip_ranges: str | None = None
    comments: str | None = None
    coordinates: str | None = None
    version: str | None = None
    zone: str = "General"

    cut_type: str = "pppoe"

    add_client_mikrotik: bool = True
    traffic_history: bool = True
    simple_queue_control: bool = True
    pppoe_control: bool = True
    hotspot_control: bool = False
    ipv6_enabled: bool = False

    billing_type: str = "prepaid"
    invoice_day: str = "25"
    payment_day: str = "1"
    reminder_day: str = "26"
    cut_day: str = "8"
    suspend_after_invoices: int = 1

    auto_cut: bool = True
    auto_invoice: bool = True
    auto_notifications: bool = False

class RouterResponse(RouterCreate):
    id: int

    class Config:
        from_attributes = True