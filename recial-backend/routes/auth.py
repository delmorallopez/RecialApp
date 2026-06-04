from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import get_db
from models.users import User, UserRole
from auth import (
    hash_password, verify_password,
    create_access_token, get_current_user
)
from schemas.auth import UserCreate, Token, UserResponse
from schemas.auth import UserUpdate

router = APIRouter(prefix="/auth", tags=["Auth"])



# ── Login ────────────────────────────────────────────────────
@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.username == form_data.username
    ).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is disabled")

    token = create_access_token({"sub": user.username, "role": user.role})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
        }
    }


# ── Get current user info ────────────────────────────────────
@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# ── Create user (admin only in production) ───────────────────
@router.post("/register", response_model=UserResponse, status_code=201)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check username taken
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    new_user = User(
        username=user_data.username,
        full_name=user_data.full_name,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role=user_data.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


# ── List users (admin only) ──────────────────────────────────
@router.get("/users", response_model=list[UserResponse])
def get_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return db.query(User).all()


# ── Update user (admin only) ─────────────────────────────────
@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update allowed fields
    allowed = ["full_name", "email", "role", "is_active"]
    for field in allowed:
        if field in user_data:
            setattr(user, field, user_data[field])

    # Update password if provided
    if "password" in user_data and user_data["password"]:
        user.hashed_password = hash_password(user_data["password"])

    db.commit()
    db.refresh(user)
    return user


# ── Delete user (admin only) ─────────────────────────────────
@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    db.delete(user)
    db.commit()
    return None


# ── Change own password ──────────────────────────────────────
@router.patch("/me/password")
def change_password(
    passwords: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(passwords.get("current_password", ""), current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(passwords["new_password"])
    db.commit()
    return {"message": "Password updated successfully"}