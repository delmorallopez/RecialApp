import { useState, useEffect, useCallback } from "react";
import {
  getEntrances,
  createEntrance,
  deleteEntrance,
  updateEntrance,
} from "../services/entrancesServices";
import { getReceipts } from "../services/receiptsServices";
import { getTanks } from "../services/tanksServices";
import "../stylecss/customers.css";

const EMPTY_FORM = {
  supplier_type: "A",
  date: new Date().toISOString().split("T")[0],
  tank_id: "",
  receipt_ids: [],
  filter_date_from: "",
  filter_date_to: "",
};

const EMPTY_EDIT_FORM = {
  date: "",
  tank_id: "",
  receipt_ids: [],
};

export default function Entrances() {
  const [entrances, setEntrances] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [allReceipts, setAllReceipts] = useState([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [tanks, setTanks] = useState([]);

  const [typeFilter, setTypeFilter] = useState("");

  // Create modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEntrance, setEditingEntrance] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editError, setEditError] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editReceipts, setEditReceipts] = useState([]); // available receipts for edit

  // Detail view
  const [detailEntrance, setDetailEntrance] = useState(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmCloseEdit, setConfirmCloseEdit] = useState(false);
  
  const handleOverlayClick = () => {
    const isDirty = form.receipt_ids.length > 0 ||
                    form.tank_id ||
                    form.filter_date_from ||
                    form.filter_date_to;
    if (isDirty) setConfirmClose(true);
    else closeModal();
  };

  const handleEditOverlayClick = () => {
    const isDirty = editForm.receipt_ids.length > 0 ||
                    editForm.tank_id ||
                    editForm.date;
    if (isDirty) setConfirmCloseEdit(true);
    else closeEditModal();
  };

  // ── Fetch entrances ──────────────────────────────────────
  const fetchEntrances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (typeFilter) params.supplier_type = typeFilter;
      const res = await getEntrances(params);
      setEntrances(res.data.entrances);
      setTotal(res.data.total);
    } catch {
      setError("Could not load entrances. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { fetchEntrances(); }, [fetchEntrances]);

  // ── Load tanks ───────────────────────────────────────────
  useEffect(() => {
    getTanks()
      .then((res) => setTanks(res.data.tanks.filter((t) => t.is_active)))
      .catch(() => {});
  }, []);

  // ── Load unassigned receipts (create mode) ───────────────
  const loadAllReceipts = async () => {
    setReceiptsLoading(true);
    try {
      const res = await getReceipts({ limit: 500 });
      const unassigned = res.data.receipts.filter((r) => !r.entrance_id);
      setAllReceipts(unassigned);
    } catch {
      setFormError("Could not load receipts.");
    } finally {
      setReceiptsLoading(false);
    }
  };

  // ── Load receipts for edit (unassigned + already in this entrance) ──
  const loadReceiptsForEdit = async (entrance) => {
    try {
      const res = await getReceipts({ limit: 500 });
      const available = res.data.receipts.filter(
        (r) => !r.entrance_id || r.entrance_id === entrance.id
      );
      setEditReceipts(available);
    } catch {
      setEditError("Could not load receipts.");
    }
  };

  // ── Filter receipts by type in create modal ──────────────
  const filteredReceipts = allReceipts.filter((r) => {
    const sType = r.supplier?.supplier_type?.toLowerCase();
    const rType = sType === "horeca" ? "A" : sType === "urban" ? "B" : null;
    if (rType !== form.supplier_type) return false;
    if (form.filter_date_from && r.date < form.filter_date_from) return false;
    if (form.filter_date_to && r.date > form.filter_date_to) return false;
    return true;
  });

  // ── Filter receipts by type in edit modal ───────────────
  const filteredEditReceipts = editReceipts.filter((r) => {
    if (!editingEntrance) return false;
    const sType = r.supplier?.supplier_type?.toLowerCase();
    const rType = sType === "horeca" ? "A" : sType === "urban" ? "B" : null;
    return rType === editingEntrance.supplier_type;
  });

  // ── Create modal helpers ─────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
    loadAllReceipts();
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(EMPTY_FORM);
    setFormError(null);
    setAllReceipts([]);
  };

  const toggleReceipt = (id) => {
    setForm((f) => ({
      ...f,
      receipt_ids: f.receipt_ids.includes(id)
        ? f.receipt_ids.filter((r) => r !== id)
        : [...f.receipt_ids, id],
    }));
  };

  const selectAll = () =>
    setForm((f) => ({ ...f, receipt_ids: filteredReceipts.map((r) => r.id) }));

  const clearSelection = () =>
    setForm((f) => ({ ...f, receipt_ids: [] }));

  const selectedKg = allReceipts
    .filter((r) => form.receipt_ids.includes(r.id))
    .reduce((s, r) => s + (r.quantity_kg || 0), 0);

  // ── Edit modal helpers ───────────────────────────────────
  const openEdit = (entrance) => {
    setEditingEntrance(entrance);
    setEditForm({
      date: entrance.date || "",
      tank_id: entrance.tank_id || "",
      receipt_ids: entrance.receipts?.map((r) => r.id) || [],
    });
    setEditError(null);
    setEditModalOpen(true);
    loadReceiptsForEdit(entrance);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingEntrance(null);
    setEditForm(EMPTY_EDIT_FORM);
    setEditError(null);
    setEditReceipts([]);
    setConfirmCloseEdit(false);
  };

  const toggleEditReceipt = (id) => {
    setEditForm((f) => ({
      ...f,
      receipt_ids: f.receipt_ids.includes(id)
        ? f.receipt_ids.filter((r) => r !== id)
        : [...f.receipt_ids, id],
    }));
  };

  const editSelectedKg = editReceipts
    .filter((r) => editForm.receipt_ids.includes(r.id))
    .reduce((s, r) => s + (r.quantity_kg || 0), 0);

  // ── Create submit ────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.receipt_ids.length === 0) {
      setFormError("Please select at least one receipt.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await createEntrance({
        supplier_type: form.supplier_type,
        date: form.date,
        tank_id: form.tank_id ? parseInt(form.tank_id) : null,
        receipt_ids: form.receipt_ids,
      });
      closeModal();
      fetchEntrances();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(
        typeof detail === "string" ? detail : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Edit submit ──────────────────────────────────────────
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (editForm.receipt_ids.length === 0) {
      setEditError("At least one receipt is required.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await updateEntrance(editingEntrance.id, {
        date: editForm.date,
        tank_id: editForm.tank_id ? parseInt(editForm.tank_id) : null,
        receipt_ids: editForm.receipt_ids,
      });
      closeEditModal();
      fetchEntrances();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setEditError(
        typeof detail === "string" ? detail : "Something went wrong."
      );
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEntrance(deleteTarget.id);
      setDeleteTarget(null);
      fetchEntrances();
    } catch {
      setError("Could not delete entrance.");
      setDeleteTarget(null);
    }
  };

  // ── Helpers ──────────────────────────────────────────────
  const formatDate = (d) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const typeBadge = (type) => (
    <span style={{
      background: type === "A" ? "#eff6ff" : "#f0fdf4",
      color: type === "A" ? "#1d4ed8" : "#15803d",
      padding: "3px 10px", borderRadius: "999px",
      fontSize: "12px", fontWeight: "600",
    }}>
      {type === "A" ? "Horeca" : "Urban"}
    </span>
  );

  const totalKg = entrances.reduce((s, e) => s + (e.quantity_kg || 0), 0);

  // Shared receipt list item renderer
  const ReceiptItem = ({ r, selected, onToggle }) => (
    <div onClick={() => onToggle(r.id)} style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "10px 14px",
      background: selected ? "#f0fdf4" : "#fff",
      cursor: "pointer", transition: "background 0.15s",
      borderBottom: "1px solid #f3f4f6",
    }}>
      <div style={{
        width: "18px", height: "18px", borderRadius: "4px", border: "2px solid",
        borderColor: selected ? "#2d7a4f" : "#d1d5db",
        background: selected ? "#2d7a4f" : "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {selected && <span style={{ color: "#fff", fontSize: "11px", fontWeight: "800" }}>✓</span>}
      </div>
      <div style={{ flex: 1, display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontWeight: "700", fontSize: "13px", fontFamily: "monospace", color: "#1a1a2e" }}>
          {r.receipt_code || `#${r.id}`}
        </span>
        <span style={{ color: "#d1d5db" }}>·</span>
        <span style={{ fontSize: "13px", color: "#374151" }}>{r.supplier?.name}</span>
        <span style={{ color: "#d1d5db" }}>·</span>
        <span style={{ fontSize: "13px", color: "#6b7280" }}>{formatDate(r.date)}</span>
      </div>
      <span style={{ fontWeight: "700", color: "#2d7a4f", fontSize: "14px", flexShrink: 0 }}>
        {r.quantity_kg?.toFixed(1)} kg
      </span>
    </div>
  );

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="customers-page">

      {/* Header */}
      <div className="customers-header">
        <div>
          <h1 className="customers-title">Entrances</h1>
          <p className="customers-subtitle">
            {total} batch{total !== 1 ? "es" : ""} — <strong>{totalKg.toFixed(1)} kg</strong> total UCO
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ New Entrance</button>
      </div>

      {/* Type filter */}
      <div className="customers-toolbar" style={{ display: "flex", gap: "8px" }}>
        {[["", "All"], ["A", "Horeca"], ["B", "Urban"]].map(([val, label]) => (
          <button key={val} onClick={() => setTypeFilter(val)} style={{
            padding: "8px 16px", borderRadius: "8px", border: "1.5px solid",
            borderColor: typeFilter === val ? "#2d7a4f" : "#e5e7eb",
            background: typeFilter === val ? "#2d7a4f" : "#fff",
            color: typeFilter === val ? "#fff" : "#374151",
            fontWeight: "600", fontSize: "13px", cursor: "pointer",
          }}>{label}</button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Table */}
      <div className="table-wrapper">
        <table className="customers-table">
          <thead>
            <tr>
              <th>Batch ID</th><th>Type</th><th>Date</th><th>Receipts</th>
              <th>Start</th><th>Finish</th><th>Total (kg)</th><th>Tank</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="table-state">Loading...</td></tr>
            ) : entrances.length === 0 ? (
              <tr><td colSpan={9} className="table-state">No entrances yet. Create your first batch!</td></tr>
            ) : (
              entrances.map((e) => (
                <tr key={e.id} className="table-row">
                  <td><span style={{ fontFamily: "monospace", fontWeight: "700", fontSize: "14px" }}>{e.batch_id}</span></td>
                  <td>{typeBadge(e.supplier_type)}</td>
                  <td style={{ fontWeight: "500" }}>{formatDate(e.date)}</td>
                  <td>
                    <button onClick={() => setDetailEntrance(e)} style={{
                      background: "#f3f4f6", border: "none", borderRadius: "6px",
                      padding: "4px 10px", fontSize: "13px", cursor: "pointer", fontWeight: "600",
                    }}>
                      {e.receipts?.length || 0} receipt{e.receipts?.length !== 1 ? "s" : ""}
                    </button>
                  </td>
                  <td>{formatDate(e.start_date)}</td>
                  <td>{formatDate(e.finish_date)}</td>
                  <td style={{ fontWeight: "700", color: "#2d7a4f" }}>{e.quantity_kg?.toFixed(1)} kg</td>
                  <td>{e.tank?.name || "—"}</td>
                  <td className="td-actions">
                    <button className="btn-edit" onClick={() => openEdit(e)}>Edit</button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(e)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {entrances.length > 0 && (
            <tfoot>
              <tr style={{ background: "#f8fafc", borderTop: "2px solid #e5e7eb" }}>
                <td colSpan={6} style={{ padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "13px" }}>
                  TOTAL ({entrances.length} batches)
                </td>
                <td style={{ padding: "12px 16px", fontWeight: "800", color: "#2d7a4f", fontSize: "15px" }}>
                  {totalKg.toFixed(1)} kg
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Create Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal" style={{ maxWidth: "680px", position: "relative" }} onClick={(e) => e.stopPropagation()}
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
            <div className="modal-header">
              <h2>New Entrance Batch</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>

              {/* Type + Date + Tank */}
              <div className="form-row">
                <div className="form-group">
                  <label>Supplier Type <span className="required">*</span></label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[["A", "Horeca"], ["B", "Urban"]].map(([val, label]) => (
                      <button key={val} type="button"
                        onClick={() => setForm((f) => ({ ...f, supplier_type: val, receipt_ids: [] }))}
                        style={{
                          flex: 1, padding: "9px", borderRadius: "8px", border: "1.5px solid",
                          borderColor: form.supplier_type === val ? "#2d7a4f" : "#e5e7eb",
                          background: form.supplier_type === val ? "#f0fdf4" : "#fff",
                          color: form.supplier_type === val ? "#15803d" : "#374151",
                          fontWeight: "600", fontSize: "14px", cursor: "pointer",
                        }}>{label}</button>
                    ))}
                  </div>
                </div>
                <div className="form-group form-group--grow">
                  <label>Entrance Date <span className="required">*</span></label>
                  <input type="date" value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>

              {/* Tank */}
              <div className="form-group">
                <label>Assign to Tank</label>
                <select value={form.tank_id}
                  onChange={(e) => setForm({ ...form, tank_id: e.target.value })}
                  style={{ padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: "9px", fontSize: "15px", color: "#374151", background: "#fff", width: "100%" }}>
                  <option value="">Select a tank (optional)...</option>
                  {tanks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.capacity ? ` — ${t.stock || 0} / ${t.capacity} kg` : ` — ${t.stock || 0} kg`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date range filter */}
              <div style={{ background: "#f8fafc", border: "1.5px solid #e5e7eb", borderRadius: "10px", padding: "14px 16px" }}>
                <p style={{ fontSize: "13px", fontWeight: "600", color: "#6b7280", margin: "0 0 10px" }}>
                  Filter receipts by date range (optional)
                </p>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label style={{ fontSize: "13px", color: "#374151", fontWeight: "500" }}>From</label>
                    <input type="date" value={form.filter_date_from}
                      onChange={(e) => setForm({ ...form, filter_date_from: e.target.value, receipt_ids: [] })}
                      style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label style={{ fontSize: "13px", color: "#374151", fontWeight: "500" }}>To</label>
                    <input type="date" value={form.filter_date_to}
                      onChange={(e) => setForm({ ...form, filter_date_to: e.target.value, receipt_ids: [] })}
                      style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
                  </div>
                  {(form.filter_date_from || form.filter_date_to) && (
                    <button type="button"
                      onClick={() => setForm((f) => ({ ...f, filter_date_from: "", filter_date_to: "", receipt_ids: [] }))}
                      style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "13px" }}>
                      Clear dates
                    </button>
                  )}
                </div>
              </div>

              {/* Receipt list */}
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label>
                    Select Receipts <span className="required">*</span>
                    {form.receipt_ids.length > 0 && (
                      <span style={{ marginLeft: "8px", color: "#2d7a4f", fontWeight: "700" }}>
                        {form.receipt_ids.length} selected — {selectedKg.toFixed(1)} kg
                      </span>
                    )}
                  </label>
                  {filteredReceipts.length > 0 && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button type="button" onClick={selectAll}
                        style={{ background: "none", border: "none", color: "#2d7a4f", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                        Select all ({filteredReceipts.length})
                      </button>
                      {form.receipt_ids.length > 0 && (
                        <button type="button" onClick={clearSelection}
                          style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "13px", cursor: "pointer" }}>
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {receiptsLoading ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>Loading receipts...</div>
                ) : filteredReceipts.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", background: "#f8fafc", borderRadius: "8px", border: "1.5px solid #e5e7eb", color: "#9ca3af", fontSize: "14px" }}>
                    No unassigned {form.supplier_type === "A" ? "Horeca" : "Urban"} receipts available
                  </div>
                ) : (
                  <div style={{ border: "1.5px solid #e5e7eb", borderRadius: "8px", maxHeight: "260px", overflowY: "auto" }}>
                    {filteredReceipts.map((r) => (
                      <ReceiptItem key={r.id} r={r}
                        selected={form.receipt_ids.includes(r.id)}
                        onToggle={toggleReceipt} />
                    ))}
                  </div>
                )}
              </div>

              {formError && <p className="form-error">{formError}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Creating..." : `Create Batch${form.receipt_ids.length > 0 ? ` (${form.receipt_ids.length} receipts)` : ""}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editModalOpen && editingEntrance && (
        <div className="modal-overlay" onClick={handleEditOverlayClick}>
          <div className="modal" style={{ maxWidth: "680px", position: "relative" }} onClick={(e) => e.stopPropagation()}
        >
        {confirmCloseEdit && (
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
                      onClick={() => setConfirmCloseEdit(false)}
                      style={{
                        padding: "10px 20px", borderRadius: "8px",
                        border: "1.5px solid #e5e7eb", background: "#fff",
                        color: "#374151", fontWeight: "600", fontSize: "14px", cursor: "pointer",
                      }}
                    >
                      Keep editing
                    </button>
                    <button
                      onClick={() => { setConfirmCloseEdit(false); closeEditModal(); }}
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
              <div>
                <h2>Edit Batch {editingEntrance.batch_id}</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0 0" }}>
                  {editingEntrance.supplier_type === "A" ? "Horeca" : "Urban"} — Batch type cannot be changed
                </p>
              </div>
              <button className="modal-close" onClick={closeEditModal}>✕</button>
            </div>

            {/* Traceability warning */}
            <div style={{ margin: "0 24px", background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "10px", padding: "12px 16px" }}>
              <p style={{ fontWeight: "700", color: "#92400e", fontSize: "13px", margin: "0 0 4px" }}>
                ⚠ Traceability Warning
              </p>
              <p style={{ fontSize: "13px", color: "#78350f", margin: 0 }}>
                Changing receipts will recalculate the batch total and update tank stock. 
                Any dispatches linked to this batch will reflect the new quantities.
              </p>
            </div>

            <form className="modal-form" onSubmit={handleEditSubmit}>

              {/* Date + Tank */}
              <div className="form-row">
                <div className="form-group form-group--grow">
                  <label>Entrance Date</label>
                  <input type="date" value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
                </div>
                <div className="form-group form-group--grow">
                  <label>Tank</label>
                  <select value={editForm.tank_id}
                    onChange={(e) => setEditForm({ ...editForm, tank_id: e.target.value })}
                    style={{ padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: "9px", fontSize: "15px", color: "#374151", background: "#fff", width: "100%" }}>
                    <option value="">No tank assigned</option>
                    {tanks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.capacity ? ` — ${t.stock || 0} / ${t.capacity} kg` : ` — ${t.stock || 0} kg`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Receipt selection */}
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label>
                    Receipts in this batch
                    {editForm.receipt_ids.length > 0 && (
                      <span style={{ marginLeft: "8px", color: "#2d7a4f", fontWeight: "700" }}>
                        {editForm.receipt_ids.length} selected — {editSelectedKg.toFixed(1)} kg
                      </span>
                    )}
                  </label>
                </div>

                {filteredEditReceipts.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: "14px",
                    background: "#f8fafc", borderRadius: "8px", border: "1.5px solid #e5e7eb" }}>
                    No receipts available for this batch type
                  </div>
                ) : (
                  <div style={{ border: "1.5px solid #e5e7eb", borderRadius: "8px", maxHeight: "280px", overflowY: "auto" }}>
                    {filteredEditReceipts.map((r) => (
                      <ReceiptItem key={r.id} r={r}
                        selected={editForm.receipt_ids.includes(r.id)}
                        onToggle={toggleEditReceipt} />
                    ))}
                  </div>
                )}
              </div>

              {editError && <p className="form-error">{editError}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeEditModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={editSaving}>
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detailEntrance && (
        <div className="modal-overlay" onClick={() => setDetailEntrance(null)}>
          <div className="modal" style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Batch {detailEntrance.batch_id}</h2>
              <button className="modal-close" onClick={() => setDetailEntrance(null)}>✕</button>
            </div>
            <div style={{ padding: "16px 24px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                {[
                  ["Type", detailEntrance.supplier_type === "A" ? "Horeca" : "Urban"],
                  ["Date", formatDate(detailEntrance.date)],
                  ["Total", `${detailEntrance.quantity_kg?.toFixed(1)} kg`],
                  ["Start", formatDate(detailEntrance.start_date)],
                  ["Finish", formatDate(detailEntrance.finish_date)],
                  ["Tank", detailEntrance.tank?.name || "—"],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "#f8fafc", borderRadius: "8px", padding: "10px 12px" }}>
                    <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>{label}</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a2e" }}>{value}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontWeight: "600", fontSize: "13px", color: "#374151", marginBottom: "8px" }}>
                Receipts ({detailEntrance.receipts?.length || 0})
              </p>
              <div style={{ border: "1.5px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
                {detailEntrance.receipts?.map((r, idx) => (
                  <div key={r.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px",
                    borderBottom: idx < detailEntrance.receipts.length - 1 ? "1px solid #f3f4f6" : "none",
                  }}>
                    <span style={{ fontWeight: "600", fontSize: "13px", fontFamily: "monospace" }}>{r.receipt_code || `#${r.id}`}</span>
                    <span style={{ fontSize: "13px", color: "#6b7280" }}>{formatDate(r.date)}</span>
                    <span style={{ fontWeight: "700", color: "#2d7a4f", fontSize: "13px" }}>{r.quantity_kg?.toFixed(1)} kg</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Entrance</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p className="confirm-text">
              Are you sure you want to delete batch <strong>{deleteTarget.batch_id}</strong>?
            </p>
            <div style={{ margin: "0 24px 16px", background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: "10px", padding: "14px 16px" }}>
              <p style={{ fontWeight: "700", color: "#dc2626", fontSize: "14px", margin: "0 0 8px" }}>⚠ Traceability Warning</p>
              <ul style={{ fontSize: "13px", color: "#7f1d1d", margin: 0, paddingLeft: "18px", lineHeight: 1.8 }}>
                <li><strong>{deleteTarget.receipts?.length || 0} receipt{deleteTarget.receipts?.length !== 1 ? "s" : ""}</strong> will be unlocked</li>
                <li><strong>{deleteTarget.quantity_kg?.toFixed(0)} kg</strong> will be removed from tank stock</li>
                <li>Any dispatch linked to this batch will lose this entrance reference</li>
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
