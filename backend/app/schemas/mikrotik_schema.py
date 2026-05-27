from pydantic import BaseModel

class PPPoESecretCreate(BaseModel):
    name: str
    password: str
    service: str = "pppoe"
    profile: str = "default"
    remote_address: str | None = None