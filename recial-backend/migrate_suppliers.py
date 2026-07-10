# migrate_suppliers.py
from sqlalchemy import text
from database import engine

_EXPECTED_COLUMNS = {
    "email":          "VARCHAR(120)",
    "phone":          "VARCHAR(30)",
    "city":           "VARCHAR(100)",
    "county":         "VARCHAR(100)",
    "contact_person": "VARCHAR(120)",
}

def migrate_suppliers():
    try:
        with engine.begin() as conn:
            # Drop the unique constraint on cif — grouped businesses
            # (care homes, schools) legitimately share a group CIF.
            conn.execute(text(
                "ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_cif_key"
            ))
            exists = conn.execute(text("SELECT to_regclass('public.suppliers')")).scalar()
            if exists is None:
                print("[migrate_suppliers] 'suppliers' table doesn't exist yet — nothing to do.")
                return
            rows = conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'suppliers'"
            )).fetchall()
            existing = {r[0] for r in rows}
            added = 0
            for col, ddl in _EXPECTED_COLUMNS.items():
                if col not in existing:
                    conn.execute(text(f'ALTER TABLE suppliers ADD COLUMN {col} {ddl}'))
                    print(f"[migrate_suppliers] Added missing column: {col}")
                    added += 1
            print(f"[migrate_suppliers] Done — {added} column(s) added." if added
                  else "[migrate_suppliers] Nothing to do — schema already up to date.")
    except Exception as e:
        print(f"[migrate_suppliers] ERROR (skipped): {e}")