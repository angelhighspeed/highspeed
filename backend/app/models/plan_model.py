from sqlalchemy import Column, Integer, String, Float, Boolean
from app.database import Base


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)

    # Configuración básica
    name = Column(String, index=True)
    price = Column(Float)
    speed = Column(String, nullable=True)

    profile = Column(String, nullable=True)
    download_speed = Column(String, nullable=True)
    upload_speed = Column(String, nullable=True)
    address_list = Column(String, nullable=True)
    dhcpv6_pd_pool = Column(String, nullable=True)
    internal_code = Column(String, nullable=True)
    description = Column(String, nullable=True)
    late_fee = Column(Float, default=0)

    # Configuración avanzada
    reuse = Column(String, default="1:1")
    use_rules = Column(Boolean, default=True)

    limit_upload = Column(String, default="0")
    limit_download = Column(String, default="0")

    burst_limit_upload = Column(String, default="0")
    burst_limit_download = Column(String, default="0")

    burst_threshold_upload = Column(String, default="0")
    burst_threshold_download = Column(String, default="0")

    burst_time_upload = Column(String, default="10")
    burst_time_download = Column(String, default="10")

    queue_type_upload = Column(String, default="default-small")
    queue_type_download = Column(String, default="default-small")

    parent = Column(String, default="none")
    priority_download = Column(String, default="8")

    plan_type = Column(String, default="pppoe")