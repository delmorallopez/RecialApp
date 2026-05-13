import { useState, useEffect, useCallback } from "react";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../services/suppliersServices";
import "../stylecss/customers.css";

const SUPPLIER_TYPES = ["Horeca", "Urban"];

const EMPTY_FORM = {
  supplier_type: "Horeca",
  name: "",
  cif: "",
  address: "",
  pickup_point: "",
};

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Fetch ────────────────────────────────────────────────
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
    } catch (err) {
      setError("Could not load suppliers. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchSuppliers, 300);
    return () => clearTimeout(timer);
  }, [fetchSuppliers]);

  // ── Modal helpers ────────────────────────────────────────
  const openAdd = () => {
    setEditingSupplier(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (supplier) => {
    setEditingSupplier(supplier);
    setForm({
      supplier_type: supplier.supplier_type,
      name: supplier.name || "",
      cif: supplier.cif || "",
      address: supplier.address || "",
      pickup_point: supplier.pickup_point || "",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSupplier(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Supplier name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, form);
      } else {
        await createSupplier(form);
      }
      closeModal();
      fetchSuppliers();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(detail || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSupplier(deleteTarget.id);
      setDeleteTarget(null);
      fetchSuppliers();
    } catch {
      setError("Could not delete supplier.");
      setDeleteTarget(null);
    }
  };

  // ── Type badge ───────────────────────────────────────────
  const typeBadge = (type) => {
    const styles = {
      Horeca: { background: "#eff6ff", color: "#1d4ed8" },
      Urban:  { background: "#f0fdf4", color: "#15803d" },
    };
    return (
      <span style={{
        ...styles[type],
        padding: "3px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: "600",
      }}>
        {type}
      </span>
    );
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="customers-page">

      {/* ── Header ── */}
      <div className="customers-header">
        <div>
          <h1 className="customers-title">Suppliers</h1>
          <p className="customers-subtitle">
            {total} registered supplier{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          + New Supplier
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="customers-toolbar" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <div className="search-wrapper">
          <span className="search-icon">⌕</span>
          <input
            className="search-input"
            type="text"
            placeholder="Search by name, CIF or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        {/* Type filter */}
        <div style={{ display: "flex", gap: "8px" }}>
          {["", ...SUPPLIER_TYPES].map((t) => (
            <button
              key={t || "all"}
              onClick={() => setTypeFilter(t)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1.5px solid",
                borderColor: typeFilter === t ? "#2d7a4f" : "#e5e7eb",
                background: typeFilter === t ? "#2d7a4f" : "#fff",
                color: typeFilter === t ? "#fff" : "#374151",
                fontWeight: "600",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              {t || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ── */}
      {error && <div className="error-banner">{error}</div>}

      {/* ── Table ── */}
      <div className="table-wrapper">
        <table className="customers-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Name</th>
              <th>CIF</th>
              <th>Address</th>
              <th>Pickup Point</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="table-state">Loading...</td>
              </tr>
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-state">
                  {search ? "No suppliers match your search." : "No suppliers yet. Add your first one!"}
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id} className="table-row">
                  <td className="td-id">#{s.id}</td>
                  <td>{typeBadge(s.supplier_type)}</td>
                  <td className="td-name">{s.name}</td>
                  <td className="td-cif">{s.cif || "—"}</td>
                  <td className="td-address">{s.address || "—"}</td>
                  <td>{s.pickup_point || "—"}</td>
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

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingSupplier ? "Edit Supplier" : "New Supplier"}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>

              {/* Type selector */}
              <div className="form-group">
                <label>Supplier Type <span className="required">*</span></label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {SUPPLIER_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, supplier_type: t })}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1.5px solid",
                        borderColor: form.supplier_type === t ? "#2d7a4f" : "#e5e7eb",
                        background: form.supplier_type === t ? "#f0fdf4" : "#fff",
                        color: form.supplier_type === t ? "#15803d" : "#374151",
                        fontWeight: "600",
                        fontSize: "14px",
                        cursor: "pointer",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name + CIF */}
              <div className="form-row">
                <div className="form-group form-group--grow">
                  <label>Supplier Name <span className="required">*</span></label>
                  <input
                    type="text"
                    placeholder="Restaurant or company name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>CIF</label>
                  <input
                    type="text"
                    placeholder="B12345678"
                    value={form.cif}
                    onChange={(e) => setForm({ ...form, cif: e.target.value })}
                  />
                </div>
              </div>

              {/* Address */}
              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  placeholder="Street, number, city..."
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              {/* Pickup Point */}
              <div className="form-group">
                <label>Pickup Point</label>
                <input
                  type="text"
                  placeholder="Where Recial collects the oil"
                  value={form.pickup_point}
                  onChange={(e) => setForm({ ...form, pickup_point: e.target.value })}
                />
              </div>

              {formError && <p className="form-error">{formError}</p>}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingSupplier ? "Save Changes" : "Add Supplier"}
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
              <h2>Delete Supplier</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p className="confirm-text">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              This action cannot be undone.
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
