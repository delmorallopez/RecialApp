"""
test_dispatch_lifecycle.py — Step 2: the dispatch create-and-delete lifecycle.

This is the suite that targets your real production 500: deleting a dispatch
used to crash with an IntegrityError. These tests prove:

  1. A dispatch can be created (201).
  2. A dispatch can be deleted (204, NOT 500).
  3. Deleting restores the tank stock.
  4. A dispatch WITH a disposal deletes cleanly (the cascade that broke prod).

PREREQUISITES a dispatch needs: a customer (required), and a tank (optional,
but required here to test stock restore). The tests create their own.

NOTE — fields marked  # ⚠️ VERIFY  are my best guess from the code seen so far.
If a test fails with a 422 validation error, the response body will name the
exact field to fix; adjust the payloads below to match your real schemas.
"""

import pytest
from auth import hash_password
from models.users import User, UserRole
from models.customers import Customer
from models.tanks import Tank


TEST_USERNAME = "testadmin"
TEST_PASSWORD = "TestPass123!"


# ── Auth fixtures ───────────────────────────────────────────────────────────
@pytest.fixture()
def test_user(db_session):
    """Known ADMIN user (admin satisfies both require_manager_or_above and require_admin)."""
    user = User(
        username=TEST_USERNAME,
        full_name="Test Admin",
        email="testadmin@example.com",
        hashed_password=hash_password(TEST_PASSWORD),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def auth_headers(client, test_user):
    """Log in and return the Authorization header for protected routes."""
    res = client.post("/auth/login", data={
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD,
    })
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── Prerequisite data fixtures ──────────────────────────────────────────────
@pytest.fixture()
def customer(db_session):
    """A customer to dispatch to. name is required; other fields optional."""
    c = Customer(
        name="Test Customer S.L.",        # ⚠️ VERIFY required fields on Customer
        cif="B00000000",
    )
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    return c


@pytest.fixture()
def tank(db_session):
    """A tank with a known starting stock, so we can assert stock restore."""
    t = Tank(
        name="Test Tank 1",                # ⚠️ VERIFY required fields on Tank
        capacity=10000,
        stock=5000,
        is_active=True,
    )
    db_session.add(t)
    db_session.commit()
    db_session.refresh(t)
    return t


# ── Payload builder ─────────────────────────────────────────────────────────
def _dispatch_payload(customer_id, tank_id=None, with_disposal=False):
    """Build a DispatchCreate body. ⚠️ VERIFY field names against schemas/dispatches.py."""
    payload = {
        "customer_id": customer_id,
        "tank_id": tank_id,
        "date": "2026-01-15",
        "raw_material": "UCO",
        "value_gei": 1,
        "quantity": 1000,
        "entrance_ids": [],
    }
    if with_disposal:
        payload["disposal"] = {
            "date": "2026-01-15",
            "quantity": 50,
            "notes": "test disposal",
        }
    return payload


# ── TEST 1: create returns 201 ──────────────────────────────────────────────
def test_create_dispatch(client, auth_headers, customer, tank):
    res = client.post("/dispatches/", json=_dispatch_payload(customer.id, tank.id),
                      headers=auth_headers)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["customer_id"] == customer.id
    assert body["quantity"] == 1000
    assert body["batch_id"].startswith("SA")   # auto-generated batch id


# ── TEST 2: create decreases tank stock ─────────────────────────────────────
def test_create_decreases_tank_stock(client, auth_headers, customer, tank, db_session):
    start_stock = tank.stock  # 5000
    res = client.post("/dispatches/", json=_dispatch_payload(customer.id, tank.id),
                      headers=auth_headers)
    assert res.status_code == 201, res.text

    db_session.refresh(tank)
    assert tank.stock == start_stock - 1000   # 1000 kg dispatched


# ── TEST 3: delete returns 204 (NOT 500) — the core production bug ───────────
def test_delete_dispatch_returns_204(client, auth_headers, customer, tank):
    created = client.post("/dispatches/", json=_dispatch_payload(customer.id, tank.id),
                         headers=auth_headers)
    assert created.status_code == 201, created.text
    dispatch_id = created.json()["id"]

    deleted = client.delete(f"/dispatches/{dispatch_id}", headers=auth_headers)
    assert deleted.status_code == 204, deleted.text   # was 500 in production

    # And it's really gone
    gone = client.get(f"/dispatches/{dispatch_id}", headers=auth_headers)
    assert gone.status_code == 404


# ── TEST 4: delete restores tank stock ──────────────────────────────────────
def test_delete_restores_tank_stock(client, auth_headers, customer, tank, db_session):
    start_stock = tank.stock  # 5000

    created = client.post("/dispatches/", json=_dispatch_payload(customer.id, tank.id),
                         headers=auth_headers)
    dispatch_id = created.json()["id"]

    client.delete(f"/dispatches/{dispatch_id}", headers=auth_headers)

    db_session.refresh(tank)
    assert tank.stock == start_stock   # back to where we started


# ── TEST 5: delete a dispatch WITH a disposal — the cascade that broke prod ──
def test_delete_dispatch_with_disposal(client, auth_headers, customer, tank):
    created = client.post(
        "/dispatches/",
        json=_dispatch_payload(customer.id, tank.id, with_disposal=True),
        headers=auth_headers,
    )
    assert created.status_code == 201, created.text
    dispatch_id = created.json()["id"]

    # This is the exact scenario that produced the IntegrityError 500.
    deleted = client.delete(f"/dispatches/{dispatch_id}", headers=auth_headers)
    assert deleted.status_code == 204, deleted.text
