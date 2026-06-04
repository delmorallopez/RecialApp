import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

import LogoRecial from '../Images/LogoRecial.jpg';

const MENU = [
  { path: "/dashboard",  label: "Dashboard",  icon: "📊" },
  { path: "/customers",  label: "Customers",  icon: "👥" },
  { path: "/suppliers",  label: "Suppliers",  icon: "🏭" },
  { divider: true, label: "OPERATIONS" },
  { path: "/receipts",   label: "Receipts",   icon: "📥" },
  { path: "/entrances",  label: "Entrances",  icon: "📦" },
  { path: "/dispatches", label: "Dispatches", icon: "🚚" },
  { divider: true, label: "ASSETS" },
  { path: "/tanks",      label: "Tanks",      icon: "🛢️" },
  { path: "/map",        label: "Logistics",  icon: "🗺️" },
  { divider: true, label: "ANALYTICS" },
];

const REPORTS_ITEMS = [
  { path: "/reports", label: "Mass Balance", icon: "⚖️" },
];

// Role badge colors
const ROLE_STYLES = {
  admin:   { bg: "rgba(220,38,38,0.2)",  color: "#fca5a5", label: "Admin" },
  manager: { bg: "rgba(234,179,8,0.2)",  color: "#fde68a", label: "Manager" },
  driver:  { bg: "rgba(59,130,246,0.2)", color: "#93c5fd", label: "Driver" },
};

