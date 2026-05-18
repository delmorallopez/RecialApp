from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models.tanks import Tank
from models.entrances import Entrance
from schemas.tanks import TankCreate, TankUpdate, TankResponse, TankListResponse

router = APIRouter(prefix="/tanks", tags=["Tanks"])


@router.get("/", response_model=TankListResponse)
def get_tanks(db: Session = Depends(get_db)):
    tanks = db.query(Tank).order_by(Tank.name).all()
    return {"total": len(tanks), "tanks": tanks}


@router.get("/{tank_id}", response_model=TankResponse)
def get_tank(tank_id: int, db: Session = Depends(get_db)):
    tank = db.query(Tank).filter(Tank.id == tank_id).first()
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
    return tank


@router.post("/", response_model=TankResponse, status_code=201)
def create_tank(tank_data: TankCreate, db: Session = Depends(get_db)):
    new_tank = Tank(**tank_data.model_dump())
    db.add(new_tank)
    db.commit()
    db.refresh(new_tank)
    return new_tank


@router.patch("/{tank_id}", response_model=TankResponse)
def update_tank(tank_id: int, tank_data: TankUpdate, db: Session = Depends(get_db)):
    tank = db.query(Tank).filter(Tank.id == tank_id).first()
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
    for field, value in tank_data.model_dump(exclude_unset=True).items():
        setattr(tank, field, value)
    db.commit()
    db.refresh(tank)
    return tank


@router.delete("/{tank_id}", status_code=204)
def delete_tank(tank_id: int, db: Session = Depends(get_db)):
    tank = db.query(Tank).filter(Tank.id == tank_id).first()
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
    # Check if tank has entrances assigned
    has_entrances = db.query(Entrance).filter(
        Entrance.tank_id == tank_id
    ).first()
    if has_entrances:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete tank with assigned entrances"
        )
    db.delete(tank)
    db.commit()
    return None