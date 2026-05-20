from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import date, datetime

from database import get_db
from models.receipts import Receipt
from models.entrances import Entrance
from models.dispatches import Dispatch
from models.disposals import Disposal
from models.tanks import Tank
from models.suppliers import Supplier

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/")
def get_dashboard(
    year: int = None,
    db: Session = Depends(get_db),
):
    if not year:
        year = datetime.now().year

    # ── KPI totals for the year ──────────────────────────────
    receipts_kg = db.query(func.sum(Receipt.quantity_kg)).filter(
        extract("year", Receipt.date) == year
    ).scalar() or 0

    receipts_count = db.query(func.count(Receipt.id)).filter(
        extract("year", Receipt.date) == year
    ).scalar() or 0

    entrances_kg = db.query(func.sum(Entrance.quantity_kg)).filter(
        extract("year", Entrance.date) == year
    ).scalar() or 0

    entrances_count = db.query(func.count(Entrance.id)).filter(
        extract("year", Entrance.date) == year
    ).scalar() or 0

    dispatches_kg = db.query(func.sum(Dispatch.quantity)).filter(
        extract("year", Dispatch.date) == year
    ).scalar() or 0

    dispatches_count = db.query(func.count(Dispatch.id)).filter(
        extract("year", Dispatch.date) == year
    ).scalar() or 0

    disposal_kg = db.query(func.sum(Disposal.quantity)).join(
        Dispatch, Disposal.dispatch_id == Dispatch.id
    ).filter(
        extract("year", Dispatch.date) == year
    ).scalar() or 0

    # ── Pending receipts (not assigned to entrance) ──────────
    pending_receipts = db.query(func.count(Receipt.id)).filter(
        Receipt.entrance_id == None
    ).scalar() or 0

    pending_kg = db.query(func.sum(Receipt.quantity_kg)).filter(
        Receipt.entrance_id == None
    ).scalar() or 0

    # ── Monthly breakdown ────────────────────────────────────
    monthly = []
    for month in range(1, 13):
        r_kg = db.query(func.sum(Receipt.quantity_kg)).filter(
            extract("year", Receipt.date) == year,
            extract("month", Receipt.date) == month
        ).scalar() or 0

        e_kg = db.query(func.sum(Entrance.quantity_kg)).filter(
            extract("year", Entrance.date) == year,
            extract("month", Entrance.date) == month
        ).scalar() or 0

        d_kg = db.query(func.sum(Dispatch.quantity)).filter(
            extract("year", Dispatch.date) == year,
            extract("month", Dispatch.date) == month
        ).scalar() or 0

        disp_kg = db.query(func.sum(Disposal.quantity)).join(
            Dispatch, Disposal.dispatch_id == Dispatch.id
        ).filter(
            extract("year", Dispatch.date) == year,
            extract("month", Dispatch.date) == month
        ).scalar() or 0

        monthly.append({
            "month": month,
            "receipts_kg": round(r_kg, 1),
            "entrances_kg": round(e_kg, 1),
            "dispatches_kg": round(d_kg, 1),
            "disposal_kg": round(disp_kg, 1),
        })

    # ── Supplier type split ──────────────────────────────────
    horeca_kg = db.query(func.sum(Receipt.quantity_kg)).join(
        Supplier, Receipt.supplier_id == Supplier.id
    ).filter(
        Supplier.supplier_type == "Horeca",
        extract("year", Receipt.date) == year,
    ).scalar() or 0

    urban_kg = db.query(func.sum(Receipt.quantity_kg)).join(
        Supplier, Receipt.supplier_id == Supplier.id
    ).filter(
        Supplier.supplier_type == "Urban",
        extract("year", Receipt.date) == year,
    ).scalar() or 0

    # ── Tank status ──────────────────────────────────────────
    tanks = db.query(Tank).filter(Tank.is_active == True).all()
    tank_status = [{
        "id": t.id,
        "name": t.name,
        "stock": t.stock or 0,
        "capacity": t.capacity or 0,
        "pct": round(((t.stock or 0) / t.capacity) * 100, 1) if t.capacity else 0,
    } for t in tanks]

    # ── Recent activity ──────────────────────────────────────
    recent_receipts = db.query(Receipt).order_by(
        Receipt.created_at.desc()
    ).limit(5).all()

    recent_dispatches = db.query(Dispatch).order_by(
        Dispatch.date.desc()
    ).limit(5).all()

    recent_entrances = db.query(Entrance).order_by(
        Entrance.date.desc()
    ).limit(5).all()

    # Merge and sort recent activity
    activity = []
    for r in recent_receipts:
        activity.append({
            "type": "receipt",
            "date": str(r.date),
            "label": f"Receipt #{r.receipt_code or r.id}",
            "detail": f"{r.quantity_kg:.1f} kg",
            "created_at": str(r.created_at),
        })
    for e in recent_entrances:
        activity.append({
            "type": "entrance",
            "date": str(e.date),
            "label": f"Batch {e.batch_id}",
            "detail": f"{e.quantity_kg:.1f} kg",
            "created_at": str(e.created_at),
        })
    for d in recent_dispatches:
        activity.append({
            "type": "dispatch",
            "date": str(d.date),
            "label": f"Dispatch {d.batch_id}",
            "detail": f"{d.quantity} kg",
            "created_at": str(d.date),
        })

    activity.sort(key=lambda x: x["created_at"], reverse=True)
    activity = activity[:10]

    # ── Calendar events ──────────────────────────────────────
    calendar_receipts = db.query(
        Receipt.date, func.count(Receipt.id), func.sum(Receipt.quantity_kg)
    ).filter(
        extract("year", Receipt.date) == year
    ).group_by(Receipt.date).all()

    calendar_dispatches = db.query(
        Dispatch.date, func.count(Dispatch.id), func.sum(Dispatch.quantity)
    ).filter(
        extract("year", Dispatch.date) == year
    ).group_by(Dispatch.date).all()

    calendar_entrances = db.query(
        Entrance.date, func.count(Entrance.id), func.sum(Entrance.quantity_kg)
    ).filter(
        extract("year", Entrance.date) == year
    ).group_by(Entrance.date).all()

    calendar = {}
    for d, cnt, kg in calendar_receipts:
        key = str(d)
        if key not in calendar: calendar[key] = {}
        calendar[key]["receipts"] = {"count": cnt, "kg": round(kg or 0, 1)}
    for d, cnt, kg in calendar_dispatches:
        key = str(d)
        if key not in calendar: calendar[key] = {}
        calendar[key]["dispatches"] = {"count": cnt, "kg": round(kg or 0, 1)}
    for d, cnt, kg in calendar_entrances:
        key = str(d)
        if key not in calendar: calendar[key] = {}
        calendar[key]["entrances"] = {"count": cnt, "kg": round(kg or 0, 1)}

    return {
        "year": year,
        "kpi": {
            "receipts_kg": round(receipts_kg, 1),
            "receipts_count": receipts_count,
            "entrances_kg": round(entrances_kg, 1),
            "entrances_count": entrances_count,
            "dispatches_kg": round(dispatches_kg, 1),
            "dispatches_count": dispatches_count,
            "disposal_kg": round(disposal_kg, 1),
            "pending_receipts": pending_receipts,
            "pending_kg": round(pending_kg, 1),
            "total_stock_kg": round(sum(t["stock"] for t in tank_status), 1),
        },
        "monthly": monthly,
        "supplier_split": {
            "horeca_kg": round(horeca_kg, 1),
            "urban_kg": round(urban_kg, 1),
        },
        "tanks": tank_status,
        "activity": activity,
        "calendar": calendar,
    }