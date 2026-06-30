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
      setError("No se pueden cargar las entradas. ¿Está el servidor en ejecución?");
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
      setFormError("No se pudieron cargar las recogidas.");
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
      setEditError("No se pudieron cargar las recogidas.");
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
       setFormError("Por favor, selecciona al menos una recogida.");
      return;
    }
    if (!form.tank_id) {
      setFormError("Por favor, selecciona un depósito.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await createEntrance({
        supplier_type: form.supplier_type,
        date: form.date,
        tank_id: parseInt(form.tank_id),
        receipt_ids: form.receipt_ids,
      });
      closeModal();
      fetchEntrances();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(
        typeof detail === "string" ? detail : "Ha ocurrido un error."
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Edit submit ──────────────────────────────────────────
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (editForm.receipt_ids.length === 0) {
       setEditError("Se requiere al menos una recogida.");
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
        typeof detail === "string" ? detail : "Ha ocurrido un error."
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
      setError("No se pudo eliminar la entrada.");
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
      {type === "A" ? "Horeca" : "Urbano"}
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
    <h1 className="customers-title">Entradas</h1>
    <p className="customers-subtitle">
      {total} lote{total !== 1 ? "s" : ""} — <strong>{totalKg.toFixed(1)} kg</strong> UCO total
    </p>

    {/* Tank stock summary */}
    {tanks.length > 0 && (
      <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
        {tanks.map((t) => {
          const pct = t.capacity ? Math.round(((t.stock || 0) / t.capacity) * 100) : null;
          const color = pct === null ? "#6b7280" : pct >= 90 ? "#dc2626" : pct >= 70 ? "#f59e0b" : "#2d7a4f";
          return (
            <div key={t.id} style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: "#fff", border: "1.5px solid #e5e7eb",
              borderRadius: "8px", padding: "6px 12px",
              fontSize: "13px",
            }}>
              <span style={{ fontSize: "15px" }}>🛢️</span>
              <span style={{ fontWeight: "600", color: "#374151" }}>{t.name}</span>
              <span style={{ fontWeight: "700", color }}>
                {(t.stock || 0).toLocaleString()} kg
              </span>
              {pct !== null && (
                <>
                  <div style={{ width: "60px", height: "6px", background: "#f3f4f6", borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: "999px" }} />
                  </div>
                  <span style={{ fontSize: "11px", color, fontWeight: "600" }}>{pct}%</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    )}
  </div>
  <button className="btn-primary" onClick={openAdd}>+ Nueva Entrada</button>
</div>

      {/* Type filter */}
      <div className="customers-toolbar" style={{ display: "flex", gap: "8px" }}>
        {[["", "Todos"], ["A", "Horeca"], ["B", "Urbano"]].map(([val, label]) => (
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
              <th>Código de Lote</th><th>Tipo</th><th>Fecha</th><th>Albaranes</th>
              <th>Inicio</th><th>Fin</th><th>Total (kg)</th><th>Depósito</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="table-state">Cargando...</td></tr>
            ) : entrances.length === 0 ? (
              <tr><td colSpan={9} className="table-state">No hay entradas todavía. ¡Crea tu primer lote!</td></tr>
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
                      {e.receipts?.length || 0} recogida{e.receipts?.length !== 1 ? "s" : ""}
                    </button>
                  </td>
                  <td>{formatDate(e.start_date)}</td>
                  <td>{formatDate(e.finish_date)}</td>
                  <td style={{ fontWeight: "700", color: "#2d7a4f" }}>{e.quantity_kg?.toFixed(1)} kg</td>
                  <td>{e.tank?.name || "—"}</td>
                  <td className="td-actions">
                    <button className="btn-edit" onClick={() => openEdit(e)}>Editar</button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(e)}>Eliminar</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {entrances.length > 0 && (
            <tfoot>
              <tr style={{ background: "#f8fafc", borderTop: "2px solid #e5e7eb" }}>
                <td colSpan={6} style={{ padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "13px" }}>
                  TOTAL ({entrances.length} lotes)
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
                  ¿Descartar cambios?
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
            <div className="modal-header">
              <h2>Nuevo Lote de Entrada</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>

              {/* Type + Date + Tank */}
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo proveedor <span className="required">*</span></label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[["A", "Horeca"], ["B", "Urbano"]].map(([val, label]) => (
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
                  <label>Fecha de entrada <span className="required">*</span></label>
                  <input type="date" value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>

              {/* Tank */}
              <div className="form-group">
              <label>Asignar Depósito <span className="required">*</span></label>
                <select value={form.tank_id}
                  onChange={(e) => setForm({ ...form, tank_id: e.target.value })}
                  style={{ padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: "9px", fontSize: "15px", color: "#374151", background: "#fff", width: "100%" }}>
                  <option value="">Seleccionar un depòsito (obligatorio)...</option>
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
                    Filtrar recogidas por rango de fechas (opcional)
                </p>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label style={{ fontSize: "13px", color: "#374151", fontWeight: "500" }}>Desde</label>
                    <input type="date" value={form.filter_date_from}
                      onChange={(e) => setForm({ ...form, filter_date_from: e.target.value, receipt_ids: [] })}
                      style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label style={{ fontSize: "13px", color: "#374151", fontWeight: "500" }}>Hasta</label>
                    <input type="date" value={form.filter_date_to}
                      onChange={(e) => setForm({ ...form, filter_date_to: e.target.value, receipt_ids: [] })}
                      style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
                  </div>
                  {(form.filter_date_from || form.filter_date_to) && (
                    <button type="button"
                      onClick={() => setForm((f) => ({ ...f, filter_date_from: "", filter_date_to: "", receipt_ids: [] }))}
                      style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "13px" }}>
                      Limpiar fechas
                    </button>
                  )}
                </div>
              </div>

              {/* Receipt list */}
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>
                  Seleccionar Recogidas <span className="required">*</span>
                  {form.receipt_ids.length > 0 && (
                    <span style={{ marginLeft: "8px", color: "#2d7a4f", fontWeight: "700" }}>
                      {form.receipt_ids.length} seleccionados — {selectedKg.toFixed(1)} kg
                    </span>
                  )}
                </label>
                  {filteredReceipts.length > 0 && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button type="button" onClick={selectAll}
                        style={{ background: "none", border: "none", color: "#2d7a4f", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                        Seleccionar todos ({filteredReceipts.length})
                      </button>
                      {form.receipt_ids.length > 0 && (
                        <button type="button" onClick={clearSelection}
                          style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "13px", cursor: "pointer" }}>
                          Limpiar
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {receiptsLoading ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>Cargando recogidas...</div>
                ) : filteredReceipts.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", background: "#f8fafc", borderRadius: "8px", border: "1.5px solid #e5e7eb", color: "#9ca3af", fontSize: "14px" }}>
                    No hay recogidas {form.supplier_type === "A" ? "Horeca" : "Urbano"} Recogidas disponibles
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
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Creando..." : `Crear Lote${form.receipt_ids.length > 0 ? ` (${form.receipt_ids.length} recogidas)` : ""}`}
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
                    ¿Descartar cambios?
                  </p>
                  <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "24px" }}>
                    Tienes datos sin guardar. Si cierras ahora se perderán.
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
                        Seguir editando
                    </button>
                    <button
                      onClick={() => { setConfirmCloseEdit(false); closeEditModal(); }}
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
            <div className="modal-header">
              <div>
              <h2>Editar Lote {editingEntrance.batch_id}</h2>
              <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0 0" }}>
                {editingEntrance.supplier_type === "A" ? "Horeca" : "Urbano"} — El tipo de lote no se puede modificar
              </p>
              </div>
              <button className="modal-close" onClick={closeEditModal}>✕</button>
            </div>

            {/* Traceability warning */}
            <div style={{ margin: "0 24px", background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "10px", padding: "12px 16px" }}>
            <p style={{ fontWeight: "700", color: "#92400e", fontSize: "13px", margin: "0 0 4px" }}>
              ⚠ Aviso de Trazabilidad
            </p>
            <p style={{ fontSize: "13px", color: "#78350f", margin: 0 }}>
              Cambiar los albaranes recalculará el total del lote y actualizará el stock del depósito.
              Cualquier salida vinculada a este lote reflejará las nuevas cantidades.
            </p>
            </div>

            <form className="modal-form" onSubmit={handleEditSubmit}>

              {/* Date + Tank */}
              <div className="form-row">
                <div className="form-group form-group--grow">
                  <label>Fecha de Entrada</label>
                  <input type="date" value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
                </div>
                <div className="form-group form-group--grow">
                <label>Depósito <span className="required">*</span></label>
                  <select value={editForm.tank_id}
                    onChange={(e) => setEditForm({ ...editForm, tank_id: e.target.value })}
                    style={{ padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: "9px", fontSize: "15px", color: "#374151", background: "#fff", width: "100%" }}>
                    <option value="">Sin depósito asignado</option>
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
                  Recogidas en este lote
                  {editForm.receipt_ids.length > 0 && (
                    <span style={{ marginLeft: "8px", color: "#2d7a4f", fontWeight: "700" }}>
                      {editForm.receipt_ids.length} seleccionados — {editSelectedKg.toFixed(1)} kg
                    </span>
                  )}
                </label>
                </div>

                {filteredEditReceipts.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: "14px",
                    background: "#f8fafc", borderRadius: "8px", border: "1.5px solid #e5e7eb" }}>
                    No hay recogidas disponibles para este tipo de lote
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
              <button type="button" className="btn-secondary" onClick={closeEditModal}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={editSaving}>
                {editSaving ? "Guardando..." : "Guardar Cambios"}
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
              <h2>Lote {detailEntrance.batch_id}</h2>
              <button className="modal-close" onClick={() => setDetailEntrance(null)}>✕</button>
            </div>
            <div style={{ padding: "16px 24px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                {[
                  ["Tipo",   detailEntrance.supplier_type === "A" ? "Horeca" : "Urbano"],
                  ["Fecha",  formatDate(detailEntrance.date)],
                  ["Total",  `${detailEntrance.quantity_kg?.toFixed(1)} kg`],
                  ["Inicio", formatDate(detailEntrance.start_date)],
                  ["Fin",    formatDate(detailEntrance.finish_date)],
                  ["Depósito", detailEntrance.tank?.name || "—"],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "#f8fafc", borderRadius: "8px", padding: "10px 12px" }}>
                    <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>{label}</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a2e" }}>{value}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontWeight: "600", fontSize: "13px", color: "#374151", marginBottom: "8px" }}>
                Recogidas ({detailEntrance.receipts?.length || 0})
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
              <h2>Eliminar Entrada</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p className="confirm-text">
              ¿Estás seguro de que quieres eliminar el lote <strong>{deleteTarget.batch_id}</strong>?
            </p>
            <div style={{ margin: "0 24px 16px", background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: "10px", padding: "14px 16px" }}>
            <p style={{ fontWeight: "700", color: "#dc2626", fontSize: "14px", margin: "0 0 8px" }}>⚠ Aviso de Trazabilidad</p>
            <ul style={{ fontSize: "13px", color: "#7f1d1d", margin: 0, paddingLeft: "18px", lineHeight: 1.8 }}>
              <li><strong>{deleteTarget.receipts?.length || 0} recogida{deleteTarget.receipts?.length !== 1 ? "s" : ""}</strong> serán desbloqueados</li>
              <li><strong>{deleteTarget.quantity_kg?.toFixed(0)} kg</strong> serán retirados del stock del depósito</li>
              <li>Cualquier salida vinculada a este lote perderá esta referencia de entrada</li>
            </ul>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button className="btn-danger" onClick={confirmDelete}>Eliminar de todas formas</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
