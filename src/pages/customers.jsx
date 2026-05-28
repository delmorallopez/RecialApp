import { useState, useEffect, useCallback } from "react";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../services/customersServices";
import "../stylecss/customers.css";

const EMPTY_FORM = {
  cif: "",
  name: "",
  phone: "",
  address: "",
  email: "",
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Fetch customers ──────────────────────────────────────
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const res = await getCustomers(params);
      setCustomers(res.data.customers);
      setTotal(res.data.total);
    } catch (err) {
      setError("Could not load customers. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timer);
  }, [fetchCustomers]);

  // ── Modal helpers ────────────────────────────────────────
  const openAdd = () => {
    setEditingCustomer(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setConfirmClose(false);
    setModalOpen(true);
  };

  const openEdit = (customer) => {
    setEditingCustomer(customer);
    setForm({
      cif: customer.cif || "",
      name: customer.name || "",
      phone: customer.phone || "",
      address: customer.address || "",
      email: customer.email || "",
    });
    setFormError(null);
    setConfirmClose(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCustomer(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setConfirmClose(false);
  };

  // ── Overlay click — ask before closing if form is dirty ──
  const handleOverlayClick = () => {
    const isDirty = form.name || form.cif || form.email ||
                    form.phone || form.address;
    if (isDirty) {
      setConfirmClose(true);
    } else {
      closeModal();
    }
  };

  // ── Form submit ──────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Customer name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, form);
      } else {
        await createCustomer(form);
      }
      closeModal();
      fetchCustomers();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(
        typeof detail === "string" ? detail : "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCustomer(deleteTarget.id);
      setDeleteTarget(null);
      fetchCustomers();
    } catch {
      setError("Could not delete customer.");
      setDeleteTarget(null);
    }
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="customers-page">

      {/* Header */}
      <div className="customers-header">
        <div>
          <h1 className="customers-title">Customers</h1>
          <p className="customers-subtitle">
            {total} registered customer{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          + New Customer
        </button>
      </div>

      {/* Search */}
      <div className="customers-toolbar">
        <div className="search-wrapper">
          <span className="search-icon">⌕</span>
          <input
            className="search-input"
            type="text"
            placeholder="Search by name, city or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")}>✕</button>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Table */}
      <div className="table-wrapper">
        <table className="customers-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>CIF</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Address</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="table-state">Loading...</td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-state">
                  {search
                    ? "No customers match your search."
                    : "No customers yet. Add your first one!"}
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="td-id">#{c.id}</td>
                  <td className="td-cif">{c.cif || "—"}</td>
                  <td className="td-name">{c.name}</td>
                  <td>{c.phone || "—"}</td>
                  <td>{c.email || "—"}</td>
                  <td className="td-address">{c.address || "—"}</td>
                  <td className="td-actions">
                    <button className="btn-edit" onClick={() => openEdit(c)}>Edit</button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(c)}>Delete</button>
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
          <div
            className="modal"
            style={{ maxWidth: "600px", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
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

            {/* ── Modal header ── */}
            <div className="modal-header">
              <h2>{editingCustomer ? "Edit Customer" : "New Customer"}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            {/* ── Form ── */}
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>CIF</label>
                  <input
                    type="text"
                    placeholder="e.g. B12345678"
                    value={form.cif}
                    onChange={(e) => setForm({ ...form, cif: e.target.value })}
                  />
                </div>
                <div className="form-group form-group--grow">
                  <label>Customer Name <span className="required">*</span></label>
                  <input
                    type="text"
                    placeholder="Company or person name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="text"
                    placeholder="+34 600 000 000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="form-group form-group--grow">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  placeholder="Street, number, city..."
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              {formError && (
                <p className="form-error">
                  {typeof formError === "string" ? formError : "Validation error."}
                </p>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingCustomer ? "Save Changes" : "Add Customer"}
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
              <h2>Delete Customer</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p className="confirm-text">
              Are you sure you want to delete{" "}
              <strong>{deleteTarget.name}</strong>?
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
