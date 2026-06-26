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
  const [confirmClose, setConfirmClose] = useState(false);

  const handleOverlayClick = () => {
    const isDirty = form.supplier_id || form.quantity_kg ||
                    form.notes ||
                    Object.values(form.pickup_quantities).some((v) => v !== "");
    if (isDirty) setConfirmClose(true);
    else closeModal();
  };

  // ── Load suppliers ───────────────────────────────────────
  useEffect(() => {
    getSuppliers({ limit: 200 })
      .then((res) => setSuppliers(res.data.suppliers))
      .catch(() => setError("No se pudo cargar la lista de proveedores."));
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
      setError("No se pueden cargar las recogidas. ¿Está el servidor en ejecución?");
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
    setConfirmClose(false)
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
    if (!form.supplier_id) { setFormError("Por favor, selecciona un proveedor."); return; }
    if (!form.date) { setFormError("La fecha es obligatoria."); return; }

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
        setFormError("Introduce al menos una cantidad mayor que 0 en un punto de recogida.");
        return;
      }
      // Total is calculated by the backend from pickup quantities
      finalQuantity = pickupTotal;
    } else {
      if (!form.quantity_kg || parseFloat(form.quantity_kg) <= 0) {
        setFormError("La cantidad debe ser mayor que 0.");
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
          : "Ha ocurrido un error. Por favor, inténtalo de nuevo."
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
      setError("No se pudo eliminar la recogida.");
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
    receipt.supplier?.name || `Proveedor #${receipt.supplier_id}`;

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
        <h1 className="customers-title">Recogidas</h1>
        <p className="customers-subtitle">
          {total} recogida{total !== 1 ? "s" : ""} —{" "}
          <strong>{totalKg.toFixed(1)} kg</strong> UCO recogidos
        </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Nueva recogida</button>
      </div>

      {/* Filters */}
      <div className="customers-toolbar" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}
          style={{ padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px", color: "#374151", background: "#fff", cursor: "pointer" }}>
          <option value="">Todos los Proveedores</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label style={{ fontSize: "13px", color: "#6b7280", fontWeight: "500" }}>Desde</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label style={{ fontSize: "13px", color: "#6b7280", fontWeight: "500" }}>Hasta</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
        </div>
        {(supplierFilter || dateFrom || dateTo) && (
          <button className="btn-secondary"
            onClick={() => { setSupplierFilter(""); setDateFrom(""); setDateTo(""); }}
            style={{ padding: "8px 14px", fontSize: "13px" }}>
            Limpiar filtros
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
            <th>Código</th>
            <th>Fecha</th>
            <th>Proveedor</th>
            <th>Materia Prima</th>
            <th>Cantidad (kg)</th>
            <th>Desglose Recogida</th>
            <th>Observaciones</th>
            <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="table-state">Cargando...</td></tr>
            ) : receipts.length === 0 ? (
              <tr><td colSpan={9} className="table-state">No se encontraron recogidas. ¡Añade tu primera recogida!</td></tr>
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
                    <button className="btn-edit" onClick={() => openEdit(r)}>Editar</button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(r)}>Eliminar</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {receipts.length > 0 && (
            <tfoot>
              <tr style={{ background: "#f8fafc", borderTop: "2px solid #e5e7eb" }}>
                <td colSpan={5} style={{ padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "13px" }}>
                  TOTAL ({receipts.length} recogidas)
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
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal"
            style={{ maxWidth: "620px", maxHeight: "90vh", overflowY: "auto" }}
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
                      Seguir Editando
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
            <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 9 }}>
              <h2>{editingReceipt ? "Editar Recogida" : "Nueva Recogida"}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>

              {/* Supplier */}
              <div className="form-group">
                <label>Proveedor <span className="required">*</span></label>
                <select value={form.supplier_id}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  style={{ padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: "9px", fontSize: "15px", color: "#374151", background: "#fff", width: "100%" }}>
                  <option value="">Seleccionar un proveedor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.supplier_type})</option>
                  ))}
                </select>
              </div>

              {/* Date + Raw material */}
              <div className="form-row">
                <div className="form-group form-group--grow">
                  <label>Fecha <span className="required">*</span></label>
                  <input type="date" value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Materia Prima</label>
                  <input type="text" value={form.raw_material}
                    onChange={(e) => setForm({ ...form, raw_material: e.target.value })}
                    style={{ background: "#f8fafc" }} />
                </div>
              </div>

              {/* ── Quantity section ── */}

              {/* No supplier selected yet */}
              {!form.supplier_id && (
                <div className="form-group">
                  <label>Cantidad (kg) <span className="required">*</span></label>
                  <input type="number" min="0.1" step="0.1" placeholder="0.0"
                    value={form.quantity_kg}
                    onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })} />
                </div>
              )}

              {/* Loading pickup points */}
              {form.supplier_id && pickupLoading && (
                <div style={{ padding: "16px", textAlign: "center", color: "#9ca3af", fontSize: "14px",
                  border: "1.5px solid #e5e7eb", borderRadius: "10px" }}>
                  Cargando puntos de recogidas...
                </div>
              )}

              {/* Supplier has NO pickup points → plain quantity */}
              {form.supplier_id && !pickupLoading && pickupPoints.length === 0 && (
                <div className="form-group">
                  <label>Cantidad (kg) <span className="required">*</span></label>
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
                      📍 Puntos de Recogida
                      {selectedSupplier && (
                        <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "400", marginLeft: "8px" }}>
                          {selectedSupplier.name}
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                      {pickupPoints.length} punto{pickupPoints.length !== 1 ? "s" : ""} — introduce la cantidad por punto
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
                      {usePickupPoints ? "✓ Por punto" : "Total manual"}
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
                          Total ({filledPoints}/{pickupPoints.length} puntos)
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
                        <label>Cantidad Total (kg) <span className="required">*</span></label>
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
              <label>Observaciones</label>
              <input type="text" placeholder="Observaciones opcionales sobre esta recogida..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              {formError && (
                <p className="form-error">
                 {typeof formError === "string" ? formError : "Error de validación — revisa los datos."}
                </p>
              )}

              <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Guardando..."
                  : editingReceipt ? "Guardar Cambios"
                  : usePickupPoints && pickupTotal > 0
                    ? `Añadir Recogida — ${pickupTotal.toFixed(1)} kg`
                    : "Añadir Recogida"}
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
              <h2>Eliminar Recogida</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p className="confirm-text">
              ¿Estás seguro de que quieres eliminar la recogida?{" "}
              <strong>#{deleteTarget.receipt_code || deleteTarget.id}</strong> de{" "}
              <strong>{supplierName(deleteTarget)}</strong>?
            </p>
            {deleteTarget.entrance_id && (
              <div style={{
                margin: "0 24px 16px",
                background: "#fef2f2", border: "1.5px solid #fecaca",
                borderRadius: "10px", padding: "14px 16px",
              }}>
                <p style={{ fontWeight: "700", color: "#dc2626", fontSize: "14px", margin: "0 0 8px" }}>
                  ⚠ Aviso de Trazabilidad
                </p>
                <ul style={{ fontSize: "13px", color: "#7f1d1d", margin: 0, paddingLeft: "18px", lineHeight: 1.8 }}>
                  <li>Esta recogida está asignada al lote de entrada <strong>#{deleteTarget.entrance_id}</strong></li>
                  <li>Eliminarla reducirá la cantidad del lote y podría romper la cadena de trazabilidad</li>
                </ul>
              </div>
            )}
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
