# models/historical_summary.py
#
# Level-1 historical import: stores MONTHLY summary totals per year, imported
# from the legacy hand-kept mass-balance spreadsheets (2020-2025).
#
# This is DELIBERATELY separate from the live receipts/entrances/dispatches
# tables. These are summary figures reconstructed from historical reports —
# NOT individually traceable records. Keeping them apart means:
#   - the live ISCC traceability chain is never polluted with un-traceable data
#   - an auditor can clearly distinguish "imported historical summary" from
#     "live tracked record"
#   - reports can show continuous multi-year history by reading BOTH sources

from sqlalchemy import Column, Integer, Float, String, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from database import Base


class HistoricalMonthlySummary(Base):
    __tablename__ = "historical_monthly_summary"

    id = Column(Integer, primary_key=True, index=True)

    year  = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False)   # 1-12

    # Core monthly figures (kg)
    receipts_kg   = Column(Float, nullable=False, default=0)   # kg received (source of truth)
    dispatches_kg = Column(Float, nullable=False, default=0)   # kg dispatched
    disposal_kg   = Column(Float, nullable=False, default=0)   # merma

    receipts_count = Column(Integer, nullable=False, default=0)

    # Provenance / audit
    source_file = Column(String(255), nullable=True)
    imported_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("year", "month", name="uq_hist_year_month"),
    )


class HistoricalYearMeta(Base):
    """Per-year figures that aren't monthly: opening stock, closing stock."""
    __tablename__ = "historical_year_meta"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False, unique=True, index=True)

    opening_stock_kg = Column(Float, nullable=True)
    total_receipts_kg   = Column(Float, nullable=True)
    total_dispatches_kg = Column(Float, nullable=True)
    total_disposal_kg   = Column(Float, nullable=True)

    source_file = Column(String(255), nullable=True)
    imported_at = Column(DateTime(timezone=True), server_default=func.now())