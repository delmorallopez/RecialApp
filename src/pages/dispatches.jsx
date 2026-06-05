import { useState, useEffect, useCallback } from "react";
import {
  getDispatches,
  createDispatch,
  updateDispatch,
  deleteDispatch,
} from "../services/dispatchesServices";
import { getCustomers } from "../services/customersServices";
import { getEntrances } from "../services/entrancesServices";
import { getTanks } from "../services/tanksServices";
import "../stylecss/customers.css";

const EMPTY_FORM = {
  customer_id: "",
  tank_id: "",
  date: new Date().toISOString().split("T")[0],
  post_number: "",
  raw_material: "UCO",
  value_gei: 1,
  quantity: "",
  entrance_ids: [],
  has_disposal: true,
  disposal_date: new Date().toISOString().split("T")[0],
  disposal_quantity: "",
  disposal_notes: "",
};

export default function Dispatches() {
  const [dispatches, setDispatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [customers, setCustomers] = useState([]);
  const [entrances, setEntrances] = useState([]);
  const [tanks, setTanks] = useState([]);

  // Create/Edit modal (shared)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDispatch, setEditingDispatch] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Detail view
  const [detailDispatch, setDetailDispatch] = useState(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const handleOverlayClick = () => {
    const isDirty = form.customer_id || form.quantity ||
                    form.entrance_ids.length > 0 ||
                    form.disposal_quantity || form.notes ||
                    form.tank_id || form.post_number;
    if (isDirty) setConfirmClose(true);
    else closeModal();
  };

  // ── Fetch dispatches ─────────────────────────────────────
  const fetchDispatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDispatches();
      setDispatches(res.data.dispatches);
      setTotal(res.data.total);
    } catch {
      setError("Could not load dispatches. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDispatches(); }, [fetchDispatches]);

  // ── Load dropdown data ───────────────────────────────────
  const loadDropdownData = async () => {
    try {
      const [custRes, entRes, tankRes] = await Promise.all([
        getCustomers({ limit: 200 }),
        getEntrances({ limit: 200 }),
        getTanks(),
      ]);
      setCustomers(custRes.data.customers);
      setEntrances(entRes.data.entrances);
      setTanks(tankRes.data.tanks.filter((t) => t.is_active));
    } catch {
      setFormError("Could not load dropdown data.");
    }
  };

  // ── Modal helpers ────────────────────────────────────────
  const openAdd = () => {
    setEditingDispatch(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
    loadDropdownData();
    setConfirmClose(false);
  };

  const openEdit = (dispatch) => {
    setEditingDispatch(dispatch);
    setForm({
      customer_id: dispatch.customer_id || "",
      tank_id: dispatch.tank_id || "",
      date: dispatch.date ? dispatch.date.split("T")[0] : "",
      post_number: dispatch.post_number || "",
      raw_material: dispatch.raw_material || "UCO",
      value_gei: dispatch.value_gei || 1,
      quantity: dispatch.quantity || "",
      entrance_ids: dispatch.entrances?.map((e) => e.id) || [],
      has_disposal: !!dispatch.disposal,
      disposal_date: dispatch.disposal?.date
        ? dispatch.disposal.date.split("T")[0]
        : new Date().toISOString().split("T")[0],
      disposal_quantity: dispatch.disposal?.quantity || "",
      disposal_notes: dispatch.disposal?.notes || "",
    });
    setFormError(null);
    setModalOpen(true);
    loadDropdownData();
    setConfirmClose(false);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDispatch(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setConfirmClose(false); 
  };

  const toggleEntrance = (id) => {
    setForm((f) => ({
      ...f,
      entrance_ids: f.entrance_ids.includes(id)
        ? f.entrance_ids.filter((e) => e !== id)
        : [...f.entrance_ids, id],
    }));
  };

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) { setFormError("Please select a customer."); return; }
    if (!form.date) { setFormError("Date is required."); return; }
    if (!form.quantity || parseInt(form.quantity) <= 0) {
      setFormError("Quantity must be greater than 0."); return;
    }
    if (form.has_disposal && (!form.disposal_quantity || parseInt(form.disposal_quantity) <= 0)) {
      setFormError("Disposal quantity must be greater than 0."); return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        customer_id: parseInt(form.customer_id),
        tank_id: form.tank_id ? parseInt(form.tank_id) : null,
        date: form.date,
        post_number: form.post_number ? parseInt(form.post_number) : null,
        raw_material: form.raw_material,
        value_gei: parseInt(form.value_gei),
        quantity: parseInt(form.quantity),
        entrance_ids: form.entrance_ids,
        disposal: form.has_disposal ? {
          date: form.disposal_date,
          quantity: parseInt(form.disposal_quantity),
          notes: form.disposal_notes || null,
        } : null,
      };

      if (editingDispatch) {
        await updateDispatch(editingDispatch.id, payload);
      } else {
        await createDispatch(payload);
      }
      closeModal();
      fetchDispatches();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(typeof detail === "string" ? detail : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDispatch(deleteTarget.id);
      setDeleteTarget(null);
      fetchDispatches();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not delete dispatch.");
      setDeleteTarget(null);
    }
  };

  // ── Helpers ──────────────────────────────────────────────
  const formatDate = (d) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const totalKg = dispatches.reduce((s, d) => s + (d.quantity || 0), 0);
  const totalDisposal = dispatches.reduce((s, d) => s + (d.disposal?.quantity || 0), 0);

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="customers-page">

      {/* Header */}
      <div className="customers-header">
        <div>
          <h1 className="customers-title">Dispatches</h1>
          <p className="customers-subtitle">
            {total} dispatch{total !== 1 ? "es" : ""} — <strong>{totalKg.toLocaleString()} kg</strong> sold
            {totalDisposal > 0 && (
              <span style={{ color: "#9ca3af" }}> · {totalDisposal.toLocaleString()} kg disposal</span>
            )}
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ New Dispatch</button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Table */}
      <div className="table-wrapper">
        <table className="customers-table">
          <thead>
            <tr>
              <th>Batch ID</th><th>Date</th><th>Customer</th><th>Post №</th>
              <th>Tank</th><th>Quantity (kg)</th><th>Disposal (kg)</th><th>GEI</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="table-state">Loading...</td></tr>
            ) : dispatches.length === 0 ? (
              <tr><td colSpan={9} className="table-state">No dispatches yet. Create your first one!</td></tr>
            ) : (
              dispatches.map((d) => (
                <tr key={d.id} className="table-row">
                  <td><span style={{ fontFamily: "monospace", fontWeight: "700", fontSize: "14px" }}>{d.batch_id}</span></td>
                  <td style={{ fontWeight: "500" }}>{formatDate(d.date)}</td>
                  <td className="td-name">{d.customer?.name || "—"}</td>
                  <td style={{ fontFamily: "monospace" }}>{d.post_number || "—"}</td>
                  <td>{d.tank?.name || "—"}</td>
                  <td style={{ fontWeight: "700", color: "#2d7a4f" }}>{d.quantity?.toLocaleString()} kg</td>
                  <td>
                    {d.disposal ? (
                      <span style={{ background: "#fef3c7", color: "#92400e", padding: "3px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600" }}>
                        {d.disposal.quantity} kg
                      </span>
                    ) : <span style={{ color: "#9ca3af", fontSize: "13px" }}>—</span>}
                  </td>
                  <td>
                    <span style={{ background: "#f0fdf4", color: "#15803d", padding: "3px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600" }}>
                      {d.value_gei}
                    </span>
                  </td>
                  <td className="td-actions">
                    <button className="btn-edit" onClick={() => setDetailDispatch(d)}>View</button>
                    <button className="btn-edit" onClick={() => openEdit(d)}>Edit</button>
                    <button
                      className="btn-edit"
                      style={{ background: "#f0fdf4", color: "#15803d" }}
                      onClick={() => {
                        const price = prompt("Price per kg (€):", "1.09");
                        if (price) {
                          window.open(
                            `http://localhost:8000/invoices/${d.id}?price_per_kg=${price}`,
                            "_blank"
                          );
                        }
                      }}
                    >
                      🧾 Invoice
                    </button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(d)}>Delete</button>
                  </td>
                 </tr>
              ))
            )}
          </tbody>
          {dispatches.length > 0 && (
            <tfoot>
              <tr style={{ background: "#f8fafc", borderTop: "2px solid #e5e7eb" }}>
                <td colSpan={5} style={{ padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "13px" }}>
                  TOTAL ({dispatches.length} dispatches)
                </td>
                <td style={{ padding: "12px 16px", fontWeight: "800", color: "#2d7a4f", fontSize: "15px" }}>
                  {totalKg.toLocaleString()} kg
                </td>
                <td style={{ padding: "12px 16px", fontWeight: "700", color: "#92400e", fontSize: "14px" }}>
                  {totalDisposal.toLocaleString()} kg
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Create / Edit Modal (shared) ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal" style={{ maxWidth: "680px", maxHeight: "90vh", overflowY: "auto", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
           
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
                textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
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

            <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 9 }}>
              <div>
                <h2>{editingDispatch ? `Edit ${editingDispatch.batch_id}` : "New Dispatch"}</h2>
                {editingDispatch && (
                  <p style={{ fontSize: "12px", color: "#9ca3af", margin: "2px 0 0" }}>
                    Batch ID cannot be changed
                  </p>
                )}
              </div>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>

              {/* Customer + Date */}
              <div className="form-row">
                <div className="form-group form-group--grow">
                  <label>Customer <span className="required">*</span></label>
                  <select value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                    style={{ padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: "9px", fontSize: "15px", color: "#374151", background: "#fff", width: "100%" }}>
                    <option value="">Select customer...</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Date <span className="required">*</span></label>
                  <input type="date" value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>

              {/* Tank + Post Number */}
              <div className="form-row">
                <div className="form-group form-group--grow">
                  <label>Tank</label>
                  <select value={form.tank_id}
                    onChange={(e) => setForm({ ...form, tank_id: e.target.value })}
                    style={{ padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: "9px", fontSize: "15px", color: "#374151", background: "#fff", width: "100%" }}>
                    <option value="">Select tank...</option>
                    {tanks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.capacity ? ` — ${t.stock || 0} / ${t.capacity} kg` : ` — ${t.stock || 0} kg`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Post Number (ISCC)</label>
                  <input type="number" placeholder="e.g. 1" value={form.post_number}
                    onChange={(e) => setForm({ ...form, post_number: e.target.value })} />
                </div>
              </div>

              {/* Quantity + Raw material + GEI */}
              <div className="form-row">
                <div className="form-group form-group--grow">
                  <label>Quantity (kg) <span className="required">*</span></label>
                  <input type="number" min="1" placeholder="kg to dispatch" value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Raw Material</label>
                  <input type="text" value={form.raw_material}
                    onChange={(e) => setForm({ ...form, raw_material: e.target.value })}
                    style={{ background: "#f8fafc" }} />
                </div>
                <div className="form-group">
                  <label>GEI Value</label>
                  <input type="number" value={form.value_gei}
                    onChange={(e) => setForm({ ...form, value_gei: e.target.value })}
                    style={{ background: "#f8fafc" }} />
                </div>
              </div>

              {/* Entrance batches */}
              <div className="form-group">
                <label>
                  Entrance Batches (optional)
                  {form.entrance_ids.length > 0 && (
                    <span style={{ marginLeft: "8px", color: "#2d7a4f", fontWeight: "700" }}>
                      {form.entrance_ids.length} selected
                    </span>
                  )}
                </label>
                {entrances.length === 0 ? (
                  <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1.5px solid #e5e7eb", color: "#9ca3af", fontSize: "14px" }}>
                    No entrance batches available
                  </div>
                ) : (
                  <div style={{ border: "1.5px solid #e5e7eb", borderRadius: "8px", maxHeight: "180px", overflowY: "auto" }}>
                    {entrances.map((en, idx) => {
                      const selected = form.entrance_ids.includes(en.id);
                      return (
                        <div key={en.id} onClick={() => toggleEntrance(en.id)} style={{
                          display: "flex", alignItems: "center", gap: "12px",
                          padding: "10px 14px",
                          borderBottom: idx < entrances.length - 1 ? "1px solid #f3f4f6" : "none",
                          background: selected ? "#f0fdf4" : "#fff", cursor: "pointer",
                        }}>
                          <div style={{
                            width: "18px", height: "18px", borderRadius: "4px", border: "2px solid",
                            borderColor: selected ? "#2d7a4f" : "#d1d5db",
                            background: selected ? "#2d7a4f" : "#fff",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}>
                            {selected && <span style={{ color: "#fff", fontSize: "11px", fontWeight: "800" }}>✓</span>}
                          </div>
                          <span style={{ fontFamily: "monospace", fontWeight: "700", fontSize: "13px" }}>{en.batch_id}</span>
                          <span style={{ color: "#d1d5db" }}>·</span>
                          <span style={{ fontSize: "13px", color: "#374151" }}>{en.supplier_type === "A" ? "Horeca" : "Urban"}</span>
                          <span style={{ color: "#d1d5db" }}>·</span>
                          <span style={{ fontSize: "13px", color: "#6b7280" }}>{formatDate(en.date)}</span>
                          <span style={{ marginLeft: "auto", fontWeight: "700", color: "#2d7a4f", fontSize: "13px" }}>
                            {en.quantity_kg?.toFixed(0)} kg
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Disposal */}
              <div style={{
                background: form.has_disposal ? "#fffbeb" : "#f8fafc",
                border: `1.5px solid ${form.has_disposal ? "#fcd34d" : "#e5e7eb"}`,
                borderRadius: "10px", padding: "16px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: form.has_disposal ? "14px" : "0" }}>
                  <p style={{ fontWeight: "700", fontSize: "14px", color: "#92400e", margin: 0 }}>Disposal Record</p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[true, false].map((val) => (
                      <button key={String(val)} type="button"
                        onClick={() => setForm({ ...form, has_disposal: val })}
                        style={{
                          padding: "6px 14px", borderRadius: "6px", border: "1.5px solid",
                          borderColor: form.has_disposal === val ? "#f59e0b" : "#e5e7eb",
                          background: form.has_disposal === val ? "#fef3c7" : "#fff",
                          color: form.has_disposal === val ? "#92400e" : "#9ca3af",
                          fontWeight: "600", fontSize: "13px", cursor: "pointer",
                        }}>{val ? "Yes" : "No"}</button>
                    ))}
                  </div>
                </div>

                {form.has_disposal && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label style={{ fontSize: "13px", color: "#92400e" }}>Disposal Date <span className="required">*</span></label>
                        <input type="date" value={form.disposal_date}
                          onChange={(e) => setForm({ ...form, disposal_date: e.target.value })} />
                      </div>
                      <div className="form-group form-group--grow">
                        <label style={{ fontSize: "13px", color: "#92400e" }}>Disposal Quantity (kg) <span className="required">*</span></label>
                        <input type="number" min="1" placeholder="Residue in kg" value={form.disposal_quantity}
                          onChange={(e) => setForm({ ...form, disposal_quantity: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: "13px", color: "#92400e" }}>Notes</label>
                      <input type="text" placeholder="Any notes about the disposal..." value={form.disposal_notes}
                        onChange={(e) => setForm({ ...form, disposal_notes: e.target.value })} />
                    </div>
                    {form.quantity && form.disposal_quantity && (
                      <div style={{ background: "#fff", borderRadius: "8px", padding: "10px 14px", border: "1px solid #fcd34d", fontSize: "13px" }}>
                        <span style={{ color: "#6b7280" }}>Total tank deduction: </span>
                        <strong style={{ color: "#dc2626" }}>
                          {(parseInt(form.quantity || 0) + parseInt(form.disposal_quantity || 0)).toLocaleString()} kg
                        </strong>
                        <span style={{ color: "#9ca3af", marginLeft: "8px" }}>
                          ({form.quantity} kg sold + {form.disposal_quantity} kg disposal)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {formError && <p className="form-error">{typeof formError === "string" ? formError : "Validation error."}</p>}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingDispatch ? "Save Changes" : "Create Dispatch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detailDispatch && (
        <div className="modal-overlay" onClick={() => setDetailDispatch(null)}>
          <div className="modal" style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{detailDispatch.batch_id}</h2>
              <button className="modal-close" onClick={() => setDetailDispatch(null)}>✕</button>
            </div>
            <div style={{ padding: "16px 24px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                {[
                  ["Customer", detailDispatch.customer?.name || "—"],
                  ["Date", formatDate(detailDispatch.date)],
                  ["Quantity", `${detailDispatch.quantity} kg`],
                  ["Tank", detailDispatch.tank?.name || "—"],
                  ["Post №", detailDispatch.post_number || "—"],
                  ["GEI", detailDispatch.value_gei],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "#f8fafc", borderRadius: "8px", padding: "10px 12px" }}>
                    <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>{label}</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a2e" }}>{value}</div>
                  </div>
                ))}
              </div>
              {detailDispatch.entrances?.length > 0 && (
                <>
                  <p style={{ fontWeight: "600", fontSize: "13px", color: "#374151", marginBottom: "8px" }}>
                    Entrance Batches ({detailDispatch.entrances.length})
                  </p>
                  <div style={{ border: "1.5px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", marginBottom: "16px" }}>
                    {detailDispatch.entrances.map((en, idx) => (
                      <div key={en.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 14px",
                        borderBottom: idx < detailDispatch.entrances.length - 1 ? "1px solid #f3f4f6" : "none",
                      }}>
                        <span style={{ fontFamily: "monospace", fontWeight: "700", fontSize: "13px" }}>{en.batch_id}</span>
                        <span style={{ fontWeight: "700", color: "#2d7a4f", fontSize: "13px" }}>{en.quantity_kg?.toFixed(0)} kg</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {detailDispatch.disposal && (
                <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "10px", padding: "14px 16px" }}>
                  <p style={{ fontWeight: "700", fontSize: "13px", color: "#92400e", margin: "0 0 10px" }}>Disposal</p>
                  <div style={{ display: "flex", gap: "16px", fontSize: "14px" }}>
                    <span><strong>Date:</strong> {formatDate(detailDispatch.disposal.date)}</span>
                    <span><strong>Quantity:</strong> {detailDispatch.disposal.quantity} kg</span>
                    {detailDispatch.disposal.notes && (
                      <span><strong>Notes:</strong> {detailDispatch.disposal.notes}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Dispatch</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p className="confirm-text">
              Are you sure you want to delete dispatch <strong>{deleteTarget.batch_id}</strong>?
            </p>
            <div style={{ margin: "0 24px 16px", background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: "10px", padding: "14px 16px" }}>
              <p style={{ fontWeight: "700", color: "#dc2626", fontSize: "14px", margin: "0 0 8px" }}>⚠ Traceability Warning</p>
              <ul style={{ fontSize: "13px", color: "#7f1d1d", margin: 0, paddingLeft: "18px", lineHeight: 1.8 }}>
                <li><strong>{deleteTarget.quantity} kg</strong> sold will be restored to tank stock</li>
                {deleteTarget.disposal && (
                  <li>Disposal record of <strong>{deleteTarget.disposal.quantity} kg</strong> will also be deleted</li>
                )}
                {deleteTarget.entrances?.length > 0 && (
                  <li><strong>{deleteTarget.entrances.length} entrance batch{deleteTarget.entrances.length !== 1 ? "es" : ""}</strong> will be unlinked</li>
                )}
                <li>ISCC traceability record for post number <strong>{deleteTarget.post_number || "N/A"}</strong> will be permanently lost</li>
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
