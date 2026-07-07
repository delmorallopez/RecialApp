from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models.suppliers import Supplier, SupplierType
from models.receipts import Receipt
from schemas.suppliers import (
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    SupplierListResponse,
)

from auth import get_current_user, require_admin, require_manager_or_above
from models.users import User

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.get("/", response_model=SupplierListResponse)
def get_suppliers(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    supplier_type: Optional[SupplierType] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Supplier)
    if search:
        query = query.filter(
            Supplier.name.ilike(f"%{search}%") |
            Supplier.cif.ilike(f"%{search}%") |
            Supplier.address.ilike(f"%{search}%")
        )
    if supplier_type:
        query = query.filter(Supplier.supplier_type == supplier_type)
    total = query.count()
    suppliers = query.order_by(Supplier.name).offset(skip).limit(limit).all()
    return {"total": total, "suppliers": suppliers}


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@router.post("/", response_model=SupplierResponse, status_code=201)
def create_supplier(supplier_data: SupplierCreate, db: Session = Depends(get_db), current_user: User = Depends(require_manager_or_above) ):
    if supplier_data.cif:
        existing = db.query(Supplier).filter(
            Supplier.cif == supplier_data.cif
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="CIF already registered")
    new_supplier = Supplier(**supplier_data.model_dump())
    db.add(new_supplier)
    db.commit()
    db.refresh(new_supplier)
    return new_supplier


@router.patch("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: int,
    supplier_data: SupplierUpdate,
    db: Session = Depends(get_db),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for field, value in supplier_data.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}", status_code=204)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    receipt_count = db.query(Receipt).filter(Receipt.supplier_id == supplier_id).count()
    if receipt_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar este proveedor porque tiene {receipt_count} albarán(es) registrado(s). "
                f"Los albaranes son registros de trazabilidad y deben conservarse."
        )

    db.delete(supplier)
    db.commit()
    return None