import { createBrowserRouter, RouterProvider, Outlet, Navigate } from "react-router-dom";
import { useState } from "react";

import { AuthProvider, useAuth } from "./context/AuthContext";
import SideBar from "./components/SideBar";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Customers from "./pages/customers";
import Suppliers from "./pages/suppliers";
import Receipts from "./pages/receipts";
import Dispatches from "./pages/dispatches";
import Entrances from "./pages/entrances";
import Reports from "./pages/reports";
import Settings from "./pages/settings";
import Tanks from "./pages/tanks";
import Home from "./pages/home";
import Map from "./Map";

import "./App.css";
import "./index.css";


// ── Protected layout — redirects to login if not authenticated ──
function ProtectedLayout() {
  const { user, loading } = useAuth();
  const [isActive, setIsActive] = useState(false);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3f4f6",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "40px", height: "40px",
            border: "3px solid #e5e7eb",
            borderTopColor: "#2d7a4f",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 16px",
          }} />
          <p style={{ color: "#6b7280", fontSize: "14px" }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not logged in → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app">
      <div
        className={`menu-toggle ${isActive ? "is-active" : ""}`}
        onClick={() => setIsActive(!isActive)}
      >
        <div className="hamburger">
          <span></span>
        </div>
      </div>

      <SideBar isActive={isActive} />

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}


// ── Router ──────────────────────────────────────────────────
const router = createBrowserRouter([
  // Public route — login page (no sidebar)
  {
    path: "/login",
    element: <LoginWrapper />,
  },

  // Protected routes — require authentication
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      { path: "/",          element: <Home /> },
      { path: "home",       element: <Home /> },
      { path: "dashboard",  element: <Dashboard /> },
      { path: "customers",  element: <Customers /> },
      { path: "suppliers",  element: <Suppliers /> },
      { path: "receipts",   element: <Receipts /> },
      { path: "entrances",  element: <Entrances /> },
      { path: "dispatches", element: <Dispatches /> },
      { path: "tanks",      element: <Tanks /> },
      { path: "map",        element: <Map /> },
      { path: "reports",    element: <Reports /> },
      { path: "settings",   element: <Settings /> },
    ],
  },
]);


// ── Login wrapper — redirects to dashboard if already logged in ──
function LoginWrapper() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Login />;
}


// ── App root ────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;