import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { getDashboard } from "../services/dashboardServices";
import "../stylecss/dashboard.css";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const COLORS = {
  receipts:  "#2d7a4f",
  entrances: "#1d4ed8",
  dispatches:"#d97706",
  disposal:  "#dc2626",
  horeca:    "#3b82f6",
  urban:     "#22c55e",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // ── Fetch dashboard data ─────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    getDashboard(year)
      .then((res) => setData(res.data))
      .catch(() => setError("Could not load dashboard data."))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return (
    <div className="dash-loading">
      <div className="dash-spinner" />
      <p>Loading dashboard...</p>
    </div>
  );

  if (error) return (
    <div className="dash-error">
      <p>{error}</p>
      <button onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  const { kpi, monthly, supplier_split, tanks, activity, calendar } = data;

  // ── Monthly chart data ───────────────────────────────────
  const chartData = monthly.map((m) => ({
    name: MONTHS[m.month - 1],
    "Receipts": m.receipts_kg,
    "Entrances": m.entrances_kg,
    "Dispatches": m.dispatches_kg,
    "Disposal": m.disposal_kg,
  }));

  // ── Donut data ───────────────────────────────────────────
  const donutData = [
    { name: "Horeca", value: supplier_split.horeca_kg },
    { name: "Urban",  value: supplier_split.urban_kg  },
  ];

  // ── Calendar helpers ─────────────────────────────────────
  const calYear = year;
  const daysInMonth = new Date(calYear, calendarMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calendarMonth, 1).getDay(); // 0=Sun
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Mon-start

  const calDays = [];
  for (let i = 0; i < startOffset; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calDays.push(d);

  const dayKey = (d) => {
    const mm = String(calendarMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${calYear}-${mm}-${dd}`;
  };

  const dayEvents = (d) => {
    if (!d) return null;
    return calendar[dayKey(d)] || null;
  };

  const today = new Date();
  const isToday = (d) =>
    d &&
    today.getFullYear() === calYear &&
    today.getMonth() === calendarMonth &&
    today.getDate() === d;

  // ── Activity icon ────────────────────────────────────────
  const actIcon = (type) => {
    if (type === "receipt")  return { icon: "📥", color: "#2d7a4f", bg: "#f0fdf4" };
    if (type === "entrance") return { icon: "📦", color: "#1d4ed8", bg: "#eff6ff" };
    if (type === "dispatch") return { icon: "🚚", color: "#d97706", bg: "#fffbeb" };
    return { icon: "•", color: "#6b7280", bg: "#f3f4f6" };
  };

  const totalStock = tanks.reduce((s, t) => s + t.stock, 0);
  const totalCapacity = tanks.reduce((s, t) => s + t.capacity, 0);

  // ── Custom tooltip for bar chart ─────────────────────────
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: "10px", padding: "12px 16px", fontSize: "13px" }}>
        <p style={{ fontWeight: "700", color: "#1a1a2e", marginBottom: "8px" }}>{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>
            {p.name}: <strong>{p.value.toLocaleString()} kg</strong>
          </p>
        ))}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="dash-page">

      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Dashboard</h1>
          <p className="dash-subtitle">Reciclajes Recial — Overview {year}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Year selector */}
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
            className="dash-year-select">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {/* Quick actions */}
          <button className="dash-quick-btn green" onClick={() => navigate("/receipts")}>+ Receipt</button>
          <button className="dash-quick-btn blue" onClick={() => navigate("/entrances")}>+ Entrance</button>
          <button className="dash-quick-btn amber" onClick={() => navigate("/dispatches")}>+ Dispatch</button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="dash-kpi-grid">
        {[
          { label: "Collected (kg)", value: kpi.receipts_kg.toLocaleString(), sub: `${kpi.receipts_count} receipts`, color: COLORS.receipts, icon: "📥" },
          { label: "Entered (kg)", value: kpi.entrances_kg.toLocaleString(), sub: `${kpi.entrances_count} batches`, color: COLORS.entrances, icon: "📦" },
          { label: "Dispatched (kg)", value: kpi.dispatches_kg.toLocaleString(), sub: `${kpi.dispatches_count} dispatches`, color: COLORS.dispatches, icon: "🚚" },
          { label: "Disposal (kg)", value: kpi.disposal_kg.toLocaleString(), sub: "residue / waste", color: COLORS.disposal, icon: "♻️" },
          { label: "Tank Stock (kg)", value: kpi.total_stock_kg.toLocaleString(), sub: `${tanks.length} active tanks`, color: "#7c3aed", icon: "🛢️" },
          { label: "Pending Receipts", value: kpi.pending_receipts, sub: `${kpi.pending_kg.toLocaleString()} kg unassigned`, color: "#b45309", icon: "⏳", alert: kpi.pending_receipts > 0 },
        ].map(({ label, value, sub, color, icon, alert }) => (
          <div key={label} className={`dash-kpi-card ${alert ? "dash-kpi-alert" : ""}`}>
            <div className="dash-kpi-icon" style={{ background: color + "18", color }}>{icon}</div>
            <div>
              <p className="dash-kpi-value" style={{ color }}>{value}</p>
              <p className="dash-kpi-label">{label}</p>
              <p className="dash-kpi-sub">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main content grid ── */}
      <div className="dash-main-grid">

        {/* ── Left column ── */}
        <div className="dash-left">

          {/* Bar chart — monthly breakdown */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h2>Monthly Mass Balance {year}</h2>
              <p>Receipts · Entrances · Dispatches · Disposal (kg)</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="Receipts"  fill={COLORS.receipts}  radius={[3,3,0,0]} />
                <Bar dataKey="Entrances" fill={COLORS.entrances} radius={[3,3,0,0]} />
                <Bar dataKey="Dispatches" fill={COLORS.dispatches} radius={[3,3,0,0]} />
                <Bar dataKey="Disposal"  fill={COLORS.disposal}  radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Line chart — receipts trend */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h2>Collection Trend {year}</h2>
              <p>kg collected per month</p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="Receipts" stroke={COLORS.receipts}
                  strokeWidth={2.5} dot={{ r: 4, fill: COLORS.receipts }} />
                <Line type="monotone" dataKey="Dispatches" stroke={COLORS.dispatches}
                  strokeWidth={2.5} dot={{ r: 4, fill: COLORS.dispatches }} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Calendar */}
          <div className="dash-card">
            <div className="dash-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2>Activity Calendar</h2>
                <p>📥 Receipts &nbsp; 📦 Entrances &nbsp; 🚚 Dispatches</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button onClick={() => setCalendarMonth((m) => m === 0 ? 11 : m - 1)}
                  className="dash-cal-nav">‹</button>
                <span style={{ fontWeight: "700", fontSize: "14px", color: "#1a1a2e", minWidth: "110px", textAlign: "center" }}>
                  {MONTHS[calendarMonth]} {calYear}
                </span>
                <button onClick={() => setCalendarMonth((m) => m === 11 ? 0 : m + 1)}
                  className="dash-cal-nav">›</button>
              </div>
            </div>

            {/* Day headers */}
            <div className="dash-cal-grid">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                <div key={d} className="dash-cal-day-hdr">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="dash-cal-grid">
              {calDays.map((d, idx) => {
                const ev = dayEvents(d);
                const today_ = isToday(d);
                const selected = selectedDay === dayKey(d);
                return (
                  <div key={idx}
                    className={`dash-cal-cell ${d ? "dash-cal-cell--active" : ""} ${today_ ? "dash-cal-cell--today" : ""} ${selected ? "dash-cal-cell--selected" : ""}`}
                    onClick={() => d && setSelectedDay(selected ? null : dayKey(d))}>
                    {d && (
                      <>
                        <span className="dash-cal-date">{d}</span>
                        <div className="dash-cal-dots">
                          {ev?.receipts  && <span className="dash-dot" style={{ background: COLORS.receipts }} />}
                          {ev?.entrances && <span className="dash-dot" style={{ background: COLORS.entrances }} />}
                          {ev?.dispatches && <span className="dash-dot" style={{ background: COLORS.dispatches }} />}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected day detail */}
            {selectedDay && calendar[selectedDay] && (
              <div className="dash-cal-detail">
                <p style={{ fontWeight: "700", fontSize: "13px", color: "#1a1a2e", marginBottom: "8px" }}>
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                {calendar[selectedDay].receipts && (
                  <p style={{ fontSize: "13px", color: COLORS.receipts }}>
                    📥 {calendar[selectedDay].receipts.count} receipt{calendar[selectedDay].receipts.count !== 1 ? "s" : ""} — <strong>{calendar[selectedDay].receipts.kg} kg</strong>
                  </p>
                )}
                {calendar[selectedDay].entrances && (
                  <p style={{ fontSize: "13px", color: COLORS.entrances }}>
                    📦 {calendar[selectedDay].entrances.count} entrance batch{calendar[selectedDay].entrances.count !== 1 ? "es" : ""} — <strong>{calendar[selectedDay].entrances.kg} kg</strong>
                  </p>
                )}
                {calendar[selectedDay].dispatches && (
                  <p style={{ fontSize: "13px", color: COLORS.dispatches }}>
                    🚚 {calendar[selectedDay].dispatches.count} dispatch{calendar[selectedDay].dispatches.count !== 1 ? "es" : ""} — <strong>{calendar[selectedDay].dispatches.kg} kg</strong>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="dash-right">

          {/* Donut — supplier split */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h2>Collection by Type</h2>
              <p>Horeca vs Urban — {year}</p>
            </div>
            {supplier_split.horeca_kg + supplier_split.urban_kg === 0 ? (
              <p style={{ textAlign: "center", color: "#9ca3af", padding: "32px 0", fontSize: "14px" }}>No data yet</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                      dataKey="value" paddingAngle={3}>
                      <Cell fill={COLORS.horeca} />
                      <Cell fill={COLORS.urban} />
                    </Pie>
                    <Tooltip formatter={(v) => `${v.toLocaleString()} kg`} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginTop: "4px" }}>
                  {donutData.map((d, i) => (
                    <div key={d.name} style={{ textAlign: "center" }}>
                      <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: i === 0 ? COLORS.horeca : COLORS.urban, margin: "0 auto 4px" }} />
                      <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{d.name}</p>
                      <p style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a2e", margin: 0 }}>
                        {d.value.toLocaleString()} kg
                      </p>
                      <p style={{ fontSize: "11px", color: "#9ca3af", margin: 0 }}>
                        {supplier_split.horeca_kg + supplier_split.urban_kg > 0
                          ? Math.round((d.value / (supplier_split.horeca_kg + supplier_split.urban_kg)) * 100)
                          : 0}%
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Tank status */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h2>Tank Status</h2>
              <p>{totalStock.toLocaleString()} / {totalCapacity.toLocaleString()} kg total</p>
            </div>
            {tanks.length === 0 ? (
              <p style={{ textAlign: "center", color: "#9ca3af", padding: "20px 0", fontSize: "14px" }}>No tanks configured</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {tanks.map((t) => {
                  const pct = t.pct;
                  const color = pct >= 90 ? "#dc2626" : pct >= 70 ? "#f59e0b" : "#2d7a4f";
                  return (
                    <div key={t.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                        <span style={{ fontWeight: "600", fontSize: "14px", color: "#1a1a2e" }}>{t.name}</span>
                        <span style={{ fontSize: "13px", color, fontWeight: "700" }}>
                          {t.stock.toLocaleString()} {t.capacity > 0 ? `/ ${t.capacity.toLocaleString()} kg` : "kg"}
                          {t.capacity > 0 && <span style={{ color: "#9ca3af", fontWeight: "400" }}> ({pct}%)</span>}
                        </span>
                      </div>
                      <div style={{ height: "8px", background: "#f3f4f6", borderRadius: "999px", overflow: "hidden" }}>
                        <div style={{
                          width: `${Math.min(pct, 100)}%`, height: "100%",
                          background: color, borderRadius: "999px",
                          transition: "width 0.6s ease",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h2>Recent Activity</h2>
              <p>Last 10 events</p>
            </div>
            {activity.length === 0 ? (
              <p style={{ textAlign: "center", color: "#9ca3af", padding: "20px 0", fontSize: "14px" }}>No activity yet</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {activity.map((a, idx) => {
                  const { icon, color, bg } = actIcon(a.type);
                  return (
                    <div key={idx} style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "9px 4px",
                      borderBottom: idx < activity.length - 1 ? "1px solid #f3f4f6" : "none",
                    }}>
                      <div style={{
                        width: "32px", height: "32px", borderRadius: "8px",
                        background: bg, display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: "14px", flexShrink: 0,
                      }}>{icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: "600", fontSize: "13px", color: "#1a1a2e", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.label}
                        </p>
                        <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                          {a.detail}
                        </p>
                      </div>
                      <span style={{ fontSize: "11px", color: "#9ca3af", flexShrink: 0 }}>
                        {new Date(a.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
