from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

load_dotenv()  # loads .env for local development

DATABASE_URL = os.getenv("DATABASE_URL")

# Fail loudly instead of silently falling back to a localhost DB that
# cannot exist inside a container.
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is NOT SET. Refusing to start. "
        "Set it in the hosting platform's environment variables."
    )

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()