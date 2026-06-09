# 🫙 Recial UCO Traceability System

A full-stack web application for tracking **Used Cooking Oil (UCO)** collection, processing and dispatch at **Reciclajes Recial S.L.** — a waste oil recycling company based in Luque, Córdoba, Spain.

Built to replace manual spreadsheet tracking with a proper traceability system that meets **ISCC certification** requirements.

🌐 **Live App:** [https://mzpqhv96qjkzktfr4qxl9im5.hosting.codeyourfuture.io](https://mzpqhv96qjkzktfr4qxl9im5.hosting.codeyourfuture.io)

---

## 📸 Screenshots

> Dashboard · Suppliers · Reports · Quarterly Closing

---

## 🏗️ Architecture

```
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│   React Frontend │ ──────▶│  FastAPI Backend │ ──────▶│   PostgreSQL DB  │
│   (nginx/Docker) │  HTTP  │  (uvicorn/Docker)│  ORM   │   (Coolify)      │
└─────────────────┘        └─────────────────┘        └─────────────────┘
```

**Frontend:** React · Recharts · Axios · React Router  
**Backend:** FastAPI · SQLAlchemy · JWT Auth · reportlab · openpyxl  
**Database:** PostgreSQL  
**Deployment:** Docker · nginx · Coolify  

---

## ✨ Features

### 🔐 Authentication & Roles
- JWT-based authentication with 8-hour token expiry
- Three role levels with different permissions:
  - **Admin** — full access, user management
  - **Manager** — create and edit, no delete
  - **Driver** — create receipts only

### 📦 Core Traceability Modules
| Module | Description |
|--------|-------------|
| **Suppliers** | Manage Horeca (type A) and Urban (type B) suppliers with pickup point coordinates |
| **Receipts** | Log UCO collections per supplier, with per-pickup-point quantities |
| **Entrances** | Batch receipts into tank entrance records (batch ID: `DDMMYYA/B`) |
| **Tanks** | Track tank stock levels with automatic updates on entrance/dispatch |
| **Dispatches** | Record outgoing sales with disposal records and batch IDs (`SADDMMYY`) |
| **Customers** | Manage buyers with address and CIF details |

### 📊 Reports (7 reports across 4 sections)

**Traceability**
- Mass Balance Excel (PG.09.01/REG-A ISCC format)

**Operations**
- Receipts Summary — filter by supplier, type, date range
- Tank Stock Report — monthly history reconstructed from entrances/dispatches
- Urban Collection PDF — RESUMEN RECOGIDA URBANO per municipality, per pickup point

**Commercial**
- Dispatches Summary — with monthly bar chart
- Customer Activity — revenue, avg order size, activity status, monthly trend
- Supplier Activity — collection performance, activity status, monthly trend

**Audit**
- Quarterly Closing (CIERRES TRIMESTRALES) — view + Excel download
- Annual Summary — monthly breakdown with charts

### 🧾 Invoice Generation
- PDF invoice generation per dispatch
- Matches official Recial invoice format (GDPR footer, IVA 21%, payment terms)
- Downloadable directly from the dispatches table

### 🗺️ Logistics Map
- Interactive 3D map of Urban supplier pickup points
- Coordinates stored per pickup point with Google Maps integration

---

## 🚀 Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL 14+

### Backend Setup

```bash
cd recial-backend

# Create virtual environment
python3.12 -m venv venv

# Install dependencies
./venv/bin/pip install -r requirements.txt

# Set up environment variable
export DATABASE_URL=postgresql://user:password@localhost:5432/recial_db

# Create database
createdb recial_db

# Start server
./venv/bin/uvicorn main:app --reload
```

API docs available at: `http://localhost:8000/docs`

### Frontend Setup

```bash
# Install dependencies
npm install

# Set API URL (optional, defaults to localhost:8000)
export REACT_APP_API_URL=http://localhost:8000

# Start development server
npm start
```

App runs at: `http://localhost:3000`

---

## 🗂️ Project Structure

```
RecialApp/
├── src/                        # React frontend
│   ├── pages/
│   │   ├── dashboard.jsx       # KPIs, charts, activity feed
│   │   ├── suppliers.jsx       # Supplier CRUD + pickup points
│   │   ├── receipts.jsx        # UCO collection records
│   │   ├── entrances.jsx       # Tank entrance batches
│   │   ├── dispatches.jsx      # Outgoing sales + invoices
│   │   ├── tanks.jsx           # Tank stock management
│   │   ├── reports.jsx         # All 7 reports
│   │   └── settings.jsx        # User management
│   ├── components/
│   │   └── SideBar.jsx         # Navigation with role badges
│   ├── services/               # Axios API calls
│   └── context/
│       └── AuthContext.js      # JWT auth state
│
├── recial-backend/             # FastAPI backend
│   ├── main.py                 # App entry point + CORS
│   ├── database.py             # SQLAlchemy engine
│   ├── auth.py                 # JWT helpers + role guards
│   ├── models/                 # SQLAlchemy ORM models
│   │   ├── supplier.py
│   │   ├── receipt.py
│   │   ├── entrance.py
│   │   ├── dispatch.py
│   │   ├── disposal.py
│   │   ├── tank.py
│   │   ├── pickup_point.py
│   │   ├── receipt_pickup.py
│   │   ├── invoice.py
│   │   └── user.py
│   ├── routes/                 # API endpoints
│   │   ├── suppliers.py
│   │   ├── receipts.py
│   │   ├── entrances.py
│   │   ├── dispatches.py
│   │   ├── tanks.py
│   │   ├── reports.py          # All report endpoints + PDF/Excel generators
│   │   ├── invoices.py         # Invoice PDF generation
│   │   ├── dashboard.py
│   │   ├── auth.py
│   │   └── pickup_points.py
│   └── schemas/                # Pydantic validation schemas
│
├── Dockerfile                  # Multi-stage React build
├── nginx.conf                  # Production nginx config
└── .dockerignore
```

---

## 🔌 API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Get JWT token |
| `GET` | `/auth/me` | Current user info |
| `GET` | `/suppliers/` | List suppliers |
| `GET` | `/receipts/` | List receipts |
| `GET` | `/entrances/` | List entrances |
| `GET` | `/dispatches/` | List dispatches |
| `GET` | `/tanks/` | List tanks with stock |
| `GET` | `/dashboard/` | KPIs and activity data |
| `GET` | `/reports/mass-balance` | ISCC Mass Balance Excel |
| `GET` | `/reports/quarterly-closing` | CIERRES TRIMESTRALES |
| `GET` | `/reports/quarterly-closing/excel` | Download Excel |
| `GET` | `/reports/urban-collection/{id}/pdf` | Municipality PDF |
| `GET` | `/invoices/{dispatch_id}` | Generate invoice PDF |

Full interactive docs at `/docs` (Swagger UI).

---

## 🐳 Docker Deployment

```bash
# Build and run frontend
docker build -t recial-frontend .
docker run -p 80:80 -e REACT_APP_API_URL=https://your-api-url recial-frontend
```

The `Dockerfile` uses a **multi-stage build**:
1. **Build stage** — Node 18 Alpine, runs `npm run build`
2. **Serve stage** — nginx Alpine, serves the `build/` folder

---

## 🌍 Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `ALLOWED_ORIGINS` | Backend | Comma-separated CORS origins |
| `REACT_APP_API_URL` | Frontend (build time) | Backend API base URL |

---

## 📄 Business Context

Recial collects UCO from two supplier types:
- **Horeca (Type A)** — restaurants and food service businesses
- **Urban (Type B)** — street container pickup points managed per municipality

The oil flows through the system:

```
Suppliers → Receipts → Entrances (into tanks) → Dispatches (to customers)
                                                      ↓
                                                  Disposal record
                                                  (mermas / losses)
```

Each entrance and dispatch generates a **batch ID** used for ISCC traceability certification. The system generates all regulatory documents required by Spanish and EU waste oil regulations.

---

## 👤 Author

**Jesus del Moral Lopez**  
Software Developer · Code Your Future Graduate  
[delmorallopez@gmail.com](mailto:delmorallopez@gmail.com) · [GitHub](https://github.com/delmorallopez) · [LinkedIn](https://linkedin.com/in/delmorallopez)

---

## 📜 License

This project was built for Reciclajes Recial S.L. — all business logic, report formats and data structures are proprietary to the company.
