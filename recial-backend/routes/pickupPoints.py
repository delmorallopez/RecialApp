from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models.pickupPoints import PickupPoint
from schemas.pickupPoints import (
    PickupPointCreate, PickupPointUpdate,
    PickupPointResponse, PickupPointListResponse
)

router = APIRouter(prefix="/pickup-points", tags=["Pickup Points"])


@router.get("/", response_model=PickupPointListResponse)
def get_pickup_points(
    supplier_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(PickupPoint)
    if supplier_id:
        query = query.filter(PickupPoint.supplier_id == supplier_id)
    points = query.order_by(PickupPoint.name).all()
    return {"total": len(points), "pickup_points": points}


@router.post("/", response_model=PickupPointResponse, status_code=201)
def create_pickup_point(data: PickupPointCreate, db: Session = Depends(get_db)):
    point = PickupPoint(**data.model_dump())
    db.add(point)
    db.commit()
    db.refresh(point)
    return point


@router.patch("/{point_id}", response_model=PickupPointResponse)
def update_pickup_point(point_id: int, data: PickupPointUpdate, db: Session = Depends(get_db)):
    point = db.query(PickupPoint).filter(PickupPoint.id == point_id).first()
    if not point:
        raise HTTPException(status_code=404, detail="Pickup point not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(point, field, value)
    db.commit()
    db.refresh(point)
    return point


@router.delete("/{point_id}", status_code=204)
def delete_pickup_point(point_id: int, db: Session = Depends(get_db)):
    point = db.query(PickupPoint).filter(PickupPoint.id == point_id).first()
    if not point:
        raise HTTPException(status_code=404, detail="Pickup point not found")
    db.delete(point)
    db.commit()
    return None