from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class DisposalCreate(BaseModel):
    date: date
    quantity: int
    notes: Optional[str] = None


class DisposalResponse(BaseModel):
    id: int
    date: date
    quantity: int
    notes: Optional[str] = None
    class Config:
        from_attributes = True


class CustomerInfo(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True


class TankInfo(BaseModel):
    id: int
    name: str
    stock: Optional[int] = 0
    class Config:
        from_attributes = True


class EntranceInfo(BaseModel):
    id: int
    batch_id: str
    quantity_kg: Optional[float] = 0
    class Config:
        from_attributes = True


class DispatchBase(BaseModel):
    post_number: Optional[int] = None
    customer_id: int
    tank_id: Optional[int] = None
    date: date
    raw_material: Optional[str] = "UCO"
    value_gei: Optional[int] = 1
    quantity: int


class DispatchCreate(DispatchBase):
    customer_id: int    # required
    date: date          # required
    quantity: int       # required
    entrance_ids: list[int] = []          # entrance batches to link
    disposal: Optional[DisposalCreate] = None  # optional disposal record


class DispatchUpdate(BaseModel):
    post_number: Optional[int] = None
    customer_id: Optional[int] = None
    tank_id: Optional[int] = None
    date: Optional[date] = None
    raw_material: Optional[str] = None
    value_gei: Optional[int] = None
    quantity: Optional[int] = None


class DispatchResponse(DispatchBase):
    id: int
    batch_id: str
    customer: Optional[CustomerInfo] = None
    tank: Optional[TankInfo] = None
    entrances: list[EntranceInfo] = []
    disposal: Optional[DisposalResponse] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DispatchListResponse(BaseModel):
    total: int
    dispatches: list[DispatchResponse]