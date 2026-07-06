"""
test_harness.py — Step 0 sanity checks.

These don't test business logic yet. They only prove the harness works:
- the app boots and answers
- the test database is connected and is NOT the real one
- the per-test session + rollback machinery is alive

If these pass, the plumbing is correct and we can start writing real tests
(auth, dispatch lifecycle, cascades, reports).
"""

import os
from sqlalchemy import text


def test_app_responds(client):
    """The app boots and the health check answers 200."""
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_using_test_database():
    """
    Guard rail: make sure we're pointed at the TEST database, never the real
    recial_db. This protects you from tests accidentally wiping real data.
    """
    url = os.environ["DATABASE_URL"]
    assert "test" in url, (
        f"Refusing to run: DATABASE_URL does not look like a test DB ({url}). "
        "Tests must run against a separate database."
    )


def test_db_session_works(db_session):
    """The per-test session can talk to the database."""
    result = db_session.execute(text("SELECT 1")).scalar()
    assert result == 1


def test_tables_exist(db_session):
    """
    The schema was created — check a couple of core tables are present.
    Confirms every model registered on Base and create_all() ran.
    """
    rows = db_session.execute(text(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = 'public'"
    )).fetchall()
    tables = {r[0] for r in rows}
    # Spot-check a few tables we know your app has.
    for expected in ("users", "suppliers", "dispatches", "invoices"):
        assert expected in tables, f"Expected table '{expected}' missing from test DB"
