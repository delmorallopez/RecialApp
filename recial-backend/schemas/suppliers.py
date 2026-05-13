from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum
from models.suppliers import SupplierType 


class SupplierBase(BaseModel):
    supplier_type: SupplierType
    name: str
    cif: Optional[str] = None
    address: Optional[str] = None
    pickup_point: Optional[str] = None
    is_active: Optional[bool] = True

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    supplier_type: Optional[SupplierType] = None
    name: Optional[str] = None
    cif: Optional[str] = None
    address: Optional[str] = None
    pickup_point: Optional[str] = None
    is_active: Optional[bool] = None

class SupplierResponse(SupplierBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class SupplierListResponse(BaseModel):
    total: int
    suppliers: list[SupplierResponse]