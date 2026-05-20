from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PickupPointBase(BaseModel):
    name: str
    address: Optional[str] = None
    is_active: Optional[bool] = True


class PickupPointCreate(PickupPointBase):
    supplier_id: int


class PickupPointUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None


class PickupPointResponse(PickupPointBase):
    id: int
    supplier_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PickupPointListResponse(BaseModel):
    total: int
    pickup_points: list[PickupPointResponse]