from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Replace with your actual PostgreSQL credentials
# Format: postgresql://username:password@host:port/database_name
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://jesus.delmoral@localhost:5432/recial_db"
)

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Dependency — used in every route
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
