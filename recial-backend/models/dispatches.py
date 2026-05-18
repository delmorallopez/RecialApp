from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Table
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

# Junction table — many dispatches can reference many entrances
dispatch_entrances = Table(
    "dispatch_entrances",
    Base.metadata,
    Column("dispatch_id", Integer, ForeignKey("dispatches.id"), primary_key=True),
    Column("entrance_id", Integer, ForeignKey("entrances.id"), primary_key=True),
)


class Dispatch(Base):
    __tablename__ = "dispatches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(20), unique=True, nullable=False)  # e.g. SA010126
    post_number = Column(Integer, nullable=True)                # ISCC traceability
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    tank_id = Column(Integer, ForeignKey("tanks.id"), nullable=True)
    date = Column(Date, nullable=False)
    raw_material = Column(String(100), default="UCO")
    value_gei = Column(Integer, default=1)
    quantity = Column(Integer, nullable=False)                  # kg sold
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    customer = relationship("Customer", backref="dispatches")
    tank = relationship("Tank", backref="dispatches")
    entrances = relationship("Entrance", secondary=dispatch_entrances, backref="dispatches")
    disposal = relationship("Disposal", back_populates="dispatch", uselist=False)