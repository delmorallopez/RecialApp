from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from sqlalchemy.orm import Session
from typing import Optional
from openpyxl import load_workbook
from io import BytesIO

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

# ── Supplier import helpers ─────────────────────────────────
_COLUMN_MAP = {
    "contact person": "contact_person",
    "name":           "name",
    "cif":            "cif",
    "address":        "address",
    "town":           "city",       # sheet "Town"   -> model city
    "county":         "county",     # sheet "County" -> model county
    "phone":          "phone",
    "email":          "email",
}


def _clean(v):
    """Trim strings; turn blanks/NaN into None. Strip trailing .0 from numbers
    (Excel stores phone numbers and numeric-looking CIFs as floats)."""
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = str(v).strip()
    return s or None

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



@router.post("/import")
async def import_suppliers(
    file: UploadFile = File(...),
    supplier_type: str = Query("Urban", description="Type to assign to all imported rows: Horeca or Urban"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # 1. Validate the chosen supplier_type
    try:
        stype = SupplierType(supplier_type)   # "Horeca" or "Urban"
    except ValueError:
        raise HTTPException(status_code=400,
            detail="supplier_type debe ser 'Horeca' o 'Urban'.")

    # 2. Read the uploaded file
    if not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400,
            detail="El archivo debe ser un Excel (.xlsx).")
    content = await file.read()
    try:
        wb = load_workbook(BytesIO(content), read_only=True, data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400,
            detail=f"No se pudo leer el archivo Excel: {type(e).__name__}: {e} (bytes recibidos: {len(content)})")
    ws = wb.active  # first sheet ("POR PUEBLOS")

    # 3. Read header row and build a column-index map
    rows = ws.iter_rows(values_only=True)
    try:
        header = next(rows)
    except StopIteration:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")

    col_index = {}   # model_field -> column position
    for idx, h in enumerate(header):
        key = _clean(h)
        if key and key.lower() in _COLUMN_MAP:
            col_index[_COLUMN_MAP[key.lower()]] = idx

    if "name" not in col_index:
        raise HTTPException(status_code=400,
            detail="No se encontró la columna 'name' en el archivo.")

    # 4. Existing names (dedupe key) — lowercased for case-insensitive match
    existing_names = {
        (n or "").strip().lower()
        for (n,) in db.query(Supplier.name).all()
    }

    created, skipped = [], []
    seen_in_file = set()

    # 5. Parse + validate every row BEFORE inserting
    to_insert = []
    for i, row in enumerate(rows, start=2):  # row 2 = first data row
        rec = {}
        for field, idx in col_index.items():
            rec[field] = _clean(row[idx]) if idx < len(row) else None

        name = rec.get("name")
        if not name:
            continue  # silently skip fully-blank rows

        key = name.lower()

        # Skip duplicates already in DB
        if key in existing_names:
            skipped.append({"name": name, "reason": "ya existe"})
            continue
        # Skip duplicates within the same file
        if key in seen_in_file:
            skipped.append({"name": name, "reason": "duplicado en el archivo"})
            continue
        seen_in_file.add(key)

        to_insert.append(Supplier(
            supplier_type=stype,
            name=name,
            cif=rec.get("cif"),
            address=rec.get("address"),
            city=rec.get("city"),
            county=rec.get("county"),
            phone=rec.get("phone"),
            email=rec.get("email"),
            contact_person=rec.get("contact_person"),
            is_active=True,
        ))
        created.append(name)

    # 6. Insert all valid rows in one transaction
    if to_insert:
        db.add_all(to_insert)
        db.commit()

    return {
        "created_count": len(created),
        "skipped_count": len(skipped),
        "created": created,
        "skipped": skipped,
        "supplier_type": stype.value,
    }
