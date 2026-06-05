from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id          = Column(Integer, primary_key=True, index=True)
    dispatch_id = Column(Integer, ForeignKey("dispatches.id"), nullable=False)
    invoice_number = Column(String(20), nullable=True)  # e.g. A 03/26
    price_per_kg   = Column(Float, nullable=False)
    base_amount    = Column(Float, nullable=False)       # quantity * price
    iva_pct        = Column(Float, default=21.0)
    iva_amount     = Column(Float, nullable=False)
    total_amount   = Column(Float, nullable=False)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    dispatch = relationship("Dispatch", backref="invoices")