from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class Entrance(Base):
    __tablename__ = "entrances"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(20), unique=True, nullable=False)  # e.g. 010124A
    tank_id = Column(Integer, ForeignKey("tanks.id"), nullable=True)
    supplier_type = Column(String(1), nullable=False)           # A or B
    raw_material = Column(String(100), default="UCO")
    date = Column(Date, nullable=False)
    start_date = Column(Date, nullable=True)   # date of first receipt in batch
    finish_date = Column(Date, nullable=True)  # date of last receipt in batch
    quantity_kg = Column(Float, default=0)     # total kg (sum of receipts)
    value_gei = Column(Integer, default=1)     # greenhouse gas value, always 1
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tank = relationship("Tank", backref="entrances")
    # receipts relationship comes from Receipt.entrance backref