import { useState, useEffect, useCallback } from "react";
import {
  getEntrances,
  createEntrance,
  deleteEntrance,
} from "../services/entrancesServices";
import { getReceipts } from "../services/receiptsServices";
import "../stylecss/customers.css";
import { getTanks } from "../services/tanksServices";

const EMPTY_FORM = {
  supplier_type: "A",
  date: new Date().toISOString().split("T")[0],
  tank_id: "",
  receipt_ids: [],
  filter_date_from: "",
  filter_date_to: "",
};

export default function Entrances() {
  const [entrances, setEntrances] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [allReceipts, setAllReceipts] = useState([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);

  const [typeFilter, setTypeFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detailEntrance, setDetailEntrance] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [tanks, setTanks] = useState([]);

  // Load tanks when component mounts
  useEffect(() => {
    getTanks()
      .then((res) => setTanks(res.data.tanks.filter((t) => t.is_active)))
      .catch(() => setError("Could not load tanks."));
  }, []);

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

  useEffect(() => {
    fetchEntrances();
  }, [fetchEntrances]);

  // ── Load all unassigned receipts ─────────────────────────
  const loadAllReceipts = async () => {
    setReceiptsLoading(true);
    try {
      const res = await getReceipts({ limit: 500 });
      console.log("Sample receipt:", res.data.receipts[0]); // testing
      const unassigned = res.data.receipts.filter((r) => !r.entrance_id);
      console.log("Receipt supplier types:", unassigned.map(r => r.supplier?.supplier_type)); // ← testing
      setAllReceipts(unassigned);
    } catch {
      setFormError("Could not load receipts.");
    } finally {
      setReceiptsLoading(false);
    }
  };

  // ── Filter receipts in the modal ─────────────────────────
  // THE FIX: compare supplier_type from the supplier object correctly
  const filteredReceipts = allReceipts.filter((r) => {
// NEW — explicit for both types
  const supplierType = r.supplier?.supplier_type?.toLowerCase();
  if (!supplierType) return false; // skip if no supplier info
  const rType = supplierType === "horeca" ? "A" 
            : supplierType === "urban"  ? "B" 
            : null;
  if (!rType) return false;        // skip unknown types

  if (rType !== form.supplier_type) return false;
    if (form.filter_date_from && r.date < form.filter_date_from) return false;
    if (form.filter_date_to && r.date > form.filter_date_to) return false;
    return true;
  });

  // ── Modal helpers ────────────────────────────────────────
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
    setForm((f) => {
      const ids = f.receipt_ids.includes(id)
        ? f.receipt_ids.filter((r) => r !== id)
        : [...f.receipt_ids, id];
      return { ...f, receipt_ids: ids };
    });
  };

  const selectAll = () => {
    setForm((f) => ({ ...f, receipt_ids: filteredReceipts.map((r) => r.id) }));
  };

  const clearSelection = () => {
    setForm((f) => ({ ...f, receipt_ids: [] }));
  };

  const selectedKg = allReceipts
    .filter((r) => form.receipt_ids.includes(r.id))
    .reduce((sum, r) => sum + (r.quantity_kg || 0), 0);

  // ── Submit ───────────────────────────────────────────────
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
      setFormError(err.response?.data?.detail || "Something went wrong.");
    } finally {
      setSaving(false);
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

  const totalKg = entrances.reduce((sum, e) => sum + (e.quantity_kg || 0), 0);

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
              <th>Start Date</th><th>Finish Date</th><th>Total (kg)</th><th>Tank</th><th>Actions</th>
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

      {/* ── Create Entrance Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Entrance Batch</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>

              {/* Type + Date */}
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
                        }}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                {/* TANK SELECTOR HERE */}
                <div className="form-group">
                  <label>Assign to Tank</label>
                  <select
                    value={form.tank_id}
                    onChange={(e) => setForm({ ...form, tank_id: e.target.value })}
                    style={{
                      padding: "11px 14px",
                      border: "1.5px solid #e5e7eb",
                      borderRadius: "9px",
                      fontSize: "15px",
                      color: "#374151",
                      background: "#fff",
                      width: "100%",
                    }}
                  >
                    <option value="">Select a tank (optional)...</option>
                    {tanks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.capacity
                          ? ` — ${t.stock || 0} / ${t.capacity} kg`
                          : ` — ${t.stock || 0} kg`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group form-group--grow">
                  <label>Entrance Date <span className="required">*</span></label>
                  <input type="date" value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>

              {/* Date range filter for receipts */}
              <div style={{
                background: "#f8fafc", border: "1.5px solid #e5e7eb",
                borderRadius: "10px", padding: "14px 16px",
              }}>
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
                  <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
                    Loading receipts...
                  </div>
                ) : filteredReceipts.length === 0 ? (
                  <div style={{
                    padding: "24px", textAlign: "center", background: "#f8fafc",
                    borderRadius: "8px", border: "1.5px solid #e5e7eb", color: "#9ca3af", fontSize: "14px",
                  }}>
                    No unassigned {form.supplier_type === "A" ? "Horeca" : "Urban"} receipts
                    {(form.filter_date_from || form.filter_date_to) ? " for the selected date range" : " available"}
                  </div>
                ) : (
                  <div style={{ border: "1.5px solid #e5e7eb", borderRadius: "8px", maxHeight: "260px", overflowY: "auto" }}>
                    {filteredReceipts.map((r, idx) => {
                      const selected = form.receipt_ids.includes(r.id);
                      return (
                        <div key={r.id} onClick={() => toggleReceipt(r.id)} style={{
                          display: "flex", alignItems: "center", gap: "12px",
                          padding: "11px 14px",
                          borderBottom: idx < filteredReceipts.length - 1 ? "1px solid #f3f4f6" : "none",
                          background: selected ? "#f0fdf4" : "#fff",
                          cursor: "pointer", transition: "background 0.15s",
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
                    })}
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

      {/* Detail Modal */}
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
                Receipts in this batch ({detailEntrance.receipts?.length || 0})
              </p>
              <div style={{ border: "1.5px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
                {detailEntrance.receipts?.map((r, idx) => (
                  <div key={r.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px",
                    borderBottom: idx < detailEntrance.receipts.length - 1 ? "1px solid #f3f4f6" : "none",
                    background: "#fff",
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

      {/* Delete Confirmation */}
      {deleteTarget && (
  <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
    <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>Delete Entrance Batch</h2>
        <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
      </div>
      <p className="confirm-text">
        Are you sure you want to delete batch <strong>{deleteTarget.batch_id}</strong>?
      </p>

      {/* Always show cascade info for entrances */}
      <div style={{
        margin: "0 24px 16px",
        background: "#fef2f2",
        border: "1.5px solid #fecaca",
        borderRadius: "10px",
        padding: "14px 16px",
      }}>
        <p style={{ fontWeight: "700", color: "#dc2626", fontSize: "14px", margin: "0 0 8px" }}>
          ⚠ Traceability Warning — Cascade Effects
        </p>
        <ul style={{ fontSize: "13px", color: "#7f1d1d", margin: 0, paddingLeft: "18px", lineHeight: 1.8 }}>
          <li>
            <strong>{deleteTarget.receipts?.length || 0} receipt{deleteTarget.receipts?.length !== 1 ? "s" : ""}</strong>{" "}
            will be unlocked and become available again
          </li>
          {deleteTarget.quantity_kg > 0 && (
            <li>
              <strong>{deleteTarget.quantity_kg?.toFixed(0)} kg</strong> will be removed from the tank stock
            </li>
          )}
          <li>
            Any <strong>dispatch</strong> linked to this batch will lose this entrance reference —
            breaking the traceability chain
          </li>
        </ul>
      </div>

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
