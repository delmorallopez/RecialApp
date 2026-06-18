from sqlalchemy import Column, Integer, Float, String, Date, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, backref
from database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id             = Column(Integer, primary_key=True, index=True)
    dispatch_id    = Column(Integer, ForeignKey("dispatches.id"), unique=True, nullable=False)
    invoice_number = Column(String(30), nullable=True)   # e.g. SA050626
    price_per_kg   = Column(Float, nullable=False, default=1.09)
    quantity_kg    = Column(Float, nullable=True)         # override if needed
    base_amount    = Column(Float, nullable=False)
    iva_pct        = Column(Float, default=21.0)
    iva_amount     = Column(Float, nullable=False)
    total_amount   = Column(Float, nullable=False)
    invoice_date   = Column(Date, nullable=True)         # override dispatch date
    notes          = Column(String(500), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())

    dispatch = relationship("Dispatch", backref=backref("invoice", uselist=False, cascade="all, delete-orphan"))