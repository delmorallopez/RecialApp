from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class ReceiptBase(BaseModel):
    supplier_id: int
    driver_id: Optional[int] = None
    raw_material: Optional[str] = "UCO"
    date: date
    pickup_point: Optional[str] = None
    quantity_kg: float
    notes: Optional[str] = None


class ReceiptCreate(ReceiptBase):
    supplier_id: int   # required
    date: date         # required
    quantity_kg: float # required


class ReceiptUpdate(BaseModel):
    supplier_id: Optional[int] = None
    driver_id: Optional[int] = None
    raw_material: Optional[str] = None
    date: Optional[date] = None
    pickup_point: Optional[str] = None
    quantity_kg: Optional[float] = None
    notes: Optional[str] = None


class SupplierInfo(BaseModel):
    id: int
    name: str
    supplier_type: str  
    class Config:
        from_attributes = True


class ReceiptResponse(ReceiptBase):
    id: int
    receipt_code: Optional[str] = None
    entrance_id: Optional[int] = None    # ← add this if missing
    supplier: Optional[SupplierInfo] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
class ReceiptListResponse(BaseModel):
    total: int
    receipts: list[ReceiptResponse]