from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from database import Base
import enum


class UserRole(str, enum.Enum):
    ADMIN   = "admin"
    MANAGER = "manager"
    DRIVER  = "driver"


class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    username   = Column(String(50), unique=True, nullable=False, index=True)
    full_name  = Column(String(100), nullable=True)
    email      = Column(String(100), unique=True, nullable=True)
    hashed_password = Column(String(200), nullable=False)
    role       = Column(Enum(UserRole), default=UserRole.DRIVER, nullable=False)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())