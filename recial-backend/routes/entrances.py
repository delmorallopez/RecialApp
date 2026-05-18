from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import date

from database import get_db
from models.entrances import Entrance
from models.receipts import Receipt
from models.tanks import Tank
from schemas.entrances import EntranceCreate, EntranceUpdate, EntranceResponse, EntranceListResponse

router = APIRouter(prefix="/entrances", tags=["Entrances"])


def generate_batch_id(date: date, supplier_type: str, db: Session) -> str:
    """Generate batch ID like 010124A"""
    suffix = "A" if supplier_type == "A" else "B"
    date_part = date.strftime("%d%m%y")   # e.g. 010124
    batch_id = f"{date_part}{suffix}"

    # If batch_id already exists today, add a counter
    existing = db.query(Entrance).filter(
        Entrance.batch_id.like(f"{date_part}{suffix}%")
    ).count()
    if existing > 0:
        batch_id = f"{date_part}{suffix}{existing + 1}"
    return batch_id


@router.get("/", response_model=EntranceListResponse)
def get_entrances(
    skip: int = 0,
    limit: int = 50,
    supplier_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Entrance).options(
        joinedload(Entrance.receipts),
        joinedload(Entrance.tank)
    )
    if supplier_type:
        query = query.filter(Entrance.supplier_type == supplier_type)
    total = query.count()
    entrances = query.order_by(Entrance.date.desc()).offset(skip).limit(limit).all()
    return {"total": total, "entrances": entrances}


@router.get("/{entrance_id}", response_model=EntranceResponse)
def get_entrance(entrance_id: int, db: Session = Depends(get_db)):
    entrance = db.query(Entrance).options(
        joinedload(Entrance.receipts),
        joinedload(Entrance.tank)
    ).filter(Entrance.id == entrance_id).first()
    if not entrance:
        raise HTTPException(status_code=404, detail="Entrance not found")
    return entrance


@router.post("/", response_model=EntranceResponse, status_code=201)
def create_entrance(entrance_data: EntranceCreate, db: Session = Depends(get_db)):
    if not entrance_data.receipt_ids:
        raise HTTPException(status_code=400, detail="At least one receipt is required")

    # Validate all receipts exist, are same type, and not already assigned
    receipts = []
    for rid in entrance_data.receipt_ids:
        receipt = db.query(Receipt).options(
            joinedload(Receipt.supplier)
        ).filter(Receipt.id == rid).first()

        if not receipt:
            raise HTTPException(status_code=404, detail=f"Receipt #{rid} not found")
        if receipt.entrance_id:
            raise HTTPException(status_code=400, detail=f"Receipt #{rid} is already assigned to an entrance")

        # Check supplier type matches
        receipt_type = "A" if receipt.supplier.supplier_type == "Horeca" else "B"
        if receipt_type != entrance_data.supplier_type:
            raise HTTPException(
                status_code=400,
                detail=f"Receipt #{rid} is type {receipt_type} but batch is type {entrance_data.supplier_type}"
            )
        receipts.append(receipt)

    # Calculate totals
    total_kg = sum(r.quantity_kg for r in receipts)
    dates = [r.date for r in receipts]
    start_date = min(dates)
    finish_date = max(dates)

    # Generate batch ID
    batch_id = generate_batch_id(entrance_data.date, entrance_data.supplier_type, db)

    # Create entrance
    new_entrance = Entrance(
        batch_id=batch_id,
        tank_id=entrance_data.tank_id,
        supplier_type=entrance_data.supplier_type,
        date=entrance_data.date,
        start_date=start_date,
        finish_date=finish_date,
        quantity_kg=total_kg,
    )
    db.add(new_entrance)
    db.flush()  # get the new entrance ID

    # Lock receipts to this entrance
    for receipt in receipts:
        receipt.entrance_id = new_entrance.id

    db.commit()
    if new_entrance.tank_id:
       tank = db.query(Tank).filter(Tank.id == new_entrance.tank_id).first()
       if tank:
         tank.stock = (tank.stock or 0) + int(total_kg)
         db.commit()
    db.refresh(new_entrance)

    return db.query(Entrance).options(
        joinedload(Entrance.receipts),
        joinedload(Entrance.tank)
    ).filter(Entrance.id == new_entrance.id).first()


@router.patch("/{entrance_id}", response_model=EntranceResponse)
def update_entrance(entrance_id: int, entrance_data: EntranceUpdate, db: Session = Depends(get_db)):
    entrance = db.query(Entrance).filter(Entrance.id == entrance_id).first()
    if not entrance:
        raise HTTPException(status_code=404, detail="Entrance not found")
    for field, value in entrance_data.model_dump(exclude_unset=True).items():
        setattr(entrance, field, value)
    db.commit()
    return db.query(Entrance).options(
        joinedload(Entrance.receipts),
        joinedload(Entrance.tank)
    ).filter(Entrance.id == entrance_id).first()


@router.delete("/{entrance_id}", status_code=204)
def delete_entrance(entrance_id: int, db: Session = Depends(get_db)):
    entrance = db.query(Entrance).filter(Entrance.id == entrance_id).first()
    if not entrance:
        raise HTTPException(status_code=404, detail="Entrance not found")
    # Unlock the receipts
    for receipt in entrance.receipts:
        receipt.entrance_id = None
    
    if entrance.tank_id:
        tank = db.query(Tank).filter(Tank.id == entrance.tank_id).first()

        if tank:
          tank.stock = max(0, (tank.stock or 0) - int(entrance.quantity_kg or 0))
          db.commit()

    db.delete(entrance)
    db.commit()
    return None