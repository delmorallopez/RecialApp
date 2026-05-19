from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from datetime import date
import io

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from database import get_db
from models.entrances import Entrance
from models.dispatches import Dispatch
from models.disposals import Disposal

router = APIRouter(prefix="/reports", tags=["Reports"])


def excel_mass_balance(entrances, dispatches, year: int) -> bytes:
    """Generate the Mass Balance Excel file and return bytes."""

    wb = Workbook()
    ws = wb.active
    ws.title = "Mass Balance"

    # ── Colors ─────────────────────────────────────────────
    GREEN  = "2d7a4f"
    AMBER  = "d97706"
    BLUE   = "1d4ed8"
    DARK   = "1a1a2e"
    GRAY   = "6b7280"
    WHITE  = "FFFFFF"

    def thin():
        s = Side(style="thin", color="D1D5DB")
        return Border(top=s, bottom=s, left=s, right=s)

    def hdr_cell(ws, row, col, value, bg, color=WHITE, bold=True, halign="center", wrap=False):
        c = ws.cell(row=row, column=col, value=value)
        c.font = Font(name="Arial", bold=bold, color=color, size=10)
        c.fill = PatternFill("solid", start_color=bg)
        c.alignment = Alignment(horizontal=halign, vertical="center", wrap_text=wrap)
        c.border = thin()
        return c

    def data_cell(ws, row, col, value, bg=WHITE, bold=False, halign="center", num_fmt=None):
        c = ws.cell(row=row, column=col, value=value)
        c.font = Font(name="Arial", bold=bold, color=DARK, size=10)
        c.fill = PatternFill("solid", start_color=bg)
        c.alignment = Alignment(horizontal=halign, vertical="center")
        c.border = thin()
        if num_fmt:
            c.number_format = num_fmt
        return c

    # ── Column widths ───────────────────────────────────────
    widths = {"A":16,"B":12,"C":12,"D":14,"E":10,"F":2,
              "G":18,"H":12,"I":12,"J":10,"K":2,
              "L":14,"M":12,"N":12,"O":14,"P":10,"Q":10,"R":12}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    # ── Title row ───────────────────────────────────────────
    ws.merge_cells("A1:R1")
    c = ws["A1"]
    c.value = f"RECICLAJES RECIAL S.L. — BALANCE DE MASAS {year}"
    c.font = Font(name="Arial", bold=True, color=WHITE, size=13)
    c.fill = PatternFill("solid", start_color=GREEN)
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 28

    ws.merge_cells("L2:R2")
    ws["L2"].value = "PG.09.01 / REG-A Balance de Masas"
    ws["L2"].font = Font(name="Arial", color=GRAY, size=9)
    ws["L2"].alignment = Alignment(horizontal="right")

    ws.row_dimensions[3].height = 6  # spacer

    # ── Section headers row 4 ────────────────────────────────
    ws.row_dimensions[4].height = 22
    for rng, label, bg in [
        ("A4:E4", "ENTRADAS", GREEN),
        ("G4:J4", "MERMAS (PROCESO INTERNO)", AMBER),
        ("L4:R4", "SALIDAS", BLUE),
    ]:
        ws.merge_cells(rng)
        c = ws[rng.split(":")[0]]
        c.value = label
        c.font = Font(name="Arial", bold=True, color=WHITE, size=10)
        c.fill = PatternFill("solid", start_color=bg)
        c.alignment = Alignment(horizontal="center", vertical="center")

    # ── Column headers row 5 ────────────────────────────────
    ws.row_dimensions[5].height = 30
    for col, lbl in [(1,"LOTE"),(2,"FECHA"),(3,"CONCEPTO"),(4,"CANTIDAD Kg"),(5,"VALOR GEI")]:
        hdr_cell(ws, 5, col, lbl, GREEN, wrap=True)
    for col, lbl in [(7,"CONCEPTO"),(8,"FECHA"),(9,"CANTIDAD Kg"),(10,"VALOR GEI")]:
        hdr_cell(ws, 5, col, lbl, AMBER, wrap=True)
    for col, lbl in [(12,"LOTE"),(13,"CONCEPTO"),(14,"FECHA"),(15,"CANTIDAD Kg Netos"),(16,"VALOR GEI"),(17,"Nº POS"),(18,"STOCK")]:
        hdr_cell(ws, 5, col, lbl, BLUE, wrap=True)

    # ── Data rows ────────────────────────────────────────────
    # Collect disposals (mermas) from dispatches
    disposals = []
    for d in dispatches:
        if d.disposal:
            disposals.append(d.disposal)

    row = 6
    max_rows = max(len(entrances), len(disposals), len(dispatches))

    for i in range(max_rows):
        bg_e = "F8FAFC" if i % 2 == 0 else WHITE
        bg_m = "FFFBEB" if i % 2 == 0 else "FEF9EE"
        bg_s = "EFF6FF" if i % 2 == 0 else "F0F7FF"

        # ENTRADAS
        if i < len(entrances):
            e = entrances[i]
            data_cell(ws, row, 1, e.batch_id,    bg_e, bold=True)
            data_cell(ws, row, 2, str(e.date),   bg_e, num_fmt="DD/MM/YYYY")
            data_cell(ws, row, 3, "UCO",          bg_e, halign="left")
            data_cell(ws, row, 4, int(e.quantity_kg or 0), bg_e, num_fmt="#,##0")
            data_cell(ws, row, 5, e.value_gei or 1, bg_e)

        # MERMAS
        if i < len(disposals):
            m = disposals[i]
            data_cell(ws, row, 7,  "DESECHO SOLIDO", bg_m, halign="left")
            data_cell(ws, row, 8,  str(m.date),      bg_m, num_fmt="DD/MM/YYYY")
            data_cell(ws, row, 9,  m.quantity,        bg_m, num_fmt="#,##0")
            data_cell(ws, row, 10, 1,                 bg_m)

        # SALIDAS
        if i < len(dispatches):
            d = dispatches[i]
            data_cell(ws, row, 12, d.batch_id,        bg_s, bold=True)
            data_cell(ws, row, 13, d.raw_material or "UCO", bg_s)
            data_cell(ws, row, 14, str(d.date),        bg_s, num_fmt="DD/MM/YYYY")
            data_cell(ws, row, 15, d.quantity,          bg_s, num_fmt="#,##0")
            data_cell(ws, row, 16, d.value_gei or 1,   bg_s)
            data_cell(ws, row, 17, d.post_number or "", bg_s)
            data_cell(ws, row, 18, 0,                   bg_s, num_fmt="#,##0")

        row += 1

    # ── Totals row ───────────────────────────────────────────
    ws.row_dimensions[row].height = 22
    total_ent = sum(int(e.quantity_kg or 0) for e in entrances)
    total_mer = sum(m.quantity for m in disposals)
    total_sal = sum(d.quantity for d in dispatches)

    ws.merge_cells(f"A{row}:C{row}")
    ws.merge_cells(f"G{row}:H{row}")
    ws.merge_cells(f"L{row}:N{row}")

    for col, val, bg in [(1,"TOTAL",GREEN),(4,total_ent,GREEN),
                          (7,"TOTAL",AMBER),(9,total_mer,AMBER),
                          (12,"TOTAL",BLUE),(15,total_sal,BLUE)]:
        c = ws.cell(row=row, column=col, value=val)
        c.font = Font(name="Arial", bold=True, color=WHITE, size=10)
        c.fill = PatternFill("solid", start_color=bg)
        c.alignment = Alignment(horizontal="center", vertical="center")
        c.border = thin()
        if isinstance(val, int):
            c.number_format = "#,##0"

    ws.freeze_panes = "A6"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


@router.get("/mass-balance")
def get_mass_balance(
    year: int = Query(default=2024, ge=2020, le=2030),
    db: Session = Depends(get_db),
):
    # Fetch all entrances for the year
    entrances = db.query(Entrance).filter(
        Entrance.date >= date(year, 1, 1),
        Entrance.date <= date(year, 12, 31),
    ).order_by(Entrance.date).all()

    # Fetch all dispatches for the year with disposal
    dispatches = db.query(Dispatch).options(
        joinedload(Dispatch.disposal)
    ).filter(
        Dispatch.date >= date(year, 1, 1),
        Dispatch.date <= date(year, 12, 31),
    ).order_by(Dispatch.date).all()

    excel_bytes = excel_mass_balance(entrances, dispatches, year)

    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=MassBalance_Recial_{year}.xlsx"
        },
    )
