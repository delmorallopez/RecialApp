from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routes import customers, suppliers, receipts, entrances, tanks
from models.customers import Customer
from models.suppliers import Supplier  # ← this line must exist

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Recial API",
    description="Backend API for the Recial used vegetable oil recycling app",
    version="1.0.0",
)

# -----------------------------------------------
# CORS — allow React frontend to talk to this API
# -----------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------
# Include routers
# -----------------------------------------------
app.include_router(customers.router)
app.include_router(suppliers.router)
app.include_router(receipts.router)
app.include_router(entrances.router)
app.include_router(tanks.router)

# -----------------------------------------------
# Health check
# -----------------------------------------------
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "Recial API is running"}
