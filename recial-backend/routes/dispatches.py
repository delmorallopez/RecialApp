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
def create_dispatch(dispatch_data: DispatchCreate, db: Session = Depends(get_db)):
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
    for field, value in dispatch_data.model_dump(exclude_unset=True).items():
        setattr(dispatch, field, value)
    db.commit()
    return load_dispatch(dispatch_id, db)


@router.delete("/{dispatch_id}", status_code=204)
def delete_dispatch(dispatch_id: int, db: Session = Depends(get_db)):
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    # Restore tank stock
    if dispatch.tank_id:
       tank = db.query(Tank).filter(Tank.id == dispatch.tank_id).first()
       if tank:
         restore_amount = dispatch.quantity
            # Also restore disposal quantity if it exists
         if dispatch.disposal:
            restore_amount += dispatch.disposal.quantity
            tank.stock = (tank.stock or 0) + restore_amount

    db.delete(dispatch)
    db.commit()
    return None