from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime

from app.database import Base


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)

    customer_id = Column(Integer, nullable=False, index=True)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    status = Column(String, nullable=False, default="open")
    priority = Column(String, nullable=False, default="medium")

    assigned_technician = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)