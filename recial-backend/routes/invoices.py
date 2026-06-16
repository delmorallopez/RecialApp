from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional
from io import BytesIO
from datetime import date
import os

from database import get_db
from models.dispatches import Dispatch
from models.invoices import Invoice

router = APIRouter(prefix="/invoices", tags=["Invoices"])

# ── Asset paths ───────────────────────────────────────────
_ASSETS   = os.path.join(os.path.dirname(__file__), "../assets")
LOGO_PATH = os.path.join(_ASSETS, "LogoRecial.png")
BV_PATH   = os.path.join(_ASSETS, "BureauVeritas.png")
ISCC_PATH = os.path.join(_ASSETS, "ISCC.png")

DEFAULT_PRICE = 1.09


# ── Schemas ───────────────────────────────────────────────
class InvoiceUpdate(BaseModel):
    price_per_kg:   Optional[float] = None
    quantity_kg:    Optional[float] = None
    invoice_date:   Optional[date]  = None
    invoice_number: Optional[str]   = None
    iva_pct:        Optional[float] = None
    notes:          Optional[str]   = None


class InvoiceResponse(BaseModel):
    id:             int
    dispatch_id:    int
    invoice_number: Optional[str]
    price_per_kg:   float
    quantity_kg:    Optional[float]
    base_amount:    float
    iva_pct:        float
    iva_amount:     float
    total_amount:   float
    invoice_date:   Optional[date]
    notes:          Optional[str]

    class Config:
        from_attributes = True


# ── Helper: recalculate amounts ───────────────────────────
def recalc(invoice: Invoice, dispatch: Dispatch):
    qty              = invoice.quantity_kg or dispatch.quantity or 0
    base             = round(qty * invoice.price_per_kg, 2)
    iva              = round(base * (invoice.iva_pct / 100), 2)
    invoice.base_amount  = base
    invoice.iva_amount   = iva
    invoice.total_amount = round(base + iva, 2)


# ── GET /invoices/dispatch/{dispatch_id} ──────────────────
# Check if invoice exists for a dispatch
@router.get("/dispatch/{dispatch_id}", response_model=Optional[InvoiceResponse])
def get_invoice_by_dispatch(
    dispatch_id: int,
    db: Session = Depends(get_db),
):
    invoice = db.query(Invoice).filter(
        Invoice.dispatch_id == dispatch_id
    ).first()
    return invoice  # returns null if not yet created


