# routes/traceability.py
#
# Bidirectional batch traceability for ISCC audit purposes.
#
# Actual chain of custody (per real models):
#   Receipt.entrance_id  -> Entrance        (many Receipts belong to one Entrance)
#   Entrance <-> Dispatch via dispatch_entrances (many-to-many)
#
#   FORWARD  trace: Receipt -> its Entrance -> Dispatches linked to that Entrance
#   BACKWARD trace: Dispatch -> its Entrances -> Receipts belonging to each Entrance
#
# Batch ID fields differ per model:
#   Receipt.receipt_code   (nullable, e.g. "R-0123")
#   Entrance.batch_id      (e.g. "010124A")
#   Dispatch.batch_id      (e.g. "SA010126")

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from io import BytesIO

from database import get_db
from models.receipts import Receipt
from models.entrances import Entrance
from models.dispatches import Dispatch

router = APIRouter(prefix="/traceability", tags=["Traceability"])


# ════════════════════════════════════════════════════════════
# Serializers
# ════════════════════════════════════════════════════════════

def _entrance_to_dict(en: Entrance):
    return {
        "id":          en.id,
        "batch_id":    en.batch_id,
        "date":        en.date.isoformat() if en.date else None,
        "quantity_kg": en.quantity_kg,
        "tank_name":   en.tank.name if getattr(en, "tank", None) else None,
    }


def _receipt_to_dict(r: Receipt):
    return {
        "id":            r.id,
        "batch_id":      r.receipt_code or f"R-{r.id}",
        "date":          r.date.isoformat() if r.date else None,
        "quantity_kg":   r.quantity_kg,
        "supplier_name": r.supplier.name if getattr(r, "supplier", None) else None,
        "supplier_type": (
            r.supplier.supplier_type.value if hasattr(r.supplier.supplier_type, "value")
            else str(r.supplier.supplier_type)
        ) if getattr(r, "supplier", None) else None,
    }


def _dispatch_to_dict(d: Dispatch):
    return {
        "id":            d.id,
        "batch_id":      d.batch_id,
        "date":          d.date.isoformat() if d.date else None,
        "quantity":      d.quantity,
        "customer_name": d.customer.name if getattr(d, "customer", None) else None,
    }


# ════════════════════════════════════════════════════════════
# Search — batch_id / receipt_code (partial match)
# ════════════════════════════════════════════════════════════

