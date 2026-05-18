from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TankBase(BaseModel):
    name: str
    capacity: Optional[int] = None
    is_active: Optional[bool] = True


class TankCreate(TankBase):
    name: str


class TankUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None


class TankResponse(TankBase):
    id: int
    stock: Optional[int] = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TankListResponse(BaseModel):
    total: int
    tanks: list[TankResponse]