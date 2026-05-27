from pydantic import BaseModel

class InstallationCreate(BaseModel):
    customer_id: int
    technician: str
    scheduled_date: str
    address: str
    installation_type: str
    notes: str

class InstallationResponse(InstallationCreate):
    id: int
    status: str

    class Config:
        from_attributes = True