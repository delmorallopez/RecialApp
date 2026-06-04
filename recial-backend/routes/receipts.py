from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import date

from database import get_db
from models.receipts import Receipt
from models.suppliers import Supplier
from models.receipt_pickup import ReceiptPickup
from schemas.receipts import (
    ReceiptCreate,
    ReceiptUpdate,
    ReceiptResponse,
    ReceiptListResponse,
)

from auth import get_current_user, require_admin, require_manager_or_above
from models.users import User

router = APIRouter(prefix="/receipts", tags=["Receipts"])


def load_receipt(receipt_id: int, db: Session):
    """Load a receipt with all relationships."""
    return db.query(Receipt).options(
        joinedload(Receipt.supplier),
        joinedload(Receipt.pickup_quantities).joinedload(ReceiptPickup.pickup_point),
    ).filter(Receipt.id == receipt_id).first()


# ── GET /receipts/ ───────────────────────────────────────────
@router.get("/", response_model=ReceiptListResponse)
def get_receipts(
    skip: int = 0,
    limit: int = 50,
    supplier_id: Optional[int] = None,
    driver_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Receipt).options(
        joinedload(Receipt.supplier),
        joinedload(Receipt.pickup_quantities).joinedload(ReceiptPickup.pickup_point),
    )

    if supplier_id:
        query = query.filter(Receipt.supplier_id == supplier_id)
    if driver_id:
        query = query.filter(Receipt.driver_id == driver_id)
    if date_from:
        query = query.filter(Receipt.date >= date_from)
    if date_to:
        query = query.filter(Receipt.date <= date_to)

    total = query.count()
    receipts = query.order_by(Receipt.date.desc()).offset(skip).limit(limit).all()
    return {"total": total, "receipts": receipts}


# ── GET /receipts/{id} ───────────────────────────────────────
@router.get("/{receipt_id}", response_model=ReceiptResponse)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    receipt = load_receipt(receipt_id, db)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


# ── POST /receipts/ ──────────────────────────────────────────
@router.post("/", response_model=ReceiptResponse, status_code=201)
def create_receipt(receipt_data: ReceiptCreate, db: Session = Depends(get_db), current_user: User = Depends(require_manager_or_above)):
    # Validate supplier exists
    supplier = db.query(Supplier).filter(
        Supplier.id == receipt_data.supplier_id
    ).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Calculate total quantity
    # If pickup_quantities provided, sum them; otherwise use quantity_kg directly
    if receipt_data.pickup_quantities:
        total_kg = sum(p.quantity_kg for p in receipt_data.pickup_quantities)
    else:
        total_kg = receipt_data.quantity_kg

    # Create the receipt
    new_receipt = Receipt(
        supplier_id=receipt_data.supplier_id,
        driver_id=receipt_data.driver_id,
        raw_material=receipt_data.raw_material,
        date=receipt_data.date,
        quantity_kg=total_kg,
        notes=receipt_data.notes,
    )
    db.add(new_receipt)
    db.flush()  # get the new receipt ID

    # Save pickup point quantities
    for pq in (receipt_data.pickup_quantities or []):
        if pq.quantity_kg > 0:
            db.add(ReceiptPickup(
                receipt_id=new_receipt.id,
                pickup_point_id=pq.pickup_point_id,
                quantity_kg=pq.quantity_kg,
            ))

    db.commit()
    return load_receipt(new_receipt.id, db)


# ── PATCH /receipts/{id} ─────────────────────────────────────
@router.patch("/{receipt_id}", response_model=ReceiptResponse)
def update_receipt(
    receipt_id: int,
    receipt_data: ReceiptUpdate,
    db: Session = Depends(get_db),
):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    # Update simple fields
    update_fields = receipt_data.model_dump(exclude_unset=True, exclude={"pickup_quantities"})
    for field, value in update_fields.items():
        setattr(receipt, field, value)

    # Update pickup quantities if provided
    if receipt_data.pickup_quantities is not None:
        # Delete all existing pickup quantities for this receipt
        db.query(ReceiptPickup).filter(
            ReceiptPickup.receipt_id == receipt_id
        ).delete()

        # Insert new ones
        total_kg = 0
        for pq in receipt_data.pickup_quantities:
            if pq.quantity_kg > 0:
                db.add(ReceiptPickup(
                    receipt_id=receipt_id,
                    pickup_point_id=pq.pickup_point_id,
                    quantity_kg=pq.quantity_kg,
                ))
                total_kg += pq.quantity_kg

        # Update receipt total to match sum of pickup quantities
        if total_kg > 0:
            receipt.quantity_kg = total_kg

    db.commit()
    return load_receipt(receipt_id, db)


# ── DELETE /receipts/{id} ────────────────────────────────────
@router.delete("/{receipt_id}", status_code=204)
def delete_receipt(receipt_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin) ):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    # Cascade delete handles pickup_quantities automatically
    db.delete(receipt)
    db.commit()
    return None
