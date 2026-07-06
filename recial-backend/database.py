from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

load_dotenv()  # ← loads .env file

DATABASE_URL = os.getenv(
    "DATABASE_URL",
#    "postgresql://postgres:mIqMsRln0vMVgr5eb2kIT4CMzT0DK6VgmKzUmu3CCc6zyhD3dnpaovou0ySGn8JT@qb4gtumxixm10m4kws17yoh9:5432/postgres"
      "postgresql://jesus.delmoral@localhost:5432/recial_db"
)

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

print(">>> Connecting to:", DATABASE_URL[:50], "...")  # debug

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()