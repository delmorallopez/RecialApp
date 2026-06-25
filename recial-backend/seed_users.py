# seed_users.py
#
# One-time user seeder for production.
#
# Inserts the existing users (migrated from the local database) into whatever
# database the backend is currently connected to — but ONLY if a user with
# that username doesn't already exist. This makes it safe to run on every
# startup: it will insert the 3 users once, then do nothing on subsequent boots.
#
# The hashed_password values are copied verbatim from the local database, so
# each user's existing password continues to work unchanged.
#
# HOW TO USE:
#   1. Place this file next to main.py
#   2. In main.py, AFTER Base.metadata.create_all(bind=engine), add:
#         from seed_users import seed_users
#         seed_users()
#   3. Redeploy. Check logs for the seeding messages.
#   4. Log in.
#   5. (Optional) Remove the two lines from main.py and delete this file.
#
# Safe to leave in place — it's idempotent (won't create duplicates).

from database import SessionLocal
from models.users import User, UserRole


# Users migrated from local recial_db. hashed_password values are verbatim,
# so existing passwords keep working. role uses the enum NAME (ADMIN) to match
# how the existing column stores values.
_SEED_USERS = [
    {
        "username":        "jesus",
        "full_name":       "Jesus del Moral",
        "email":           "delmorallopez@gmail.com",
        "hashed_password": "$2b$12$CxxSR3ZN7AF9efejjMboRO4iZFQurrBXYnt8AWeMF.zKTeI2HSHHG",
        "role":            UserRole.ADMIN,
        "is_active":       True,
    },
    {
        "username":        "alberto",
        "full_name":       "Alberto del Moral",
        "email":           "info@recial.es",
        "hashed_password": "$2b$12$5PmwRb0SyxuGSS3lWGKy2eBlaaPZLDRJKCi6PucDutanK9Vl.y9cy",
        "role":            UserRole.ADMIN,
        "is_active":       True,
    },
    {
        "username":        "mangeles",
        "full_name":       "Maria Angeles Molina",
        "email":           "info@eleacodistributions.com",
        "hashed_password": "$2b$12$Uv9t.Y3GJ04rHMSj3fl8CuobQjRbwCsgiAgmSL1jGqahyCa8fl4Fi",
        "role":            UserRole.ADMIN,
        "is_active":       True,
    },
]


def seed_users():
    db = SessionLocal()
    created = 0
    try:
        for data in _SEED_USERS:
            existing = db.query(User).filter(User.username == data["username"]).first()
            if existing:
                print(f"[seed_users] '{data['username']}' already exists — skipping.")
                continue
            db.add(User(**data))
            created += 1
            print(f"[seed_users] Creating user '{data['username']}'.")
        if created:
            db.commit()
            print(f"[seed_users] Done — {created} user(s) created.")
        else:
            print("[seed_users] Nothing to do — all users already present.")
    except Exception as e:
        db.rollback()
        print(f"[seed_users] ERROR — rolled back: {e}")
    finally:
        db.close()