# models/document.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


DOC_TYPES = [
    "transport_documentation",
    "waste_identification",
    "purchase_order",
    "identification_document",
    "purchase_offer_contract",
    "sustainability_declaration",
    "analysis", 
]

DOC_LABELS = {
    "transport_documentation":  "Transport Documentation",
    "waste_identification":     "Waste Identification",
    "purchase_order":           "Purchase Order",
    "identification_document":  "Identification Document",
    "purchase_offer_contract":  "Purchase Offer and Contract",
    "sustainability_declaration": "Sustainability Declaration",
    "analysis":                   "Analysis",   
}


class DispatchDocument(Base):
    __tablename__ = "dispatch_documents"

    id          = Column(Integer, primary_key=True, index=True)
    dispatch_id = Column(Integer, ForeignKey("dispatches.id", ondelete="CASCADE"), nullable=False, index=True)
    doc_type    = Column(String(50), nullable=False)   # one of DOC_TYPES
    filename    = Column(String(255), nullable=False)  # original filename
    stored_name = Column(String(255), nullable=False)  # uuid-based name on disk
    mime_type   = Column(String(100), nullable=True)
    file_size   = Column(Integer, nullable=True)       # bytes
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    dispatch = relationship("Dispatch", backref="documents")
