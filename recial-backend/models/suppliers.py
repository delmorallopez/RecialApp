from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum, Float 
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
import enum

class SupplierType(str, enum.Enum):
    HORECA = "Horeca"
    URBAN = "Urban"

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    supplier_type = Column(Enum(SupplierType), nullable=False)
    name = Column(String(100), nullable=False)
    cif = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    email = Column(String(120), nullable=True)
    phone = Column(String(30), nullable=True)
    city = Column(String(100), nullable=True)
    county = Column(String(100), nullable=True)
    contact_person = Column(String(120), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    pickup_point = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    pickup_points = relationship(
        "PickupPoint",
        cascade="all, delete-orphan",
        back_populates="supplier"
    )