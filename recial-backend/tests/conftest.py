"""
conftest.py — shared pytest fixtures for the Recial backend test suite.

WHAT THIS DOES
--------------
1. Points the whole app at a SEPARATE test database (never your real recial_db).
2. Creates all tables once for the test session, drops them at the end.
3. Gives each test a clean transaction that is rolled back afterwards, so
   tests never leak data into each other.
4. Overrides FastAPI's get_db dependency so your routes use the test session.
5. Provides a TestClient for making HTTP requests to the app.

IMPORTANT — why the import order matters
----------------------------------------
Your main.py runs create_all(), seed_users() and migrate_invoices() AT IMPORT
TIME, using the engine from database.py. So we must set the test DATABASE_URL
BEFORE anything imports `database` or `main`. That's why the os.environ line is
at the very top, before those imports.
"""

import os
import pytest

# ── 1. Redirect the database BEFORE importing app code ──────────────────────
# This env var is read by database.py's os.getenv("DATABASE_URL", ...).
# Change this URL to match your local Postgres test database.
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://jesus.delmoral@localhost:5432/recial_test",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

# Now it's safe to import the app's database module and the app itself.
from database import Base, engine, get_db  # noqa: E402
from sqlalchemy.orm import sessionmaker      # noqa: E402
from fastapi.testclient import TestClient    # noqa: E402


# A sessionmaker bound to the (now test) engine.
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── 2. Create tables once for the whole test session ────────────────────────
@pytest.fixture(scope="session", autouse=True)
def _create_test_schema():
    """
    Build the full schema in the test DB before any test runs, and tear it
    down afterwards. Importing main here (inside the fixture, after the env var
    is set) also registers every model on Base and runs the app's startup.
    """
    # Import main so ALL models are registered on Base.metadata and routers load.
    # This also triggers main's create_all/seed/migrate against the TEST db,
    # which is fine — it's a throwaway database.
    import main  # noqa: F401

    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


# ── 3. Per-test isolated session (rolled back after each test) ──────────────
@pytest.fixture()
def db_session():
    """
    Each test gets a connection wrapped in a transaction. Whatever the test
    writes is rolled back at the end, so tests stay independent and the DB
    stays clean — no manual cleanup needed.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ── 4. TestClient with get_db overridden to use the test session ────────────
@pytest.fixture()
def client(db_session):
    """
    A FastAPI TestClient whose routes use the same rolled-back session as the
    test. Anything the API writes during a test is undone afterwards.
    """
    import main

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass  # session lifecycle handled by the db_session fixture

    main.app.dependency_overrides[get_db] = _override_get_db
    with TestClient(main.app) as c:
        yield c
    main.app.dependency_overrides.clear()
