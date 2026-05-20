from sqlalchemy import Column, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
 
 
class ReceiptPickup(Base):
    __tablename__ = "receipt_pickups"
 
    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False)
    pickup_point_id = Column(Integer, ForeignKey("pickup_points.id", ondelete="CASCADE"), nullable=False)
    quantity_kg = Column(Float, nullable=False, default=0)
 
    # Relationships
    receipt = relationship("Receipt", back_populates="pickup_quantities")
    pickup_point = relationship("PickupPoint", backref="receipt_pickups")
 