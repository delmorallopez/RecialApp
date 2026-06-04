import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LogoRecial from "../Images/LogoRecial.jpg";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter your username and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate("/dashboard");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Incorrect username or password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1e3d2a 0%, #2d5a3d 50%, #3a7a54 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
      }}>

        {/* Logo card */}
        <div style={{
          background: "rgba(255,255,255,0.1)",
          borderRadius: "16px",
          padding: "24px",
          textAlign: "center",
          marginBottom: "20px",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}>
          <img
            src={LogoRecial}
            alt="Recial"
            style={{ height: "70px", objectFit: "contain", marginBottom: "12px" }}
          />
          <p style={{ color: "rgba(255,255,255,0.9)", fontSize: "14px", margin: 0, fontWeight: "600" }}>
            UCO Traceability System
          </p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", margin: "4px 0 0" }}>
            Reciclajes Recial S.L.
          </p>
        </div>

        {/* Login form card */}
        <div style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        }}>
          <h2 style={{
            fontSize: "22px",
            fontWeight: "800",
            color: "#1a1a2e",
            margin: "0 0 6px",
          }}>
            Sign in
          </h2>
          <p style={{ fontSize: "14px", color: "#6b7280", margin: "0 0 28px" }}>
            Enter your credentials to access the platform
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Username */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
                Username
              </label>
              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                style={{
                  padding: "11px 14px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "9px",
                  fontSize: "15px",
                  color: "#1a1a2e",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => e.target.style.borderColor = "#2d7a4f"}
                onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
              />
            </div>

            {/* Password */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{
                    width: "100%",
                    padding: "11px 44px 11px 14px",
                    border: "1.5px solid #e5e7eb",
                    borderRadius: "9px",
                    fontSize: "15px",
                    color: "#1a1a2e",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#2d7a4f"}
                  onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "16px",
                    color: "#9ca3af",
                    padding: "4px",
                  }}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "13px",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}>
                <span>⚠</span>
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? "#9ca3af" : "#2d7a4f",
                color: "#fff",
                border: "none",
                borderRadius: "9px",
                padding: "13px",
                fontSize: "15px",
                fontWeight: "700",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.2s",
                marginTop: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: "16px", height: "16px",
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }} />
                  Signing in...
                </>
              ) : "Sign in →"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: "center",
          color: "rgba(255,255,255,0.35)",
          fontSize: "12px",
          marginTop: "20px",
        }}>
          © 2025 Reciclajes Recial S.L. · v1.0
        </p>
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
