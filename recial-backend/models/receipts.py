from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    driver_id = Column(Integer, nullable=True)       # will link to drivers table later
    raw_material = Column(String(100), default="UCO") # UCO = Used Cooking Oil
    date = Column(Date, nullable=False)
    pickup_point = Column(String(200), nullable=True)
    quantity_kg = Column(Float, nullable=False)       # quantity in kilograms
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship — links to Supplier object
    supplier = relationship("Supplier", backref="receipts")