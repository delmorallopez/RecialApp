from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models.customers import Customer
from schemas.customers import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerListResponse

from auth import get_current_user, require_admin, require_manager_or_above
from models.users import User


router = APIRouter(prefix="/customers", tags=["Customers"])

@router.get("/", response_model=CustomerListResponse)
def get_customers(skip: int = 0, limit: int = 50, search: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Customer)
    if search:
        query = query.filter(Customer.name.ilike(f"%{search}%") | Customer.email.ilike(f"%{search}%"))
    total = query.count()
    customers = query.order_by(Customer.name).offset(skip).limit(limit).all()
    return {"total": total, "customers": customers}

@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@router.post("/", response_model=CustomerResponse, status_code=201)
def create_customer(customer_data: CustomerCreate, db: Session = Depends(get_db), current_user: User = Depends(require_manager_or_above) ):
    if customer_data.email:
        existing = db.query(Customer).filter(Customer.email == customer_data.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    new_customer = Customer(**customer_data.model_dump())
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer

@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: int, customer_data: CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in customer_data.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer

@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin) ):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(customer)
    db.commit()
    return None
