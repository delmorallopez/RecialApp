from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from io import BytesIO
from datetime import date
import os

from database import get_db
from models.dispatches import Dispatch

router = APIRouter(prefix="/invoices", tags=["Invoices"])

# ── Asset paths ───────────────────────────────────────────
_ASSETS   = os.path.join(os.path.dirname(__file__), "../assets")
LOGO_PATH = os.path.join(_ASSETS, "LogoRecial.png")
BV_PATH   = os.path.join(_ASSETS, "BureauVeritas.png")
ISCC_PATH = os.path.join(_ASSETS, "ISCC.png")


def generate_invoice_pdf(dispatch, price_per_kg: float) -> bytes:
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

    # ── Calculations ──────────────────────────────────────
    quantity   = dispatch.quantity or 0
    base       = round(quantity * price_per_kg, 2)
    iva_amount = round(base * 0.21, 2)
    total      = round(base + iva_amount, 2)

    customer     = dispatch.customer
    inv_number   = dispatch.batch_id or f"A {dispatch.id:02d}"
    inv_date     = dispatch.date if dispatch.date else date.today()
    inv_date_str = inv_date.strftime("%d/%m/%Y") if hasattr(inv_date, "strftime") else str(inv_date)
    cust_name    = customer.name    if customer else "—"
    cust_addr    = customer.address if customer and customer.address else ""
    cust_cif     = customer.cif     if customer and customer.cif     else ""
    cust_id      = str(customer.id) if customer else "—"

    # ── Helpers ───────────────────────────────────────────
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

    # ════════════════════════════════════════════════════
    # HEADER
    # ════════════════════════════════════════════════════
    TOP = h - 18 * mm

    # ── Recial logo (top-left) ────────────────────────────
    logo_h = 18 * mm
    logo_w = 45 * mm
    if os.path.exists(LOGO_PATH):
        c.drawImage(LOGO_PATH, LEFT, TOP - logo_h,
                    width=logo_w, height=logo_h,
                    preserveAspectRatio=True, mask='auto')

    # ── Bureau Veritas + ISCC badges (top-right) ──────────
    badge_h = 14 * mm
    bv_w    = 36 * mm
    iscc_w  = 16 * mm
    gap     = 3 * mm
    iscc_x  = RIGHT - iscc_w
    bv_x    = iscc_x - gap - bv_w
    badge_y = TOP - badge_h

    if os.path.exists(BV_PATH):
        c.drawImage(BV_PATH, bv_x, badge_y,
                    width=bv_w, height=badge_h,
                    preserveAspectRatio=True, mask='auto')

    if os.path.exists(ISCC_PATH):
        c.drawImage(ISCC_PATH, iscc_x, badge_y,
                    width=iscc_w, height=iscc_w,
                    preserveAspectRatio=True, mask='auto')

    # ── Recial company info (left, below logo) ─────────────
    info_y = TOP - logo_h - 7 * mm
    text(LEFT, info_y, "RECICLAJES RECIAL, S.L.", size=11, bold=True)
    info_y -= 5 * mm
    text(LEFT, info_y, "C/ CARRERA, 56", size=9, color=GRAY)
    info_y -= 4.5 * mm
    text(LEFT, info_y, "14880 LUQUE (CÓRDOBA)", size=9, color=GRAY)
    info_y -= 4.5 * mm
    text(LEFT, info_y, "CIF: B14871560", size=9, color=GRAY)

    # ── Customer info (right half, below badges) ───────────
    cx = w / 2 + 5 * mm
    cy = TOP - badge_h - 7 * mm

    text(cx, cy, cust_name, size=11, bold=True)
    cy -= 5 * mm

    if cust_addr:
        # Split long addresses across two lines at comma
        if len(cust_addr) > 45:
            parts = cust_addr.split(",")
            line1 = parts[0].strip() if parts else cust_addr
            line2 = ", ".join(p.strip() for p in parts[1:]) if len(parts) > 1 else ""
            text(cx, cy, line1, size=9, color=GRAY)
            if line2:
                cy -= 4.5 * mm
                text(cx, cy, line2, size=9, color=GRAY)
        else:
            text(cx, cy, cust_addr, size=9, color=GRAY)
        cy -= 4.5 * mm

    if cust_cif:
        text(cx, cy, f"CIF: {cust_cif}", size=9, color=GRAY)
        cy -= 4.5 * mm

    # ── Metadata box (right side, below customer info) ─────
    box_x = w / 2 + 5 * mm
    box_w = RIGHT - box_x
    box_h = 18 * mm
    box_y = cy - 8 * mm

    c.setFillColor(LGRAY)
    c.setStrokeColor(colors.HexColor("#e5e7eb"))
    c.setLineWidth(0.5)
    c.rect(box_x, box_y, box_w, box_h, fill=1, stroke=1)

    # Proportional columns: DOCUMENTO 28% | NUMERO 22% | CLIENTE 18% | FECHA 32%
    col_pcts = [0.28, 0.22, 0.18, 0.32]
    col_xs   = []
    running  = box_x + 2 * mm
    for pct in col_pcts:
        col_xs.append(running)
        running += box_w * pct

    labels = ["DOCUMENTO", "NUMERO", "CLIENTE", "FECHA"]
    values = ["FACTURA", inv_number, cust_id, inv_date_str]

    hdr_y = box_y + box_h - 6 * mm
    for col, label in zip(col_xs, labels):
        text(col, hdr_y, label, size=8, bold=True)

    c.setStrokeColor(GREEN)
    c.setLineWidth(0.8)
    c.line(box_x + 1*mm, box_y + box_h - 9*mm,
           box_x + box_w - 1*mm, box_y + box_h - 9*mm)

    val_y = box_y + 5 * mm
    for col, val in zip(col_xs, values):
        text(col, val_y, val, size=9)

    # ── Green separator line ───────────────────────────────
    sep_y = min(info_y, box_y) - 10 * mm
    hrule(sep_y, color=GREEN, thickness=2)

    # ════════════════════════════════════════════════════
    # ITEMS TABLE
    # ════════════════════════════════════════════════════
    table_y = sep_y - 8 * mm

    c.setFillColor(LGRAY)
    c.setStrokeColor(colors.HexColor("#e5e7eb"))
    c.setLineWidth(0.5)
    c.rect(LEFT, table_y - 7*mm, RIGHT - LEFT, 9*mm, fill=1, stroke=1)

    col_cantidad = LEFT + 2 * mm
    col_concepto = LEFT + 38 * mm
    col_precio   = RIGHT - 42 * mm
    col_importe  = RIGHT - 18 * mm

    for col, label in [
        (col_cantidad, "CANTIDAD"),
        (col_concepto, "CONCEPTO"),
        (col_precio,   "PRECIO"),
        (col_importe,  "IMPORTE"),
    ]:
        text(col, table_y - 2*mm, label, size=9, bold=True)

    row_y = table_y - 18 * mm
    text(col_cantidad, row_y,
         f"{quantity:,.2f} KG".replace(",", "."), size=10)
    text(col_concepto, row_y,
         f"{dispatch.raw_material or 'ACEITE VEGETAL USADO'} (UCO)", size=10)
    text(col_precio, row_y,
         f"{price_per_kg:.2f}€".replace(".", ","), size=10)
    text(col_importe, row_y, fmt_eur(base), size=10, bold=True)

    hrule(row_y - 8*mm, color=colors.HexColor("#e5e7eb"), thickness=0.5)

    # ════════════════════════════════════════════════════
    # TOTALS BOX
    # ════════════════════════════════════════════════════
    totals_y = row_y - 35 * mm
    box_w2   = RIGHT - LEFT

    c.setFillColor(LGRAY)
    c.setStrokeColor(colors.HexColor("#e5e7eb"))
    c.setLineWidth(0.5)
    c.rect(LEFT, totals_y - 4*mm, box_w2, 20*mm, fill=1, stroke=1)

    # Proportional: BASE 35% | IVA 30% | TOTAL 35% (shifted right)
    t_col1   = LEFT + 2 * mm
    t_col2   = LEFT + box_w2 * 0.35 + 2 * mm
    t_col3   = LEFT + box_w2 * 0.65 + 2 * mm
    t_cols   = [t_col1, t_col2, t_col3]
    t_labels = ["BASE IMPONIBLE", "IVA 21%", "TOTAL, FACTURA"]
    t_values = [fmt_eur(base), fmt_eur(iva_amount), fmt_eur(total)]

    th_y = totals_y + 9 * mm
    for col, label in zip(t_cols, t_labels):
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(DARK)
        tw = c.stringWidth(label, "Helvetica-Bold", 9)
        c.drawString(col, th_y, label)
        c.setLineWidth(0.5)
        c.setStrokeColor(DARK)
        c.line(col, th_y - 1, col + tw, th_y - 1)

    tv_y = totals_y + 1 * mm
    for i, (col, val) in enumerate(zip(t_cols, t_values)):
        text(col, tv_y, val, size=11 if i < 2 else 13, bold=(i == 2))

    # ════════════════════════════════════════════════════
    # PAYMENT NOTES
    # ════════════════════════════════════════════════════
    notes_y = totals_y - 18 * mm
    text(LEFT, notes_y, "NOTA: DESGLOSE FORMA DE PAGO", size=9, bold=True)
    text(LEFT + 5*mm, notes_y - 6*mm,
         "- 1º PAGO: 80%  TRANSFERENCIA BANCARIA A LA CARGA DE MERCANCÍA",
         size=9, color=GRAY)
    text(LEFT + 5*mm, notes_y - 11*mm,
         "- 2º PAGO: 20%  TRANSFERENCIA BANCARIA A LA RESOLUCIÓN DE ANALÍTICA",
         size=9, color=GRAY)
    text(LEFT + 5*mm, notes_y - 18*mm,
         "Nº CUENTA: ES44.0049.4075.1120.1405.6169",
         size=9, bold=True)

    # ════════════════════════════════════════════════════
    # GDPR FOOTER BOX
    # ════════════════════════════════════════════════════
    footer_y = 30 * mm
    footer_h = 25 * mm

    c.setFillColor(LGRAY)
    c.setStrokeColor(colors.HexColor("#d1d5db"))
    c.setLineWidth(0.5)
    c.rect(LEFT, footer_y - 2*mm, RIGHT - LEFT, footer_h, fill=1, stroke=1)

    gdpr = (
        "A los efectos de lo dispuesto en el Reglamento (UE) 2016/679 del Parlamento "
        "Europeo y del Consejo, de 27 de abril de 2016 relativo a la protección de las "
        "personas físicas en lo que respecta al tratamiento de datos personales y a la "
        "libre circulación de estos datos y en la Ley Orgánica 3/2018, de 5 de diciembre, "
        "de protección de datos personales y garantía de los derechos digitales, así como "
        "en la demás normativa vigente en materia de protección de datos personales, se "
        "informa al interesado que los datos de carácter personal que voluntariamente "
        "facilita, se incorporaran a un registro automatizado propiedad y responsabilidad "
        "de RECICLAJES RECIAL SL. Le informamos de su derecho de acceso, rectificación, "
        "limitación de tratamiento, supresión, portabilidad y oposición al tratamiento de "
        "estos datos mediante carta dirigida a RECICLAJES RECIAL SL con domicilio social "
        "sito en CALLE CARRERA 56, 14880 - LUQUE (CORDOBA), o vía e-mail a info@recial.es."
    )

    lines  = simpleSplit(gdpr, "Helvetica", 7.5, (RIGHT - LEFT) - 6*mm)
    line_y = footer_y + footer_h - 5 * mm
    for line in lines:
        if line_y < footer_y:
            break
        c.setFont("Helvetica", 7.5)
        c.setFillColor(GRAY)
        c.drawString(LEFT + 3*mm, line_y, line)
        line_y -= 3.5 * mm

    # ── Bottom green bar ───────────────────────────────────
    c.setFillColor(GREEN)
    c.rect(LEFT, 18*mm, RIGHT - LEFT, 7*mm, fill=1, stroke=0)
    text(LEFT + 4*mm, 20*mm,
         "AUTORIZACION DE GESTOR DE RESIDUOS: 2799    CODIGO LER: 200125",
         size=8, bold=True, color=WHITE)

    c.save()
    buf.seek(0)
    return buf.read()


# ── Endpoint ──────────────────────────────────────────────
@router.get("/{dispatch_id}")
def generate_invoice(
    dispatch_id:  int,
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
    filename  = f"Factura_{dispatch.batch_id}_{dispatch.date}.pdf"

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
