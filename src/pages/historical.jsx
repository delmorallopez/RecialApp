import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import API from "../services/api";
import "../stylecss/customers.css";

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const COLORS = {
  receipts:   "#2d7a4f",
  dispatches: "#d97706",
  disposal:   "#dc2626",
};

export default function Historical() {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Selected year detail
  const [selectedYear, setSelectedYear] = useState(null);
  const [yearDetail, setYearDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Import modal
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Fetch imported years ─────────────────────────────────
  const fetchYears = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get("/historical/years");
      setYears(res.data.years);
    } catch {
      setError("No se pudieron cargar los datos históricos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchYears(); }, [fetchYears]);

  // ── Fetch one year's detail ──────────────────────────────
  const openYear = async (year) => {
    setSelectedYear(year);
    setYearDetail(null);
    setDetailLoading(true);
    try {
      const res = await API.get(`/historical/${year}`);
      setYearDetail(res.data);
    } catch {
      setError(`No se pudo cargar el detalle de ${year}.`);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Import ───────────────────────────────────────────────
  const handleImport = async () => {
    if (!importFile) { setImportError("Selecciona un archivo Excel primero."); return; }
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await API.post("/historical/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult(res.data);
      fetchYears();
    } catch (err) {
      setImportError(err.response?.data?.detail || "No se pudo importar el archivo.");
    } finally {
      setImporting(false);
    }
  };

  const closeImport = () => {
    setImportOpen(false);
    setImportFile(null);
    setImportResult(null);
    setImportError(null);
  };

  // ── Delete a year ────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await API.delete(`/historical/${deleteTarget.year}`);
      setDeleteTarget(null);
      if (selectedYear === deleteTarget.year) { setSelectedYear(null); setYearDetail(null); }
      fetchYears();
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo eliminar el año.");
      setDeleteTarget(null);
    }
  };

  // ── Helpers ──────────────────────────────────────────────
  const kg = (v) => (v == null ? "—" : `${Number(v).toLocaleString("es-ES")} kg`);

  // Multi-year comparison chart data
  const comparisonData = [...years]
    .sort((a, b) => a.year - b.year)
    .map((y) => ({
      name: String(y.year),
      "Recogido":   y.total_receipts_kg || 0,
      "Despachado": y.total_dispatches_kg || 0,
      "Merma":      y.total_disposal_kg || 0,
    }));

  // Monthly chart data for the selected year
  const monthlyData = yearDetail
    ? yearDetail.months.map((m) => ({
        name: MONTHS[m.month - 1],
        "Recogido": m.receipts_kg,
        albaranes: m.receipts_count,
      }))
    : [];

  const totalAllYears = years.reduce((s, y) => s + (y.total_receipts_kg || 0), 0);

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="customers-page">

      {/* Header */}
      <div className="customers-header">
        <div>
          <h1 className="customers-title">Histórico</h1>
          <p className="customers-subtitle">
            {years.length} año{years.length !== 1 ? "s" : ""} importado{years.length !== 1 ? "s" : ""}
            {totalAllYears > 0 && (
              <> — <strong>{totalAllYears.toLocaleString("es-ES")} kg</strong> recogidos en total</>
            )}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setImportOpen(true)}>
          ⬆ Importar Balance de Masas
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* ── Multi-year comparison ── */}
      {years.length > 0 && (
        <div style={{
          background: "#fff", border: "1.5px solid #e5e7eb",
          borderRadius: "12px", padding: "20px", marginBottom: "20px",
        }}>
          <p style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a2e", margin: "0 0 4px" }}>
            Comparativa Anual
          </p>
          <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 16px" }}>
            Recogido · Despachado · Merma (kg)
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={comparisonData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
              <Tooltip formatter={(v) => `${Number(v).toLocaleString("es-ES")} kg`} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="Recogido"   fill={COLORS.receipts}   radius={[3,3,0,0]} />
              <Bar dataKey="Despachado" fill={COLORS.dispatches} radius={[3,3,0,0]} />
              <Bar dataKey="Merma"      fill={COLORS.disposal}   radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Years table ── */}
      <div className="table-wrapper">
        <table className="customers-table">
          <thead>
            <tr>
              <th>Año</th>
              <th>Stock Inicial</th>
              <th>Recogido</th>
              <th>Despachado</th>
              <th>Merma</th>
              <th>Archivo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-state">Cargando...</td></tr>
            ) : years.length === 0 ? (
              <tr><td colSpan={7} className="table-state">
                No hay años importados todavía. Sube un balance de masas para empezar.
              </td></tr>
            ) : (
              years.map((y) => (
                <tr key={y.year} className="table-row">
                  <td style={{ fontWeight: "700", fontSize: "15px" }}>{y.year}</td>
                  <td>{kg(y.opening_stock_kg)}</td>
                  <td style={{ fontWeight: "700", color: COLORS.receipts }}>{kg(y.total_receipts_kg)}</td>
                  <td style={{ fontWeight: "600", color: COLORS.dispatches }}>{kg(y.total_dispatches_kg)}</td>
                  <td style={{ color: COLORS.disposal }}>{kg(y.total_disposal_kg)}</td>
                  <td style={{ fontSize: "12px", color: "#9ca3af", maxWidth: "180px",
                               overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {y.source_file || "—"}
                  </td>
                  <td className="td-actions">
                    <button className="btn-edit" onClick={() => openYear(y.year)}>Ver Meses</button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(y)}>Eliminar</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Selected year monthly detail ── */}
      {selectedYear && (
        <div style={{
          background: "#fff", border: "1.5px solid #e5e7eb",
          borderRadius: "12px", padding: "20px", marginTop: "20px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <p style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a2e", margin: "0 0 2px" }}>
                Detalle Mensual {selectedYear}
              </p>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                kg recogidos por mes
              </p>
            </div>
            <button className="btn-secondary"
              onClick={() => { setSelectedYear(null); setYearDetail(null); }}>
              Cerrar
            </button>
          </div>

          {detailLoading ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: "30px 0" }}>Cargando...</p>
          ) : yearDetail ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
                  <Tooltip formatter={(v) => `${Number(v).toLocaleString("es-ES")} kg`} />
                  <Line type="monotone" dataKey="Recogido" stroke={COLORS.receipts}
                    strokeWidth={2.5} dot={{ r: 4, fill: COLORS.receipts }} />
                </LineChart>
              </ResponsiveContainer>

              <div style={{ marginTop: "16px", display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "10px" }}>
                {yearDetail.months.map((m) => (
                  <div key={m.month} style={{
                    background: "#f8fafc", border: "1.5px solid #e5e7eb",
                    borderRadius: "8px", padding: "10px 12px",
                  }}>
                    <p style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600",
                                textTransform: "uppercase", margin: "0 0 4px" }}>
                      {MONTHS[m.month - 1]}
                    </p>
                    <p style={{ fontSize: "15px", fontWeight: "700", color: COLORS.receipts, margin: 0 }}>
                      {Number(m.receipts_kg).toLocaleString("es-ES")} kg
                    </p>
                    <p style={{ fontSize: "11px", color: "#6b7280", margin: 0 }}>
                      {m.receipts_count} albarán{m.receipts_count !== 1 ? "es" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── Import Modal ── */}
      {importOpen && (
        <div className="modal-overlay" onClick={closeImport}>
          <div className="modal" style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>⬆ Importar Balance de Masas</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0 0" }}>
                  Sube el Excel de un año (2020–2025). El año se detecta automáticamente.
                </p>
              </div>
              <button className="modal-close" onClick={closeImport}>✕</button>
            </div>

            <div style={{ padding: "20px 24px 24px" }}>
              {!importResult ? (
                <>
                  <div className="form-group" style={{ marginBottom: "16px" }}>
                    <label>Archivo Excel (.xlsx) <span className="required">*</span></label>
                    <input
                      type="file"
                      accept=".xlsx,.xlsm"
                      onChange={(e) => { setImportFile(e.target.files[0] || null); setImportError(null); }}
                      style={{
                        width: "100%", padding: "10px", border: "1.5px dashed #cbd5e1",
                        borderRadius: "8px", fontSize: "14px", background: "#f8fafc",
                      }}
                    />
                    {importFile && (
                      <p style={{ fontSize: "12px", color: "#15803d", margin: "6px 0 0", fontWeight: "600" }}>
                        ✓ {importFile.name}
                      </p>
                    )}
                  </div>

                  <div style={{
                    background: "#eff6ff", border: "1.5px solid #bfdbfe",
                    borderRadius: "8px", padding: "10px 14px", fontSize: "12px",
                    color: "#1e40af", lineHeight: 1.6, marginBottom: "16px",
                  }}>
                    Si el año ya estaba importado, se reemplazará con los nuevos datos.
                    Estos son totales de resumen histórico, no registros de trazabilidad.
                  </div>

                  {importError && (
                    <p className="form-error" style={{ marginBottom: "16px" }}>{importError}</p>
                  )}

                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={closeImport}>Cancelar</button>
                    <button type="button" className="btn-primary" onClick={handleImport}
                            disabled={importing || !importFile}>
                      {importing ? "Importando..." : "Importar"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    background: "#f0fdf4", border: "1.5px solid #86efac",
                    borderRadius: "10px", padding: "16px", marginBottom: "16px", textAlign: "center",
                  }}>
                    <p style={{ fontSize: "28px", fontWeight: "800", color: "#15803d", margin: "0 0 4px" }}>
                      {importResult.year}
                    </p>
                    <p style={{ fontSize: "14px", color: "#166534", margin: 0 }}>
                      {importResult.months_imported} meses importados
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "10px", marginBottom: "16px" }}>
                    {[
                      ["Stock Inicial", importResult.opening_stock_kg],
                      ["Recogido",      importResult.total_receipts_kg],
                      ["Despachado",    importResult.total_dispatches_kg],
                      ["Merma",         importResult.total_disposal_kg],
                    ].map(([label, value]) => (
                      <div key={label} style={{
                        background: "#f8fafc", borderRadius: "8px",
                        padding: "10px 12px", border: "1.5px solid #e5e7eb",
                      }}>
                        <p style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600",
                                    textTransform: "uppercase", margin: "0 0 4px" }}>{label}</p>
                        <p style={{ fontSize: "15px", fontWeight: "700", color: "#1a1a2e", margin: 0 }}>
                          {kg(value)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="modal-actions">
                    <button type="button" className="btn-primary" onClick={closeImport}>Cerrar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Eliminar {deleteTarget.year}</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p className="confirm-text">
              ¿Eliminar los datos históricos de <strong>{deleteTarget.year}</strong>?
              Podrás volver a importarlos desde el Excel.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button className="btn-danger" onClick={confirmDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
