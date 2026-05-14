from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    title = Column(String)
    description = Column(String)
    status = Column(String, default="open")