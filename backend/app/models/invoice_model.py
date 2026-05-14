from sqlalchemy import Column, Integer, Float, String, ForeignKey
from app.database import Base

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    amount = Column(Float)
    status = Column(String, default="pending")
    due_date = Column(String)