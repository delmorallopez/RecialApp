from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from io import BytesIO
from datetime import date

from database import get_db
from models.dispatches import Dispatch
from models.customers import Customer

router = APIRouter(prefix="/invoices", tags=["Invoices"])


def generate_invoice_pdf(dispatch, price_per_kg: float) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from reportlab.platypus import Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import Paragraph
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

    buf = BytesIO()
    w, h = A4
    c = canvas.Canvas(buf, pagesize=A4)

    # ── Constants ────────────────────────────────────────────
    LEFT  = 20 * mm
    RIGHT = w - 20 * mm
    GREEN = colors.HexColor("#2d7a4f")
    DARK  = colors.HexColor("#1a1a2e")
    GRAY  = colors.HexColor("#6b7280")
    LGRAY = colors.HexColor("#f3f4f6")

    # ── Calculations ─────────────────────────────────────────
    quantity    = dispatch.quantity or 0
    base        = round(quantity * price_per_kg, 2)
    iva_pct     = 0.21
    iva_amount  = round(base * iva_pct, 2)
    total       = round(base + iva_amount, 2)

    customer    = dispatch.customer
    inv_number  = dispatch.batch_id or f"A {dispatch.id:02d}"
    inv_date    = dispatch.date if dispatch.date else date.today()
    inv_date_str = inv_date.strftime("%d/%m/%Y") if hasattr(inv_date, "strftime") else str(inv_date)

    # ── Helper: draw horizontal rule ────────────────────────
    def hrule(y, color=GREEN, thickness=1.5):
        c.setStrokeColor(color)
        c.setLineWidth(thickness)
        c.line(LEFT, y, RIGHT, y)

    # ── Helper: draw text ────────────────────────────────────
    def text(x, y, txt, size=10, bold=False, color=DARK, align="left"):
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.setFillColor(color)
        if align == "right":
            c.drawRightString(x, y, str(txt))
        elif align == "center":
            c.drawCentredString(x, y, str(txt))
        else:
            c.drawString(x, y, str(txt))

    # ════════════════════════════════════════════════════════
    # HEADER
    # ════════════════════════════════════════════════════════
    y = h - 20 * mm

    # Left — Recial info
    text(LEFT, y, "RECICLAJES RECIAL, S.L.", size=12, bold=True)
    y -= 5 * mm
    text(LEFT, y, "C/ CARRERA, 56", size=9, color=GRAY)
    y -= 4.5 * mm
    text(LEFT, y, "14880 LUQUE (CÓRDOBA)", size=9, color=GRAY)
    y -= 4.5 * mm
    text(LEFT, y, "CIF: B14871560", size=9, color=GRAY)

    # Right — Customer info
    cust_name = customer.name if customer else "—"
    cust_addr = customer.address if customer and customer.address else ""
    cust_cif  = customer.cif if customer and customer.cif else ""

    cx = w / 2 + 5 * mm
    cy = h - 20 * mm
    text(cx, cy, cust_name, size=12, bold=True)
    cy -= 5 * mm
    if cust_addr:
        text(cx, cy, cust_addr, size=9, color=GRAY)
        cy -= 4.5 * mm
    if cust_cif:
        text(cx, cy, f"CIF: {cust_cif}", size=9, color=GRAY)

    # ── Invoice metadata box ─────────────────────────────────
    meta_y = h - 50 * mm
    box_x = w / 2 + 5 * mm
    box_w = RIGHT - box_x
    box_h = 18 * mm

    # Box background
    c.setFillColor(LGRAY)
    c.setStrokeColor(colors.HexColor("#e5e7eb"))
    c.setLineWidth(0.5)
    c.rect(box_x, meta_y - box_h + 6 * mm, box_w, box_h, fill=1, stroke=1)

    # Headers
    col1 = box_x + 2 * mm
    col2 = box_x + 32 * mm
    col3 = box_x + 52 * mm
    col4 = box_x + 68 * mm

    header_y = meta_y + 1 * mm
    for col, label in [(col1, "DOCUMENTO"), (col2, "NUMERO"), (col3, "CLIENTE"), (col4, "FECHA")]:
        text(col, header_y, label, size=8, bold=True, color=DARK)

    hrule(header_y - 2 * mm, color=GREEN, thickness=1)

    val_y = header_y - 7 * mm
    text(col1, val_y, "FACTURA", size=9)
    text(col2, val_y, inv_number, size=9)
    text(col3, val_y, str(customer.id if customer else "—"), size=9)
    text(col4, val_y, inv_date_str, size=9)

    # ── Green separator line ──────────────────────────────────
    sep_y = h - 72 * mm
    hrule(sep_y, color=GREEN, thickness=2)

    # ════════════════════════════════════════════════════════
    # ITEMS TABLE
    # ════════════════════════════════════════════════════════
    table_y = sep_y - 8 * mm

    # Table header
    c.setFillColor(LGRAY)
    c.setStrokeColor(colors.HexColor("#e5e7eb"))
    c.setLineWidth(0.5)
    c.rect(LEFT, table_y - 7 * mm, RIGHT - LEFT, 9 * mm, fill=1, stroke=1)

    col_cantidad  = LEFT + 2 * mm
    col_concepto  = LEFT + 38 * mm
    col_precio    = RIGHT - 42 * mm
    col_importe   = RIGHT - 18 * mm

    hdr_y = table_y - 2 * mm
    for col, label in [
        (col_cantidad, "CANTIDAD"),
        (col_concepto, "CONCEPTO"),
        (col_precio,   "PRECIO"),
        (col_importe,  "IMPORTE"),
    ]:
        text(col, hdr_y, label, size=9, bold=True)

    # Table row
    row_y = table_y - 18 * mm
    text(col_cantidad, row_y, f"{quantity:,.2f} KG".replace(",", "."), size=10)
    text(col_concepto, row_y, f"{dispatch.raw_material or 'ACEITE VEGETAL USADO'} (UCO)", size=10)
    text(col_precio,   row_y, f"{price_per_kg:.2f}€".replace(".", ","), size=10)
    text(col_importe,  row_y, f"{base:,.2f} €".replace(",", "X").replace(".", ",").replace("X", "."), size=10, bold=True)

    # ── Light separator ───────────────────────────────────────
    hrule(row_y - 8 * mm, color=colors.HexColor("#e5e7eb"), thickness=0.5)

    # ════════════════════════════════════════════════════════
    # TOTALS BOX
    # ════════════════════════════════════════════════════════
    totals_y = row_y - 35 * mm
    box_w2   = RIGHT - LEFT
    box_h2   = 18 * mm

    c.setFillColor(LGRAY)
    c.setStrokeColor(colors.HexColor("#e5e7eb"))
    c.setLineWidth(0.5)
    c.rect(LEFT, totals_y - 4 * mm, box_w2, box_h2, fill=1, stroke=1)

    # Totals header row
    t_col1 = LEFT + (box_w2 / 3) * 0 + 2 * mm
    t_col2 = LEFT + (box_w2 / 3) * 1 + 2 * mm
    t_col3 = LEFT + (box_w2 / 3) * 2 + 2 * mm

    th_y = totals_y + 8 * mm
    for col, label in [(t_col1, "BASE IMPONIBLE"), (t_col2, "IVA 21%"), (t_col3, "TOTAL, FACTURA")]:
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(DARK)
        # Underline
        tw = c.stringWidth(label, "Helvetica-Bold", 9)
        c.drawString(col, th_y, label)
        c.setLineWidth(0.5)
        c.setStrokeColor(DARK)
        c.line(col, th_y - 1, col + tw, th_y - 1)

    tv_y = totals_y + 1 * mm

    def fmt_eur(v):
        return f"{v:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")

    text(t_col1, tv_y, fmt_eur(base),       size=11, bold=False)
    text(t_col2, tv_y, fmt_eur(iva_amount),  size=11, bold=False)
    text(t_col3, tv_y, fmt_eur(total),       size=12, bold=True)

    # ════════════════════════════════════════════════════════
    # PAYMENT NOTES
    # ════════════════════════════════════════════════════════
    notes_y = totals_y - 18 * mm
    text(LEFT, notes_y, "NOTA: DESGLOSE FORMA DE PAGO", size=9, bold=True)
    text(LEFT + 5 * mm, notes_y - 6 * mm,  "- 1º PAGO: 80%  TRANSFERENCIA BANCARIA A LA CARGA DE MERCANCÍA", size=9, color=GRAY)
    text(LEFT + 5 * mm, notes_y - 11 * mm, "- 2º PAGO: 20%  TRANSFERENCIA BANCARIA A LA RESOLUCIÓN DE ANALÍTICA", size=9, color=GRAY)
    text(LEFT + 5 * mm, notes_y - 18 * mm, "Nº CUENTA: ES44.0049.4075.1120.1405.6169", size=9, bold=True)

    # ════════════════════════════════════════════════════════
    # GDPR FOOTER BOX
    # ════════════════════════════════════════════════════════
    footer_y = 30 * mm
    footer_h = 25 * mm

    c.setFillColor(LGRAY)
    c.setStrokeColor(colors.HexColor("#d1d5db"))
    c.setLineWidth(0.5)
    c.rect(LEFT, footer_y - 2 * mm, RIGHT - LEFT, footer_h, fill=1, stroke=1)

    gdpr = (
        "A los efectos de lo dispuesto en el Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016 "
        "relativo a la protección de las personas físicas en lo que respecta al tratamiento de datos personales y a la libre circulación "
        "de estos datos y en la Ley Orgánica 3/2018, de 5 de diciembre, de protección de datos personales y garantía de los derechos "
        "digitales, así como en la demás normativa vigente en materia de protección de datos personales, se informa al interesado que "
        "los datos de carácter personal que voluntariamente facilita, se incorporaran a un registro automatizado propiedad y "
        "responsabilidad de RECICLAJES RECIAL SL. Le informamos de su derecho de acceso, rectificación, limitación de tratamiento, "
        "supresión, portabilidad y oposición al tratamiento de estos datos mediante carta dirigida a RECICLAJES RECIAL SL con domicilio "
        "social sito en CALLE CARRERA 56, 14880 - LUQUE (CORDOBA), o vía e-mail a la dirección info@recial.es."
    )

    # Word-wrap the GDPR text manually
    from reportlab.lib.utils import simpleSplit
    lines = simpleSplit(gdpr, "Helvetica", 7.5, (RIGHT - LEFT) - 6 * mm)
    line_y = footer_y + footer_h - 5 * mm
    for line in lines:
        if line_y < footer_y: break
        c.setFont("Helvetica", 7.5)
        c.setFillColor(GRAY)
        c.drawString(LEFT + 3 * mm, line_y, line)
        line_y -= 3.5 * mm

    # ── Bottom green bar ──────────────────────────────────────
    bottom_y = 18 * mm
    c.setFillColor(GREEN)
    c.setStrokeColor(GREEN)
    c.rect(LEFT, bottom_y, RIGHT - LEFT, 7 * mm, fill=1, stroke=0)
    text(
        LEFT + 4 * mm, bottom_y + 2 * mm,
        "AUTORIZACION DE GESTOR DE RESIDUOS: 2799    CODIGO LER: 200125",
        size=8, bold=True, color=colors.white
    )

    c.save()
    buf.seek(0)
    return buf.read()


# ── Endpoint ─────────────────────────────────────────────────
@router.get("/{dispatch_id}")
def generate_invoice(
    dispatch_id: int,
    price_per_kg: float = Query(default=1.09, ge=0.01),
    db: Session = Depends(get_db),
):
    dispatch = db.query(Dispatch).options(
        joinedload(Dispatch.customer),
        joinedload(Dispatch.disposal),
    ).filter(Dispatch.id == dispatch_id).first()

    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    pdf_bytes = generate_invoice_pdf(dispatch, price_per_kg)

    filename = f"Factura_{dispatch.batch_id}_{dispatch.date}.pdf"

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )