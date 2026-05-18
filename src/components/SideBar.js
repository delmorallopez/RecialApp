import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

import LogoRecial from '../Images/LogoRecial.jpg';
import imageDashboard from '../Images/imageDashboard.jpg';
import imageCustomers from '../Images/imageCustomers.jpg';
import imageSuppliers from '../Images/imageSuppliers.jpg';
import imageReceipts from '../Images/imageReciepts.jpg';
import imageDispatches from '../Images/imageDispatches.jpg';
import imageEntrances from '../Images/imageEntrances.jpg';
import imageLogistics from '../Images/imageLogistics.jpg';
import imageReports from '../Images/imageReports.jpg';
import imageSettings from '../Images/imageSettings.jpg';
import imageTanks from '../Images/imageTank.jpg';

function SideBar({ isActive }) {
  const location = useLocation();
  const [reportsOpen, setReportsOpen] = useState(
    location.pathname.startsWith("/reports")
  );

  const isActive_ = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  const menuItemStyle = (path) => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    borderRadius: "8px",
    textDecoration: "none",
    fontSize: "17px",
    fontWeight: isActive_(path) ? "700" : "500",
    color: isActive_(path) ? "#fff" : "#e8f0e8",
    background: isActive_(path) ? "rgba(255,255,255,0.18)" : "transparent",
    transition: "background 0.15s, color 0.15s",
    marginBottom: "2px",
  });

  return (
    <aside className={`sidebar ${isActive ? "is-active" : ""}`}>

      {/* Logo */}
      <div style={{ padding: "0 16px 16px" }}>
        <Link to="/home">
          <img className="logoRecial" src={LogoRecial} alt="Logo Recial" />
        </Link>
      </div>

      <nav className="menu">

        <Link to="/dashboard" style={menuItemStyle("/dashboard")}>
          <img className="iconsidebar" src={imageDashboard} alt="" />
          Dashboard
        </Link>

        <Link to="/customers" style={menuItemStyle("/customers")}>
          <img className="iconsidebar" src={imageCustomers} alt="" />
          Customers
        </Link>

        <Link to="/suppliers" style={menuItemStyle("/suppliers")}>
          <img className="iconsidebar" src={imageSuppliers} alt="" />
          Suppliers
        </Link>

        <Link to="/receipts" style={menuItemStyle("/receipts")}>
          <img className="iconsidebar" src={imageReceipts} alt="" />
          Receipts
        </Link>

        <Link to="/entrances" style={menuItemStyle("/entrances")}>
          <img className="iconsidebar" src={imageEntrances} alt="" />
          Entrances
        </Link>

        <Link to="/dispatches" style={menuItemStyle("/dispatches")}>
          <img className="iconsidebar" src={imageDispatches} alt="" />
          Dispatches
        </Link>
        
        <Link to="/tanks" style={menuItemStyle("/tanks")}>
          <img className="iconsidebar" src={imageTanks} alt="" />
          Tanks
        </Link>
        
        <Link to="/map" style={menuItemStyle("/map")}>
          <img className="iconsidebar" src={imageLogistics} alt="" />
          Logistics
        </Link>

        {/* ── Reports section with subsections ── */}
        <div>
          {/* Reports toggle button */}
          <button
            onClick={() => setReportsOpen(!reportsOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "17px",
              fontWeight: location.pathname.startsWith("/reports") ? "700" : "500",
              color: location.pathname.startsWith("/reports") ? "#fff" : "#e8f0e8",
              background: location.pathname.startsWith("/reports")
                ? "rgba(255,255,255,0.18)"
                : "transparent",
              border: "none",
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
              marginBottom: "2px",
              transition: "background 0.15s",
            }}
          >
            <img className="iconsidebar" src={imageReports} alt="" />
            <span style={{ flex: 1 }}>Reports</span>
            {/* Arrow indicator */}
            <span style={{
              fontSize: "11px",
              opacity: 0.7,
              transition: "transform 0.2s",
              transform: reportsOpen ? "rotate(180deg)" : "rotate(0deg)",
              display: "inline-block",
            }}>
              ▼
            </span>
          </button>

          {/* Subsections — shown when expanded */}
          {reportsOpen && (
            <div style={{
              marginLeft: "16px",
              borderLeft: "2px solid rgba(255,255,255,0.15)",
              paddingLeft: "12px",
              marginBottom: "4px",
            }}>
              <Link
                to="/reports"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "7px 10px",
                  borderRadius: "7px",
                  textDecoration: "none",
                  fontSize: "15px",
                  fontWeight: location.pathname === "/reports" ? "700" : "400",
                  color: location.pathname === "/reports" ? "#fff" : "#c8dcc8",
                  background: location.pathname === "/reports"
                    ? "rgba(255,255,255,0.14)"
                    : "transparent",
                  marginBottom: "2px",
                  transition: "background 0.15s",
                }}
              >
                <span style={{ fontSize: "14px" }}>⚖️</span>
                Mass Balance
              </Link>

              {/* Placeholder for future reports — easy to add */}
              {/* 
              <Link to="/reports/receipts" style={subItemStyle("/reports/receipts")}>
                <span>📋</span> Receipts Summary
              </Link>
              <Link to="/reports/dispatches" style={subItemStyle("/reports/dispatches")}>
                <span>🚚</span> Dispatches
              </Link>
              */}

              <div style={{
                padding: "6px 10px",
                fontSize: "12px",
                color: "rgba(255,255,255,0.3)",
                fontStyle: "italic",
              }}>
                More coming soon...
              </div>
            </div>
          )}
        </div>

        <Link to="/settings" style={menuItemStyle("/settings")}>
          <img className="iconsidebar" src={imageSettings} alt="" />
          Settings
        </Link>

      </nav>
    </aside>
  );
}

export default SideBar;
