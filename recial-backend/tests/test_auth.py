"""
test_auth.py — Step 1: authentication.

These are the gate: every other protected endpoint needs a token, so we prove
login works first. This suite also would have caught the bcrypt/passlib crash
that took down production login — because it actually calls verify_password
through the real /auth/login route.

We create our OWN test user with a known password (rather than relying on the
seeded real users, whose plaintext passwords we don't have).
"""

import pytest
from auth import hash_password
from models.users import User, UserRole


# ── Fixture: a known test user in the database ──────────────────────────────
TEST_USERNAME = "testadmin"
TEST_PASSWORD = "TestPass123!"


@pytest.fixture()
def test_user(db_session):
    """
    Insert a known admin user into the test DB using the app's own
    hash_password(), so the stored hash is exactly what verify_password()
    expects. Returns the User object.
    """
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


# ── Login: happy path ───────────────────────────────────────────────────────
def test_login_success(client, test_user):
    """Valid credentials return 200 and a bearer token."""
    res = client.post("/auth/login", data={
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD,
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]                       # non-empty token
    assert body["user"]["username"] == TEST_USERNAME  # correct user echoed back


# ── Login: wrong password ───────────────────────────────────────────────────
def test_login_wrong_password(client, test_user):
    """Wrong password returns 401, not 200 and not 500."""
    res = client.post("/auth/login", data={
        "username": TEST_USERNAME,
        "password": "WrongPassword!",
    })
    assert res.status_code == 401, res.text


# ── Login: unknown user ─────────────────────────────────────────────────────
def test_login_unknown_user(client):
    """A username that doesn't exist returns 401."""
    res = client.post("/auth/login", data={
        "username": "nobody",
        "password": "whatever",
    })
    assert res.status_code == 401, res.text


# ── Token actually works on a protected route ───────────────────────────────
def test_token_grants_access_to_me(client, test_user):
    """
    The token from login is accepted by a protected endpoint (/auth/me).
    This proves the whole auth round-trip: hash -> verify -> issue -> validate.
    """
    login = client.post("/auth/login", data={
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD,
    })
    token = login.json()["access_token"]

    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    assert res.json()["username"] == TEST_USERNAME


# ── Protected route rejects missing/invalid token ───────────────────────────
def test_me_requires_token(client):
    """/auth/me without a token is rejected (401)."""
    res = client.get("/auth/me")
    assert res.status_code == 401, res.text
