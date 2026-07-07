"""
test_cascade_deletes.py — Step 3: the remaining cascade-delete scenarios.

Same bug family as the dispatch/disposal cascade (Step 2), but for the other
parent→child relationships that have NOT-NULL foreign keys:

  1. Delete a SUPPLIER that has PICKUP POINTS  → must cascade, not 500.
  2. Delete a RECEIPT that is linked to an ENTRANCE → must not crash traceability.
  3. Delete a SUPPLIER that has RECEIPTS → receipts lose their reference cleanly.

These target the IntegrityError class of bug ("NOT NULL FK but no cascade").

NOTE — spots marked  # ⚠️ VERIFY  are inferred. If a request returns 422/404,
the response body names the mismatch; adjust and re-run.
"""

import pytest
from auth import hash_password
from models.users import User, UserRole


TEST_USERNAME = "testadmin"
TEST_PASSWORD = "TestPass123!"


# ── Auth ────────────────────────────────────────────────────────────────────
@pytest.fixture()
def test_user(db_session):
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
    res = client.post("/auth/login", data={
        "username": TEST_USERNAME, "password": TEST_PASSWORD,
    })
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


# ── Helpers that drive the real API ─────────────────────────────────────────
def _create_supplier(client, headers, supplier_type="Urban", name="Cascade Test Supplier"):
    """Create a supplier via the API. supplier_type + name are required."""
    res = client.post("/suppliers/", json={
        "supplier_type": supplier_type,   # "Horeca" or "Urban" (data values)
        "name": name,
        "cif": "B12345678",
    }, headers=headers)
    assert res.status_code in (200, 201), res.text
    return res.json()


def _add_pickup_point(client, headers, supplier_id, name="Contenedor Test"):
    """
    Create a pickup point for a supplier.
    ⚠️ VERIFY: endpoint path and payload for pickup points. Common patterns:
       POST /pickup-points/  with {"supplier_id":..., "name":..., "latitude":..., "longitude":...}
    Adjust to match routes/pickupPoints.py if this 404s.
    """
    res = client.post("/pickup-points/", json={
        "supplier_id": supplier_id,
        "name": name,
        "latitude": 37.5,
        "longitude": -4.2,
    }, headers=headers)
    assert res.status_code in (200, 201), res.text
    return res.json()


def _create_receipt(client, headers, supplier_id, qty=100.0):
    """Create a receipt via the API. supplier_id + date + quantity_kg required."""
    res = client.post("/receipts/", json={
        "supplier_id": supplier_id,
        "date": "2026-01-10",
        "quantity_kg": qty,
        "raw_material": "UCO",
    }, headers=headers)
    assert res.status_code in (200, 201), res.text
    return res.json()


# ── TEST 1: delete supplier WITH pickup points → cascades, not 500 ──────────
def test_delete_supplier_with_pickup_points(client, auth_headers):
    supplier = _create_supplier(client, auth_headers)
    _add_pickup_point(client, auth_headers, supplier["id"], "Punto 1")
    _add_pickup_point(client, auth_headers, supplier["id"], "Punto 2")

    res = client.delete(f"/suppliers/{supplier['id']}", headers=auth_headers)
    assert res.status_code in (200, 204), res.text   # not 500

    gone = client.get(f"/suppliers/{supplier['id']}", headers=auth_headers)
    assert gone.status_code == 404

# ── TEST 2: delete supplier WITH receipts → BLOCKED with 400 (Option A) ─────
def test_delete_supplier_with_receipts_is_blocked(client, auth_headers):
    supplier = _create_supplier(client, auth_headers, name="Supplier With Receipts")
    _create_receipt(client, auth_headers, supplier["id"])

    res = client.delete(f"/suppliers/{supplier['id']}", headers=auth_headers)
    assert res.status_code == 400, res.text          # blocked, not deleted
    assert "albarán" in res.json()["detail"].lower() # helpful message returned

    # And the supplier is still there (protected)
    still_there = client.get(f"/suppliers/{supplier['id']}", headers=auth_headers)
    assert still_there.status_code == 200


# ── TEST 3: delete a receipt → returns cleanly ──────────────────────────────
def test_delete_receipt(client, auth_headers):
    supplier = _create_supplier(client, auth_headers, name="Supplier For Receipt Delete")
    receipt = _create_receipt(client, auth_headers, supplier["id"])

    res = client.delete(f"/receipts/{receipt['id']}", headers=auth_headers)
    assert res.status_code in (200, 204), res.text

    gone = client.get(f"/receipts/{receipt['id']}", headers=auth_headers)
    assert gone.status_code == 404


# ── TEST 4: create a supplier with the OTHER type too (Horeca) ──────────────
def test_delete_horeca_supplier(client, auth_headers):
    supplier = _create_supplier(client, auth_headers, supplier_type="Horeca",
                               name="Horeca Cascade Test")
    res = client.delete(f"/suppliers/{supplier['id']}", headers=auth_headers)
    assert res.status_code in (200, 204), res.text


def test_delete_customer_with_dispatches_is_blocked(client, auth_headers):
    # create a customer
    cust = client.post("/customers/", json={"name": "Cliente Con Salidas"},
                       headers=auth_headers)
    assert cust.status_code in (200, 201), cust.text
    customer_id = cust.json()["id"]

    # create a dispatch for that customer
    disp = client.post("/dispatches/", json={
        "customer_id": customer_id,
        "date": "2026-01-15",
        "quantity": 500,
        "entrance_ids": [],
    }, headers=auth_headers)
    assert disp.status_code == 201, disp.text

    # deleting the customer must now be blocked
    res = client.delete(f"/customers/{customer_id}", headers=auth_headers)
    assert res.status_code == 400, res.text
    assert "salida" in res.json()["detail"].lower()