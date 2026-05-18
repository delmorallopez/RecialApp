from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class EntranceBase(BaseModel):
    batch_id: str
    tank_id: Optional[int] = None
    supplier_type: str        # "A" or "B"
    raw_material: Optional[str] = "UCO"
    date: date
    start_date: Optional[date] = None
    finish_date: Optional[date] = None
    quantity_kg: Optional[float] = 0
    value_gei: Optional[int] = 1


class EntranceCreate(BaseModel):
    tank_id: Optional[int] = None
    supplier_type: str        # "A" or "B"
    date: date
    receipt_ids: list[int]    # list of receipt IDs to include in this batch


class EntranceUpdate(BaseModel):
    tank_id: Optional[int] = None
    date: Optional[date] = None
    raw_material: Optional[str] = None
    value_gei: Optional[int] = None


class ReceiptInfo(BaseModel):
    id: int
    receipt_code: Optional[str] = None
    quantity_kg: float
    date: date
    class Config:
        from_attributes = True


class TankInfo(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True


class EntranceResponse(EntranceBase):
    id: int
    receipts: list[ReceiptInfo] = []
    tank: Optional[TankInfo] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


class EntranceListResponse(BaseModel):
    total: int
    entrances: list[EntranceResponse]