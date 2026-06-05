import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";
import "../stylecss/customers.css";
import "./reports.css";
import API from "../services/api";

// ── Report definitions ───────────────────────────────────────
const REPORT_SECTIONS = [
  {
    id: "traceability",
    label: "Traceability",
    icon: "🔗",
    reports: [
      {
        id: "mass_balance",
        title: "Mass Balance",
        description: "Complete mass balance report (ENTRADAS / MERMAS / SALIDAS) following the PG.09.01/REG-A format required for ISCC traceability certification.",
        format: "Excel (.xlsx)",
        icon: "⚖️",
        color: "#2d7a4f",
        bgColor: "#f0fdf4",
        borderColor: "#86efac",
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: "🏭",
    reports: [
      {
        id: "receipts_summary",
        title: "Receipts Summary",
        description: "Summary of all UCO collections by supplier, date range and type (Horeca / Urban).",
        format: "View in modal",
        icon: "📋",
        color: "#1d4ed8",
        bgColor: "#eff6ff",
        borderColor: "#93c5fd",
      },
      {
        id: "tank_stock",
        title: "Tank Stock Report",
        description: "Current and historical stock levels across all tanks with fill percentage and monthly trend reconstructed from entrances and dispatches.",
        format: "View in modal",
        icon: "🛢️",
        color: "#7c3aed",
        bgColor: "#faf5ff",
        borderColor: "#c4b5fd",
      },
    ],
  },
  {
    id: "commercial",
    label: "Commercial",
    icon: "📦",
    reports: [
      {
        id: "dispatches_summary",
        title: "Dispatches Summary",
        description: "Summary of all dispatches by customer, date and quantity. Includes disposal records.",
        format: "Excel (.xlsx)",
        icon: "🚚",
        color: "#b45309",
        bgColor: "#fffbeb",
        borderColor: "#fcd34d",
        comingSoon: true,
      },
      {
        id: "customer_activity",
        title: "Customer Activity",
        description: "Sales activity per customer with total kg dispatched and revenue over a selected period.",
        format: "Excel (.xlsx)",
        icon: "👥",
        color: "#0f766e",
        bgColor: "#f0fdfa",
        borderColor: "#99f6e4",
        comingSoon: true,
      },
    ],
  },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function Reports() {
  const [activeSection, setActiveSection] = useState("traceability");
  const [generating, setGenerating] = useState(null);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  // Receipts summary modal
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [summaryFilters, setSummaryFilters] = useState({
    date_from: "", date_to: "", supplier_type: "", supplier_id: "",
  });

  // Tank stock modal
  const [tankOpen, setTankOpen] = useState(false);
  const [tankLoading, setTankLoading] = useState(false);
  const [tankData, setTankData] = useState(null);
  const [tankError, setTankError] = useState(null);
  const [selectedTank, setSelectedTank] = useState(null);
  const [tankYear, setTankYear] = useState(new Date().getFullYear());

  // Suppliers for filter
  const [suppliers, setSuppliers] = useState([]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    API.get("/suppliers/?limit=200")
      .then((res) => setSuppliers(res.data.suppliers))
      .catch(() => {});
  }, []);

  const currentSection = REPORT_SECTIONS.find((s) => s.id === activeSection);

  // ── Generate / open reports ──────────────────────────────
  const handleGenerate = async (reportId) => {
    if (reportId === "receipts_summary") {
      setSummaryOpen(true);
      fetchReceiptsSummary();
      return;
    }
    if (reportId === "tank_stock") {
      setTankOpen(true);
      fetchTankStock(tankYear);
      return;
    }

    // Mass balance — download Excel
    setGenerating(reportId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `http://localhost:8000/reports/mass-balance?year=${yearFilter}`,
        { method: "GET", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MassBalance_Recial_${yearFilter}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess(`Mass Balance ${yearFilter} downloaded successfully!`);
    } catch {
      setError("Could not generate report. Make sure the backend is running.");
    } finally {
      setGenerating(null);
    }
  };

  // ── Receipts summary ─────────────────────────────────────
  const fetchReceiptsSummary = async (filters = summaryFilters) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const params = new URLSearchParams();
      if (filters.date_from)     params.append("date_from",     filters.date_from);
      if (filters.date_to)       params.append("date_to",       filters.date_to);
      if (filters.supplier_type) params.append("supplier_type", filters.supplier_type);
      if (filters.supplier_id)   params.append("supplier_id",   filters.supplier_id);
      const res = await API.get(`/reports/receipts-summary?${params.toString()}`);
      setSummaryData(res.data);
    } catch {
      setSummaryError("Could not load receipts summary.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleSummaryFilter = (newFilters) => {
    setSummaryFilters(newFilters);
    fetchReceiptsSummary(newFilters);
  };

  // ── Tank stock ───────────────────────────────────────────
  const fetchTankStock = async (yr = tankYear) => {
    setTankLoading(true);
    setTankError(null);
    try {
      const res = await API.get(`/reports/tank-stock?year=${yr}`);
      setTankData(res.data);
      if (res.data.tanks?.length > 0) setSelectedTank(res.data.tanks[0].id);
    } catch {
      setTankError("Could not load tank stock data.");
    } finally {
      setTankLoading(false);
    }
  };

  const handleTankYearChange = (yr) => {
    setTankYear(yr);
    fetchTankStock(yr);
  };

  // ── Helpers ──────────────────────────────────────────────
  const fmt = (d) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const TypeBadge = ({ type }) => (
    <span style={{
      background: type === "Horeca" ? "#eff6ff" : "#f0fdf4",
      color: type === "Horeca" ? "#1d4ed8" : "#15803d",
      padding: "2px 8px", borderRadius: "999px",
      fontSize: "11px", fontWeight: "700",
    }}>{type}</span>
  );

  const stockColor = (pct) => {
    if (pct === null || pct === undefined) return "#6b7280";
    if (pct >= 90) return "#dc2626";
    if (pct >= 70) return "#f59e0b";
    return "#2d7a4f";
  };

  const selectedTankData = tankData?.tanks?.find((t) => t.id === selectedTank);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: "#fff", border: "1.5px solid #e5e7eb",
        borderRadius: "10px", padding: "10px 14px", fontSize: "13px",
      }}>
        <p style={{ fontWeight: "700", color: "#1a1a2e", margin: "0 0 6px" }}>{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>
            {p.name}: <strong>{(p.value || 0).toLocaleString()} kg</strong>
          </p>
        ))}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="reports-page">

      {/* Header */}
      <div className="reports-header">
        <div>
          <h1 className="customers-title">Reports</h1>
          <p className="customers-subtitle">
            Generate and download reports for traceability, operations and commercial activity
          </p>
        </div>
        <div className="reports-year-selector">
          <label>Year</label>
          <select value={yearFilter} onChange={(e) => setYearFilter(parseInt(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {success && (
        <div className="reports-success-banner">
          ✓ {success}
          <button onClick={() => setSuccess(null)}>✕</button>
        </div>
      )}
      {error && <div className="error-banner" style={{ marginBottom: "20px" }}>{error}</div>}

      <div className="reports-layout">

        {/* Sidebar */}
        <aside className="reports-sidebar">
          <p className="reports-sidebar-label">Categories</p>
          {REPORT_SECTIONS.map((section) => (
            <button key={section.id}
              className={`reports-sidebar-item ${activeSection === section.id ? "active" : ""}`}
              onClick={() => setActiveSection(section.id)}>
              <span className="reports-sidebar-icon">{section.icon}</span>
              <span>{section.label}</span>
              <span className="reports-sidebar-count">{section.reports.length}</span>
            </button>
          ))}
        </aside>

        {/* Report cards */}
        <div className="reports-content">
          <h2 className="reports-section-title">
            {currentSection?.icon} {currentSection?.label} Reports
          </h2>
          <div className="reports-cards-grid">
            {currentSection?.reports.map((report) => (
              <div key={report.id} className="report-card"
                style={{ borderColor: report.borderColor, background: report.bgColor }}>
                <div className="report-card-header">
                  <div className="report-card-icon" style={{ background: report.color }}>
                    {report.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 className="report-card-title" style={{ color: report.color }}>
                      {report.title}
                    </h3>
                    <span className="report-card-format">{report.format}</span>
                  </div>
                  {report.comingSoon && <span className="report-card-soon">Coming soon</span>}
                </div>
                <p className="report-card-description">{report.description}</p>
                <div className="report-card-footer">
                  <span className="report-card-period">
                    Period: <strong>{yearFilter}</strong>
                  </span>
                  <button className="report-card-btn"
                    style={{
                      background: report.comingSoon ? "#e5e7eb" : report.color,
                      cursor: report.comingSoon ? "not-allowed" : "pointer",
                    }}
                    disabled={report.comingSoon || generating === report.id}
                    onClick={() => !report.comingSoon && handleGenerate(report.id)}
                  >
                    {generating === report.id ? (
                      <span className="report-btn-loading">Generating...</span>
                    ) : report.comingSoon ? "Not available yet"
                      : report.id === "receipts_summary" ? "📋 View Report"
                      : report.id === "tank_stock" ? "🛢️ View Report"
                      : `⬇ Download ${yearFilter}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          RECEIPTS SUMMARY MODAL
      ══════════════════════════════════════════════════════ */}
      {summaryOpen && (
        <div className="modal-overlay" onClick={() => setSummaryOpen(false)}>
          <div className="modal"
            style={{ maxWidth: "900px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>

            <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 9 }}>
              <div>
                <h2>📋 Receipts Summary</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0 0" }}>
                  UCO collections by supplier
                </p>
              </div>
              <button className="modal-close" onClick={() => setSummaryOpen(false)}>✕</button>
            </div>

            <div style={{ padding: "16px 24px 24px" }}>

              {/* Filters */}
              <div style={{
                display: "flex", gap: "12px", alignItems: "flex-end",
                background: "#f8fafc", border: "1.5px solid #e5e7eb",
                borderRadius: "10px", padding: "14px 16px",
                marginBottom: "20px", flexWrap: "wrap",
              }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>From</label>
                  <input type="date" value={summaryFilters.date_from}
                    onChange={(e) => handleSummaryFilter({ ...summaryFilters, date_from: e.target.value })}
                    style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: "7px", fontSize: "14px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>To</label>
                  <input type="date" value={summaryFilters.date_to}
                    onChange={(e) => handleSummaryFilter({ ...summaryFilters, date_to: e.target.value })}
                    style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: "7px", fontSize: "14px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>Type</label>
                  <select value={summaryFilters.supplier_type}
                    onChange={(e) => handleSummaryFilter({ ...summaryFilters, supplier_type: e.target.value, supplier_id: "" })}
                    style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: "7px", fontSize: "14px", background: "#fff" }}>
                    <option value="">All types</option>
                    <option value="Horeca">Horeca</option>
                    <option value="Urban">Urban</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>Supplier</label>
                  <select value={summaryFilters.supplier_id}
                    onChange={(e) => handleSummaryFilter({ ...summaryFilters, supplier_id: e.target.value })}
                    style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: "7px", fontSize: "14px", background: "#fff", minWidth: "160px" }}>
                    <option value="">All suppliers</option>
                    {suppliers
                      .filter((s) => !summaryFilters.supplier_type || s.supplier_type === summaryFilters.supplier_type)
                      .map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.supplier_type})</option>
                      ))}
                  </select>
                </div>
                {(summaryFilters.date_from || summaryFilters.date_to || summaryFilters.supplier_type || summaryFilters.supplier_id) && (
                  <button
                    onClick={() => handleSummaryFilter({ date_from: "", date_to: "", supplier_type: "", supplier_id: "" })}
                    style={{ padding: "7px 14px", borderRadius: "7px", border: "1.5px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: "13px", cursor: "pointer" }}>
                    Clear
                  </button>
                )}
              </div>

              {/* KPI cards */}
              {summaryData && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
                  {[
                    { label: "Total Receipts", value: summaryData.total_receipts, color: "#1d4ed8", icon: "📋" },
                    { label: "Total kg",       value: `${summaryData.total_kg?.toLocaleString()} kg`, color: "#2d7a4f", icon: "⚖️" },
                    { label: "Horeca kg",      value: `${summaryData.horeca_kg?.toLocaleString()} kg`, color: "#1d4ed8", icon: "🍽️" },
                    { label: "Urban kg",       value: `${summaryData.urban_kg?.toLocaleString()} kg`, color: "#15803d", icon: "🏙️" },
                  ].map(({ label, value, color, icon }) => (
                    <div key={label} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: "10px", padding: "14px 16px" }}>
                      <p style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", margin: "0 0 6px" }}>
                        {icon} {label}
                      </p>
                      <p style={{ fontSize: "20px", fontWeight: "800", color, margin: 0 }}>{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Table */}
              {summaryLoading ? (
                <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Loading...</p>
              ) : summaryError ? (
                <div className="error-banner">{summaryError}</div>
              ) : summaryData?.suppliers?.length === 0 ? (
                <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>No receipts found.</p>
              ) : (
                <div className="table-wrapper" style={{ margin: 0 }}>
                  <table className="customers-table">
                    <thead>
                      <tr>
                        <th>Supplier</th><th>Type</th><th>Receipts</th>
                        <th>First</th><th>Last</th><th>Total (kg)</th><th>% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData?.suppliers?.map((s) => {
                        const pct = summaryData.total_kg > 0
                          ? ((s.total_kg / summaryData.total_kg) * 100).toFixed(1) : 0;
                        return (
                          <tr key={s.supplier_id} className="table-row">
                            <td className="td-name">{s.supplier_name}</td>
                            <td><TypeBadge type={s.supplier_type} /></td>
                            <td style={{ textAlign: "center", fontWeight: "600" }}>{s.receipts_count}</td>
                            <td style={{ color: "#6b7280", fontSize: "13px" }}>{fmt(s.first_date)}</td>
                            <td style={{ color: "#6b7280", fontSize: "13px" }}>{fmt(s.last_date)}</td>
                            <td style={{ fontWeight: "700", color: "#2d7a4f" }}>{s.total_kg.toLocaleString()} kg</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ flex: 1, height: "6px", background: "#f3f4f6", borderRadius: "999px", overflow: "hidden" }}>
                                  <div style={{
                                    width: `${pct}%`, height: "100%",
                                    background: s.supplier_type === "Horeca" ? "#1d4ed8" : "#2d7a4f",
                                    borderRadius: "999px",
                                  }} />
                                </div>
                                <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600", minWidth: "36px" }}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {summaryData?.suppliers?.length > 0 && (
                      <tfoot>
                        <tr style={{ background: "#f8fafc", borderTop: "2px solid #e5e7eb" }}>
                          <td colSpan={2} style={{ padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "13px" }}>
                            TOTAL ({summaryData.suppliers.length} suppliers)
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: "700", color: "#374151", textAlign: "center" }}>
                            {summaryData.total_receipts}
                          </td>
                          <td colSpan={2} />
                          <td style={{ padding: "12px 16px", fontWeight: "800", color: "#2d7a4f", fontSize: "15px" }}>
                            {summaryData.total_kg?.toLocaleString()} kg
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: "700", color: "#374151" }}>100%</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TANK STOCK MODAL
      ══════════════════════════════════════════════════════ */}
      {tankOpen && (
        <div className="modal-overlay" onClick={() => setTankOpen(false)}>
          <div className="modal"
            style={{ maxWidth: "960px", maxHeight: "92vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>

            <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 9 }}>
              <div>
                <h2>🛢️ Tank Stock Report</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0 0" }}>
                  Monthly stock levels reconstructed from entrances and dispatches
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <select value={tankYear} onChange={(e) => handleTankYearChange(parseInt(e.target.value))}
                  style={{ padding: "7px 12px", border: "1.5px solid #e5e7eb", borderRadius: "7px", fontSize: "14px", fontWeight: "600" }}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <button className="modal-close" onClick={() => setTankOpen(false)}>✕</button>
              </div>
            </div>

            <div style={{ padding: "16px 24px 24px" }}>

              {tankLoading ? (
                <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Loading...</p>
              ) : tankError ? (
                <div className="error-banner">{tankError}</div>
              ) : !tankData?.tanks?.length ? (
                <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>No tanks found.</p>
              ) : (
                <>
                  {/* ── Current stock overview cards ── */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "24px" }}>
                    {tankData.tanks.map((t) => {
                      const color = stockColor(t.current_pct);
                      return (
                        <div key={t.id}
                          onClick={() => setSelectedTank(t.id)}
                          style={{
                            background: selectedTank === t.id ? "#faf5ff" : "#fff",
                            border: `1.5px solid ${selectedTank === t.id ? "#c4b5fd" : "#e5e7eb"}`,
                            borderRadius: "12px", padding: "16px",
                            cursor: "pointer", transition: "all 0.15s",
                          }}>
                          <p style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a2e", margin: "0 0 8px" }}>
                            {t.name}
                          </p>
                          <p style={{ fontWeight: "800", fontSize: "22px", color, margin: "0 0 8px" }}>
                            {(t.current_stock || 0).toLocaleString()} kg
                          </p>
                          {t.capacity > 0 && (
                            <>
                              <div style={{ height: "6px", background: "#f3f4f6", borderRadius: "999px", overflow: "hidden", marginBottom: "4px" }}>
                                <div style={{
                                  width: `${Math.min(t.current_pct, 100)}%`,
                                  height: "100%", background: color, borderRadius: "999px",
                                  transition: "width 0.6s ease",
                                }} />
                              </div>
                              <p style={{ fontSize: "12px", color, fontWeight: "600", margin: 0 }}>
                                {t.current_pct}% · {t.capacity.toLocaleString()} kg capacity
                              </p>
                            </>
                          )}
                          <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                            <div>
                              <p style={{ fontSize: "10px", color: "#9ca3af", margin: "0 0 2px" }}>IN {tankYear}</p>
                              <p style={{ fontSize: "13px", fontWeight: "700", color: "#2d7a4f", margin: 0 }}>+{t.total_in.toLocaleString()} kg</p>
                            </div>
                            <div>
                              <p style={{ fontSize: "10px", color: "#9ca3af", margin: "0 0 2px" }}>OUT {tankYear}</p>
                              <p style={{ fontSize: "13px", fontWeight: "700", color: "#dc2626", margin: 0 }}>-{t.total_out.toLocaleString()} kg</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Selected tank detail ── */}
                  {selectedTankData && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                        <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1a1a2e", margin: 0 }}>
                          {selectedTankData.name} — Monthly Breakdown {tankYear}
                        </h3>
                        <span style={{ fontSize: "12px", color: "#9ca3af" }}>click a tank card to switch</span>
                      </div>

                      {/* Bar chart — in vs out */}
                      <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
                        <p style={{ fontWeight: "600", fontSize: "14px", color: "#374151", margin: "0 0 16px" }}>
                          Entrances vs Dispatches + Disposal
                        </p>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={selectedTankData.monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} />
                            <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: "12px" }} />
                            <Bar dataKey="added"   name="In (kg)"  fill="#2d7a4f" radius={[3,3,0,0]} />
                            <Bar dataKey="removed" name="Out (kg)" fill="#dc2626" radius={[3,3,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Line chart — stock level */}
                      <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
                        <p style={{ fontWeight: "600", fontSize: "14px", color: "#374151", margin: "0 0 16px" }}>
                          Running Stock Level
                          {selectedTankData.capacity > 0 && (
                            <span style={{ fontSize: "12px", color: "#9ca3af", marginLeft: "8px" }}>
                              capacity: {selectedTankData.capacity.toLocaleString()} kg
                            </span>
                          )}
                        </p>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={selectedTankData.monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} />
                            <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="stock" name="Stock (kg)"
                              stroke="#7c3aed" strokeWidth={2.5}
                              dot={{ r: 4, fill: "#7c3aed" }} />
                            {selectedTankData.capacity > 0 && (
                              <Line type="monotone"
                                data={selectedTankData.monthly.map((m) => ({ ...m, capacity: selectedTankData.capacity }))}
                                dataKey="capacity" name="Capacity"
                                stroke="#e5e7eb" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Monthly table */}
                      <div className="table-wrapper" style={{ margin: 0 }}>
                        <table className="customers-table">
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th>In (kg)</th>
                              <th>Out (kg)</th>
                              <th>Net (kg)</th>
                              <th>Stock (kg)</th>
                              {selectedTankData.capacity > 0 && <th>Fill %</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedTankData.monthly.map((m) => {
                              const net = m.added - m.removed;
                              const color = stockColor(m.fill_pct);
                              return (
                                <tr key={m.month} className="table-row">
                                  <td style={{ fontWeight: "600" }}>{m.label}</td>
                                  <td style={{ color: "#2d7a4f", fontWeight: "600" }}>
                                    {m.added > 0 ? `+${m.added.toLocaleString()}` : "—"}
                                  </td>
                                  <td style={{ color: m.removed > 0 ? "#dc2626" : "#9ca3af" }}>
                                    {m.removed > 0 ? `-${m.removed.toLocaleString()}` : "—"}
                                  </td>
                                  <td style={{ fontWeight: "600", color: net >= 0 ? "#2d7a4f" : "#dc2626" }}>
                                    {net > 0 ? `+${net.toLocaleString()}` : net < 0 ? net.toLocaleString() : "—"}
                                  </td>
                                  <td style={{ fontWeight: "700", color: "#1a1a2e" }}>
                                    {m.stock.toLocaleString()} kg
                                  </td>
                                  {selectedTankData.capacity > 0 && (
                                    <td>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <div style={{ width: "60px", height: "6px", background: "#f3f4f6", borderRadius: "999px", overflow: "hidden" }}>
                                          <div style={{
                                            width: `${Math.min(m.fill_pct || 0, 100)}%`,
                                            height: "100%", background: color, borderRadius: "999px",
                                          }} />
                                        </div>
                                        <span style={{ fontSize: "12px", color, fontWeight: "600" }}>
                                          {m.fill_pct ?? "—"}%
                                        </span>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: "#f8fafc", borderTop: "2px solid #e5e7eb" }}>
                              <td style={{ padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "13px" }}>
                                TOTAL {tankYear}
                              </td>
                              <td style={{ padding: "12px 16px", fontWeight: "700", color: "#2d7a4f" }}>
                                +{selectedTankData.total_in.toLocaleString()} kg
                              </td>
                              <td style={{ padding: "12px 16px", fontWeight: "700", color: "#dc2626" }}>
                                -{selectedTankData.total_out.toLocaleString()} kg
                              </td>
                              <td style={{ padding: "12px 16px", fontWeight: "700", color: (selectedTankData.total_in - selectedTankData.total_out) >= 0 ? "#2d7a4f" : "#dc2626" }}>
                                {selectedTankData.total_in - selectedTankData.total_out >= 0 ? "+" : ""}
                                {(selectedTankData.total_in - selectedTankData.total_out).toLocaleString()} kg
                              </td>
                              <td style={{ padding: "12px 16px", fontWeight: "800", color: "#7c3aed", fontSize: "15px" }}>
                                {selectedTankData.current_stock.toLocaleString()} kg
                              </td>
                              {selectedTankData.capacity > 0 && (
                                <td style={{ padding: "12px 16px", fontWeight: "700", color: stockColor(selectedTankData.current_pct) }}>
                                  {selectedTankData.current_pct}%
                                </td>
                              )}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