function SideBar({ isActive }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [reportsOpen, setReportsOpen] = useState(
    location.pathname.startsWith("/reports")
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isActivePath = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const itemStyle = (active) => ({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "11px 14px",
    borderRadius: "9px",
    textDecoration: "none",
    marginBottom: "3px",
    fontSize: "15px",
    fontWeight: active ? "700" : "500",
    color: active ? "#ffffff" : "rgba(255,255,255,0.88)",
    background: active ? "rgba(255,255,255,0.2)" : "transparent",
    borderLeft: active ? "3px solid rgba(255,255,255,0.9)" : "3px solid transparent",
    transition: "all 0.15s ease",
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    border: "none",
    boxSizing: "border-box",
  });

  const hoverIn = (e, active) => {
    if (!active) {
      e.currentTarget.style.background = "rgba(255,255,255,0.1)";
      e.currentTarget.style.color = "#ffffff";
    }
  };

  const hoverOut = (e, active) => {
    if (!active) {
      e.currentTarget.style.background = "transparent";
      e.currentTarget.style.color = "rgba(255,255,255,0.88)";
    }
  };

  // Get initials from full name or username
  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() || "?";

  const roleStyle = ROLE_STYLES[user?.role] || ROLE_STYLES.driver;

  return (
    <aside className={`sidebar ${isActive ? "is-active" : ""}`}>

      {/* Logo */}
      <div style={{ padding: "20px 16px 8px" }}>
        <Link to="/home" style={{ display: "block" }}>
          <img src={LogoRecial} alt="Recial"
            style={{ width: "100%", height: "80px", objectFit: "contain", display: "block" }} />
        </Link>
      </div>

      {/* Company name */}
      <div style={{ padding: "4px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <p style={{ fontSize: "12px", fontWeight: "700", color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
          Reciclajes Recial
        </p>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", margin: "2px 0 0" }}>
          UCO Traceability System
        </p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>

        {MENU.map((item, idx) => {
          if (item.divider) {
            return (
              <div key={idx} style={{ padding: "16px 10px 5px" }}>
                <p style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.1em", color: "rgba(255,255,255,0.55)", textTransform: "uppercase", margin: 0 }}>
                  {item.label}
                </p>
              </div>
            );
          }

          const active = isActivePath(item.path);
          return (
            <Link key={item.path} to={item.path}
              style={itemStyle(active)}
              onMouseEnter={(e) => hoverIn(e, active)}
              onMouseLeave={(e) => hoverOut(e, active)}
            >
              <span style={{ fontSize: "18px", width: "22px", textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {active && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(255,255,255,0.9)", flexShrink: 0 }} />}
            </Link>
          );
        })}

        {/* Reports collapsible */}
        <button
          onClick={() => setReportsOpen(!reportsOpen)}
          style={{
            ...itemStyle(location.pathname.startsWith("/reports")),
            border: "none",
            borderLeft: location.pathname.startsWith("/reports") ? "3px solid rgba(255,255,255,0.9)" : "3px solid transparent",
          }}
          onMouseEnter={(e) => hoverIn(e, location.pathname.startsWith("/reports"))}
          onMouseLeave={(e) => hoverOut(e, location.pathname.startsWith("/reports"))}
        >
          <span style={{ fontSize: "18px", width: "22px", textAlign: "center", flexShrink: 0 }}>📈</span>
          <span style={{ flex: 1 }}>Reports</span>
          <span style={{ fontSize: "11px", opacity: 0.7, transform: reportsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
        </button>

        {reportsOpen && (
          <div style={{ marginLeft: "16px", paddingLeft: "18px", borderLeft: "1px solid rgba(255,255,255,0.2)", marginBottom: "4px" }}>
            {REPORTS_ITEMS.map((item) => {
              const active = isActivePath(item.path);
              return (
                <Link key={item.path} to={item.path} style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "9px 10px", borderRadius: "7px", textDecoration: "none",
                  marginBottom: "2px", fontSize: "14px",
                  fontWeight: active ? "700" : "400",
                  color: active ? "#fff" : "rgba(255,255,255,0.75)",
                  background: active ? "rgba(255,255,255,0.14)" : "transparent",
                  transition: "all 0.15s ease",
                }}
                  onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; } }}
                  onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.75)"; } }}
                >
                  <span style={{ fontSize: "14px" }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div style={{ padding: "4px 10px", fontSize: "11px", color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
              More coming soon
            </div>
          </div>
        )}

        {/* Settings */}
        {(() => {
          const active = isActivePath("/settings");
          return (
            <Link to="/settings" style={{ ...itemStyle(active), marginTop: "8px", borderLeft: active ? "3px solid rgba(255,255,255,0.9)" : "3px solid transparent" }}
              onMouseEnter={(e) => hoverIn(e, active)}
              onMouseLeave={(e) => hoverOut(e, active)}>
              <span style={{ fontSize: "18px", width: "22px", textAlign: "center", flexShrink: 0 }}>⚙️</span>
              <span style={{ flex: 1 }}>Settings</span>
              {active && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(255,255,255,0.9)", flexShrink: 0 }} />}
            </Link>
          );
        })()}
      </nav>

      {/* ── User footer ── */}
      <div style={{ padding: "12px 14px 16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>

        {/* Logout confirmation */}
        {showLogoutConfirm ? (
          <div style={{
            background: "rgba(220,38,38,0.15)",
            border: "1px solid rgba(220,38,38,0.3)",
            borderRadius: "10px",
            padding: "12px",
            textAlign: "center",
          }}>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", margin: "0 0 10px", fontWeight: "600" }}>
              Sign out?
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1, padding: "7px", borderRadius: "7px",
                  background: "rgba(255,255,255,0.1)", border: "none",
                  color: "rgba(255,255,255,0.8)", fontSize: "12px",
                  fontWeight: "600", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                style={{
                  flex: 1, padding: "7px", borderRadius: "7px",
                  background: "#dc2626", border: "none",
                  color: "#fff", fontSize: "12px",
                  fontWeight: "700", cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "10px 12px", borderRadius: "10px",
            background: "rgba(255,255,255,0.07)",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
          >
            {/* Avatar */}
            <div style={{
              width: "34px", height: "34px", borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "13px", fontWeight: "800", color: "#fff", flexShrink: 0,
            }}>
              {initials}
            </div>

            {/* User info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: "13px", fontWeight: "700",
                color: "rgba(255,255,255,0.9)", margin: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {user?.full_name || user?.username || "User"}
              </p>
              <span style={{
                display: "inline-block",
                fontSize: "10px", fontWeight: "700",
                background: roleStyle.bg,
                color: roleStyle.color,
                padding: "1px 7px",
                borderRadius: "999px",
                marginTop: "2px",
                textTransform: "capitalize",
              }}>
                {roleStyle.label}
              </span>
            </div>

            {/* Logout button */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowLogoutConfirm(true); }}
              title="Sign out"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "6px",
                width: "28px", height: "28px",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                fontSize: "14px",
                flexShrink: 0,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(220,38,38,0.3)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            >
              ↪
            </button>
          </div>
        )}
      </div>

    </aside>
  );
}

export default SideBar;
