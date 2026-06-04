from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import date

from database import get_db
from models.dispatches import Dispatch
from models.disposals import Disposal
from models.entrances import Entrance
from models.customers import Customer
from models.tanks import Tank
from schemas.dispatches import (
    DispatchCreate, DispatchUpdate, DispatchResponse, DispatchListResponse
)
from auth import get_current_user, require_admin, require_manager_or_above
from models.users import User

router = APIRouter(prefix="/dispatches", tags=["Dispatches"])


def generate_batch_id(date: date, db: Session) -> str:
    """Generate batch ID like SA010126"""
    date_part = date.strftime("%d%m%y")
    batch_id = f"SA{date_part}"
    existing = db.query(Dispatch).filter(
        Dispatch.batch_id.like(f"SA{date_part}%")
    ).count()
    if existing > 0:
        batch_id = f"SA{date_part}-{existing + 1}"
    return batch_id


def load_dispatch(dispatch_id: int, db: Session):
    return db.query(Dispatch).options(
        joinedload(Dispatch.customer),
        joinedload(Dispatch.tank),
        joinedload(Dispatch.entrances),
        joinedload(Dispatch.disposal),
    ).filter(Dispatch.id == dispatch_id).first()


@router.get("/", response_model=DispatchListResponse)
def get_dispatches(
    skip: int = 0,
    limit: int = 50,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Dispatch).options(
        joinedload(Dispatch.customer),
        joinedload(Dispatch.tank),
        joinedload(Dispatch.entrances),
        joinedload(Dispatch.disposal),
    )
    if customer_id:
        query = query.filter(Dispatch.customer_id == customer_id)
    total = query.count()
    dispatches = query.order_by(Dispatch.date.desc()).offset(skip).limit(limit).all()
    return {"total": total, "dispatches": dispatches}


@router.get("/{dispatch_id}", response_model=DispatchResponse)
def get_dispatch(dispatch_id: int, db: Session = Depends(get_db)):
    dispatch = load_dispatch(dispatch_id, db)
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    return dispatch


@router.post("/", response_model=DispatchResponse, status_code=201)
def create_dispatch(dispatch_data: DispatchCreate, db: Session = Depends(get_db), current_user: User = Depends(require_manager_or_above) ):
    # Validate customer
    customer = db.query(Customer).filter(
        Customer.id == dispatch_data.customer_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Validate entrances
    entrances = []
    for eid in dispatch_data.entrance_ids:
        entrance = db.query(Entrance).filter(Entrance.id == eid).first()
        if not entrance:
            raise HTTPException(status_code=404, detail=f"Entrance #{eid} not found")
        entrances.append(entrance)

    # Generate batch ID
    batch_id = generate_batch_id(dispatch_data.date, db)

    # Create dispatch
    new_dispatch = Dispatch(
        batch_id=batch_id,
        post_number=dispatch_data.post_number,
        customer_id=dispatch_data.customer_id,
        tank_id=dispatch_data.tank_id,
        date=dispatch_data.date,
        raw_material=dispatch_data.raw_material,
        value_gei=dispatch_data.value_gei,
        quantity=dispatch_data.quantity,
        entrances=entrances,
    )
    db.add(new_dispatch)
    db.flush()

    # Decrease tank stock
    if dispatch_data.tank_id:
        tank = db.query(Tank).filter(Tank.id == dispatch_data.tank_id).first()
        if tank:
            total_deduction = dispatch_data.quantity
            if dispatch_data.disposal:
                total_deduction += dispatch_data.disposal.quantity
            tank.stock = max(0, (tank.stock or 0) - total_deduction) 

    # Create disposal if provided
    if dispatch_data.disposal:
        disposal = Disposal(
            dispatch_id=new_dispatch.id,
            date=dispatch_data.disposal.date,
            quantity=dispatch_data.disposal.quantity,
            notes=dispatch_data.disposal.notes,
        )
        db.add(disposal)

    db.commit()
    return load_dispatch(new_dispatch.id, db)


@router.patch("/{dispatch_id}", response_model=DispatchResponse)
def update_dispatch(
    dispatch_id: int,
    dispatch_data: DispatchUpdate,
    db: Session = Depends(get_db),
):
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    # Handle tank stock adjustment if quantity or tank changes
    old_qty = dispatch.quantity or 0
    old_disposal_qty = dispatch.disposal.quantity if dispatch.disposal else 0
    old_tank_id = dispatch.tank_id

    # Update simple fields
    for field, value in dispatch_data.model_dump(
        exclude_unset=True, exclude={"entrance_ids", "disposal"}
    ).items():
        setattr(dispatch, field, value)

    # Update entrance links
    if dispatch_data.entrance_ids is not None:
        entrances = []
        for eid in dispatch_data.entrance_ids:
            entrance = db.query(Entrance).filter(Entrance.id == eid).first()
            if entrance:
                entrances.append(entrance)
        dispatch.entrances = entrances

    # Update disposal
    if dispatch_data.disposal is not None:
        if dispatch.disposal:
            dispatch.disposal.date = dispatch_data.disposal.date
            dispatch.disposal.quantity = dispatch_data.disposal.quantity
            dispatch.disposal.notes = dispatch_data.disposal.notes
        else:
            db.add(Disposal(
                dispatch_id=dispatch_id,
                date=dispatch_data.disposal.date,
                quantity=dispatch_data.disposal.quantity,
                notes=dispatch_data.disposal.notes,
            ))
    elif dispatch_data.disposal is None and "disposal" in dispatch_data.model_fields_set:
        # Explicitly set to None — remove disposal
        if dispatch.disposal:
            db.delete(dispatch.disposal)

    # Recalculate tank stock
    new_qty = dispatch.quantity or 0
    new_disposal_qty = dispatch.disposal.quantity if dispatch.disposal else 0
    new_tank_id = dispatch.tank_id

    if old_tank_id:
        old_tank = db.query(Tank).filter(Tank.id == old_tank_id).first()
        if old_tank:
            old_tank.stock = (old_tank.stock or 0) + old_qty + old_disposal_qty

    if new_tank_id:
        new_tank = db.query(Tank).filter(Tank.id == new_tank_id).first()
        if new_tank:
            new_tank.stock = max(0, (new_tank.stock or 0) - new_qty - new_disposal_qty)

    db.commit()
    return load_dispatch(dispatch_id, db)


@router.delete("/{dispatch_id}", status_code=204)
def delete_dispatch(dispatch_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    # Restore tank stock
    if dispatch.tank_id:
        tank = db.query(Tank).filter(Tank.id == dispatch.tank_id).first()
        if tank:
            restore_amount = dispatch.quantity or 0
            if dispatch.disposal:
                restore_amount += dispatch.disposal.quantity or 0
            tank.stock = (tank.stock or 0) + restore_amount

    # Explicitly delete disposal first ← add this
    if dispatch.disposal:
        db.delete(dispatch.disposal)
        db.flush()

    db.delete(dispatch)
    db.commit()
    return None