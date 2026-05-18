from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    receipt_code = Column(String(10), unique=True, nullable=True)  # e.g. 001A or 002B
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    driver_id = Column(Integer, nullable=True)
    raw_material = Column(String(100), default="UCO")
    date = Column(Date, nullable=False)
    pickup_point = Column(String(200), nullable=True)
    quantity_kg = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    entrance_id = Column(Integer, ForeignKey("entrances.id"), nullable=True)  # locked when assigned
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    supplier = relationship("Supplier", backref="receipts")
    entrance = relationship("Entrance", backref="receipts")