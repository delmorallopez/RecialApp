from pydantic import BaseModel
from typing import Optional
from datetime import date as date_type, datetime 
from models.users import User, UserRole

# ── Schemas ──────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


class UserCreate(BaseModel):
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: str
    role: UserRole = UserRole.DRIVER


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: UserRole
    is_active: bool

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None