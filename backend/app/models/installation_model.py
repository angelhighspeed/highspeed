from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base

class Installation(Base):
    __tablename__ = "installations"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    technician = Column(String)
    scheduled_date = Column(String)
    address = Column(String)
    installation_type = Column(String)
    notes = Column(String)
    status = Column(String, default="pending")