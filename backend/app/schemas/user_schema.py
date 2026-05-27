from pydantic import BaseModel

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "admin"

class UserLogin(BaseModel):
    username: str
    password: str