# ── POST /invoices/dispatch/{dispatch_id} ─────────────────
# Create invoice for a dispatch (first time)
@router.post("/dispatch/{dispatch_id}", response_model=InvoiceResponse, status_code=201)
def create_invoice(
    dispatch_id:  int,
    price_per_kg: float = Query(default=DEFAULT_PRICE, ge=0.01),
    db: Session = Depends(get_db),
):
    dispatch = db.query(Dispatch).options(
        joinedload(Dispatch.customer)
    ).filter(Dispatch.id == dispatch_id).first()

    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    # Don't create duplicate
    existing = db.query(Invoice).filter(Invoice.dispatch_id == dispatch_id).first()
    if existing:
        return existing

    qty  = dispatch.quantity or 0
    base = round(qty * price_per_kg, 2)
    iva  = round(base * 0.21, 2)

    invoice = Invoice(
        dispatch_id    = dispatch_id,
        invoice_number = dispatch.batch_id,
        price_per_kg   = price_per_kg,
        quantity_kg    = None,   # None = use dispatch quantity
        base_amount    = base,
        iva_pct        = 21.0,
        iva_amount     = iva,
        total_amount   = round(base + iva, 2),
        invoice_date   = dispatch.date,
        notes          = None,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


# ── PATCH /invoices/{invoice_id} ──────────────────────────
# Edit invoice (price, quantity, date, etc.)
@router.patch("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id:  int,
    data:        InvoiceUpdate,
    db:          Session = Depends(get_db),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    dispatch = db.query(Dispatch).filter(
        Dispatch.id == invoice.dispatch_id
    ).first()

    # Apply updates
    if data.price_per_kg   is not None: invoice.price_per_kg   = data.price_per_kg
    if data.quantity_kg    is not None: invoice.quantity_kg    = data.quantity_kg
    if data.invoice_date   is not None: invoice.invoice_date   = data.invoice_date
    if data.invoice_number is not None: invoice.invoice_number = data.invoice_number
    if data.iva_pct        is not None: invoice.iva_pct        = data.iva_pct
    if data.notes          is not None: invoice.notes          = data.notes

    # Recalculate amounts
    recalc(invoice, dispatch)

    db.commit()
    db.refresh(invoice)
    return invoice


# ── GET /invoices/{invoice_id}/pdf ────────────────────────
# Download PDF for an existing invoice
@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
):
    invoice = db.query(Invoice).first()  # placeholder
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    dispatch = db.query(Dispatch).options(
        joinedload(Dispatch.customer),
        joinedload(Dispatch.disposal),
    ).filter(Dispatch.id == invoice.dispatch_id).first()

    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    pdf_bytes = generate_invoice_pdf(dispatch, invoice)
    filename  = f"Factura_{invoice.invoice_number or invoice_id}_{invoice.invoice_date}.pdf"

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ── GET /invoices/dispatch/{dispatch_id}/pdf ──────────────
# Quick PDF download by dispatch (creates invoice if needed)
@router.get("/dispatch/{dispatch_id}/pdf")
def download_invoice_pdf_by_dispatch(
    dispatch_id:  int,
    price_per_kg: float = Query(default=DEFAULT_PRICE, ge=0.01),
    db:           Session = Depends(get_db),
):
    dispatch = db.query(Dispatch).options(
        joinedload(Dispatch.customer),
        joinedload(Dispatch.disposal),
    ).filter(Dispatch.id == dispatch_id).first()

    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    # Get or create invoice
    invoice = db.query(Invoice).filter(Invoice.dispatch_id == dispatch_id).first()
    if not invoice:
        qty  = dispatch.quantity or 0
        base = round(qty * price_per_kg, 2)
        iva  = round(base * 0.21, 2)
        invoice = Invoice(
            dispatch_id    = dispatch_id,
            invoice_number = dispatch.batch_id,
            price_per_kg   = price_per_kg,
            quantity_kg    = None,
            base_amount    = base,
            iva_pct        = 21.0,
            iva_amount     = iva,
            total_amount   = round(base + iva, 2),
            invoice_date   = dispatch.date,
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)

    pdf_bytes = generate_invoice_pdf(dispatch, invoice)
    filename  = f"Factura_{invoice.invoice_number or dispatch_id}.pdf"

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ════════════════════════════════════════════════════════
# PDF GENERATOR
# ════════════════════════════════════════════════════════
def generate_invoice_pdf(dispatch, invoice: Invoice) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from reportlab.lib.utils import simpleSplit

    buf = BytesIO()
    w, h = A4
    c = canvas.Canvas(buf, pagesize=A4)

    LEFT  = 20 * mm
    RIGHT = w - 20 * mm
    GREEN = colors.HexColor("#2d7a4f")
    DARK  = colors.HexColor("#1a1a2e")
    GRAY  = colors.HexColor("#6b7280")
    LGRAY = colors.HexColor("#f3f4f6")
    WHITE = colors.white

    # Use invoice values (may override dispatch)
    quantity     = invoice.quantity_kg or dispatch.quantity or 0
    price_per_kg = invoice.price_per_kg
    base         = invoice.base_amount
    iva_amount   = invoice.iva_amount
    total        = invoice.total_amount
    inv_number   = invoice.invoice_number or dispatch.batch_id or f"#{invoice.id}"
    inv_date     = invoice.invoice_date or dispatch.date or date.today()
    inv_date_str = inv_date.strftime("%d/%m/%Y") if hasattr(inv_date, "strftime") else str(inv_date)

    customer  = dispatch.customer
    cust_name = customer.name    if customer else "—"
    cust_addr = customer.address if customer and customer.address else ""
    cust_cif  = customer.cif     if customer and customer.cif     else ""
    cust_id   = str(customer.id) if customer else "—"

    def hrule(y, color=GREEN, thickness=1.5):
        c.setStrokeColor(color)
        c.setLineWidth(thickness)
        c.line(LEFT, y, RIGHT, y)

    def text(x, y, txt, size=10, bold=False, color=DARK, align="left"):
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.setFillColor(color)
        if align == "right":    c.drawRightString(x, y, str(txt))
        elif align == "center": c.drawCentredString(x, y, str(txt))
        else:                   c.drawString(x, y, str(txt))

    def fmt_eur(v):
        return f"{v:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")

    TOP = h - 18 * mm

    # ── Logos ────────────────────────────────────────────
    if os.path.exists(LOGO_PATH):
        c.drawImage(LOGO_PATH, LEFT, TOP - 18*mm,
                    width=45*mm, height=18*mm,
                    preserveAspectRatio=True, mask='auto')

    badge_h = 14*mm
    iscc_x  = RIGHT - 16*mm
    bv_x    = iscc_x - 3*mm - 36*mm
    badge_y = TOP - badge_h

    if os.path.exists(BV_PATH):
        c.drawImage(BV_PATH, bv_x, badge_y,
                    width=36*mm, height=badge_h,
                    preserveAspectRatio=True, mask='auto')
    if os.path.exists(ISCC_PATH):
        c.drawImage(ISCC_PATH, iscc_x, badge_y,
                    width=16*mm, height=16*mm,
                    preserveAspectRatio=True, mask='auto')

    # ── Recial info ──────────────────────────────────────
    info_y = TOP - 18*mm - 7*mm
    text(LEFT, info_y, "RECICLAJES RECIAL, S.L.", size=11, bold=True)
    info_y -= 5*mm;   text(LEFT, info_y, "C/ CARRERA, 56", size=9, color=GRAY)
    info_y -= 4.5*mm; text(LEFT, info_y, "14880 LUQUE (CÓRDOBA)", size=9, color=GRAY)
    info_y -= 4.5*mm; text(LEFT, info_y, "CIF: B14871560", size=9, color=GRAY)

    # ── Customer info ────────────────────────────────────
    cx = w / 2 + 5*mm

    # Calculate customer block height first
    n_addr_lines = 0
    if cust_addr:
        n_addr_lines = 2 if len(cust_addr) > 42 else 1
    n_cif_lines  = 1 if cust_cif else 0
    cust_block_h = 5*mm + (n_addr_lines + n_cif_lines) * 4.5*mm + 8*mm

    # Box anchored below customer block
    box_x = cx
    box_w = RIGHT - box_x
    box_h = 18*mm
    box_y = (TOP - badge_h - 24*mm) - cust_block_h - 6*mm

    # Draw customer text working upward from box_y
    cust_name_y = box_y + box_h + cust_block_h
    text(cx, cust_name_y, cust_name, size=11, bold=True)

    addr_y = cust_name_y - 5*mm
    if cust_addr:
        if len(cust_addr) > 42:
            parts = cust_addr.split(",")
            line1 = parts[0].strip()
            line2 = ", ".join(p.strip() for p in parts[1:]) if len(parts) > 1 else ""
            text(cx, addr_y, line1, size=9, color=GRAY)
            addr_y -= 4.5*mm
            if line2:
                text(cx, addr_y, line2, size=9, color=GRAY)
                addr_y -= 4.5*mm
        else:
            text(cx, addr_y, cust_addr, size=9, color=GRAY)
            addr_y -= 4.5*mm

    if cust_cif:
        text(cx, addr_y, f"CIF: {cust_cif}", size=9, color=GRAY)

    # Metadata box
    c.setFillColor(LGRAY)
    c.setStrokeColor(colors.HexColor("#e5e7eb"))
    c.setLineWidth(0.5)
    c.rect(box_x, box_y, box_w, box_h, fill=1, stroke=1)

    col_pcts = [0.28, 0.22, 0.18, 0.32]
    col_xs   = []
    running  = box_x + 2*mm
    for pct in col_pcts:
        col_xs.append(running)
        running += box_w * pct

    labels = ["DOCUMENTO", "NUMERO", "CLIENTE", "FECHA"]
    values = ["FACTURA", inv_number, cust_id, inv_date_str]

    hdr_y = box_y + box_h - 6*mm
    for col, label in zip(col_xs, labels):
        text(col, hdr_y, label, size=8, bold=True)

    c.setStrokeColor(GREEN); c.setLineWidth(0.8)
    c.line(box_x+1*mm, box_y+box_h-9*mm, box_x+box_w-1*mm, box_y+box_h-9*mm)

    val_y = box_y + 5*mm
    for col, val in zip(col_xs, values):
        text(col, val_y, val, size=9)

    # Green separator
    sep_y = min(info_y, box_y) - 10*mm
    hrule(sep_y, color=GREEN, thickness=2)

    # Items table
    table_y = sep_y - 8*mm
    c.setFillColor(LGRAY); c.setStrokeColor(colors.HexColor("#e5e7eb")); c.setLineWidth(0.5)
    c.rect(LEFT, table_y - 7*mm, RIGHT-LEFT, 9*mm, fill=1, stroke=1)

    col_cantidad = LEFT + 2*mm
    col_concepto = LEFT + 38*mm
    col_precio   = RIGHT - 42*mm
    col_importe  = RIGHT - 18*mm

    for col, label in [(col_cantidad,"CANTIDAD"),(col_concepto,"CONCEPTO"),(col_precio,"PRECIO"),(col_importe,"IMPORTE")]:
        text(col, table_y - 2*mm, label, size=9, bold=True)

    row_y = table_y - 18*mm
    text(col_cantidad, row_y, f"{quantity:,.2f} KG".replace(",","."), size=10)
    text(col_concepto, row_y, "ACEITE VEGETAL USADO (UCO)", size=10)
    text(col_precio,   row_y, f"{price_per_kg:.2f}€".replace(".",","), size=10)
    text(col_importe,  row_y, fmt_eur(base), size=10, bold=True)

    hrule(row_y - 8*mm, color=colors.HexColor("#e5e7eb"), thickness=0.5)

    # Totals
    totals_y = row_y - 35*mm
    box_w2   = RIGHT - LEFT
    c.setFillColor(LGRAY); c.setStrokeColor(colors.HexColor("#e5e7eb")); c.setLineWidth(0.5)
    c.rect(LEFT, totals_y - 4*mm, box_w2, 20*mm, fill=1, stroke=1)

    t_cols   = [LEFT + 2*mm, LEFT + box_w2*0.35 + 2*mm, LEFT + box_w2*0.80 + 2*mm]
    t_labels = ["BASE IMPONIBLE", "IVA 21%", "TOTAL, FACTURA"]
    t_values = [fmt_eur(base), fmt_eur(iva_amount), fmt_eur(total)]

    th_y = totals_y + 9*mm
    for col, label in zip(t_cols, t_labels):
        c.setFont("Helvetica-Bold", 9); c.setFillColor(DARK)
        tw = c.stringWidth(label, "Helvetica-Bold", 9)
        c.drawString(col, th_y, label)
        c.setLineWidth(0.5); c.setStrokeColor(DARK)
        c.line(col, th_y-1, col+tw, th_y-1)

    tv_y = totals_y + 1*mm
    for i, (col, val) in enumerate(zip(t_cols, t_values)):
        text(col, tv_y, val, size=11 if i < 2 else 13, bold=(i==2))

    # Payment notes
    notes_y = totals_y - 18*mm
    text(LEFT, notes_y, "NOTA: DESGLOSE FORMA DE PAGO", size=9, bold=True)
    text(LEFT+5*mm, notes_y-6*mm,  "- 1º PAGO: 80%  TRANSFERENCIA BANCARIA A LA CARGA DE MERCANCÍA", size=9, color=GRAY)
    text(LEFT+5*mm, notes_y-11*mm, "- 2º PAGO: 20%  TRANSFERENCIA BANCARIA A LA RESOLUCIÓN DE ANALÍTICA", size=9, color=GRAY)
    text(LEFT, notes_y-18*mm, "Nº CUENTA: ES44.0049.4075.1120.1405.6169", size=9, bold=True)

    # GDPR footer
    footer_y = 30*mm; footer_h = 25*mm
    c.setFillColor(LGRAY); c.setStrokeColor(colors.HexColor("#d1d5db")); c.setLineWidth(0.5)
    c.rect(LEFT, footer_y-2*mm, RIGHT-LEFT, footer_h, fill=1, stroke=1)
    gdpr = ("A los efectos de lo dispuesto en el Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016 "
        "relativo a la protección de las personas físicas en lo que respecta al tratamiento de datos personales y a la libre circulación "
        "de estos datos y en la Ley Orgánica 3/2018, de 5 de diciembre, de protección de datos personales y garantía de los derechos "
        "digitales, así como en la demás normativa vigente en materia de protección de datos personales, se informa al interesado que "
        "los datos de carácter personal que voluntariamente facilita, se incorporaran a un registro automatizado propiedad y "
        "responsabilidad de RECICLAJES RECIAL SL. Le informamos de su derecho de acceso, rectificación, limitación de tratamiento, "
        "supresión, portabilidad y oposición al tratamiento de estos datos mediante carta dirigida a RECICLAJES RECIAL SL con domicilio "
        "social sito en CALLE CARRERA 56, 14880 - LUQUE (CORDOBA), o vía e-mail a la dirección info@recial.es.")
    lines = simpleSplit(gdpr, "Helvetica", 7.5, (RIGHT-LEFT)-6*mm)
    line_y = footer_y + footer_h - 5*mm
    for line in lines:
        if line_y < footer_y: break
        c.setFont("Helvetica", 7.5); c.setFillColor(GRAY)
        c.drawString(LEFT+3*mm, line_y, line); line_y -= 3.5*mm

    # Bottom bar
    c.setFillColor(GREEN)
    c.rect(LEFT, 18*mm, RIGHT-LEFT, 7*mm, fill=1, stroke=0)
    text(LEFT+4*mm, 20*mm, "AUTORIZACION DE GESTOR DE RESIDUOS: 2799    CODIGO LER: 200125",
         size=8, bold=True, color=WHITE)

    c.save(); buf.seek(0)
    return buf.read()
