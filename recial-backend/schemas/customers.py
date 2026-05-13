from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# --- Base (shared fields) ---
class CustomerBase(BaseModel):
    cif: Optional[str] = None
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "Spain"
    is_active: Optional[bool] = True
    notes: Optional[str] = None


# --- Create (what the frontend sends) ---
class CustomerCreate(CustomerBase):
    name: str  # required


# --- Update (all fields optional for PATCH) ---
class CustomerUpdate(BaseModel):
    cif: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


# --- Response (what the API returns) ---
class CustomerResponse(CustomerBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # replaces orm_mode in Pydantic v2


# --- List response with pagination info ---
class CustomerListResponse(BaseModel):
    total: int
    customers: list[CustomerResponse]
