# migrate_invoices.py
#
# One-time, idempotent schema fix for the `invoices` table.
#
# PROBLEM: the Invoice model defines columns (quantity_kg, price_per_kg, ...)
# that don't exist in the production `invoices` table, because the table was
# created before those fields were added. Base.metadata.create_all() creates
# missing TABLES but never adds missing COLUMNS to existing tables. As a result
# any query touching invoices (including deleting a dispatch) crashes with
# "column invoices.quantity_kg does not exist".
#
# FIX: on startup, check which expected columns are missing and ALTER TABLE
# to add them. Safe to run on every boot — it only adds columns that are
# absent, and does nothing if they already exist.
#
# HOW TO USE:
#   1. Place this file next to main.py
#   2. In main.py, AFTER Base.metadata.create_all(bind=engine), add:
#         from migrate_invoices import migrate_invoices
#         migrate_invoices()
#   3. Redeploy. Check logs for the [migrate_invoices] messages.
#   4. (Optional) leave it in — it's harmless once columns exist.

from sqlalchemy import text
from database import engine

# Column name -> SQL definition to add if missing.
# Defaults are included so the ALTER works even if rows already exist.
_EXPECTED_COLUMNS = {
    "invoice_number": "VARCHAR(50)",
    "price_per_kg":   "DOUBLE PRECISION DEFAULT 1.09",
    "quantity_kg":    "DOUBLE PRECISION DEFAULT 0",
    "base_amount":    "DOUBLE PRECISION DEFAULT 0",
    "iva_pct":        "DOUBLE PRECISION DEFAULT 21",
    "iva_amount":     "DOUBLE PRECISION DEFAULT 0",
    "total_amount":   "DOUBLE PRECISION DEFAULT 0",
    "invoice_date":   "DATE",
    "notes":          "VARCHAR(500)",
    "created_at":     "TIMESTAMP WITH TIME ZONE DEFAULT now()",
    "updated_at":     "TIMESTAMP WITH TIME ZONE DEFAULT now()",
}


def migrate_invoices():
    try:
        with engine.begin() as conn:
            # Does the invoices table exist at all?
            exists = conn.execute(text(
                "SELECT to_regclass('public.invoices')"
            )).scalar()
            if exists is None:
                print("[migrate_invoices] 'invoices' table doesn't exist yet — "
                      "create_all will handle it. Nothing to do.")
                return

            # Which columns are already present?
            rows = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'invoices'"
            )).fetchall()
            existing = {r[0] for r in rows}

            added = 0
            for col, ddl in _EXPECTED_COLUMNS.items():
                if col not in existing:
                    conn.execute(text(
                        f'ALTER TABLE invoices ADD COLUMN {col} {ddl}'
                    ))
                    print(f"[migrate_invoices] Added missing column: {col}")
                    added += 1

            if added:
                print(f"[migrate_invoices] Done — {added} column(s) added.")
            else:
                print("[migrate_invoices] Nothing to do — schema already up to date.")
    except Exception as e:
        # Never let a migration problem crash the whole app on boot.
        print(f"[migrate_invoices] ERROR (skipped): {e}")
