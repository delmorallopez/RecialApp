from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class PickupPoint(Base):
    __tablename__ = "pickup_points"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    name = Column(String(150), nullable=False)
    address = Column(String(200), nullable=True)
    latitude = Column(Float, nullable=True)   # ← ADD
    longitude = Column(Float, nullable=True)  # ← ADD
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    supplier = relationship("Supplier", backref="pickup_points")