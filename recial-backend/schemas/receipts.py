from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date as date_type, datetime


# ── Pickup point quantity (nested in receipt) ────────────────
class ReceiptPickupCreate(BaseModel):
    pickup_point_id: int
    quantity_kg: float


class PickupPointInfo(BaseModel):
    id: int
    name: str
    address: Optional[str] = None

    class Config:
        from_attributes = True


class ReceiptPickupResponse(BaseModel):
    id: int
    pickup_point_id: int
    quantity_kg: float
    pickup_point: Optional[PickupPointInfo] = None

    class Config:
        from_attributes = True


# ── Supplier info (nested in receipt) ───────────────────────
class SupplierInfo(BaseModel):
    id: int
    name: str
    supplier_type: str

    class Config:
        from_attributes = True


# ── Receipt schemas ──────────────────────────────────────────
class ReceiptCreate(BaseModel):
    supplier_id: int
    driver_id: Optional[int] = None
    raw_material: Optional[str] = "UCO"
    date: date_type
    quantity_kg: float
    notes: Optional[str] = None
    # Pickup point quantities — optional, used when supplier has pickup points
    pickup_quantities: Optional[list[ReceiptPickupCreate]] = []


class ReceiptUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    supplier_id: Optional[int] = None
    driver_id: Optional[int] = None
    raw_material: Optional[str] = None
    date: Optional[date_type] = None
    quantity_kg: Optional[float] = None
    notes: Optional[str] = None
    # When updating, replace all pickup quantities
    pickup_quantities: Optional[list[ReceiptPickupCreate]] = None


class ReceiptResponse(BaseModel):
    id: int
    receipt_code: Optional[str] = None
    supplier_id: Optional[int] = None
    driver_id: Optional[int] = None
    raw_material: Optional[str] = None
    date: Optional[date_type] = None
    quantity_kg: Optional[float] = None
    notes: Optional[str] = None
    entrance_id: Optional[int] = None
    supplier: Optional[SupplierInfo] = None
    pickup_quantities: list[ReceiptPickupResponse] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReceiptListResponse(BaseModel):
    total: int
    receipts: list[ReceiptResponse]
