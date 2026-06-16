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
import API from "../services/api";
import config from "../config";
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

const EMPTY_INVOICE_FORM = {
  invoice_number: "",
  price_per_kg: "1.09",
  quantity_kg: "",
  invoice_date: "",
  iva_pct: "21",
  notes: "",
};

export default function Dispatches() {
  const [dispatches, setDispatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [customers, setCustomers] = useState([]);
  const [entrances, setEntrances] = useState([]);
  const [tanks, setTanks] = useState([]);

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDispatch, setEditingDispatch] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Detail view
  const [detailDispatch, setDetailDispatch] = useState(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Invoice modal ────────────────────────────────────────
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceDispatch, setInvoiceDispatch] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);   // existing invoice or null
  const [invoiceForm, setInvoiceForm] = useState(EMPTY_INVOICE_FORM);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [invoiceError, setInvoiceError] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // ── Documents state ──────────────────────────────────────
  const [documents, setDocuments] = useState(null);   // { dispatch_id, documents: [...] }
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState({});     // { doc_type: bool }
  const [docError, setDocError] = useState(null);

  const DOC_TYPES = [
    { key: "transport_documentation",   label: "Transport Documentation",    icon: "🚚" },
    { key: "waste_identification",      label: "Waste Identification",       icon: "♻️" },
    { key: "purchase_order",            label: "Purchase Order",             icon: "🛒" },
    { key: "identification_document",   label: "Identification Document",    icon: "🪪" },
    { key: "purchase_offer_contract",   label: "Purchase Offer and Contract",icon: "📝" },
    { key: "sustainability_declaration",label: "Sustainability Declaration", icon: "🌿" },
    { key: "analysis",                   label: "Analysis",                    icon: "🔬" }, 
  ];

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

  // ── Dispatch modal helpers ───────────────────────────────
  const openAdd = () => {
    setEditingDispatch(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
    loadDropdownData();
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
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDispatch(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const toggleEntrance = (id) => {
    setForm((f) => ({
      ...f,
      entrance_ids: f.entrance_ids.includes(id)
        ? f.entrance_ids.filter((e) => e !== id)
        : [...f.entrance_ids, id],
    }));
  };

  // ── Submit dispatch ──────────────────────────────────────
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

  // ── Invoice helpers ──────────────────────────────────────
  const openInvoice = async (dispatch) => {
    setInvoiceDispatch(dispatch);
    setInvoiceError(null);
    setInvoiceData(null);
    setInvoiceOpen(true);
    setInvoiceLoading(true);

    try {
      // Check if invoice already exists
      const res = await API.get(`/invoices/dispatch/${dispatch.id}`);
      if (res.data) {
        // Existing invoice — populate form with saved values
        setInvoiceData(res.data);
        setInvoiceForm({
          invoice_number: res.data.invoice_number || dispatch.batch_id || "",
          price_per_kg:   String(res.data.price_per_kg || "1.09"),
          quantity_kg:    res.data.quantity_kg ? String(res.data.quantity_kg) : "",
          invoice_date:   res.data.invoice_date || dispatch.date?.split("T")[0] || "",
          iva_pct:        String(res.data.iva_pct || "21"),
          notes:          res.data.notes || "",
        });
      } else {
        // New invoice — set defaults from dispatch
        setInvoiceForm({
          invoice_number: dispatch.batch_id || "",
          price_per_kg:   "1.09",
          quantity_kg:    "",
          invoice_date:   dispatch.date?.split("T")[0] || new Date().toISOString().split("T")[0],
          iva_pct:        "21",
          notes:          "",
        });
      }
    } catch {
      setInvoiceForm({
        invoice_number: dispatch.batch_id || "",
        price_per_kg:   "1.09",
        quantity_kg:    "",
        invoice_date:   dispatch.date?.split("T")[0] || "",
        iva_pct:        "21",
        notes:          "",
      });
    } finally {
      setInvoiceLoading(false);
    }
  };

  const closeInvoice = () => {
    setInvoiceOpen(false);
    setInvoiceDispatch(null);
    setInvoiceData(null);
    setInvoiceForm(EMPTY_INVOICE_FORM);
    setInvoiceError(null);
  };

  // Save / update invoice
  const saveInvoice = async () => {
    if (!invoiceForm.price_per_kg || parseFloat(invoiceForm.price_per_kg) <= 0) {
      setInvoiceError("Price per kg must be greater than 0."); return;
    }
    setInvoiceSaving(true);
    setInvoiceError(null);
    try {
      if (invoiceData) {
        // Update existing
        await API.patch(`/invoices/${invoiceData.id}`, {
          price_per_kg:   parseFloat(invoiceForm.price_per_kg),
          quantity_kg:    invoiceForm.quantity_kg ? parseFloat(invoiceForm.quantity_kg) : null,
          invoice_date:   invoiceForm.invoice_date || null,
          invoice_number: invoiceForm.invoice_number || null,
          iva_pct:        parseFloat(invoiceForm.iva_pct || 21),
          notes:          invoiceForm.notes || null,
        });
        // Refresh invoice data
        const res = await API.get(`/invoices/dispatch/${invoiceDispatch.id}`);
        setInvoiceData(res.data);
      } else {
        // Create new
        const res = await API.post(
          `/invoices/dispatch/${invoiceDispatch.id}?price_per_kg=${invoiceForm.price_per_kg}`
        );
        setInvoiceData(res.data);
        // Apply any other fields
        if (invoiceForm.quantity_kg || invoiceForm.invoice_date || invoiceForm.invoice_number || invoiceForm.notes) {
          await API.patch(`/invoices/${res.data.id}`, {
            price_per_kg:   parseFloat(invoiceForm.price_per_kg),
            quantity_kg:    invoiceForm.quantity_kg ? parseFloat(invoiceForm.quantity_kg) : null,
            invoice_date:   invoiceForm.invoice_date || null,
            invoice_number: invoiceForm.invoice_number || null,
            iva_pct:        parseFloat(invoiceForm.iva_pct || 21),
            notes:          invoiceForm.notes || null,
          });
          const res2 = await API.get(`/invoices/dispatch/${invoiceDispatch.id}`);
          setInvoiceData(res2.data);
        }
      }
    } catch (err) {
      setInvoiceError(err.response?.data?.detail || "Could not save invoice.");
    } finally {
      setInvoiceSaving(false);
    }
  };

  // Download PDF
  const downloadInvoicePdf = async () => {
    setDownloadingPdf(true);
    try {
      // Save first if unsaved changes
      if (!invoiceData) {
        await saveInvoice();
      }
      const url = `${config.apiUrl}/invoices/dispatch/${invoiceDispatch.id}/pdf?price_per_kg=${invoiceForm.price_per_kg}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `Factura_${invoiceDispatch.batch_id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(link.href);
    } catch {
      setInvoiceError("Could not download PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Live preview totals
  const previewQty   = parseFloat(invoiceForm.quantity_kg) || invoiceDispatch?.quantity || 0;
  const previewPrice = parseFloat(invoiceForm.price_per_kg) || 0;
  const previewIva   = parseFloat(invoiceForm.iva_pct) || 21;
  const previewBase  = Math.round(previewQty * previewPrice * 100) / 100;
  const previewIvaAmt= Math.round(previewBase * (previewIva / 100) * 100) / 100;
  const previewTotal = Math.round((previewBase + previewIvaAmt) * 100) / 100;

  const fmtEur = (v) => v?.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

  // ── Document helpers ─────────────────────────────────────
  const fetchDocuments = async (dispatchId) => {
    setDocsLoading(true);
    setDocError(null);
    try {
      const res = await API.get(`/documents/dispatch/${dispatchId}`);
      setDocuments(res.data);
    } catch {
      setDocError("Could not load documents.");
    } finally {
      setDocsLoading(false);
    }
  };

  const handleUpload = async (docType, file) => {
    if (!file) return;
    setUploading((u) => ({ ...u, [docType]: true }));
    setDocError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await API.post(`/documents/dispatch/${detailDispatch.id}/${docType}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await fetchDocuments(detailDispatch.id);
    } catch (err) {
      setDocError(err.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading((u) => ({ ...u, [docType]: false }));
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await API.delete(`/documents/${docId}`);
      await fetchDocuments(detailDispatch.id);
    } catch {
      setDocError("Could not delete document.");
    }
  };

  const handleDownload = (docId, filename) => {
    const url = `${config.apiUrl}/documents/${docId}/download`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
                    <button className="btn-edit" onClick={() => { setDetailDispatch(d); fetchDocuments(d.id); }}>View</button>
                    <button className="btn-edit" onClick={() => openEdit(d)}>Edit</button>
                    <button
                      className="btn-edit"
                      style={{ background: "#f0fdf4", color: "#15803d" }}
                      onClick={() => openInvoice(d)}
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

      {/* ══════════════════════════════════════════════════════
          INVOICE MODAL
      ══════════════════════════════════════════════════════ */}
      {invoiceOpen && invoiceDispatch && (
        <div className="modal-overlay" onClick={closeInvoice}>
          <div className="modal" style={{ maxWidth: "620px", maxHeight: "92vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 9 }}>
              <div>
                <h2>🧾 Invoice — {invoiceDispatch.batch_id}</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0 0" }}>
                  {invoiceData ? "Edit existing invoice" : "Create new invoice"} · {invoiceDispatch.customer?.name}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  onClick={downloadInvoicePdf}
                  disabled={downloadingPdf}
                  style={{
                    padding: "8px 16px", background: "#2d7a4f", color: "#fff",
                    border: "none", borderRadius: "8px", fontSize: "13px",
                    fontWeight: "700", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "6px",
                    opacity: downloadingPdf ? 0.7 : 1,
                  }}
                >
                  {downloadingPdf ? (
                    <><span style={{ width:"12px",height:"12px",border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite" }}/> Generating...</>
                  ) : "⬇ Download PDF"}
                </button>
                <button className="modal-close" onClick={closeInvoice}>✕</button>
              </div>
            </div>

            <div style={{ padding: "16px 24px 24px" }}>

              {invoiceLoading ? (
                <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Loading...</p>
              ) : (
                <>
                  {/* Status badge */}
                  {invoiceData && (
                    <div style={{
                      background: "#f0fdf4", border: "1.5px solid #86efac",
                      borderRadius: "8px", padding: "10px 14px",
                      marginBottom: "20px",
                      display: "flex", alignItems: "center", gap: "8px",
                      fontSize: "13px", color: "#15803d",
                    }}>
                      <span>✓</span>
                      <span>Invoice saved — last updated. Any changes will update the existing invoice.</span>
                    </div>
                  )}

                  {/* Dispatch info summary */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px",
                    marginBottom: "20px",
                  }}>
                    {[
                      ["Dispatch Date", formatDate(invoiceDispatch.date)],
                      ["Quantity", `${invoiceDispatch.quantity?.toLocaleString()} kg`],
                      ["Customer", invoiceDispatch.customer?.name || "—"],
                    ].map(([label, value]) => (
                      <div key={label} style={{ background: "#f8fafc", borderRadius: "8px", padding: "10px 12px", border: "1.5px solid #e5e7eb" }}>
                        <p style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", margin: "0 0 4px" }}>{label}</p>
                        <p style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a2e", margin: 0 }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Invoice form */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                    {/* Invoice number + date */}
                    <div className="form-row">
                      <div className="form-group form-group--grow">
                        <label>Invoice Number</label>
                        <input type="text"
                          placeholder={invoiceDispatch.batch_id}
                          value={invoiceForm.invoice_number}
                          onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Invoice Date</label>
                        <input type="date"
                          value={invoiceForm.invoice_date}
                          onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Price + quantity override */}
                    <div className="form-row">
                      <div className="form-group form-group--grow">
                        <label>Price per kg (€) <span className="required">*</span></label>
                        <input type="number" step="0.01" min="0.01"
                          placeholder="1.09"
                          value={invoiceForm.price_per_kg}
                          onChange={(e) => setInvoiceForm({ ...invoiceForm, price_per_kg: e.target.value })}
                        />
                        <p style={{ fontSize: "11px", color: "#9ca3af", margin: "4px 0 0" }}>
                          Default: 1.09 €/kg
                        </p>
                      </div>
                      <div className="form-group form-group--grow">
                        <label>Quantity override (kg)</label>
                        <input type="number" step="0.1" min="0"
                          placeholder={`${invoiceDispatch.quantity} kg (from dispatch)`}
                          value={invoiceForm.quantity_kg}
                          onChange={(e) => setInvoiceForm({ ...invoiceForm, quantity_kg: e.target.value })}
                        />
                        <p style={{ fontSize: "11px", color: "#9ca3af", margin: "4px 0 0" }}>
                          Leave empty to use dispatch quantity
                        </p>
                      </div>
                      <div className="form-group">
                        <label>IVA (%)</label>
                        <input type="number" step="0.1" min="0"
                          value={invoiceForm.iva_pct}
                          onChange={(e) => setInvoiceForm({ ...invoiceForm, iva_pct: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="form-group">
                      <label>Notes (optional)</label>
                      <input type="text"
                        placeholder="Any additional notes..."
                        value={invoiceForm.notes}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                      />
                    </div>

                    {/* Live preview */}
                    <div style={{
                      background: "#f0fdf4", border: "1.5px solid #86efac",
                      borderRadius: "12px", padding: "16px 20px",
                    }}>
                      <p style={{ fontWeight: "700", fontSize: "13px", color: "#15803d", margin: "0 0 12px" }}>
                        💶 Invoice Preview
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
                        {[
                          ["Base Imponible", fmtEur(previewBase), "#1a1a2e"],
                          [`IVA ${invoiceForm.iva_pct}%`, fmtEur(previewIvaAmt), "#6b7280"],
                          ["TOTAL FACTURA", fmtEur(previewTotal), "#2d7a4f"],
                        ].map(([label, value, color]) => (
                          <div key={label} style={{ textAlign: "center" }}>
                            <p style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", margin: "0 0 4px" }}>{label}</p>
                            <p style={{ fontSize: label === "TOTAL FACTURA" ? "20px" : "16px", fontWeight: "800", color, margin: 0 }}>{value}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #86efac", fontSize: "12px", color: "#6b7280" }}>
                        {previewQty.toLocaleString()} kg × {invoiceForm.price_per_kg} €/kg
                        {invoiceForm.quantity_kg && (
                          <span style={{ color: "#f59e0b", marginLeft: "8px" }}>
                            ⚠ Using overridden quantity
                          </span>
                        )}
                      </div>
                    </div>

                    {invoiceError && (
                      <p className="form-error">{invoiceError}</p>
                    )}

                    {/* Actions */}
                    <div className="modal-actions">
                      <button type="button" className="btn-secondary" onClick={closeInvoice}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={saveInvoice}
                        disabled={invoiceSaving}
                      >
                        {invoiceSaving ? "Saving..." : invoiceData ? "Update Invoice" : "Create Invoice"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Dispatch Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: "680px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
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
        <div className="modal-overlay" onClick={() => { setDetailDispatch(null); setDocuments(null); }}>
          <div className="modal" style={{ maxWidth: "640px", maxHeight: "92vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 9 }}>
              <div>
                <h2>{detailDispatch.batch_id}</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0 0" }}>
                  {detailDispatch.customer?.name} · {formatDate(detailDispatch.date)}
                </p>
              </div>
              <button className="modal-close" onClick={() => { setDetailDispatch(null); setDocuments(null); }}>✕</button>
            </div>

            <div style={{ padding: "16px 24px 24px" }}>

              {/* Dispatch info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
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

              {/* Entrances */}
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

              {/* Disposal */}
              {detailDispatch.disposal && (
                <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "10px", padding: "14px 16px", marginBottom: "20px" }}>
                  <p style={{ fontWeight: "700", fontSize: "13px", color: "#92400e", margin: "0 0 10px" }}>Disposal</p>
                  <div style={{ display: "flex", gap: "16px", fontSize: "14px" }}>
                    <span><strong>Date:</strong> {formatDate(detailDispatch.disposal.date)}</span>
                    <span><strong>Quantity:</strong> {detailDispatch.disposal.quantity} kg</span>
                    {detailDispatch.disposal.notes && <span><strong>Notes:</strong> {detailDispatch.disposal.notes}</span>}
                  </div>
                </div>
              )}

              {/* ── Documents section ── */}
              <div style={{ borderTop: "2px solid #e5e7eb", paddingTop: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div>
                    <p style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a2e", margin: "0 0 2px" }}>
                      📎 Compliance Documents
                    </p>
                    <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
                      {documents ? `${documents.uploaded_types?.length || 0} of 7 uploaded` : "Click to load documents"}
                    </p>
                  </div>
                  {!documents && (
                    <button
                      onClick={() => fetchDocuments(detailDispatch.id)}
                      disabled={docsLoading}
                      style={{
                        padding: "8px 16px", background: "#f0f9ff",
                        border: "1.5px solid #7dd3fc", borderRadius: "8px",
                        color: "#0369a1", fontSize: "13px", fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      {docsLoading ? "Loading..." : "📂 Load Documents"}
                    </button>
                  )}
                </div>

                {docError && (
                  <div className="error-banner" style={{ marginBottom: "12px" }}>{docError}</div>
                )}

                {documents && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {DOC_TYPES.map(({ key, label, icon }) => {
                      const docGroup = documents.documents?.find((d) => d.doc_type === key);
                      const files    = docGroup?.files || [];
                      const hasFiles = files.length > 0;

                      return (
                        <div key={key} style={{
                          border: `1.5px solid ${hasFiles ? "#86efac" : "#e5e7eb"}`,
                          background: hasFiles ? "#f0fdf4" : "#fff",
                          borderRadius: "10px",
                          overflow: "hidden",
                        }}>
                          {/* Doc type header */}
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 14px",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span style={{ fontSize: "18px" }}>{icon}</span>
                              <div>
                                <p style={{ fontWeight: "600", fontSize: "14px", color: "#1a1a2e", margin: 0 }}>{label}</p>
                                <p style={{ fontSize: "11px", color: hasFiles ? "#15803d" : "#9ca3af", margin: 0, fontWeight: "600" }}>
                                  {hasFiles ? `${files.length} file${files.length > 1 ? "s" : ""} uploaded` : "No files uploaded"}
                                </p>
                              </div>
                            </div>

                            {/* Upload button */}
                            <label style={{
                              padding: "6px 12px",
                              background: uploading[key] ? "#f3f4f6" : "#f0f9ff",
                              border: "1.5px solid #7dd3fc",
                              borderRadius: "7px",
                              color: "#0369a1",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: uploading[key] ? "not-allowed" : "pointer",
                              display: "flex", alignItems: "center", gap: "4px",
                              whiteSpace: "nowrap",
                            }}>
                              {uploading[key] ? (
                                <>
                                  <span style={{ width:"10px",height:"10px",border:"2px solid #7dd3fc",borderTopColor:"#0369a1",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite" }}/>
                                  Uploading...
                                </>
                              ) : (
                                <>⬆ Upload</>
                              )}
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                                style={{ display: "none" }}
                                disabled={uploading[key]}
                                onChange={(e) => {
                                  if (e.target.files[0]) {
                                    handleUpload(key, e.target.files[0]);
                                    e.target.value = "";
                                  }
                                }}
                              />
                            </label>
                          </div>

                          {/* File list */}
                          {hasFiles && (
                            <div style={{ borderTop: "1px solid #dcfce7" }}>
                              {files.map((file, idx) => (
                                <div key={file.id} style={{
                                  display: "flex", alignItems: "center", gap: "10px",
                                  padding: "8px 14px",
                                  borderTop: idx > 0 ? "1px solid #f0fdf4" : "none",
                                  background: "#fff",
                                }}>
                                  {/* File icon */}
                                  <span style={{ fontSize: "16px", flexShrink: 0 }}>
                                    {file.mime_type === "application/pdf" ? "📑"
                                      : file.mime_type?.startsWith("image/") ? "🖼️"
                                      : "📄"}
                                  </span>

                                  {/* File info */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{
                                      fontSize: "13px", fontWeight: "600", color: "#1a1a2e",
                                      margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                    }}>
                                      {file.filename}
                                    </p>
                                    <p style={{ fontSize: "11px", color: "#9ca3af", margin: 0 }}>
                                      {formatFileSize(file.file_size)}
                                      {file.uploaded_at && ` · ${new Date(file.uploaded_at).toLocaleDateString("en-GB")}`}
                                    </p>
                                  </div>

                                  {/* Actions */}
                                  <button
                                    onClick={() => handleDownload(file.id, file.filename)}
                                    title="Download"
                                    style={{
                                      padding: "4px 10px", background: "#f0fdf4",
                                      border: "1px solid #86efac", borderRadius: "6px",
                                      color: "#15803d", fontSize: "12px", fontWeight: "600",
                                      cursor: "pointer", flexShrink: 0,
                                    }}
                                  >
                                    ⬇
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDoc(file.id)}
                                    title="Delete"
                                    style={{
                                      padding: "4px 10px", background: "#fef2f2",
                                      border: "1px solid #fecaca", borderRadius: "6px",
                                      color: "#dc2626", fontSize: "12px", fontWeight: "600",
                                      cursor: "pointer", flexShrink: 0,
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
