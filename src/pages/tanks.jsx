import { useState, useEffect, useCallback } from "react";
import {
  getTanks,
  createTank,
  updateTank,
  deleteTank,
} from "../services/tanksServices";
import "../stylecss/customers.css";

const EMPTY_FORM = {
  name: "",
  capacity: "",
  is_active: true,
};

export default function Tanks() {
  const [tanks, setTanks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTank, setEditingTank] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
 
  const [confirmClose, setConfirmClose] = useState(false);

  const handleOverlayClick = () => {
    const isDirty = form.name || form.capacity;
    if (isDirty) setConfirmClose(true);
    else closeModal();
  };

  // ── Fetch tanks ──────────────────────────────────────────
  const fetchTanks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTanks();
      setTanks(res.data.tanks);
      setTotal(res.data.total);
    } catch {
      setError("Could not load tanks. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTanks();
  }, [fetchTanks]);

  // ── Modal helpers ────────────────────────────────────────
  const openAdd = () => {
    setEditingTank(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
    setConfirmClose(false);
  };

  const openEdit = (tank) => {
    setEditingTank(tank);
    setForm({
      name: tank.name || "",
      capacity: tank.capacity || "",
      is_active: tank.is_active ?? true,
    });
    setFormError(null);
    setModalOpen(true);
    setConfirmClose(false);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTank(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setConfirmClose(false);
  };

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Tank name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name,
        capacity: form.capacity ? parseInt(form.capacity) : null,
        is_active: form.is_active,
      };
      if (editingTank) {
        await updateTank(editingTank.id, payload);
      } else {
        await createTank(payload);
      }
      closeModal();
      fetchTanks();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTank(deleteTarget.id);
      setDeleteTarget(null);
      fetchTanks();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not delete tank.");
      setDeleteTarget(null);
    }
  };

  // ── Stock bar component ──────────────────────────────────
  const StockBar = ({ stock, capacity }) => {
    if (!capacity) {
      return (
        <div style={{ fontSize: "14px", color: "#374151" }}>
          <strong>{stock || 0}</strong> kg
          <span style={{ fontSize: "12px", color: "#9ca3af", marginLeft: "6px" }}>
            (no capacity set)
          </span>
        </div>
      );
    }

    const pct = Math.min(100, Math.round(((stock || 0) / capacity) * 100));
    const color =
      pct >= 90 ? "#dc2626" :   // red — almost full
      pct >= 70 ? "#f59e0b" :   // amber — getting full
      "#2d7a4f";                 // green — normal

    return (
      <div style={{ minWidth: "180px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
          <span style={{ fontSize: "14px", fontWeight: "700", color }}>
            {stock || 0} kg
          </span>
          <span style={{ fontSize: "12px", color: "#9ca3af" }}>
            {pct}% of {capacity} kg
          </span>
        </div>
        <div style={{
          width: "100%", height: "8px", background: "#f3f4f6",
          borderRadius: "999px", overflow: "hidden",
        }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: color, borderRadius: "999px",
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>
    );
  };

  // ── Status badge ─────────────────────────────────────────
  const statusBadge = (isActive) => (
    <span style={{
      background: isActive ? "#f0fdf4" : "#f9fafb",
      color: isActive ? "#15803d" : "#9ca3af",
      padding: "3px 10px", borderRadius: "999px",
      fontSize: "12px", fontWeight: "600",
    }}>
      {isActive ? "Active" : "Inactive"}
    </span>
  );

  // ── Summary stats ────────────────────────────────────────
  const totalStock = tanks.reduce((s, t) => s + (t.stock || 0), 0);
  const totalCapacity = tanks.reduce((s, t) => s + (t.capacity || 0), 0);
  const activeTanks = tanks.filter((t) => t.is_active).length;

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="customers-page">

      {/* ── Header ── */}
      <div className="customers-header">
        <div>
          <h1 className="customers-title">Tanks</h1>
          <p className="customers-subtitle">
            {activeTanks} active tank{activeTanks !== 1 ? "s" : ""} —{" "}
            <strong>{totalStock.toLocaleString()} kg</strong> in stock
            {totalCapacity > 0 && (
              <span style={{ color: "#9ca3af" }}>
                {" "}/ {totalCapacity.toLocaleString()} kg total capacity
              </span>
            )}
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          + New Tank
        </button>
      </div>

      {/* ── Summary cards ── */}
      {tanks.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}>
          {[
            { label: "Total Tanks", value: total, color: "#1a1a2e" },
            { label: "Active Tanks", value: activeTanks, color: "#15803d" },
            { label: "Total Stock (kg)", value: totalStock.toLocaleString(), color: "#2d7a4f" },
            { label: "Total Capacity (kg)", value: totalCapacity > 0 ? totalCapacity.toLocaleString() : "—", color: "#374151" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: "#fff", border: "1.5px solid #e5e7eb",
              borderRadius: "12px", padding: "20px 24px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              <p style={{ fontSize: "12px", fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                {label}
              </p>
              <p style={{ fontSize: "24px", fontWeight: "800", color, margin: 0 }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {/* ── Table ── */}
      <div className="table-wrapper">
        <table className="customers-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tank Name</th>
              <th>Status</th>
              <th>Stock / Capacity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="table-state">Loading...</td>
              </tr>
            ) : tanks.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-state">
                  No tanks yet. Add your first tank!
                </td>
              </tr>
            ) : (
              tanks.map((t) => (
                <tr key={t.id} className="table-row">
                  <td className="td-id">#{t.id}</td>
                  <td className="td-name">{t.name}</td>
                  <td>{statusBadge(t.is_active)}</td>
                  <td>
                    <StockBar stock={t.stock} capacity={t.capacity} />
                  </td>
                  <td className="td-actions">
                    <button className="btn-edit" onClick={() => openEdit(t)}>Edit</button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(t)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={handleOverlayClick}>
        <div className="modal" onClick={(e) => e.stopPropagation()}
        >
          {/* ── Discard confirmation overlay ── */}
          {confirmClose && (
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 10, borderRadius: "16px",
              }}>
                <div style={{
                  background: "#fff", borderRadius: "14px",
                  padding: "28px 32px", maxWidth: "360px",
                  textAlign: "center",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                }}>
                  <p style={{ fontSize: "22px", marginBottom: "8px" }}>⚠️</p>
                  <p style={{ fontWeight: "700", fontSize: "16px", color: "#1a1a2e", marginBottom: "8px" }}>
                    Discard changes?
                  </p>
                  <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "24px" }}>
                    You have unsaved data. If you close now it will be lost.
                  </p>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                    <button
                      onClick={() => setConfirmClose(false)}
                      style={{
                        padding: "10px 20px", borderRadius: "8px",
                        border: "1.5px solid #e5e7eb", background: "#fff",
                        color: "#374151", fontWeight: "600", fontSize: "14px", cursor: "pointer",
                      }}
                    >
                      Keep editing
                    </button>
                    <button
                      onClick={() => { setConfirmClose(false); closeModal(); }}
                      style={{
                        padding: "10px 20px", borderRadius: "8px",
                        border: "none", background: "#dc2626",
                        color: "#fff", fontWeight: "600", fontSize: "14px", cursor: "pointer",
                      }}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              </div>
            )}  
            <div className="modal-header">
              <h2>{editingTank ? "Edit Tank" : "New Tank"}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>

              {/* Name */}
              <div className="form-group">
                <label>Tank Name <span className="required">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Tank 1, Tank A..."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              {/* Capacity */}
              <div className="form-group">
                <label>Capacity (kg)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Maximum capacity in kg"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                />
              </div>

              {/* Status toggle */}
              <div className="form-group">
                <label>Status</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {[true, false].map((val) => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => setForm({ ...form, is_active: val })}
                      style={{
                        flex: 1, padding: "10px", borderRadius: "8px",
                        border: "1.5px solid",
                        borderColor: form.is_active === val ? "#2d7a4f" : "#e5e7eb",
                        background: form.is_active === val ? "#f0fdf4" : "#fff",
                        color: form.is_active === val ? "#15803d" : "#9ca3af",
                        fontWeight: "600", fontSize: "14px", cursor: "pointer",
                      }}
                    >
                      {val ? "Active" : "Inactive"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stock info when editing */}
              {editingTank && (
                <div style={{
                  background: "#f8fafc", border: "1.5px solid #e5e7eb",
                  borderRadius: "10px", padding: "14px 16px",
                }}>
                  <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 8px", fontWeight: "600" }}>
                    Current Stock
                  </p>
                  <StockBar stock={editingTank.stock} capacity={editingTank.capacity} />
                  <p style={{ fontSize: "12px", color: "#9ca3af", margin: "8px 0 0" }}>
                    Stock is updated automatically when entrances are created or deleted.
                  </p>
                </div>
              )}

              {formError && <p className="form-error">{formError}</p>}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingTank ? "Save Changes" : "Add Tank"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Tank</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p className="confirm-text">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              {deleteTarget.stock > 0 && (
                <span style={{ display: "block", marginTop: "8px", color: "#dc2626", fontWeight: "600" }}>
                  ⚠ This tank still has {deleteTarget.stock} kg of stock.
                </span>
              )}
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
