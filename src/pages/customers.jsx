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
      setError("No se pudieron cargar los clientes. ¿Está el servidor en ejecución?");
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
       setFormError("El nombre del cliente es obligatorio.");
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
        typeof detail === "string" ? detail : "Ha ocurrido un error. Por favor, inténtalo de nuevo."
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCustomer(deleteTarget.id);
      setDeleteTarget(null);
      fetchCustomers();
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo eliminar el cliente.");
      setDeleteTarget(null);
    }
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="customers-page">

      {/* Header */}
      <div className="customers-header">
        <div>
        <h1 className="customers-title">Clientes</h1>
        <p className="customers-subtitle">
          {total} cliente{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}
        </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          + Nuevo Cliente
        </button>
      </div>

      {/* Search */}
      <div className="customers-toolbar">
        <div className="search-wrapper">
          <span className="search-icon">⌕</span>
          <input
            className="search-input"
            type="text"
            placeholder="Buscar por nombre, ciudad o email..."
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
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Dirección</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="table-state">Cargando...</td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-state">
                  {search
                    ? "Ningún cliente coincide con tu búsqueda."
                    : "No hay clientes todavía. ¡Añade el primero!"}
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
                    <button className="btn-edit" onClick={() => openEdit(c)}>Editar</button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(c)}>Eliminar</button>
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
                    Descartar Cambios
                  </p>
                  <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "24px" }}>
                    Tienes datos sin guardar. Si cierras ahora se perderán.
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
                      Seguir editando
                    </button>
                    <button
                      onClick={() => { setConfirmClose(false); closeModal(); }}
                      style={{
                        padding: "10px 20px", borderRadius: "8px",
                        border: "none", background: "#dc2626",
                        color: "#fff", fontWeight: "600", fontSize: "14px", cursor: "pointer",
                      }}
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Modal header ── */}
            <div className="modal-header">
              <h2>{editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            {/* ── Form ── */}
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>CIF</label>
                  <input
                    type="text"
                    placeholder="ej. B12345678"
                    value={form.cif}
                    onChange={(e) => setForm({ ...form, cif: e.target.value })}
                  />
                </div>
                <div className="form-group form-group--grow">
                  <label>Nombre del Cliente <span className="required">*</span></label>
                  <input
                    type="text"
                    placeholder="Nombre de la empresa o persona"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Telefono</label>
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
                <label>Direccion</label>
                <input
                  type="text"
                  placeholder="Street, number, city..."
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              {formError && (
                <p className="form-error">
                  {typeof formError === "string" ? formError : "Error de validación."}
                </p>
              )}

              <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={closeModal}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Guardando..." : editingCustomer ? "Guardar Cambios" : "Añadir Cliente"}
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
              <h2>Eliminar Cliente</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p className="confirm-text">
              ¿Estás seguro de que quieres eliminar a{" "}
              <strong>{deleteTarget.name}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </button>
              <button className="btn-danger" onClick={confirmDelete}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
