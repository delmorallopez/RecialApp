import { useState, useEffect, useCallback } from "react";
import {
  getReceipts,
  createReceipt,
  updateReceipt,
  deleteReceipt,
} from "../services/receiptsServices";
import { getSuppliers } from "../services/suppliersServices";
import "../stylecss/customers.css";

const EMPTY_FORM = {
  supplier_id: "",
  raw_material: "UCO",
  date: new Date().toISOString().split("T")[0], // today's date
  pickup_point: "",
  quantity_kg: "",
  notes: "",
};

export default function Receipts() {
  const [receipts, setReceipts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Load suppliers for dropdown ──────────────────────────
  useEffect(() => {
    getSuppliers({ limit: 200 })
      .then((res) => setSuppliers(res.data.suppliers))
      .catch(() => setError("Could not load suppliers list."));
  }, []);

  // ── Fetch receipts ───────────────────────────────────────
  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (supplierFilter) params.supplier_id = supplierFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await getReceipts(params);
      setReceipts(res.data.receipts);
      setTotal(res.data.total);
    } catch {
      setError("Could not load receipts. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [supplierFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // ── Total KG collected ───────────────────────────────────
  const totalKg = receipts.reduce((sum, r) => sum + (r.quantity_kg || 0), 0);

  // ── Modal helpers ────────────────────────────────────────
  const openAdd = () => {
    setEditingReceipt(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (receipt) => {
    setEditingReceipt(receipt);
    setForm({
      supplier_id: receipt.supplier_id || "",
      raw_material: receipt.raw_material || "UCO",
      date: receipt.date || "",
      pickup_point: receipt.pickup_point || "",
      quantity_kg: receipt.quantity_kg || "",
      notes: receipt.notes || "",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingReceipt(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier_id) {
      setFormError("Please select a supplier.");
      return;
    }
    if (!form.date) {
      setFormError("Date is required.");
      return;
    }
    if (!form.quantity_kg || parseFloat(form.quantity_kg) <= 0) {
      setFormError("Quantity must be greater than 0.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        supplier_id: parseInt(form.supplier_id),
        quantity_kg: parseFloat(form.quantity_kg),
      };
      if (editingReceipt) {
        await updateReceipt(editingReceipt.id, payload);
      } else {
        await createReceipt(payload);
      }
      closeModal();
      fetchReceipts();
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
      await deleteReceipt(deleteTarget.id);
      setDeleteTarget(null);
      fetchReceipts();
    } catch {
      setError("Could not delete receipt.");
      setDeleteTarget(null);
    }
  };

  // ── Format date for display ──────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  // ── Supplier name lookup ─────────────────────────────────
  const supplierName = (receipt) =>
    receipt.supplier?.name || `Supplier #${receipt.supplier_id}`;

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="customers-page">

      {/* ── Header ── */}
      <div className="customers-header">
        <div>
          <h1 className="customers-title">Receipts</h1>
          <p className="customers-subtitle">
            {total} receipt{total !== 1 ? "s" : ""} —{" "}
            <strong>{totalKg.toFixed(1)} kg</strong> UCO collected
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          + New Receipt
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="customers-toolbar" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>

        {/* Supplier filter */}
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          style={{
            padding: "9px 12px",
            border: "1.5px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "14px",
            color: "#374151",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Date from */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label style={{ fontSize: "13px", color: "#6b7280", fontWeight: "500" }}>From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              padding: "8px 10px",
              border: "1.5px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#374151",
            }}
          />
        </div>

        {/* Date to */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label style={{ fontSize: "13px", color: "#6b7280", fontWeight: "500" }}>To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              padding: "8px 10px",
              border: "1.5px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#374151",
            }}
          />
        </div>

        {/* Clear filters */}
        {(supplierFilter || dateFrom || dateTo) && (
          <button
            className="btn-secondary"
            onClick={() => { setSupplierFilter(""); setDateFrom(""); setDateTo(""); }}
            style={{ padding: "8px 14px", fontSize: "13px" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Error ── */}
      {error && <div className="error-banner">{error}</div>}

      {/* ── Table ── */}
      <div className="table-wrapper">
        <table className="customers-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Supplier</th>
              <th>Raw Material</th>
              <th>Pickup Point</th>
              <th>Quantity (kg)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="table-state">Loading...</td>
              </tr>
            ) : receipts.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-state">
                  No receipts found. Add your first collection!
                </td>
              </tr>
            ) : (
              receipts.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="td-id">#{r.id}</td>
                  <td style={{ fontWeight: "500" }}>{formatDate(r.date)}</td>
                  <td className="td-name">{supplierName(r)}</td>
                  <td>
                    <span style={{
                      background: "#fef3c7",
                      color: "#92400e",
                      padding: "3px 10px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}>
                      {r.raw_material}
                    </span>
                  </td>
                  <td className="td-address">{r.pickup_point || "—"}</td>
                  <td style={{ fontWeight: "700", color: "#2d7a4f" }}>
                    {r.quantity_kg?.toFixed(1)} kg
                  </td>
                  <td className="td-actions">
                    <button className="btn-edit" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(r)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* ── Total row ── */}
          {receipts.length > 0 && (
            <tfoot>
              <tr style={{ background: "#f8fafc", borderTop: "2px solid #e5e7eb" }}>
                <td colSpan={5} style={{ padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "13px" }}>
                  TOTAL ({receipts.length} receipts)
                </td>
                <td style={{ padding: "12px 16px", fontWeight: "800", color: "#2d7a4f", fontSize: "15px" }}>
                  {totalKg.toFixed(1)} kg
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingReceipt ? "Edit Receipt" : "New Receipt"}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>

              {/* Supplier dropdown */}
              <div className="form-group">
                <label>Supplier <span className="required">*</span></label>
                <select
                  value={form.supplier_id}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                  style={{
                    padding: "9px 12px",
                    border: "1.5px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#374151",
                    background: "#fff",
                    width: "100%",
                  }}
                >
                  <option value="">Select a supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.supplier_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date + Raw material */}
              <div className="form-row">
                <div className="form-group form-group--grow">
                  <label>Date <span className="required">*</span></label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Raw Material</label>
                  <input
                    type="text"
                    value={form.raw_material}
                    onChange={(e) => setForm({ ...form, raw_material: e.target.value })}
                    style={{ background: "#f8fafc" }}
                  />
                </div>
              </div>

              {/* Pickup point + Quantity */}
              <div className="form-row">
                <div className="form-group form-group--grow">
                  <label>Pickup Point</label>
                  <input
                    type="text"
                    placeholder="Where the oil was collected"
                    value={form.pickup_point}
                    onChange={(e) => setForm({ ...form, pickup_point: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Quantity (kg) <span className="required">*</span></label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    placeholder="0.0"
                    value={form.quantity_kg}
                    onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label>Notes</label>
                <input
                  type="text"
                  placeholder="Any additional notes..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              {formError && <p className="form-error">{formError}</p>}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingReceipt ? "Save Changes" : "Add Receipt"}
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
        <h2>Delete Receipt</h2>
        <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
      </div>
      <p className="confirm-text">
        Are you sure you want to delete receipt{" "}
        <strong>#{deleteTarget.receipt_code || deleteTarget.id}</strong> from{" "}
        <strong>{supplierName(deleteTarget)}</strong>?
      </p>

      {/* Cascade warning */}
      {deleteTarget.entrance_id && (
        <div style={{
          margin: "0 24px 16px",
          background: "#fef2f2",
          border: "1.5px solid #fecaca",
          borderRadius: "10px",
          padding: "14px 16px",
        }}>
          <p style={{ fontWeight: "700", color: "#dc2626", fontSize: "14px", margin: "0 0 8px" }}>
            ⚠ Traceability Warning
          </p>
          <p style={{ fontSize: "13px", color: "#7f1d1d", margin: 0, lineHeight: 1.6 }}>
            This receipt is assigned to entrance batch{" "}
            <strong>#{deleteTarget.entrance_id}</strong>.
            Deleting it will remove it from that batch and reduce the batch quantity.
            If the entrance is linked to a dispatch, the traceability chain will be broken.
          </p>
        </div>
      )}

      <div className="modal-actions">
        <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
          Cancel
        </button>
        <button className="btn-danger" onClick={confirmDelete}>
          Delete anyway
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}

