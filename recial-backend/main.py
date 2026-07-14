import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routes import customers, suppliers, receipts, entrances, tanks, dispatches, reports, pickupPoints, dashboard, auth, invoices, documents, traceability
from models.customers import Customer
from models.suppliers import Supplier

# ── Debug — remove after confirming DB connects ──────────
print(">>> DATABASE_URL =", os.getenv("DATABASE_URL", "NOT SET"))

# Create all tables on startup
Base.metadata.create_all(bind=engine)

from seed_users import seed_users
seed_users()

app = FastAPI(
    title="Recial API",
    description="Backend API for the Recial used vegetable oil recycling app",
    version="1.0.0",
)


from migrate_invoices import migrate_invoices
migrate_invoices()

from migrate_suppliers import migrate_suppliers
migrate_suppliers()

# ── CORS ─────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────
app.include_router(customers.router)
app.include_router(suppliers.router)
app.include_router(receipts.router)
app.include_router(entrances.router)
app.include_router(tanks.router)
app.include_router(dispatches.router)
app.include_router(reports.router)
app.include_router(pickupPoints.router)
app.include_router(dashboard.router)
app.include_router(auth.router)
app.include_router(invoices.router)
app.include_router(documents.router)
app.include_router(traceability.router)

# ── Health check ──────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "Recial API is running"}