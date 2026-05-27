from pydantic import BaseModel

class TicketCreate(BaseModel):
    customer_id: int
    title: str
    description: str

class TicketResponse(TicketCreate):
    id: int
    status: str

    class Config:
        from_attributes = True