@router.get("/search")
def search_batch(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    receipts   = db.query(Receipt).filter(Receipt.receipt_code.ilike(f"%{q}%")).limit(10).all()
    entrances  = db.query(Entrance).filter(Entrance.batch_id.ilike(f"%{q}%")).limit(10).all()
    dispatches = db.query(Dispatch).filter(Dispatch.batch_id.ilike(f"%{q}%")).limit(10).all()

    return {
        "receipts": [
            {
                "id": r.id,
                "batch_id": r.receipt_code or f"R-{r.id}",
                "type": "receipt",
                "label": f"{r.receipt_code or f'R-{r.id}'} — {r.supplier.name if getattr(r,'supplier',None) else ''}",
            }
            for r in receipts
        ],
        "entrances": [
            {
                "id": e.id,
                "batch_id": e.batch_id,
                "type": "entrance",
                "label": f"{e.batch_id} — {e.tank.name if getattr(e,'tank',None) else ''}",
            }
            for e in entrances
        ],
        "dispatches": [
            {
                "id": d.id,
                "batch_id": d.batch_id,
                "type": "dispatch",
                "label": f"{d.batch_id} — {d.customer.name if getattr(d,'customer',None) else ''}",
            }
            for d in dispatches
        ],
    }


# ════════════════════════════════════════════════════════════
# FORWARD trace — Receipt -> Entrance -> Dispatches
# ════════════════════════════════════════════════════════════

@router.get("/forward/{receipt_id}")
def trace_forward(receipt_id: int, db: Session = Depends(get_db)):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    entrance_nodes = []
    total_dispatched = 0
    dispatch_ids_seen = set()

    if receipt.entrance_id:
        entrance = db.query(Entrance).filter(Entrance.id == receipt.entrance_id).first()
        if entrance:
            dispatches = entrance.dispatches or []  # via many-to-many backref
            dispatch_nodes = []
            for d in dispatches:
                if d.id not in dispatch_ids_seen:
                    dispatch_ids_seen.add(d.id)
                    total_dispatched += d.quantity or 0
                dispatch_nodes.append(_dispatch_to_dict(d))

            entrance_nodes.append({
                **_entrance_to_dict(entrance),
                "dispatches": dispatch_nodes,
            })

    return {
        "direction": "forward",
        "root": {
            "type": "receipt",
            **_receipt_to_dict(receipt),
        },
        "entrances": entrance_nodes,
        "summary": {
            "total_entrances":     len(entrance_nodes),
            "total_dispatches":    len(dispatch_ids_seen),
            "receipt_kg":          receipt.quantity_kg,
            "total_dispatched_kg": total_dispatched,
            "fully_traced":        len(entrance_nodes) > 0 and len(dispatch_ids_seen) > 0,
        },
    }


# ════════════════════════════════════════════════════════════
# BACKWARD trace — Dispatch -> Entrances -> Receipts
# ════════════════════════════════════════════════════════════

@router.get("/backward/{dispatch_id}")
def trace_backward(dispatch_id: int, db: Session = Depends(get_db)):
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    entrances = dispatch.entrances or []  # many-to-many relationship

    entrance_nodes = []
    total_received = 0
    receipt_ids_seen = set()

    for en in entrances:
        receipts = db.query(Receipt).filter(Receipt.entrance_id == en.id).all()
        receipt_nodes = []
        for r in receipts:
            if r.id not in receipt_ids_seen:
                receipt_ids_seen.add(r.id)
                total_received += r.quantity_kg or 0
            receipt_nodes.append(_receipt_to_dict(r))

        entrance_nodes.append({
            **_entrance_to_dict(en),
            "receipts": receipt_nodes,
        })

    return {
        "direction": "backward",
        "root": {
            "type": "dispatch",
            **_dispatch_to_dict(dispatch),
        },
        "entrances": entrance_nodes,
        "summary": {
            "total_entrances":   len(entrance_nodes),
            "total_receipts":    len(receipt_ids_seen),
            "dispatch_kg":       dispatch.quantity,
            "total_received_kg": total_received,
            "fully_traced":      len(entrance_nodes) > 0 and len(receipt_ids_seen) > 0,
        },
    }


# ════════════════════════════════════════════════════════════
# PDF — Traceability certificate
# ════════════════════════════════════════════════════════════

def _generate_traceability_pdf(trace_data: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from reportlab.platypus import Table, TableStyle
    from datetime import date as date_type
    import os

    buf = BytesIO()
    w, h = A4
    c = canvas.Canvas(buf, pagesize=A4)
    LEFT  = 15 * mm
    RIGHT = w - 15 * mm
    TOP   = h - 15 * mm

    GREEN_DARK  = colors.HexColor("#1e3d2a")
    GREEN       = colors.HexColor("#2d7a4f")
    GREEN_LIGHT = colors.HexColor("#8dc63f")
    BLUE        = colors.HexColor("#1d4ed8")
    AMBER       = colors.HexColor("#b45309")
    LGRAY       = colors.HexColor("#f2f2f2")
    DARK        = colors.HexColor("#1a1a2e")
    GRAY        = colors.HexColor("#6b7280")
    WHITE       = colors.white

    _ASSETS = os.path.join(os.path.dirname(__file__), "../assets")
    _LOGO   = os.path.join(_ASSETS, "LogoRecial.png")

    direction = trace_data["direction"]
    root      = trace_data["root"]
    summary   = trace_data["summary"]

    # ── Header ──
    if os.path.exists(_LOGO):
        c.drawImage(_LOGO, RIGHT - 35*mm, TOP - 12*mm, width=35*mm, height=14*mm,
                    preserveAspectRatio=True, mask='auto')

    title = "TRACEABILITY CERTIFICATE — FORWARD TRACE" if direction == "forward" else "TRACEABILITY CERTIFICATE — BACKWARD TRACE"
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(GREEN_DARK)
    c.drawString(LEFT, TOP - 8*mm, title)

    subtitle = f"Generated: {date_type.today().strftime('%d/%m/%Y')}  ·  Root batch: {root['batch_id']}"
    c.setFont("Helvetica", 9)
    c.setFillColor(GRAY)
    c.drawString(LEFT, TOP - 13*mm, subtitle)

    c.setStrokeColor(GREEN)
    c.setLineWidth(2)
    c.line(LEFT, TOP - 17*mm, RIGHT, TOP - 17*mm)

    y = TOP - 25*mm

    # ── Root node box ──
    root_label = "STARTING POINT: RECEIPT" if direction == "forward" else "STARTING POINT: DISPATCH"
    root_color = BLUE if direction == "forward" else AMBER
    c.setFillColor(root_color)
    c.roundRect(LEFT, y - 18*mm, RIGHT - LEFT, 16*mm, 3*mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(LEFT + 6*mm, y - 6*mm, root_label)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(LEFT + 6*mm, y - 13*mm, root["batch_id"])

    if direction == "forward":
        info = f"{root.get('supplier_name','—')}  ·  {root.get('date','—')}  ·  {root.get('quantity_kg',0)} kg"
    else:
        info = f"{root.get('customer_name','—')}  ·  {root.get('date','—')}  ·  {root.get('quantity', root.get('quantity_kg',0))} kg"
    c.setFont("Helvetica", 9)
    c.drawRightString(RIGHT - 6*mm, y - 11*mm, info)

    y -= 26*mm

    # ── Summary box ──
    c.setFillColor(LGRAY)
    c.roundRect(LEFT, y - 16*mm, RIGHT - LEFT, 14*mm, 2*mm, fill=1, stroke=0)
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 9)
    if direction == "forward":
        stats = [
            ("Entrances fed", str(summary["total_entrances"])),
            ("Dispatches reached", str(summary["total_dispatches"])),
            ("Receipt kg", f"{summary['receipt_kg']:.0f} kg"),
            ("Total dispatched", f"{summary['total_dispatched_kg']:.0f} kg"),
        ]
    else:
        stats = [
            ("Entrances used", str(summary["total_entrances"])),
            ("Receipts traced", str(summary["total_receipts"])),
            ("Dispatch kg", f"{summary['dispatch_kg']:.0f} kg"),
            ("Total received", f"{summary['total_received_kg']:.0f} kg"),
        ]
    col_w = (RIGHT - LEFT) / 4
    for i, (label, value) in enumerate(stats):
        cx = LEFT + col_w * i + col_w / 2
        c.setFont("Helvetica", 7)
        c.setFillColor(GRAY)
        c.drawCentredString(cx, y - 5*mm, label.upper())
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(GREEN_DARK)
        c.drawCentredString(cx, y - 11*mm, value)

    y -= 26*mm

    # ── Chain table(s) ──
    for en in trace_data["entrances"]:
        c.setFillColor(GREEN)
        c.roundRect(LEFT, y - 8*mm, RIGHT - LEFT, 7*mm, 1.5*mm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(LEFT + 4*mm, y - 5.5*mm, f"ENTRANCE: {en['batch_id']}")
        c.setFont("Helvetica", 8)
        c.drawRightString(RIGHT - 4*mm, y - 5.5*mm,
            f"{en.get('tank_name','—')}  ·  {en.get('date','—')}  ·  {en.get('quantity_kg',0):.0f} kg")
        y -= 12*mm

        linked = en.get("dispatches") if direction == "forward" else en.get("receipts")
        linked_label = "Dispatch" if direction == "forward" else "Receipt"

        if not linked:
            c.setFont("Helvetica-Oblique", 8)
            c.setFillColor(GRAY)
            c.drawString(LEFT + 6*mm, y - 4*mm, f"No {linked_label.lower()}s linked yet")
            y -= 10*mm
            continue

        headers = [f"{linked_label} Batch", "Date", ("Customer" if direction == "forward" else "Supplier"), "Quantity (kg)"]
        data = [headers]
        for item in linked:
            if direction == "forward":
                data.append([item["batch_id"], item.get("date","—") or "—", item.get("customer_name","—") or "—", f"{item.get('quantity',0):.0f}"])
            else:
                data.append([item["batch_id"], item.get("date","—") or "—", item.get("supplier_name","—") or "—", f"{item.get('quantity_kg',0):.0f}"])

        col_widths = [45*mm, 28*mm, 70*mm, 32*mm]
        tbl = Table(data, colWidths=col_widths)
        tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,0),  GREEN_LIGHT),
            ("TEXTCOLOR",     (0,0), (-1,0),  WHITE),
            ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0,0), (-1,0),  8),
            ("FONTNAME",      (0,1), (-1,-1), "Helvetica"),
            ("FONTSIZE",      (0,1), (-1,-1), 8),
            ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, LGRAY]),
            ("TEXTCOLOR",     (0,1), (-1,-1), DARK),
            ("ALIGN",         (3,0), (3,-1),  "RIGHT"),
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
            ("GRID",          (0,0), (-1,-1), 0.4, colors.HexColor("#d1d5db")),
            ("ROWHEIGHT",     (0,0), (-1,-1), 7*mm),
            ("LEFTPADDING",   (0,0), (-1,-1), 4),
        ]))
        tbl_w, tbl_h = tbl.wrapOn(c, RIGHT - LEFT - 6*mm, h)
        tbl.drawOn(c, LEFT + 6*mm, y - tbl_h)
        y -= tbl_h + 8*mm

        if y < 40*mm:
            c.showPage()
            y = h - 20*mm

    # ── Footer ──
    c.setFont("Helvetica", 7)
    c.setFillColor(GRAY)
    c.drawCentredString(w/2, 10*mm,
        "RECICLAJES RECIAL S.L.  ·  Traceability per ISCC chain-of-custody requirements  ·  C/ Carrera 56, 14880 Luque (Córdoba)")

    c.save()
    buf.seek(0)
    return buf.read()


@router.get("/forward/{receipt_id}/pdf")
def trace_forward_pdf(receipt_id: int, db: Session = Depends(get_db)):
    data = trace_forward(receipt_id, db)
    pdf = _generate_traceability_pdf(data)
    return StreamingResponse(BytesIO(pdf), media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Trace_Forward_{data['root']['batch_id']}.pdf"})


@router.get("/backward/{dispatch_id}/pdf")
def trace_backward_pdf(dispatch_id: int, db: Session = Depends(get_db)):
    data = trace_backward(dispatch_id, db)
    pdf = _generate_traceability_pdf(data)
    return StreamingResponse(BytesIO(pdf), media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Trace_Backward_{data['root']['batch_id']}.pdf"})
