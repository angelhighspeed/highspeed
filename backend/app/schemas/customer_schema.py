from pydantic import BaseModel

class CustomerCreate(BaseModel):
    pppoe_username: str | None = None
    pppoe_password: str | None = None
    remote_address: str | None = None
    local_address: str | None = None
    mac_cpe: str | None = None
    coordinates: str | None = None
    router_id: int | None = None
    zone: str | None = None
    plan_id: int | None = None

    name: str
    last_name: str | None = None
    dni: str | None = None
    email: str | None = None
    external_id: str | None = None
    address: str | None = None
    locality: str | None = None
    city: str | None = None
    postal_code: str | None = None
    phone: str | None = None
    contract_type: str | None = None

    status: str = "active"
    notes: str | None = None

    billing_type: str = "prepaid"
    invoice_day: str | None = None
    payment_day: str | None = None
    cut_day: str | None = None


class CustomerResponse(CustomerCreate):
    id: int

    class Config:
        from_attributes = True