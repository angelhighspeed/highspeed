from pydantic import BaseModel


class PlanCreate(BaseModel):
    name: str
    price: float
    speed: str | None = None

    profile: str | None = None
    download_speed: str | None = None
    upload_speed: str | None = None
    address_list: str | None = None
    dhcpv6_pd_pool: str | None = None
    internal_code: str | None = None
    description: str | None = None
    late_fee: float = 0

    reuse: str = "1:1"
    use_rules: bool = True

    limit_upload: str = "0"
    limit_download: str = "0"

    burst_limit_upload: str = "0"
    burst_limit_download: str = "0"

    burst_threshold_upload: str = "0"
    burst_threshold_download: str = "0"

    burst_time_upload: str = "10"
    burst_time_download: str = "10"

    queue_type_upload: str = "default-small"
    queue_type_download: str = "default-small"

    parent: str = "none"
    priority_download: str = "8"

    plan_type: str = "pppoe"


class PlanResponse(PlanCreate):
    id: int

    class Config:
        from_attributes = True