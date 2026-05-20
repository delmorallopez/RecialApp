import { useState, useEffect, useCallback } from "react";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../services/suppliersServices";
import {
  getPickupPoints,
  createPickupPoint,
  updatePickupPoint,
  deletePickupPoint,
} from "../services/pickupPointsServices";
import "../stylecss/customers.css";

const SUPPLIER_TYPES = ["Horeca", "Urban"];

const EMPTY_FORM = {
  supplier_type: "Horeca",
  name: "",
  cif: "",
  address: "",
};

const EMPTY_PICKUP = { name: "", address: "" };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Supplier modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Pickup points panel (inside supplier modal)
  const [pickupPoints, setPickupPoints] = useState([]);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [newPickup, setNewPickup] = useState(EMPTY_PICKUP);
  const [addingPickup, setAddingPickup] = useState(false);
  const [editingPickup, setEditingPickup] = useState(null);
  const [pickupError, setPickupError] = useState(null);

  // Pickup points list modal (view from table)
  const [pickupListTarget, setPickupListTarget] = useState(null);
  const [pickupListPoints, setPickupListPoints] = useState([]);

  // Delete supplier
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Fetch suppliers ──────────────────────────────────────
  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (typeFilter) params.supplier_type = typeFilter;
      const res = await getSuppliers(params);
      setSuppliers(res.data.suppliers);
      setTotal(res.data.total);
    } catch {
      setError("Could not load suppliers. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchSuppliers, 300);
    return () => clearTimeout(timer);
  }, [fetchSuppliers]);

  // ── Load pickup points for a supplier ───────────────────
  const loadPickupPoints = async (supplierId) => {
    setPickupLoading(true);
    setPickupError(null);
    try {
      const res = await getPickupPoints({ supplier_id: supplierId });
      setPickupPoints(res.data.pickup_points);
    } catch {
      setPickupError("Could not load pickup points.");
    } finally {
      setPickupLoading(false);
    }
  };

  // ── Supplier modal helpers ───────────────────────────────
  const openAdd = () => {
    setEditingSupplier(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setPickupPoints([]);
    setNewPickup(EMPTY_PICKUP);
    setEditingPickup(null);
    setPickupError(null);
    setModalOpen(true);
  };

  const openEdit = (supplier) => {
    setEditingSupplier(supplier);
    setForm({
      supplier_type: supplier.supplier_type,
      name: supplier.name || "",
      cif: supplier.cif || "",
      address: supplier.address || "",
    });
    setFormError(null);
    setNewPickup(EMPTY_PICKUP);
    setEditingPickup(null);
    setPickupError(null);
    setModalOpen(true);
    loadPickupPoints(supplier.id);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSupplier(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setPickupPoints([]);
    setNewPickup(EMPTY_PICKUP);
    setEditingPickup(null);
    setPickupError(null);
  };

  // ── Supplier submit ──────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Supplier name is required."); return; }
    setSaving(true);
    setFormError(null);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, form);
        closeModal();
      } else {
        const res = await createSupplier(form);
        // Switch to edit mode so user can add pickup points immediately
        setEditingSupplier(res.data);
        loadPickupPoints(res.data.id);
      }
      fetchSuppliers();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  // ── Pickup point actions ─────────────────────────────────
  const handleAddPickup = async () => {
    if (!newPickup.name.trim()) { setPickupError("Pickup point name is required."); return; }
    if (!editingSupplier) { setPickupError("Save the supplier first."); return; }
    setPickupError(null);
    setAddingPickup(true);
    try {
      await createPickupPoint({
        supplier_id: editingSupplier.id,
        name: newPickup.name,
        address: newPickup.address,
      });
      setNewPickup(EMPTY_PICKUP);
      loadPickupPoints(editingSupplier.id);
    } catch (err) {
      setPickupError(err.response?.data?.detail || "Could not add pickup point.");
    } finally {
      setAddingPickup(false);
    }
  };

  const handleUpdatePickup = async (id) => {
    if (!editingPickup?.name?.trim()) { setPickupError("Name is required."); return; }
    setPickupError(null);
    try {
      await updatePickupPoint(id, { name: editingPickup.name, address: editingPickup.address });
      setEditingPickup(null);
      loadPickupPoints(editingSupplier.id);
    } catch (err) {
      setPickupError(err.response?.data?.detail || "Could not update pickup point.");
    }
  };

  const handleDeletePickup = async (id) => {
    setPickupError(null);
    try {
      await deletePickupPoint(id);
      loadPickupPoints(editingSupplier.id);
    } catch (err) {
      setPickupError(err.response?.data?.detail || "Could not delete pickup point.");
    }
  };

  // ── View pickup points from table row ───────────────────
  const openPickupList = async (supplier) => {
    setPickupListTarget(supplier);
    try {
      const res = await getPickupPoints({ supplier_id: supplier.id });
      setPickupListPoints(res.data.pickup_points);
    } catch {
      setPickupListPoints([]);
    }
  };

  // ── Delete supplier ──────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSupplier(deleteTarget.id);
      setDeleteTarget(null);
      fetchSuppliers();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not delete supplier.");
      setDeleteTarget(null);
    }
  };

  // ── Type badge ───────────────────────────────────────────
  const typeBadge = (type) => (
    <span style={{
      background: type === "Horeca" ? "#eff6ff" : "#f0fdf4",
      color: type === "Horeca" ? "#1d4ed8" : "#15803d",
      padding: "3px 10px", borderRadius: "999px",
      fontSize: "12px", fontWeight: "600",
    }}>
      {type}
    </span>
  );

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="customers-page">

      {/* Header */}
      <div className="customers-header">
        <div>
          <h1 className="customers-title">Suppliers</h1>
          <p className="customers-subtitle">
            {total} registered supplier{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ New Supplier</button>
      </div>

      {/* Toolbar */}
      <div className="customers-toolbar" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <div className="search-wrapper">
          <span className="search-icon">⌕</span>
          <input
            className="search-input" type="text"
            placeholder="Search by name, CIF or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch("")}>✕</button>}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {["", ...SUPPLIER_TYPES].map((t) => (
            <button key={t || "all"} onClick={() => setTypeFilter(t)} style={{
              padding: "8px 16px", borderRadius: "8px", border: "1.5px solid",
              borderColor: typeFilter === t ? "#2d7a4f" : "#e5e7eb",
              background: typeFilter === t ? "#2d7a4f" : "#fff",
              color: typeFilter === t ? "#fff" : "#374151",
              fontWeight: "600", fontSize: "13px", cursor: "pointer",
            }}>
              {t || "All"}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Table */}
      <div className="table-wrapper">
        <table className="customers-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Name</th>
              <th>CIF</th>
              <th>Address</th>
              <th>Pickup Points</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-state">Loading...</td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td colSpan={7} className="table-state">
                {search ? "No suppliers match your search." : "No suppliers yet. Add your first one!"}
              </td></tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id} className="table-row">
                  <td className="td-id">#{s.id}</td>
                  <td>{typeBadge(s.supplier_type)}</td>
                  <td className="td-name">{s.name}</td>
                  <td className="td-cif">{s.cif || "—"}</td>
                  <td className="td-address">{s.address || "—"}</td>
                  <td>
                    <button onClick={() => openPickupList(s)} style={{
                      background: s.supplier_type === "Urban" ? "#f0fdf4" : "#f8fafc",
                      border: "1.5px solid",
                      borderColor: s.supplier_type === "Urban" ? "#86efac" : "#e5e7eb",
                      borderRadius: "6px", padding: "4px 12px",
                      fontSize: "13px", fontWeight: "600",
                      color: s.supplier_type === "Urban" ? "#15803d" : "#6b7280",
                      cursor: "pointer",
                    }}>
                      📍 View points
                    </button>
                  </td>
                  <td className="td-actions">
                    <button className="btn-edit" onClick={() => openEdit(s)}>Edit</button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(s)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add / Edit Supplier Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal"
            style={{ maxWidth: "700px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
              <h2>{editingSupplier ? "Edit Supplier" : "New Supplier"}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>

              {/* Type selector */}
              <div className="form-group">
                <label>Supplier Type <span className="required">*</span></label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {SUPPLIER_TYPES.map((t) => (
                    <button key={t} type="button"
                      onClick={() => setForm({ ...form, supplier_type: t })}
                      style={{
                        flex: 1, padding: "10px", borderRadius: "8px", border: "1.5px solid",
                        borderColor: form.supplier_type === t ? "#2d7a4f" : "#e5e7eb",
                        background: form.supplier_type === t ? "#f0fdf4" : "#fff",
                        color: form.supplier_type === t ? "#15803d" : "#374151",
                        fontWeight: "600", fontSize: "14px", cursor: "pointer",
                      }}
                    >{t}</button>
                  ))}
                </div>
              </div>

              {/* Name + CIF */}
              <div className="form-row">
                <div className="form-group form-group--grow">
                  <label>Supplier Name <span className="required">*</span></label>
                  <input type="text" placeholder="Company or restaurant name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>CIF</label>
                  <input type="text" placeholder="B12345678"
                    value={form.cif}
                    onChange={(e) => setForm({ ...form, cif: e.target.value })} />
                </div>
              </div>

              {/* Address */}
              <div className="form-group">
                <label>Address</label>
                <input type="text" placeholder="Street, number, city..."
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>

              {formError && <p className="form-error">{formError}</p>}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingSupplier ? "Save Changes" : "Create & Add Pickup Points →"}
                </button>
              </div>
            </form>

            {/* ── Pickup Points section — shown after supplier is created/editing ── */}
            {editingSupplier && (
              <div style={{ margin: "4px 24px 24px", border: "1.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>

                {/* Section header */}
                <div style={{
                  background: form.supplier_type === "Urban" ? "#f0fdf4" : "#f8fafc",
                  borderBottom: "1.5px solid #e5e7eb",
                  padding: "14px 18px",
                }}>
                  <p style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a2e", margin: "0 0 2px" }}>
                    📍 Pickup Points
                  </p>
                  <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                    {pickupPoints.length} point{pickupPoints.length !== 1 ? "s" : ""} registered
                    {form.supplier_type === "Urban" ? " — Urban collection containers" : ""}
                  </p>
                </div>

                {/* List */}
                <div style={{ background: "#fff" }}>
                  {pickupLoading ? (
                    <p style={{ padding: "16px", color: "#9ca3af", fontSize: "14px", textAlign: "center" }}>Loading...</p>
                  ) : pickupPoints.length === 0 ? (
                    <p style={{ padding: "20px", color: "#9ca3af", fontSize: "14px", textAlign: "center" }}>
                      No pickup points yet — add one below.
                    </p>
                  ) : (
                    pickupPoints.map((p, idx) => (
                      <div key={p.id} style={{
                        display: "flex", alignItems: "center", gap: "12px",
                        padding: "12px 18px",
                        borderBottom: idx < pickupPoints.length - 1 ? "1px solid #f3f4f6" : "none",
                        background: editingPickup?.id === p.id ? "#f0fdf4" : "#fff",
                      }}>
                        {editingPickup?.id === p.id ? (
                          <>
                            <div style={{ flex: 1, display: "flex", gap: "8px" }}>
                              <input type="text" value={editingPickup.name}
                                onChange={(e) => setEditingPickup({ ...editingPickup, name: e.target.value })}
                                style={{ flex: 1, padding: "7px 10px", border: "1.5px solid #2d7a4f", borderRadius: "7px", fontSize: "14px" }}
                                placeholder="Point name" />
                              <input type="text" value={editingPickup.address}
                                onChange={(e) => setEditingPickup({ ...editingPickup, address: e.target.value })}
                                style={{ flex: 2, padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: "7px", fontSize: "14px" }}
                                placeholder="Address (optional)" />
                            </div>
                            <button type="button" onClick={() => handleUpdatePickup(p.id)} style={{
                              background: "#2d7a4f", color: "#fff", border: "none",
                              borderRadius: "6px", padding: "7px 14px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                            }}>Save</button>
                            <button type="button" onClick={() => setEditingPickup(null)} style={{
                              background: "#f3f4f6", color: "#374151", border: "none",
                              borderRadius: "6px", padding: "7px 12px", fontSize: "13px", cursor: "pointer",
                            }}>✕</button>
                          </>
                        ) : (
                          <>
                            <span style={{
                              width: "26px", height: "26px", background: "#f0fdf4",
                              borderRadius: "50%", display: "flex", alignItems: "center",
                              justifyContent: "center", fontSize: "12px", fontWeight: "700",
                              color: "#15803d", flexShrink: 0,
                            }}>{idx + 1}</span>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontWeight: "600", fontSize: "14px", color: "#1a1a2e", margin: "0 0 2px" }}>{p.name}</p>
                              {p.address && <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{p.address}</p>}
                            </div>
                            <button type="button"
                              onClick={() => setEditingPickup({ id: p.id, name: p.name, address: p.address || "" })}
                              style={{ background: "#eff6ff", color: "#1d4ed8", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                              Edit
                            </button>
                            <button type="button" onClick={() => handleDeletePickup(p.id)}
                              style={{ background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add new pickup point */}
                <div style={{ background: "#f8fafc", borderTop: "1.5px solid #e5e7eb", padding: "14px 18px" }}>
                  <p style={{ fontSize: "13px", fontWeight: "600", color: "#374151", margin: "0 0 10px" }}>
                    + Add Pickup Point
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input type="text"
                      placeholder="Name (e.g. Container A, Plaza Mayor...)"
                      value={newPickup.name}
                      onChange={(e) => setNewPickup({ ...newPickup, name: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPickup())}
                      style={{ flex: 1, padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
                    <input type="text"
                      placeholder="Address (optional)"
                      value={newPickup.address}
                      onChange={(e) => setNewPickup({ ...newPickup, address: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPickup())}
                      style={{ flex: 2, padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
                    <button type="button" onClick={handleAddPickup} disabled={addingPickup} style={{
                      background: "#2d7a4f", color: "#fff", border: "none",
                      borderRadius: "8px", padding: "9px 18px",
                      fontSize: "14px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap",
                    }}>
                      {addingPickup ? "Adding..." : "Add"}
                    </button>
                  </div>
                  {pickupError && (
                    <p style={{ marginTop: "8px", color: "#dc2626", fontSize: "13px", background: "#fef2f2", padding: "6px 10px", borderRadius: "6px" }}>
                      {pickupError}
                    </p>
                  )}
                </div>
              </div>
            )}

            {!editingSupplier && (
              <p style={{ padding: "0 24px 20px", fontSize: "13px", color: "#9ca3af", textAlign: "center" }}>
                After creating the supplier you can add pickup points.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Pickup Points View Modal (from table) ── */}
      {pickupListTarget && (
        <div className="modal-overlay" onClick={() => setPickupListTarget(null)}>
          <div className="modal" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{pickupListTarget.name}</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0 0" }}>
                  {pickupListTarget.supplier_type} — Pickup Points
                </p>
              </div>
              <button className="modal-close" onClick={() => setPickupListTarget(null)}>✕</button>
            </div>
            <div style={{ padding: "8px 0 16px" }}>
              {pickupListPoints.length === 0 ? (
                <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px", padding: "24px" }}>
                  No pickup points registered yet.
                </p>
              ) : (
                pickupListPoints.map((p, idx) => (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "12px 24px",
                    borderBottom: idx < pickupListPoints.length - 1 ? "1px solid #f3f4f6" : "none",
                  }}>
                    <span style={{
                      width: "28px", height: "28px", background: "#f0fdf4",
                      borderRadius: "50%", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: "13px", fontWeight: "700",
                      color: "#15803d", flexShrink: 0,
                    }}>{idx + 1}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: "600", fontSize: "14px", color: "#1a1a2e", margin: "0 0 2px" }}>{p.name}</p>
                      {p.address && <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{p.address}</p>}
                    </div>
                  </div>
                ))
              )}
              <div style={{ padding: "16px 24px 0", display: "flex", justifyContent: "flex-end" }}>
                <button className="btn-primary" onClick={() => { setPickupListTarget(null); openEdit(pickupListTarget); }}>
                  Manage Pickup Points
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Supplier Confirmation ── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Supplier</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p className="confirm-text">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>
            <div style={{
              margin: "0 24px 16px",
              background: "#fef2f2", border: "1.5px solid #fecaca",
              borderRadius: "10px", padding: "14px 16px",
            }}>
              <p style={{ fontWeight: "700", color: "#dc2626", fontSize: "14px", margin: "0 0 8px" }}>
                ⚠ Traceability Warning
              </p>
              <ul style={{ fontSize: "13px", color: "#7f1d1d", margin: 0, paddingLeft: "18px", lineHeight: 1.8 }}>
                <li>All <strong>pickup points</strong> for this supplier will be deleted</li>
                <li>All <strong>receipts</strong> linked to this supplier will lose their supplier reference</li>
              </ul>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn-danger" onClick={confirmDelete}>Delete anyway</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
