from sqlalchemy import Column, Integer, Float, String, DateTime, Text
from datetime import datetime

from app.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)

    customer_id = Column(Integer, nullable=False, index=True)

    amount = Column(Float, nullable=False, default=0)

    due_date = Column(String, nullable=True)

    status = Column(String, nullable=False, default="pending")

    paid_at = Column(DateTime, nullable=True)
    payment_method = Column(String, nullable=True)
    payment_note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=True)