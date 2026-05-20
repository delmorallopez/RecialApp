import { useState, useEffect, useCallback } from "react";
import {
  getReceipts,
  createReceipt,
  updateReceipt,
  deleteReceipt,
} from "../services/receiptsServices";
import { getSuppliers } from "../services/suppliersServices";
import { getPickupPoints } from "../services/pickupPointsServices";
import "../stylecss/customers.css";

const EMPTY_FORM = {
  supplier_id: "",
  raw_material: "UCO",
  date: new Date().toISOString().split("T")[0],
  quantity_kg: "",
  notes: "",
  pickup_quantities: {}, // { pickup_point_id: quantity_string }
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

  // Pickup points for selected supplier
  const [pickupPoints, setPickupPoints] = useState([]);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [usePickupPoints, setUsePickupPoints] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Load suppliers ───────────────────────────────────────
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

  // ── Load pickup points (Add mode) ────────────────────────
  const loadPickupPoints = async (supplierId) => {
    if (!supplierId) {
      setPickupPoints([]);
      setUsePickupPoints(false);
      return;
    }
    setPickupLoading(true);
    try {
      const res = await getPickupPoints({ supplier_id: supplierId });
      const points = res.data.pickup_points;
      setPickupPoints(points);
      if (points.length > 0) {
        setUsePickupPoints(true);
        const init = {};
        points.forEach((p) => { init[p.id] = ""; });
        setForm((f) => ({ ...f, pickup_quantities: init, quantity_kg: "" }));
      } else {
        setUsePickupPoints(false);
        setForm((f) => ({ ...f, pickup_quantities: {} }));
      }
    } catch {
      setPickupPoints([]);
      setUsePickupPoints(false);
    } finally {
      setPickupLoading(false);
    }
  };

  // ── Load pickup points (Edit mode) ───────────────────────
  // Restores existing quantities from the receipt's pickup_quantities array
  const loadPickupPointsForEdit = async (supplierId, existingQuantities = []) => {
    if (!supplierId) return;
    setPickupLoading(true);
    try {
      const res = await getPickupPoints({ supplier_id: supplierId });
      const points = res.data.pickup_points;
      setPickupPoints(points);

      if (points.length > 0) {
        setUsePickupPoints(true);
        const init = {};
        points.forEach((p) => {
          // Find existing quantity for this pickup point from the receipt
          const existing = existingQuantities.find(
            (q) => q.pickup_point_id === p.id
          );
          init[p.id] = existing ? String(existing.quantity_kg) : "";
        });
        setForm((f) => ({ ...f, pickup_quantities: init }));
      } else {
        setUsePickupPoints(false);
      }
    } catch {
      setPickupPoints([]);
      setUsePickupPoints(false);
    } finally {
      setPickupLoading(false);
    }
  };

  // ── Calculated total from pickup points ──────────────────
  const pickupTotal = Object.values(form.pickup_quantities)
    .reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  const filledPoints = Object.values(form.pickup_quantities)
    .filter((v) => parseFloat(v) > 0).length;

  // ── Modal helpers ────────────────────────────────────────
  const openAdd = () => {
    setEditingReceipt(null);
    setForm(EMPTY_FORM);
    setPickupPoints([]);
    setUsePickupPoints(false);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (receipt) => {
    setEditingReceipt(receipt);
    setForm({
      supplier_id: receipt.supplier_id || "",
      raw_material: receipt.raw_material || "UCO",
      date: receipt.date ? receipt.date.split("T")[0] : "",
      quantity_kg: receipt.quantity_kg || "",
      notes: receipt.notes || "",
      pickup_quantities: {},
    });
    setPickupPoints([]);
    setUsePickupPoints(false);
    setFormError(null);
    setModalOpen(true);

    // Load pickup points and restore existing quantities from receipt
    if (receipt.supplier_id) {
      loadPickupPointsForEdit(
        receipt.supplier_id,
        receipt.pickup_quantities || []  // ← comes directly from the API now
      );
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingReceipt(null);
    setForm(EMPTY_FORM);
    setPickupPoints([]);
    setUsePickupPoints(false);
    setFormError(null);
  };

  const handleSupplierChange = (supplierId) => {
    setForm((f) => ({ ...f, supplier_id: supplierId, pickup_quantities: {}, quantity_kg: "" }));
    loadPickupPoints(supplierId);
  };

  const setPickupQty = (pointId, value) => {
    setForm((f) => ({
      ...f,
      pickup_quantities: { ...f.pickup_quantities, [pointId]: value },
    }));
  };

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier_id) { setFormError("Please select a supplier."); return; }
    if (!form.date) { setFormError("Date is required."); return; }

    let finalQuantity;
    let pickupPayload = [];

    if (usePickupPoints && pickupPoints.length > 0) {
      // Build pickup_quantities array for the API
      pickupPayload = pickupPoints
        .filter((p) => parseFloat(form.pickup_quantities[p.id]) > 0)
        .map((p) => ({
          pickup_point_id: p.id,
          quantity_kg: parseFloat(form.pickup_quantities[p.id]),
        }));

      if (pickupPayload.length === 0) {
        setFormError("Enter at least one pickup point quantity greater than 0.");
        return;
      }
      // Total is calculated by the backend from pickup quantities
      finalQuantity = pickupTotal;
    } else {
      if (!form.quantity_kg || parseFloat(form.quantity_kg) <= 0) {
        setFormError("Quantity must be greater than 0.");
        return;
      }
      finalQuantity = parseFloat(form.quantity_kg);
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        supplier_id: parseInt(form.supplier_id),
        raw_material: form.raw_material,
        date: form.date,
        quantity_kg: finalQuantity,
        notes: form.notes || null,       // ← clean notes, no pickup data mixed in
        pickup_quantities: pickupPayload, // ← sent as structured data
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
      setFormError(
        typeof detail === "string"
          ? detail
          : "Something went wrong. Please try again."
      );
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

  // ── Helpers ──────────────────────────────────────────────
  const formatDate = (d) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const supplierName = (receipt) =>
    receipt.supplier?.name || `Supplier #${receipt.supplier_id}`;

  const totalKg = receipts.reduce((s, r) => s + (r.quantity_kg || 0), 0);

  const selectedSupplier = suppliers.find(
    (s) => s.id === parseInt(form.supplier_id)
  );

  // ── Pickup breakdown string for table display ────────────
  const pickupBreakdown = (receipt) => {
    if (!receipt.pickup_quantities || receipt.pickup_quantities.length === 0) return null;
    return receipt.pickup_quantities
      .map((q) => `${q.pickup_point?.name || `#${q.pickup_point_id}`}: ${q.quantity_kg} kg`)
      .join(" | ");
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="customers-page">

      {/* Header */}
      <div className="customers-header">
        <div>
          <h1 className="customers-title">Receipts</h1>
          <p className="customers-subtitle">
            {total} receipt{total !== 1 ? "s" : ""} —{" "}
            <strong>{totalKg.toFixed(1)} kg</strong> UCO collected
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ New Receipt</button>
      </div>

      {/* Filters */}
      <div className="customers-toolbar" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}
          style={{ padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px", color: "#374151", background: "#fff", cursor: "pointer" }}>
          <option value="">All Suppliers</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label style={{ fontSize: "13px", color: "#6b7280", fontWeight: "500" }}>From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label style={{ fontSize: "13px", color: "#6b7280", fontWeight: "500" }}>To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
        </div>
        {(supplierFilter || dateFrom || dateTo) && (
          <button className="btn-secondary"
            onClick={() => { setSupplierFilter(""); setDateFrom(""); setDateTo(""); }}
            style={{ padding: "8px 14px", fontSize: "13px" }}>
            Clear filters
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Table */}
      <div className="table-wrapper">
        <table className="customers-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Code</th>
              <th>Date</th>
              <th>Supplier</th>
              <th>Raw Material</th>
              <th>Quantity (kg)</th>
              <th>Pickup Breakdown</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="table-state">Loading...</td></tr>
            ) : receipts.length === 0 ? (
              <tr><td colSpan={9} className="table-state">No receipts found. Add your first collection!</td></tr>
            ) : (
              receipts.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="td-id">#{r.id}</td>
                  <td>
                    {r.receipt_code
                      ? <span style={{ fontFamily: "monospace", fontWeight: "700", fontSize: "13px" }}>{r.receipt_code}</span>
                      : "—"}
                  </td>
                  <td style={{ fontWeight: "500" }}>{formatDate(r.date)}</td>
                  <td className="td-name">{supplierName(r)}</td>
                  <td>
                    <span style={{ background: "#fef3c7", color: "#92400e", padding: "3px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600" }}>
                      {r.raw_material}
                    </span>
                  </td>
                  <td style={{ fontWeight: "700", color: "#2d7a4f" }}>
                    {r.quantity_kg?.toFixed(1)} kg
                  </td>
                  <td style={{ fontSize: "12px", color: "#6b7280", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {pickupBreakdown(r) || "—"}
                  </td>
                  <td style={{ fontSize: "12px", color: "#6b7280", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.notes || "—"}
                  </td>
                  <td className="td-actions">
                    <button className="btn-edit" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(r)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {receipts.length > 0 && (
            <tfoot>
              <tr style={{ background: "#f8fafc", borderTop: "2px solid #e5e7eb" }}>
                <td colSpan={5} style={{ padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "13px" }}>
                  TOTAL ({receipts.length} receipts)
                </td>
                <td style={{ padding: "12px 16px", fontWeight: "800", color: "#2d7a4f", fontSize: "15px" }}>
                  {totalKg.toFixed(1)} kg
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal"
            style={{ maxWidth: "620px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
              <h2>{editingReceipt ? "Edit Receipt" : "New Receipt"}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>

              {/* Supplier */}
              <div className="form-group">
                <label>Supplier <span className="required">*</span></label>
                <select value={form.supplier_id}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  style={{ padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: "9px", fontSize: "15px", color: "#374151", background: "#fff", width: "100%" }}>
                  <option value="">Select a supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.supplier_type})</option>
                  ))}
                </select>
              </div>

              {/* Date + Raw material */}
              <div className="form-row">
                <div className="form-group form-group--grow">
                  <label>Date <span className="required">*</span></label>
                  <input type="date" value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Raw Material</label>
                  <input type="text" value={form.raw_material}
                    onChange={(e) => setForm({ ...form, raw_material: e.target.value })}
                    style={{ background: "#f8fafc" }} />
                </div>
              </div>

              {/* ── Quantity section ── */}

              {/* No supplier selected yet */}
              {!form.supplier_id && (
                <div className="form-group">
                  <label>Quantity (kg) <span className="required">*</span></label>
                  <input type="number" min="0.1" step="0.1" placeholder="0.0"
                    value={form.quantity_kg}
                    onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })} />
                </div>
              )}

              {/* Loading pickup points */}
              {form.supplier_id && pickupLoading && (
                <div style={{ padding: "16px", textAlign: "center", color: "#9ca3af", fontSize: "14px",
                  border: "1.5px solid #e5e7eb", borderRadius: "10px" }}>
                  Loading pickup points...
                </div>
              )}

              {/* Supplier has NO pickup points → plain quantity */}
              {form.supplier_id && !pickupLoading && pickupPoints.length === 0 && (
                <div className="form-group">
                  <label>Quantity (kg) <span className="required">*</span></label>
                  <input type="number" min="0.1" step="0.1" placeholder="0.0"
                    value={form.quantity_kg}
                    onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })} />
                </div>
              )}

              {/* Supplier HAS pickup points → per-point inputs */}
              {form.supplier_id && !pickupLoading && pickupPoints.length > 0 && (
                <div style={{ border: "1.5px solid #86efac", borderRadius: "12px", overflow: "hidden" }}>

                  {/* Header */}
                  <div style={{
                    padding: "12px 16px", background: "#f0fdf4",
                    borderBottom: "1.5px solid #86efac",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <p style={{ fontWeight: "700", fontSize: "14px", color: "#15803d", margin: "0 0 2px" }}>
                        📍 Pickup Points
                        {selectedSupplier && (
                          <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "400", marginLeft: "8px" }}>
                            {selectedSupplier.name}
                          </span>
                        )}
                      </p>
                      <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                        {pickupPoints.length} point{pickupPoints.length !== 1 ? "s" : ""} — enter quantity per point
                      </p>
                    </div>
                    {/* Toggle per-point / manual */}
                    <button type="button"
                      onClick={() => {
                        setUsePickupPoints(!usePickupPoints);
                        setForm((f) => ({ ...f, quantity_kg: "", pickup_quantities: {} }));
                      }}
                      style={{
                        background: usePickupPoints ? "#dcfce7" : "#f3f4f6",
                        color: usePickupPoints ? "#15803d" : "#6b7280",
                        border: "none", borderRadius: "6px",
                        padding: "5px 12px", fontSize: "12px",
                        fontWeight: "600", cursor: "pointer",
                      }}>
                      {usePickupPoints ? "✓ Per point" : "Manual total"}
                    </button>
                  </div>

                  {usePickupPoints ? (
                    <>
                      {/* Per-point rows */}
                      {pickupPoints.map((p, idx) => (
                        <div key={p.id} style={{
                          display: "flex", alignItems: "center", gap: "12px",
                          padding: "10px 16px",
                          borderBottom: idx < pickupPoints.length - 1 ? "1px solid #dcfce7" : "none",
                          background: parseFloat(form.pickup_quantities[p.id]) > 0 ? "#f0fdf4" : "#fff",
                        }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: "600", fontSize: "14px", color: "#1a1a2e", margin: "0 0 1px" }}>
                              {p.name}
                            </p>
                            {p.address && (
                              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{p.address}</p>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <input
                              type="number" min="0" step="0.1" placeholder="0"
                              value={form.pickup_quantities[p.id] || ""}
                              onChange={(e) => setPickupQty(p.id, e.target.value)}
                              style={{
                                width: "90px", padding: "7px 10px",
                                border: "1.5px solid",
                                borderColor: parseFloat(form.pickup_quantities[p.id]) > 0 ? "#2d7a4f" : "#e5e7eb",
                                borderRadius: "8px", fontSize: "14px",
                                textAlign: "right", fontWeight: "600",
                              }} />
                            <span style={{ fontSize: "13px", color: "#6b7280" }}>kg</span>
                          </div>
                        </div>
                      ))}

                      {/* Total row */}
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "12px 16px",
                        background: pickupTotal > 0 ? "#dcfce7" : "#f8fafc",
                        borderTop: "2px solid #86efac",
                      }}>
                        <span style={{ fontWeight: "700", fontSize: "14px", color: "#15803d" }}>
                          Total ({filledPoints}/{pickupPoints.length} points)
                        </span>
                        <span style={{ fontWeight: "800", fontSize: "20px", color: pickupTotal > 0 ? "#15803d" : "#9ca3af" }}>
                          {pickupTotal.toFixed(1)} kg
                        </span>
                      </div>
                    </>
                  ) : (
                    /* Manual total fallback */
                    <div style={{ padding: "14px 16px", background: "#fff" }}>
                      <div className="form-group">
                        <label>Total Quantity (kg) <span className="required">*</span></label>
                        <input type="number" min="0.1" step="0.1" placeholder="0.0"
                          value={form.quantity_kg}
                          onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes — clean, separate from pickup data */}
              <div className="form-group">
                <label>Notes</label>
                <input type="text" placeholder="Optional notes about this collection..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              {formError && (
                <p className="form-error">
                  {typeof formError === "string" ? formError : "Validation error — check your inputs."}
                </p>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..."
                    : editingReceipt ? "Save Changes"
                    : usePickupPoints && pickupTotal > 0
                      ? `Add Receipt — ${pickupTotal.toFixed(1)} kg`
                      : "Add Receipt"}
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
            {deleteTarget.entrance_id && (
              <div style={{
                margin: "0 24px 16px",
                background: "#fef2f2", border: "1.5px solid #fecaca",
                borderRadius: "10px", padding: "14px 16px",
              }}>
                <p style={{ fontWeight: "700", color: "#dc2626", fontSize: "14px", margin: "0 0 8px" }}>
                  ⚠ Traceability Warning
                </p>
                <ul style={{ fontSize: "13px", color: "#7f1d1d", margin: 0, paddingLeft: "18px", lineHeight: 1.8 }}>
                  <li>This receipt is assigned to entrance batch <strong>#{deleteTarget.entrance_id}</strong></li>
                  <li>Deleting it will reduce the batch quantity and may break the traceability chain</li>
                </ul>
              </div>
            )}
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
