import { useState } from "react";
import "../stylecss/customers.css";
import "../stylecss/reports.css";

// ── Report definitions — add new reports here ────────────────
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
        format: "Excel (.xlsx)",
        icon: "📋",
        color: "#1d4ed8",
        bgColor: "#eff6ff",
        borderColor: "#93c5fd",
        comingSoon: true,
      },
      {
        id: "tank_stock",
        title: "Tank Stock Report",
        description: "Current and historical stock levels across all tanks with fill percentage and trend.",
        format: "Excel (.xlsx)",
        icon: "🛢️",
        color: "#7c3aed",
        bgColor: "#faf5ff",
        borderColor: "#c4b5fd",
        comingSoon: true,
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

export default function Reports() {
  const [activeSection, setActiveSection] = useState("traceability");
  const [generating, setGenerating] = useState(null);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const currentSection = REPORT_SECTIONS.find((s) => s.id === activeSection);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // ── Generate report ───────────────────────────────────────
  const handleGenerate = async (reportId) => {
    setGenerating(reportId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `http://localhost:8000/reports/mass-balance?year=${yearFilter}`,
        { method: "GET" }
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
    } catch (err) {
      setError("Could not generate report. Make sure the backend is running.");
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="reports-page">

      {/* ── Page header ── */}
      <div className="reports-header">
        <div>
          <h1 className="customers-title">Reports</h1>
          <p className="customers-subtitle">
            Generate and download reports for traceability, operations and commercial activity
          </p>
        </div>

        {/* Year filter */}
        <div className="reports-year-selector">
          <label>Year</label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(parseInt(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Success / Error banners ── */}
      {success && (
        <div className="reports-success-banner">
          ✓ {success}
          <button onClick={() => setSuccess(null)}>✕</button>
        </div>
      )}
      {error && (
        <div className="error-banner" style={{ marginBottom: "20px" }}>
          {error}
        </div>
      )}

      <div className="reports-layout">

        {/* ── Left sidebar — sections ── */}
        <aside className="reports-sidebar">
          <p className="reports-sidebar-label">Categories</p>
          {REPORT_SECTIONS.map((section) => (
            <button
              key={section.id}
              className={`reports-sidebar-item ${activeSection === section.id ? "active" : ""}`}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="reports-sidebar-icon">{section.icon}</span>
              <span>{section.label}</span>
              <span className="reports-sidebar-count">
                {section.reports.length}
              </span>
            </button>
          ))}
        </aside>

        {/* ── Right — report cards ── */}
        <div className="reports-content">
          <h2 className="reports-section-title">
            {currentSection?.icon} {currentSection?.label} Reports
          </h2>

          <div className="reports-cards-grid">
            {currentSection?.reports.map((report) => (
              <div
                key={report.id}
                className="report-card"
                style={{
                  borderColor: report.borderColor,
                  background: report.bgColor,
                }}
              >
                {/* Card header */}
                <div className="report-card-header">
                  <div
                    className="report-card-icon"
                    style={{ background: report.color }}
                  >
                    {report.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 className="report-card-title" style={{ color: report.color }}>
                      {report.title}
                    </h3>
                    <span className="report-card-format">{report.format}</span>
                  </div>
                  {report.comingSoon && (
                    <span className="report-card-soon">Coming soon</span>
                  )}
                </div>

                {/* Description */}
                <p className="report-card-description">{report.description}</p>

                {/* Year info + generate button */}
                <div className="report-card-footer">
                  <span className="report-card-period">
                    Period: <strong>{yearFilter}</strong>
                  </span>
                  <button
                    className="report-card-btn"
                    style={{
                      background: report.comingSoon ? "#e5e7eb" : report.color,
                      cursor: report.comingSoon ? "not-allowed" : "pointer",
                    }}
                    disabled={report.comingSoon || generating === report.id}
                    onClick={() => !report.comingSoon && handleGenerate(report.id)}
                  >
                    {generating === report.id ? (
                      <span className="report-btn-loading">Generating...</span>
                    ) : report.comingSoon ? (
                      "Not available yet"
                    ) : (
                      <>⬇ Download {yearFilter}</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
