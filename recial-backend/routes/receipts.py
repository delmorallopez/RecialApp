from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import date

from database import get_db
from models.receipts import Receipt
from models.suppliers import Supplier
from schemas.receipts import ReceiptCreate, ReceiptUpdate, ReceiptResponse, ReceiptListResponse

router = APIRouter(prefix="/receipts", tags=["Receipts"])


@router.get("/", response_model=ReceiptListResponse)
def get_receipts(
    skip: int = 0,
    limit: int = 50,
    supplier_id: Optional[int] = None,
    driver_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Receipt).options(joinedload(Receipt.supplier))

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


@router.get("/{receipt_id}", response_model=ReceiptResponse)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    receipt = db.query(Receipt).options(joinedload(Receipt.supplier)).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@router.post("/", response_model=ReceiptResponse, status_code=201)
def create_receipt(receipt_data: ReceiptCreate, db: Session = Depends(get_db)):
    # Check supplier exists
    supplier = db.query(Supplier).filter(Supplier.id == receipt_data.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    new_receipt = Receipt(**receipt_data.model_dump())
    db.add(new_receipt)
    db.commit()
    db.refresh(new_receipt)

    # Reload with supplier info
    return db.query(Receipt).options(joinedload(Receipt.supplier)).filter(Receipt.id == new_receipt.id).first()


@router.patch("/{receipt_id}", response_model=ReceiptResponse)
def update_receipt(receipt_id: int, receipt_data: ReceiptUpdate, db: Session = Depends(get_db)):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    for field, value in receipt_data.model_dump(exclude_unset=True).items():
        setattr(receipt, field, value)
    db.commit()
    db.refresh(receipt)
    return db.query(Receipt).options(joinedload(Receipt.supplier)).filter(Receipt.id == receipt_id).first()


@router.delete("/{receipt_id}", status_code=204)
def delete_receipt(receipt_id: int, db: Session = Depends(get_db)):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    db.delete(receipt)
    db.commit()
    return None