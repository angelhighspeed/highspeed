from pydantic import BaseModel

class InvoiceCreate(BaseModel):
    customer_id: int
    amount: float
    due_date: str

class InvoiceResponse(InvoiceCreate):
    id: int
    status: str

    class Config:
        from_attributes = True