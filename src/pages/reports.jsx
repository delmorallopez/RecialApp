import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell
} from "recharts";
import "../stylecss/customers.css";
import "./reports.css";
import API from "../services/api";
import config from "../config";

const REPORT_SECTIONS = [
  {
    id: "traceability", label: "Traceability", icon: "🔗",
    reports: [{
      id: "mass_balance", title: "Mass Balance",
      description: "Complete mass balance report (ENTRADAS / MERMAS / SALIDAS) following the PG.09.01/REG-A format required for ISCC traceability certification.",
      format: "Excel (.xlsx)", icon: "⚖️", color: "#2d7a4f", bgColor: "#f0fdf4", borderColor: "#86efac",
    }],
  },
  {
    id: "operations", label: "Operations", icon: "🏭",
    reports: [
      { id: "receipts_summary",   title: "Receipts Summary",         description: "Summary of all UCO collections by supplier, date range and type (Horeca / Urban).",                             format: "View in modal",     icon: "📋", color: "#1d4ed8", bgColor: "#eff6ff", borderColor: "#93c5fd" },
      { id: "tank_stock",         title: "Tank Stock Report",         description: "Current and historical stock levels across all tanks with fill percentage and monthly trend.",                  format: "View in modal",     icon: "🛢️", color: "#7c3aed", bgColor: "#faf5ff", borderColor: "#c4b5fd" },
      { id: "urban_collection",   title: "Urban Collection Report",   description: "RESUMEN RECOGIDA URBANO — per supplier with each pickup point column, quantities per date and period totals.", format: "View + PDF",        icon: "🏙️", color: "#0369a1", bgColor: "#f0f9ff", borderColor: "#7dd3fc" },
    ],
  },
  {
    id: "commercial", label: "Commercial", icon: "📦",
    reports: [
      { id: "dispatches_summary", title: "Dispatches Summary",  description: "Summary of all dispatches by customer, date and quantity. Includes disposal records.",                                 format: "View in modal",  icon: "🚚", color: "#b45309", bgColor: "#fffbeb", borderColor: "#fcd34d" },
      { id: "customer_activity",  title: "Customer Activity",   description: "Sales activity per customer — total kg, revenue, order size, activity status and monthly trend.",                      format: "View in modal",  icon: "👥", color: "#0f766e", bgColor: "#f0fdfa", borderColor: "#99f6e4" },
      { id: "supplier_activity",  title: "Supplier Activity",   description: "Collection activity per supplier — total kg received, receipt count, activity status and monthly trend.",              format: "View in modal",  icon: "🏭", color: "#6d28d9", bgColor: "#faf5ff", borderColor: "#ddd6fe" },
      { id: "customers_list",     title: "Customers List",      description: "Full list of all customers with contact details. Preview in modal and download as PDF.",                               format: "View + PDF",     icon: "📋", color: "#0369a1", bgColor: "#f0f9ff", borderColor: "#7dd3fc" },
      { id: "suppliers_list",     title: "Suppliers List",      description: "Full list of all suppliers with type, contact details and Urban pickup points with GPS coordinates.",                  format: "View + PDF",     icon: "📋", color: "#059669", bgColor: "#f0fdf4", borderColor: "#6ee7b7" },
    ],
  },
  {
    id: "audit", label: "Audit", icon: "🔍",
    reports: [
      { id: "quarterly_closing",  title: "Quarterly Closing",   description: "CIERRES TRIMESTRALES — quarterly breakdown of entrances, losses (mermas) and dispatches grouped by quarter.",       format: "View + Excel",   icon: "📅", color: "#0369a1", bgColor: "#f0f9ff", borderColor: "#7dd3fc" },
      { id: "annual_summary",     title: "Annual Summary",      description: "Full year overview — monthly entrances, losses, dispatches, running stock, and Horeca / Urban split.",               format: "View in modal",  icon: "📆", color: "#0f172a", bgColor: "#f8fafc", borderColor: "#cbd5e1" },
      { id: "traceability_trace", title: "Batch Traceability",  description: "Full chain-of-custody trace, forward (Receipt→Dispatch) or backward (Dispatch→Receipt), with all batch IDs at each step.", format: "View + PDF",   icon: "🧬", color: "#9d174d", bgColor: "#fdf2f8", borderColor: "#fbcfe8" },
    ],
  },
];

const STATUS_STYLES = {
  active:   { bg: "#f0fdf4", color: "#15803d", border: "#86efac", label: "Active" },
  inactive: { bg: "#fffbeb", color: "#d97706", border: "#fcd34d", label: "Inactive" },
  dormant:  { bg: "#f9fafb", color: "#9ca3af", border: "#e5e7eb", label: "Dormant" },
};
const QUARTER_COLORS = ["#0369a1","#0f766e","#7c3aed","#b45309"];

export default function Reports() {
  const [activeSection, setActiveSection] = useState("traceability");
  const [generating, setGenerating] = useState(null);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  // ── Modal states ─────────────────────────────────────────
  const [summaryOpen,     setSummaryOpen]     = useState(false);
  const [summaryLoading,  setSummaryLoading]  = useState(false);
  const [summaryData,     setSummaryData]     = useState(null);
  const [summaryError,    setSummaryError]    = useState(null);
  const [summaryFilters,  setSummaryFilters]  = useState({ date_from:"", date_to:"", supplier_type:"", supplier_id:"" });

  const [tankOpen,        setTankOpen]        = useState(false);
  const [tankLoading,     setTankLoading]     = useState(false);
  const [tankData,        setTankData]        = useState(null);
  const [tankError,       setTankError]       = useState(null);
  const [selectedTank,    setSelectedTank]    = useState(null);
  const [tankYear,        setTankYear]        = useState(new Date().getFullYear());

  const [dispatchOpen,    setDispatchOpen]    = useState(false);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchData,    setDispatchData]    = useState(null);
  const [dispatchError,   setDispatchError]   = useState(null);
  const [dispatchFilters, setDispatchFilters] = useState({ date_from:"", date_to:"", customer_id:"" });

  const [customerOpen,    setCustomerOpen]    = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerData,    setCustomerData]    = useState(null);
  const [customerError,   setCustomerError]   = useState(null);
  const [customerFilters, setCustomerFilters] = useState({ date_from:"", date_to:"", customer_id:"", price_per_kg:"1.09" });
  const [expandedCustomer,setExpandedCustomer]= useState(null);

  const [supplierActOpen,    setSupplierActOpen]    = useState(false);
  const [supplierActLoading, setSupplierActLoading] = useState(false);
  const [supplierActData,    setSupplierActData]    = useState(null);
  const [supplierActError,   setSupplierActError]   = useState(null);
  const [supplierActFilters, setSupplierActFilters] = useState({ date_from:"", date_to:"", supplier_id:"", supplier_type:"" });
  const [expandedSupplier,   setExpandedSupplier]   = useState(null);

  const [quarterOpen,        setQuarterOpen]        = useState(false);
  const [quarterLoading,     setQuarterLoading]     = useState(false);
  const [quarterData,        setQuarterData]        = useState(null);
  const [quarterError,       setQuarterError]       = useState(null);
  const [quarterYear,        setQuarterYear]        = useState(new Date().getFullYear());
  const [downloadingQuarter, setDownloadingQuarter] = useState(false);

  const [annualOpen,    setAnnualOpen]    = useState(false);
  const [annualLoading, setAnnualLoading] = useState(false);
  const [annualData,    setAnnualData]    = useState(null);
  const [annualError,   setAnnualError]   = useState(null);
  const [annualYear,    setAnnualYear]    = useState(new Date().getFullYear());

  // ── Customers list ────────────────────────────────────────
  const [custListOpen,    setCustListOpen]    = useState(false);
  const [custListLoading, setCustListLoading] = useState(false);
  const [custListData,    setCustListData]    = useState(null);
  const [custListError,   setCustListError]   = useState(null);
  const [dlCustList,      setDlCustList]      = useState(false);

  // ── Suppliers list ────────────────────────────────────────
  const [suppListOpen,    setSuppListOpen]    = useState(false);
  const [suppListLoading, setSuppListLoading] = useState(false);
  const [suppListData,    setSuppListData]    = useState(null);
  const [suppListError,   setSuppListError]   = useState(null);
  const [dlSuppList,      setDlSuppList]      = useState(false);
  const [suppListFilters, setSuppListFilters] = useState({ supplier_type: "", supplier_id: "" });

  // ── Urban collection ──────────────────────────────────────
  const [urbanOpen,        setUrbanOpen]        = useState(false);
  const [urbanLoading,     setUrbanLoading]     = useState(false);
  const [urbanData,        setUrbanData]        = useState(null);
  const [urbanError,       setUrbanError]       = useState(null);
  const [urbanFilters,     setUrbanFilters]     = useState({
    supplier_id: "", date_from: "", date_to: "", period_label: "",
  });
  const [downloadingUrban, setDownloadingUrban] = useState(false);

  // ── Traceability ──────────────────────────────────────────
  const [traceOpen,       setTraceOpen]       = useState(false);
  const [traceDirection,  setTraceDirection]  = useState("forward"); // "forward" | "backward"
  const [traceSearchQ,    setTraceSearchQ]    = useState("");
  const [traceSearchRes,  setTraceSearchRes]  = useState(null);
  const [traceSearching,  setTraceSearching]  = useState(false);
  const [traceSelected,   setTraceSelected]   = useState(null); // {id, batch_id, type}
  const [traceData,       setTraceData]       = useState(null);
  const [traceLoading,    setTraceLoading]    = useState(false);
  const [traceError,      setTraceError]      = useState(null);
  const [dlTracePdf,      setDlTracePdf]      = useState(false);

  // ── Shared data ───────────────────────────────────────────
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    API.get("/suppliers/?limit=200").then((r) => setSuppliers(r.data.suppliers)).catch(() => {});
    API.get("/customers/?limit=200").then((r) => setCustomers(r.data.customers)).catch(() => {});
  }, []);

  const urbanSuppliers = suppliers.filter((s) => s.supplier_type === "Urban");
  const currentSection = REPORT_SECTIONS.find((s) => s.id === activeSection);

  // ── Route to handlers ────────────────────────────────────
  const handleGenerate = async (reportId) => {
    if (reportId === "receipts_summary")   { setSummaryOpen(true);     fetchReceiptsSummary(); return; }
    if (reportId === "tank_stock")         { setTankOpen(true);        fetchTankStock(tankYear); return; }
    if (reportId === "dispatches_summary") { setDispatchOpen(true);    fetchDispatchesSummary(); return; }
    if (reportId === "customer_activity")  { setCustomerOpen(true);    fetchCustomerActivity(); return; }
    if (reportId === "supplier_activity")  { setSupplierActOpen(true); fetchSupplierActivity(); return; }
    if (reportId === "quarterly_closing")  { setQuarterOpen(true);     fetchQuarterly(quarterYear); return; }
    if (reportId === "annual_summary")     { setAnnualOpen(true);      fetchAnnual(annualYear); return; }
    if (reportId === "traceability_trace") { setTraceOpen(true); return; }
    if (reportId === "customers_list")     { setCustListOpen(true); fetchCustList(); return; }
    if (reportId === "suppliers_list")     { setSuppListOpen(true); fetchSuppList(); return; }
    if (reportId === "urban_collection")   { setUrbanOpen(true); return; }

    setGenerating(reportId); setError(null); setSuccess(null);
    try {
      const res = await fetch(`http://localhost:8000/reports/mass-balance?year=${yearFilter}`,
        { method:"GET", headers:{ Authorization:`Bearer ${localStorage.getItem("token")}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href=url; a.download=`MassBalance_Recial_${yearFilter}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess(`Mass Balance ${yearFilter} downloaded!`);
    } catch { setError("Could not generate report."); }
    finally { setGenerating(null); }
  };

  // ── Fetchers ─────────────────────────────────────────────
  const fetchReceiptsSummary = async (f = summaryFilters) => {
    setSummaryLoading(true); setSummaryError(null);
    try { const p=new URLSearchParams(); if(f.date_from)p.append("date_from",f.date_from); if(f.date_to)p.append("date_to",f.date_to); if(f.supplier_type)p.append("supplier_type",f.supplier_type); if(f.supplier_id)p.append("supplier_id",f.supplier_id); const res=await API.get(`/reports/receipts-summary?${p}`); setSummaryData(res.data); }
    catch { setSummaryError("Could not load receipts summary."); }
    finally { setSummaryLoading(false); }
  };

  const fetchTankStock = async (yr = tankYear) => {
    setTankLoading(true); setTankError(null);
    try { const res=await API.get(`/reports/tank-stock?year=${yr}`); setTankData(res.data); if(res.data.tanks?.length>0)setSelectedTank(res.data.tanks[0].id); }
    catch { setTankError("Could not load tank stock data."); }
    finally { setTankLoading(false); }
  };

  const fetchDispatchesSummary = async (f = dispatchFilters) => {
    setDispatchLoading(true); setDispatchError(null);
    try { const p=new URLSearchParams(); if(f.date_from)p.append("date_from",f.date_from); if(f.date_to)p.append("date_to",f.date_to); if(f.customer_id)p.append("customer_id",f.customer_id); const res=await API.get(`/reports/dispatches-summary?${p}`); setDispatchData(res.data); }
    catch { setDispatchError("Could not load dispatches summary."); }
    finally { setDispatchLoading(false); }
  };

  const fetchCustomerActivity = async (f = customerFilters) => {
    setCustomerLoading(true); setCustomerError(null);
    try { const p=new URLSearchParams(); if(f.date_from)p.append("date_from",f.date_from); if(f.date_to)p.append("date_to",f.date_to); if(f.customer_id)p.append("customer_id",f.customer_id); if(f.price_per_kg)p.append("price_per_kg",f.price_per_kg); const res=await API.get(`/reports/customer-activity?${p}`); setCustomerData(res.data); }
    catch { setCustomerError("Could not load customer activity."); }
    finally { setCustomerLoading(false); }
  };

  const fetchSupplierActivity = async (f = supplierActFilters) => {
    setSupplierActLoading(true); setSupplierActError(null);
    try { const p=new URLSearchParams(); if(f.date_from)p.append("date_from",f.date_from); if(f.date_to)p.append("date_to",f.date_to); if(f.supplier_id)p.append("supplier_id",f.supplier_id); if(f.supplier_type)p.append("supplier_type",f.supplier_type); const res=await API.get(`/reports/supplier-activity?${p}`); setSupplierActData(res.data); }
    catch { setSupplierActError("Could not load supplier activity."); }
    finally { setSupplierActLoading(false); }
  };

  const fetchQuarterly = async (yr = quarterYear) => {
    setQuarterLoading(true); setQuarterError(null);
    try { const res=await API.get(`/reports/quarterly-closing?year=${yr}`); setQuarterData(res.data); }
    catch { setQuarterError("Could not load quarterly data."); }
    finally { setQuarterLoading(false); }
  };

  const fetchAnnual = async (yr = annualYear) => {
    setAnnualLoading(true); setAnnualError(null);
    try { const res=await API.get(`/reports/annual-summary?year=${yr}`); setAnnualData(res.data); }
    catch { setAnnualError("Could not load annual summary."); }
    finally { setAnnualLoading(false); }
  };

  const fetchCustList = async () => {
    setCustListLoading(true); setCustListError(null);
    try { const res = await API.get("/reports/customers-list"); setCustListData(res.data); }
    catch { setCustListError("Could not load customers."); }
    finally { setCustListLoading(false); }
  };

  const fetchSuppList = async (f = suppListFilters) => {
    setSuppListLoading(true); setSuppListError(null);
    try {
      const p = new URLSearchParams();
      if (f.supplier_type) p.append("supplier_type", f.supplier_type);
      if (f.supplier_id)   p.append("supplier_id",   f.supplier_id);
      const res = await API.get(`/reports/suppliers-list?${p}`);
      setSuppListData(res.data);
    } catch { setSuppListError("Could not load suppliers."); }
    finally { setSuppListLoading(false); }
  };

  const downloadCustListPdf = async () => {
    setDlCustList(true);
    try {
      const res = await fetch(`${config.apiUrl}/reports/customers-list/pdf`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      const blob = await res.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "Recial_Customers.pdf"; document.body.appendChild(a); a.click(); a.remove();
    } catch { setCustListError("Could not download PDF."); }
    finally { setDlCustList(false); }
  };

  const downloadSuppListPdf = async () => {
    setDlSuppList(true);
    try {
      const p = new URLSearchParams();
      if (suppListFilters.supplier_type) p.append("supplier_type", suppListFilters.supplier_type);
      if (suppListFilters.supplier_id)   p.append("supplier_id",   suppListFilters.supplier_id);
      const res = await fetch(`${config.apiUrl}/reports/suppliers-list/pdf?${p}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      const blob = await res.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "Recial_Suppliers.pdf"; document.body.appendChild(a); a.click(); a.remove();
    } catch { setSuppListError("Could not download PDF."); }
    finally { setDlSuppList(false); }
  };

  const fetchUrbanCollection = async (f = urbanFilters) => {
    if (!f.supplier_id) return;
    setUrbanLoading(true); setUrbanError(null);
    try {
      const p = new URLSearchParams();
      if (f.date_from) p.append("date_from", f.date_from);
      if (f.date_to)   p.append("date_to",   f.date_to);
      const res = await API.get(`/reports/urban-collection/${f.supplier_id}?${p}`);
      setUrbanData(res.data);
    } catch { setUrbanError("Could not load urban collection data."); }
    finally { setUrbanLoading(false); }
  };

  const downloadUrbanPdf = async () => {
    setDownloadingUrban(true);
    try {
      const p = new URLSearchParams();
      if (urbanFilters.date_from)    p.append("date_from",    urbanFilters.date_from);
      if (urbanFilters.date_to)      p.append("date_to",      urbanFilters.date_to);
      if (urbanFilters.period_label) p.append("period_label", urbanFilters.period_label);
      const res = await fetch(
        `http://localhost:8000/reports/urban-collection/${urbanFilters.supplier_id}/pdf?${p}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `RecogidaUrbano_${urbanData?.supplier_name || "report"}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { setUrbanError("Could not download PDF."); }
    finally { setDownloadingUrban(false); }
  };

  const downloadQuarterlyExcel = async () => {
    setDownloadingQuarter(true);
    try {
      const res = await fetch(`http://localhost:8000/reports/quarterly-closing/excel?year=${quarterYear}`,
        { headers:{ Authorization:`Bearer ${localStorage.getItem("token")}` } });
      if (!res.ok) throw new Error();
      const blob=await res.blob(); const url=window.URL.createObjectURL(blob);
      const a=document.createElement("a"); a.href=url; a.download=`CierresTrimestrales_${quarterYear}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch { setQuarterError("Could not download Excel."); }
    finally { setDownloadingQuarter(false); }
  };

  // ── Traceability ──────────────────────────────────────────
  const searchTraceBatch = async (q) => {
    setTraceSearchQ(q);
    if (!q || q.length < 2) { setTraceSearchRes(null); return; }
    setTraceSearching(true);
    try {
      const res = await API.get(`/traceability/search?q=${encodeURIComponent(q)}`);
      setTraceSearchRes(res.data);
    } catch { setTraceSearchRes(null); }
    finally { setTraceSearching(false); }
  };

  const selectTraceBatch = (item) => {
    setTraceSelected(item);
    setTraceSearchRes(null);
    setTraceSearchQ(item.batch_id);
    if (item.type === "receipt") setTraceDirection("forward");
    if (item.type === "dispatch") setTraceDirection("backward");
    fetchTrace(item, item.type === "receipt" ? "forward" : item.type === "dispatch" ? "backward" : traceDirection);
  };

  const fetchTrace = async (item = traceSelected, direction = traceDirection) => {
    if (!item) return;
    setTraceLoading(true); setTraceError(null); setTraceData(null);
    try {
      const endpoint = direction === "forward" ? `/traceability/forward/${item.id}` : `/traceability/backward/${item.id}`;
      const res = await API.get(endpoint);
      setTraceData(res.data);
    } catch (err) {
      setTraceError(err.response?.data?.detail || "Could not trace this batch. Make sure it matches the trace direction (Receipt for forward, Dispatch for backward).");
    } finally {
      setTraceLoading(false);
    }
  };

  const downloadTracePdf = async () => {
    if (!traceSelected) return;
    setDlTracePdf(true);
    try {
      const endpoint = traceDirection === "forward"
        ? `/traceability/forward/${traceSelected.id}/pdf`
        : `/traceability/backward/${traceSelected.id}/pdf`;
      const res = await fetch(`${config.apiUrl}${endpoint}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      const blob = await res.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `Trace_${traceDirection}_${traceSelected.batch_id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch { setTraceError("Could not download PDF."); }
    finally { setDlTracePdf(false); }
  };

  const resetTrace = () => {
    setTraceSelected(null); setTraceData(null); setTraceSearchQ(""); setTraceSearchRes(null); setTraceError(null);
  };

  // ── Helpers ──────────────────────────────────────────────
  const fmt = (d) => { if(!d)return"—"; const[y,m,day]=d.split("-"); return`${day}/${m}/${y}`; };
  const fmtEur = (v) => `${v?.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})} €`;
  const stockColor = (p) => p>=90?"#dc2626":p>=70?"#f59e0b":"#2d7a4f";

  const TypeBadge = ({ type }) => (
    <span style={{background:type==="Horeca"?"#eff6ff":"#f0fdf4",color:type==="Horeca"?"#1d4ed8":"#15803d",padding:"2px 8px",borderRadius:"999px",fontSize:"11px",fontWeight:"700"}}>{type}</span>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if(!active||!payload?.length)return null;
    return (<div style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:"10px",padding:"10px 14px",fontSize:"13px"}}><p style={{fontWeight:"700",color:"#1a1a2e",margin:"0 0 6px"}}>{label}</p>{payload.map((p)=><p key={p.name} style={{color:p.color,margin:"2px 0"}}>{p.name}: <strong>{(p.value||0).toLocaleString()}</strong></p>)}</div>);
  };

  const selectedTankData = tankData?.tanks?.find((t) => t.id === selectedTank);

  const btnLabel = (id) => {
    const modal = ["receipts_summary","tank_stock","dispatches_summary","customer_activity","supplier_activity","quarterly_closing","annual_summary","urban_collection","customers_list","suppliers_list","traceability_trace"];
    return modal.includes(id) ? "📊 View Report" : `⬇ Download ${yearFilter}`;
  };

  const ActivityRow = ({ item, rank, isExpanded, onToggle, accentColor, pct, metricLabel, metricValue, avgLabel, avgValue }) => {
    const ss = STATUS_STYLES[item.status]||STATUS_STYLES.dormant;
    return (
      <div style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:"12px",overflow:"hidden"}}>
        <div onClick={onToggle} style={{display:"flex",alignItems:"center",gap:"16px",padding:"16px 20px",cursor:"pointer"}}>
          <div style={{width:"32px",height:"32px",borderRadius:"50%",background:rank===0?"#fef9c3":rank===1?"#f3f4f6":rank===2?"#fef3ec":"#f8fafc",border:`2px solid ${rank===0?"#fbbf24":rank===1?"#9ca3af":rank===2?"#f97316":"#e5e7eb"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:"800",color:rank===0?"#d97706":rank===1?"#6b7280":rank===2?"#f97316":"#9ca3af",flexShrink:0}}>#{rank+1}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"4px",flexWrap:"wrap"}}>
              <p style={{fontWeight:"700",fontSize:"15px",color:"#1a1a2e",margin:0}}>{item.supplier_name||item.customer_name}</p>
              {item.supplier_type&&<TypeBadge type={item.supplier_type}/>}
              <span style={{background:ss.bg,color:ss.color,border:`1px solid ${ss.border}`,padding:"2px 8px",borderRadius:"999px",fontSize:"11px",fontWeight:"700"}}>{ss.label}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              <div style={{width:"120px",height:"5px",background:"#f3f4f6",borderRadius:"999px",overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:accentColor,borderRadius:"999px"}}/></div>
              <span style={{fontSize:"11px",color:"#9ca3af"}}>{pct}% of total</span>
            </div>
          </div>
          <div style={{display:"flex",gap:"24px",alignItems:"center",flexShrink:0}}>
            <div style={{textAlign:"right"}}><p style={{fontSize:"11px",color:"#9ca3af",margin:"0 0 2px"}}>TOTAL KG</p><p style={{fontSize:"16px",fontWeight:"800",color:"#2d7a4f",margin:0}}>{item.total_kg.toLocaleString()}</p></div>
            <div style={{textAlign:"right"}}><p style={{fontSize:"11px",color:"#9ca3af",margin:"0 0 2px"}}>{metricLabel}</p><p style={{fontSize:"16px",fontWeight:"800",color:accentColor,margin:0}}>{metricValue}</p></div>
            <div style={{textAlign:"right"}}><p style={{fontSize:"11px",color:"#9ca3af",margin:"0 0 2px"}}>{avgLabel}</p><p style={{fontSize:"14px",fontWeight:"700",color:"#374151",margin:0}}>{avgValue} kg</p></div>
            <span style={{fontSize:"14px",color:"#9ca3af",transform:isExpanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s",display:"inline-block"}}>▼</span>
          </div>
        </div>
        {isExpanded&&(<div style={{borderTop:"1px solid #f3f4f6",padding:"16px 20px",background:"#f8fafc"}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}><div style={{display:"flex",flexDirection:"column",gap:"10px"}}>{[["First date",fmt(item.first_date)],["Last date",fmt(item.last_date)],["Days since last",`${item.days_since_last} days`],["Best month",item.best_month],[metricLabel,metricValue]].map(([l,v])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff",borderRadius:"8px",padding:"8px 12px",border:"1px solid #e5e7eb"}}><span style={{fontSize:"13px",color:"#6b7280"}}>{l}</span><span style={{fontSize:"13px",fontWeight:"700",color:"#1a1a2e"}}>{v}</span></div>))}</div><div style={{background:"#fff",borderRadius:"10px",padding:"14px",border:"1px solid #e5e7eb"}}><p style={{fontWeight:"600",fontSize:"13px",color:"#374151",margin:"0 0 12px"}}>Monthly Trend (kg)</p>{item.monthly_trend?.length>0?(<ResponsiveContainer width="100%" height={140}><BarChart data={item.monthly_trend} margin={{top:2,right:4,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/><XAxis dataKey="label" tick={{fontSize:10,fill:"#9ca3af"}}/><YAxis tick={{fontSize:10,fill:"#9ca3af"}}/><Tooltip formatter={(v)=>[`${v.toLocaleString()} kg`,"kg"]}/><Bar dataKey="kg" radius={[3,3,0,0]}>{item.monthly_trend.map((_,i)=><Cell key={i} fill={i===item.monthly_trend.length-1?accentColor:`${accentColor}55`}/>)}</Bar></BarChart></ResponsiveContainer>):<p style={{color:"#9ca3af",fontSize:"13px",textAlign:"center",padding:"20px 0"}}>No monthly data</p>}</div></div></div>)}
      </div>
    );
  };

  const QuarterCard = ({ q, color }) => (
    <div style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:"12px",overflow:"hidden"}}>
      <div style={{background:color,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <p style={{fontWeight:"700",fontSize:"15px",color:"#fff",margin:0}}>{q.label}</p>
        <div style={{display:"flex",gap:"16px"}}>
          <div style={{textAlign:"right"}}><p style={{fontSize:"10px",color:"rgba(255,255,255,0.7)",margin:"0 0 1px"}}>TOTAL</p><p style={{fontSize:"14px",fontWeight:"800",color:"#fff",margin:0}}>{q.total_kg.toLocaleString()} kg</p></div>
          <div style={{textAlign:"right"}}><p style={{fontSize:"10px",color:"rgba(255,255,255,0.7)",margin:"0 0 1px"}}>SALIDAS</p><p style={{fontSize:"14px",fontWeight:"800",color:"#fde68a",margin:0}}>{q.salidas.toLocaleString()} kg</p></div>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",padding:"8px 16px",background:"#fffbeb",borderBottom:"1px solid #fde68a"}}>
        <span style={{fontSize:"13px",fontWeight:"600",color:"#92400e"}}>📦 Stock inicial</span>
        <span style={{fontSize:"13px",fontWeight:"700",color:"#92400e"}}>{q.opening_stock.toLocaleString()} kg</span>
      </div>
      {q.months.map((m,idx)=>(
        <div key={m.name} style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 16px",borderBottom:idx<q.months.length-1?"1px solid #f3f4f6":"none",background:m.mermas>0?"#fef9f0":"#fff"}}>
          <span style={{fontSize:"13px",fontWeight:"600",color:"#374151",minWidth:"90px"}}>{m.name}</span>
          <div style={{flex:1}}><div style={{height:"6px",background:"#f3f4f6",borderRadius:"999px",overflow:"hidden"}}><div style={{width:`${q.total_kg>0?(m.total/q.total_kg)*100:0}%`,height:"100%",background:color,borderRadius:"999px",opacity:0.7}}/></div></div>
          <span style={{fontSize:"12px",color:"#9ca3af",minWidth:"80px",textAlign:"right"}}>{m.kg_brutos.toLocaleString()} kg</span>
          {m.mermas>0&&<span style={{fontSize:"11px",color:"#dc2626",fontWeight:"600",background:"#fef2f2",padding:"1px 6px",borderRadius:"4px"}}>-{m.mermas} mermas</span>}
          <span style={{fontSize:"13px",fontWeight:"700",color:"#1a1a2e",minWidth:"60px",textAlign:"right"}}>{m.total.toLocaleString()} kg</span>
        </div>
      ))}
      <div style={{display:"flex",justifyContent:"space-between",padding:"8px 16px",background:"#f0fdf4",borderTop:`2px solid ${color}`}}>
        <span style={{fontSize:"13px",fontWeight:"600",color:"#15803d"}}>🏁 Stock final</span>
        <span style={{fontSize:"13px",fontWeight:"700",color:"#15803d"}}>{q.ending_stock.toLocaleString()} kg</span>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h1 className="customers-title">Reports</h1>
          <p className="customers-subtitle">Generate and download reports for traceability, operations, commercial and audit</p>
        </div>
        <div className="reports-year-selector">
          <label>Year</label>
          <select value={yearFilter} onChange={(e) => setYearFilter(parseInt(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {success&&<div className="reports-success-banner">✓ {success}<button onClick={()=>setSuccess(null)}>✕</button></div>}
      {error&&<div className="error-banner" style={{marginBottom:"20px"}}>{error}</div>}

      <div className="reports-layout">
        <aside className="reports-sidebar">
          <p className="reports-sidebar-label">Categories</p>
          {REPORT_SECTIONS.map((s)=>(
            <button key={s.id} className={`reports-sidebar-item ${activeSection===s.id?"active":""}`} onClick={()=>setActiveSection(s.id)}>
              <span className="reports-sidebar-icon">{s.icon}</span>
              <span>{s.label}</span>
              <span className="reports-sidebar-count">{s.reports.length}</span>
            </button>
          ))}
        </aside>

        <div className="reports-content">
          <h2 className="reports-section-title">{currentSection?.icon} {currentSection?.label} Reports</h2>
          <div className="reports-cards-grid">
            {currentSection?.reports.map((report)=>(
              <div key={report.id} className="report-card" style={{borderColor:report.borderColor,background:report.bgColor}}>
                <div className="report-card-header">
                  <div className="report-card-icon" style={{background:report.color}}>{report.icon}</div>
                  <div style={{flex:1}}><h3 className="report-card-title" style={{color:report.color}}>{report.title}</h3><span className="report-card-format">{report.format}</span></div>
                  {report.comingSoon&&<span className="report-card-soon">Coming soon</span>}
                </div>
                <p className="report-card-description">{report.description}</p>
                <div className="report-card-footer">
                  <span className="report-card-period">Period: <strong>{yearFilter}</strong></span>
                  <button className="report-card-btn" style={{background:report.comingSoon?"#e5e7eb":report.color,cursor:report.comingSoon?"not-allowed":"pointer"}} disabled={report.comingSoon||generating===report.id} onClick={()=>!report.comingSoon&&handleGenerate(report.id)}>
                    {generating===report.id?<span className="report-btn-loading">Generating...</span>:report.comingSoon?"Not available yet":btnLabel(report.id)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ RECEIPTS SUMMARY ══ */}
      {summaryOpen&&(
        <div className="modal-overlay" onClick={()=>setSummaryOpen(false)}>
          <div className="modal" style={{maxWidth:"900px",maxHeight:"90vh",overflowY:"auto"}} onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header" style={{position:"sticky",top:0,background:"#fff",zIndex:9}}><div><h2>📋 Receipts Summary</h2><p style={{fontSize:"13px",color:"#6b7280",margin:"2px 0 0"}}>UCO collections by supplier</p></div><button className="modal-close" onClick={()=>setSummaryOpen(false)}>✕</button></div>
            <div style={{padding:"16px 24px 24px"}}>
              <div style={{display:"flex",gap:"12px",alignItems:"flex-end",background:"#f8fafc",border:"1.5px solid #e5e7eb",borderRadius:"10px",padding:"14px 16px",marginBottom:"20px",flexWrap:"wrap"}}>
                {[["From","date_from"],["To","date_to"]].map(([l,k])=>(<div key={k}><label style={{fontSize:"12px",fontWeight:"600",color:"#374151",display:"block",marginBottom:"4px"}}>{l}</label><input type="date" value={summaryFilters[k]} onChange={(e)=>{const f={...summaryFilters,[k]:e.target.value};setSummaryFilters(f);fetchReceiptsSummary(f);}} style={{padding:"7px 10px",border:"1.5px solid #e5e7eb",borderRadius:"7px",fontSize:"14px"}}/></div>))}
                <div><label style={{fontSize:"12px",fontWeight:"600",color:"#374151",display:"block",marginBottom:"4px"}}>Type</label><select value={summaryFilters.supplier_type} onChange={(e)=>{const f={...summaryFilters,supplier_type:e.target.value,supplier_id:""};setSummaryFilters(f);fetchReceiptsSummary(f);}} style={{padding:"7px 10px",border:"1.5px solid #e5e7eb",borderRadius:"7px",fontSize:"14px",background:"#fff"}}><option value="">All types</option><option value="Horeca">Horeca</option><option value="Urban">Urban</option></select></div>
                <div><label style={{fontSize:"12px",fontWeight:"600",color:"#374151",display:"block",marginBottom:"4px"}}>Supplier</label><select value={summaryFilters.supplier_id} onChange={(e)=>{const f={...summaryFilters,supplier_id:e.target.value};setSummaryFilters(f);fetchReceiptsSummary(f);}} style={{padding:"7px 10px",border:"1.5px solid #e5e7eb",borderRadius:"7px",fontSize:"14px",background:"#fff",minWidth:"160px"}}><option value="">All suppliers</option>{suppliers.filter((s)=>!summaryFilters.supplier_type||s.supplier_type===summaryFilters.supplier_type).map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                {Object.values(summaryFilters).some(Boolean)&&<button onClick={()=>{const f={date_from:"",date_to:"",supplier_type:"",supplier_id:""};setSummaryFilters(f);fetchReceiptsSummary(f);}} style={{padding:"7px 14px",borderRadius:"7px",border:"1.5px solid #e5e7eb",background:"#fff",color:"#6b7280",fontSize:"13px",cursor:"pointer"}}>Clear</button>}
              </div>
              {summaryData&&(<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px",marginBottom:"20px"}}>{[{label:"Receipts",value:summaryData.total_receipts,color:"#1d4ed8",icon:"📋"},{label:"Total kg",value:`${summaryData.total_kg?.toLocaleString()} kg`,color:"#2d7a4f",icon:"⚖️"},{label:"Horeca kg",value:`${summaryData.horeca_kg?.toLocaleString()} kg`,color:"#1d4ed8",icon:"🍽️"},{label:"Urban kg",value:`${summaryData.urban_kg?.toLocaleString()} kg`,color:"#15803d",icon:"🏙️"}].map(({label,value,color,icon})=>(<div key={label} style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:"10px",padding:"14px 16px"}}><p style={{fontSize:"11px",color:"#9ca3af",fontWeight:"600",textTransform:"uppercase",margin:"0 0 6px"}}>{icon} {label}</p><p style={{fontSize:"20px",fontWeight:"800",color,margin:0}}>{value}</p></div>))}</div>)}
              {summaryLoading?<p style={{textAlign:"center",color:"#9ca3af",padding:"40px 0"}}>Loading...</p>:summaryError?<div className="error-banner">{summaryError}</div>:!summaryData?.suppliers?.length?<p style={{textAlign:"center",color:"#9ca3af",padding:"40px 0"}}>No receipts found.</p>:(
                <div className="table-wrapper" style={{margin:0}}><table className="customers-table"><thead><tr><th>Supplier</th><th>Type</th><th>Receipts</th><th>First</th><th>Last</th><th>Total (kg)</th><th>%</th></tr></thead><tbody>{summaryData.suppliers.map((s)=>{const pct=summaryData.total_kg>0?((s.total_kg/summaryData.total_kg)*100).toFixed(1):0;return(<tr key={s.supplier_id} className="table-row"><td className="td-name">{s.supplier_name}</td><td><TypeBadge type={s.supplier_type}/></td><td style={{textAlign:"center",fontWeight:"600"}}>{s.receipts_count}</td><td style={{color:"#6b7280",fontSize:"13px"}}>{fmt(s.first_date)}</td><td style={{color:"#6b7280",fontSize:"13px"}}>{fmt(s.last_date)}</td><td style={{fontWeight:"700",color:"#2d7a4f"}}>{s.total_kg.toLocaleString()} kg</td><td><div style={{display:"flex",alignItems:"center",gap:"8px"}}><div style={{flex:1,height:"6px",background:"#f3f4f6",borderRadius:"999px",overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:s.supplier_type==="Horeca"?"#1d4ed8":"#2d7a4f",borderRadius:"999px"}}/></div><span style={{fontSize:"12px",color:"#6b7280",fontWeight:"600",minWidth:"36px"}}>{pct}%</span></div></td></tr>);})}</tbody><tfoot><tr style={{background:"#f8fafc",borderTop:"2px solid #e5e7eb"}}><td colSpan={2} style={{padding:"12px 16px",fontWeight:"600",color:"#6b7280",fontSize:"13px"}}>TOTAL ({summaryData.suppliers.length})</td><td style={{padding:"12px 16px",fontWeight:"700",textAlign:"center"}}>{summaryData.total_receipts}</td><td colSpan={2}/><td style={{padding:"12px 16px",fontWeight:"800",color:"#2d7a4f",fontSize:"15px"}}>{summaryData.total_kg?.toLocaleString()} kg</td><td style={{padding:"12px 16px",fontWeight:"700"}}>100%</td></tr></tfoot></table></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ TANK STOCK ══ */}
      {tankOpen&&(
        <div className="modal-overlay" onClick={()=>setTankOpen(false)}>
          <div className="modal" style={{maxWidth:"960px",maxHeight:"92vh",overflowY:"auto"}} onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header" style={{position:"sticky",top:0,background:"#fff",zIndex:9}}>
              <div><h2>🛢️ Tank Stock Report</h2><p style={{fontSize:"13px",color:"#6b7280",margin:"2px 0 0"}}>Monthly stock from entrances and dispatches</p></div>
              <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                <select value={tankYear} onChange={(e)=>{setTankYear(parseInt(e.target.value));fetchTankStock(parseInt(e.target.value));}} style={{padding:"7px 12px",border:"1.5px solid #e5e7eb",borderRadius:"7px",fontSize:"14px",fontWeight:"600"}}>{years.map((y)=><option key={y} value={y}>{y}</option>)}</select>
                <button className="modal-close" onClick={()=>setTankOpen(false)}>✕</button>
              </div>
            </div>
            <div style={{padding:"16px 24px 24px"}}>
              {tankLoading?<p style={{textAlign:"center",color:"#9ca3af",padding:"40px 0"}}>Loading...</p>:tankError?<div className="error-banner">{tankError}</div>:!tankData?.tanks?.length?<p style={{textAlign:"center",color:"#9ca3af",padding:"40px 0"}}>No tanks found.</p>:(
                <><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"12px",marginBottom:"24px"}}>{tankData.tanks.map((t)=>{const color=stockColor(t.current_pct);return(<div key={t.id} onClick={()=>setSelectedTank(t.id)} style={{background:selectedTank===t.id?"#faf5ff":"#fff",border:`1.5px solid ${selectedTank===t.id?"#c4b5fd":"#e5e7eb"}`,borderRadius:"12px",padding:"16px",cursor:"pointer"}}><p style={{fontWeight:"700",fontSize:"15px",color:"#1a1a2e",margin:"0 0 8px"}}>{t.name}</p><p style={{fontWeight:"800",fontSize:"22px",color,margin:"0 0 8px"}}>{(t.current_stock||0).toLocaleString()} kg</p>{t.capacity>0&&(<><div style={{height:"6px",background:"#f3f4f6",borderRadius:"999px",overflow:"hidden",marginBottom:"4px"}}><div style={{width:`${Math.min(t.current_pct,100)}%`,height:"100%",background:color,borderRadius:"999px"}}/></div><p style={{fontSize:"12px",color,fontWeight:"600",margin:0}}>{t.current_pct}% · {t.capacity.toLocaleString()} kg</p></>)}<div style={{display:"flex",gap:"12px",marginTop:"10px"}}><div><p style={{fontSize:"10px",color:"#9ca3af",margin:"0 0 2px"}}>IN {tankYear}</p><p style={{fontSize:"13px",fontWeight:"700",color:"#2d7a4f",margin:0}}>+{t.total_in.toLocaleString()} kg</p></div><div><p style={{fontSize:"10px",color:"#9ca3af",margin:"0 0 2px"}}>OUT {tankYear}</p><p style={{fontSize:"13px",fontWeight:"700",color:"#dc2626",margin:0}}>-{t.total_out.toLocaleString()} kg</p></div></div></div>);})}
                </div>
                {selectedTankData&&(<><div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"16px"}}><h3 style={{fontSize:"16px",fontWeight:"700",color:"#1a1a2e",margin:0}}>{selectedTankData.name} — {tankYear}</h3><span style={{fontSize:"12px",color:"#9ca3af"}}>click a card to switch</span></div><div style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:"12px",padding:"20px",marginBottom:"20px"}}><p style={{fontWeight:"600",fontSize:"14px",color:"#374151",margin:"0 0 16px"}}>Entrances vs Out</p><ResponsiveContainer width="100%" height={220}><BarChart data={selectedTankData.monthly} margin={{top:4,right:8,left:0,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/><XAxis dataKey="label" tick={{fontSize:12,fill:"#6b7280"}}/><YAxis tick={{fontSize:12,fill:"#6b7280"}}/><Tooltip content={<CustomTooltip/>}/><Legend wrapperStyle={{fontSize:"12px"}}/><Bar dataKey="added" name="In (kg)" fill="#2d7a4f" radius={[3,3,0,0]}/><Bar dataKey="removed" name="Out (kg)" fill="#dc2626" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div><div style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:"12px",padding:"20px",marginBottom:"20px"}}><p style={{fontWeight:"600",fontSize:"14px",color:"#374151",margin:"0 0 16px"}}>Running Stock</p><ResponsiveContainer width="100%" height={200}><LineChart data={selectedTankData.monthly} margin={{top:4,right:8,left:0,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/><XAxis dataKey="label" tick={{fontSize:12,fill:"#6b7280"}}/><YAxis tick={{fontSize:12,fill:"#6b7280"}}/><Tooltip content={<CustomTooltip/>}/><Line type="monotone" dataKey="stock" name="Stock (kg)" stroke="#7c3aed" strokeWidth={2.5} dot={{r:4,fill:"#7c3aed"}}/></LineChart></ResponsiveContainer></div></>)}</>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ DISPATCHES SUMMARY ══ */}
      {dispatchOpen&&(
        <div className="modal-overlay" onClick={()=>setDispatchOpen(false)}>
          <div className="modal" style={{maxWidth:"900px",maxHeight:"90vh",overflowY:"auto"}} onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header" style={{position:"sticky",top:0,background:"#fff",zIndex:9}}><div><h2>🚚 Dispatches Summary</h2><p style={{fontSize:"13px",color:"#6b7280",margin:"2px 0 0"}}>All dispatches by customer</p></div><button className="modal-close" onClick={()=>setDispatchOpen(false)}>✕</button></div>
            <div style={{padding:"16px 24px 24px"}}>
              <div style={{display:"flex",gap:"12px",alignItems:"flex-end",background:"#fffbeb",border:"1.5px solid #fcd34d",borderRadius:"10px",padding:"14px 16px",marginBottom:"20px",flexWrap:"wrap"}}>
                {[["From","date_from"],["To","date_to"]].map(([l,k])=>(<div key={k}><label style={{fontSize:"12px",fontWeight:"600",color:"#374151",display:"block",marginBottom:"4px"}}>{l}</label><input type="date" value={dispatchFilters[k]} onChange={(e)=>{const f={...dispatchFilters,[k]:e.target.value};setDispatchFilters(f);fetchDispatchesSummary(f);}} style={{padding:"7px 10px",border:"1.5px solid #e5e7eb",borderRadius:"7px",fontSize:"14px"}}/></div>))}
                <div><label style={{fontSize:"12px",fontWeight:"600",color:"#374151",display:"block",marginBottom:"4px"}}>Customer</label><select value={dispatchFilters.customer_id} onChange={(e)=>{const f={...dispatchFilters,customer_id:e.target.value};setDispatchFilters(f);fetchDispatchesSummary(f);}} style={{padding:"7px 10px",border:"1.5px solid #e5e7eb",borderRadius:"7px",fontSize:"14px",background:"#fff",minWidth:"180px"}}><option value="">All customers</option>{customers.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                {Object.values(dispatchFilters).some(Boolean)&&<button onClick={()=>{const f={date_from:"",date_to:"",customer_id:""};setDispatchFilters(f);fetchDispatchesSummary(f);}} style={{padding:"7px 14px",borderRadius:"7px",border:"1.5px solid #e5e7eb",background:"#fff",color:"#6b7280",fontSize:"13px",cursor:"pointer"}}>Clear</button>}
              </div>
              {dispatchData&&(<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px",marginBottom:"20px"}}>{[{label:"Dispatches",value:dispatchData.total_dispatches,color:"#b45309",icon:"🚚"},{label:"Total kg",value:`${dispatchData.total_kg?.toLocaleString()} kg`,color:"#2d7a4f",icon:"⚖️"},{label:"Disposal kg",value:`${dispatchData.total_disposal_kg?.toLocaleString()} kg`,color:"#dc2626",icon:"♻️"}].map(({label,value,color,icon})=>(<div key={label} style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:"10px",padding:"14px 16px"}}><p style={{fontSize:"11px",color:"#9ca3af",fontWeight:"600",textTransform:"uppercase",margin:"0 0 6px"}}>{icon} {label}</p><p style={{fontSize:"20px",fontWeight:"800",color,margin:0}}>{value}</p></div>))}</div>)}
              {dispatchLoading?<p style={{textAlign:"center",color:"#9ca3af",padding:"40px 0"}}>Loading...</p>:dispatchError?<div className="error-banner">{dispatchError}</div>:!dispatchData?.customers?.length?<p style={{textAlign:"center",color:"#9ca3af",padding:"40px 0"}}>No dispatches found.</p>:(
                <><div className="table-wrapper" style={{margin:0}}><table className="customers-table"><thead><tr><th>Customer</th><th>Dispatches</th><th>First</th><th>Last</th><th>Total Sold (kg)</th><th>Disposal</th><th>%</th></tr></thead><tbody>{dispatchData.customers.map((c)=>{const pct=dispatchData.total_kg>0?((c.total_kg/dispatchData.total_kg)*100).toFixed(1):0;return(<tr key={c.customer_id} className="table-row"><td className="td-name">{c.customer_name}</td><td style={{textAlign:"center",fontWeight:"600"}}>{c.dispatches_count}</td><td style={{color:"#6b7280",fontSize:"13px"}}>{fmt(c.first_date)}</td><td style={{color:"#6b7280",fontSize:"13px"}}>{fmt(c.last_date)}</td><td style={{fontWeight:"700",color:"#2d7a4f"}}>{c.total_kg.toLocaleString()} kg</td><td>{c.total_disposal_kg>0?<span style={{background:"#fef3c7",color:"#92400e",padding:"2px 8px",borderRadius:"999px",fontSize:"12px",fontWeight:"600"}}>{c.total_disposal_kg.toLocaleString()} kg</span>:<span style={{color:"#9ca3af"}}>—</span>}</td><td><div style={{display:"flex",alignItems:"center",gap:"8px"}}><div style={{flex:1,height:"6px",background:"#f3f4f6",borderRadius:"999px",overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:"#b45309",borderRadius:"999px"}}/></div><span style={{fontSize:"12px",color:"#6b7280",fontWeight:"600",minWidth:"36px"}}>{pct}%</span></div></td></tr>);})}</tbody><tfoot><tr style={{background:"#f8fafc",borderTop:"2px solid #e5e7eb"}}><td style={{padding:"12px 16px",fontWeight:"600",color:"#6b7280",fontSize:"13px"}}>TOTAL ({dispatchData.customers.length})</td><td style={{padding:"12px 16px",fontWeight:"700",textAlign:"center"}}>{dispatchData.total_dispatches}</td><td colSpan={2}/><td style={{padding:"12px 16px",fontWeight:"800",color:"#2d7a4f",fontSize:"15px"}}>{dispatchData.total_kg?.toLocaleString()} kg</td><td style={{padding:"12px 16px",fontWeight:"700",color:"#92400e"}}>{dispatchData.total_disposal_kg?.toLocaleString()} kg</td><td style={{padding:"12px 16px",fontWeight:"700"}}>100%</td></tr></tfoot></table></div>
                {dispatchData.monthly?.length>0&&(<div style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:"12px",padding:"20px",marginTop:"20px"}}><p style={{fontWeight:"600",fontSize:"14px",color:"#374151",margin:"0 0 4px"}}>Monthly Volume</p><ResponsiveContainer width="100%" height={240}><BarChart data={dispatchData.monthly} margin={{top:4,right:8,left:0,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/><XAxis dataKey="label" tick={{fontSize:11,fill:"#6b7280"}} angle={dispatchData.monthly.length>8?-35:0} textAnchor={dispatchData.monthly.length>8?"end":"middle"} height={dispatchData.monthly.length>8?50:30}/><YAxis tick={{fontSize:12,fill:"#6b7280"}}/><Tooltip content={<CustomTooltip/>}/><Legend wrapperStyle={{fontSize:"12px"}}/><Bar dataKey="dispatched" name="Dispatched (kg)" fill="#b45309" radius={[3,3,0,0]}/><Bar dataKey="disposal" name="Disposal (kg)" fill="#fcd34d" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div>)}</>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ CUSTOMER ACTIVITY ══ */}
      {customerOpen&&(
        <div className="modal-overlay" onClick={()=>setCustomerOpen(false)}>
          <div className="modal" style={{maxWidth:"960px",maxHeight:"92vh",overflowY:"auto"}} onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header" style={{position:"sticky",top:0,background:"#fff",zIndex:9}}><div><h2>👥 Customer Activity</h2><p style={{fontSize:"13px",color:"#6b7280",margin:"2px 0 0"}}>Sales performance, revenue and trends</p></div><button className="modal-close" onClick={()=>setCustomerOpen(false)}>✕</button></div>
            <div style={{padding:"16px 24px 24px"}}>
              <div style={{display:"flex",gap:"12px",alignItems:"flex-end",background:"#f0fdfa",border:"1.5px solid #99f6e4",borderRadius:"10px",padding:"14px 16px",marginBottom:"20px",flexWrap:"wrap"}}>
                {[["From","date_from"],["To","date_to"]].map(([l,k])=>(<div key={k}><label style={{fontSize:"12px",fontWeight:"600",color:"#374151",display:"block",marginBottom:"4px"}}>{l}</label><input type="date" value={customerFilters[k]} onChange={(e)=>{const f={...customerFilters,[k]:e.target.value};setCustomerFilters(f);fetchCustomerActivity(f);}} style={{padding:"7px 10px",border:"1.5px solid #e5e7eb",borderRadius:"7px",fontSize:"14px"}}/></div>))}
                <div><label style={{fontSize:"12px",fontWeight:"600",color:"#374151",display:"block",marginBottom:"4px"}}>Customer</label><select value={customerFilters.customer_id} onChange={(e)=>{const f={...customerFilters,customer_id:e.target.value};setCustomerFilters(f);fetchCustomerActivity(f);}} style={{padding:"7px 10px",border:"1.5px solid #e5e7eb",borderRadius:"7px",fontSize:"14px",background:"#fff",minWidth:"180px"}}><option value="">All customers</option>{customers.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label style={{fontSize:"12px",fontWeight:"600",color:"#374151",display:"block",marginBottom:"4px"}}>Price / kg (€)</label><input type="number" step="0.01" min="0.01" value={customerFilters.price_per_kg} onChange={(e)=>setCustomerFilters({...customerFilters,price_per_kg:e.target.value})} onBlur={()=>fetchCustomerActivity(customerFilters)} style={{width:"90px",padding:"7px 10px",border:"1.5px solid #e5e7eb",borderRadius:"7px",fontSize:"14px"}}/></div>
                {(customerFilters.date_from||customerFilters.date_to||customerFilters.customer_id)&&<button onClick={()=>{const f={date_from:"",date_to:"",customer_id:"",price_per_kg:customerFilters.price_per_kg};setCustomerFilters(f);fetchCustomerActivity(f);}} style={{padding:"7px 14px",borderRadius:"7px",border:"1.5px solid #e5e7eb",background:"#fff",color:"#6b7280",fontSize:"13px",cursor:"pointer"}}>Clear</button>}
              </div>
              {customerData&&(<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px",marginBottom:"24px"}}>{[{label:"Customers",value:customerData.total_customers,color:"#0f766e",icon:"👥"},{label:"Total kg",value:`${customerData.total_kg?.toLocaleString()} kg`,color:"#2d7a4f",icon:"⚖️"},{label:"Revenue",value:fmtEur(customerData.total_revenue),color:"#b45309",icon:"💶"}].map(({label,value,color,icon})=>(<div key={label} style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:"10px",padding:"16px"}}><p style={{fontSize:"11px",color:"#9ca3af",fontWeight:"600",textTransform:"uppercase",margin:"0 0 6px"}}>{icon} {label}</p><p style={{fontSize:"22px",fontWeight:"800",color,margin:0}}>{value}</p></div>))}</div>)}
              {customerLoading?<p style={{textAlign:"center",color:"#9ca3af",padding:"40px 0"}}>Loading...</p>:customerError?<div className="error-banner">{customerError}</div>:!customerData?.customers?.length?<p style={{textAlign:"center",color:"#9ca3af",padding:"40px 0"}}>No customer activity found.</p>:(
                <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>{customerData.customers.map((c,rank)=>{const pct=customerData.total_kg>0?((c.total_kg/customerData.total_kg)*100).toFixed(1):0;return<ActivityRow key={c.customer_id} item={c} rank={rank} isExpanded={expandedCustomer===c.customer_id} onToggle={()=>setExpandedCustomer(expandedCustomer===c.customer_id?null:c.customer_id)} accentColor="#0f766e" pct={pct} metricLabel="REVENUE" metricValue={fmtEur(c.revenue)} avgLabel="AVG ORDER" avgValue={c.avg_kg_per_dispatch.toLocaleString()}/>;})}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ SUPPLIER ACTIVITY ══ */}
      {supplierActOpen&&(
        <div className="modal-overlay" onClick={()=>setSupplierActOpen(false)}>
          <div className="modal" style={{maxWidth:"960px",maxHeight:"92vh",overflowY:"auto"}} onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header" style={{position:"sticky",top:0,background:"#fff",zIndex:9}}><div><h2>🏭 Supplier Activity</h2><p style={{fontSize:"13px",color:"#6b7280",margin:"2px 0 0"}}>Collection performance and trends</p></div><button className="modal-close" onClick={()=>setSupplierActOpen(false)}>✕</button></div>
            <div style={{padding:"16px 24px 24px"}}>
              <div style={{display:"flex",gap:"12px",alignItems:"flex-end",background:"#faf5ff",border:"1.5px solid #ddd6fe",borderRadius:"10px",padding:"14px 16px",marginBottom:"20px",flexWrap:"wrap"}}>
                {[["From","date_from"],["To","date_to"]].map(([l,k])=>(<div key={k}><label style={{fontSize:"12px",fontWeight:"600",color:"#374151",display:"block",marginBottom:"4px"}}>{l}</label><input type="date" value={supplierActFilters[k]} onChange={(e)=>{const f={...supplierActFilters,[k]:e.target.value};setSupplierActFilters(f);fetchSupplierActivity(f);}} style={{padding:"7px 10px",border:"1.5px solid #e5e7eb",borderRadius:"7px",fontSize:"14px"}}/></div>))}
                <div><label style={{fontSize:"12px",fontWeight:"600",color:"#374151",display:"block",marginBottom:"4px"}}>Type</label><select value={supplierActFilters.supplier_type} onChange={(e)=>{const f={...supplierActFilters,supplier_type:e.target.value,supplier_id:""};setSupplierActFilters(f);fetchSupplierActivity(f);}} style={{padding:"7px 10px",border:"1.5px solid #e5e7eb",borderRadius:"7px",fontSize:"14px",background:"#fff"}}><option value="">All types</option><option value="Horeca">Horeca</option><option value="Urban">Urban</option></select></div>
                <div><label style={{fontSize:"12px",fontWeight:"600",color:"#374151",display:"block",marginBottom:"4px"}}>Supplier</label><select value={supplierActFilters.supplier_id} onChange={(e)=>{const f={...supplierActFilters,supplier_id:e.target.value};setSupplierActFilters(f);fetchSupplierActivity(f);}} style={{padding:"7px 10px",border:"1.5px solid #e5e7eb",borderRadius:"7px",fontSize:"14px",background:"#fff",minWidth:"180px"}}><option value="">All suppliers</option>{suppliers.filter((s)=>!supplierActFilters.supplier_type||s.supplier_type===supplierActFilters.supplier_type).map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                {(supplierActFilters.date_from||supplierActFilters.date_to||supplierActFilters.supplier_id||supplierActFilters.supplier_type)&&<button onClick={()=>{const f={date_from:"",date_to:"",supplier_id:"",supplier_type:""};setSupplierActFilters(f);fetchSupplierActivity(f);}} style={{padding:"7px 14px",borderRadius:"7px",border:"1.5px solid #e5e7eb",background:"#fff",color:"#6b7280",fontSize:"13px",cursor:"pointer"}}>Clear</button>}
              </div>
              {supplierActData&&(<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px",marginBottom:"24px"}}>{[{label:"Suppliers",value:supplierActData.total_suppliers,color:"#6d28d9",icon:"🏭"},{label:"Total kg",value:`${supplierActData.total_kg?.toLocaleString()} kg`,color:"#2d7a4f",icon:"⚖️"},{label:"Horeca kg",value:`${supplierActData.horeca_kg?.toLocaleString()} kg`,color:"#1d4ed8",icon:"🍽️"},{label:"Urban kg",value:`${supplierActData.urban_kg?.toLocaleString()} kg`,color:"#15803d",icon:"🏙️"}].map(({label,value,color,icon})=>(<div key={label} style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:"10px",padding:"16px"}}><p style={{fontSize:"11px",color:"#9ca3af",fontWeight:"600",textTransform:"uppercase",margin:"0 0 6px"}}>{icon} {label}</p><p style={{fontSize:"22px",fontWeight:"800",color,margin:0}}>{value}</p></div>))}</div>)}
              {supplierActLoading?<p style={{textAlign:"center",color:"#9ca3af",padding:"40px 0"}}>Loading...</p>:supplierActError?<div className="error-banner">{supplierActError}</div>:!supplierActData?.suppliers?.length?<p style={{textAlign:"center",color:"#9ca3af",padding:"40px 0"}}>No supplier activity found.</p>:(
                <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>{supplierActData.suppliers.map((s,rank)=>{const pct=supplierActData.total_kg>0?((s.total_kg/supplierActData.total_kg)*100).toFixed(1):0;return<ActivityRow key={s.supplier_id} item={s} rank={rank} isExpanded={expandedSupplier===s.supplier_id} onToggle={()=>setExpandedSupplier(expandedSupplier===s.supplier_id?null:s.supplier_id)} accentColor="#6d28d9" pct={pct} metricLabel="RECEIPTS" metricValue={s.receipts_count} avgLabel="AVG RECEIPT" avgValue={s.avg_kg_per_receipt.toLocaleString()}/>;})}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ QUARTERLY CLOSING ══ */}
      {quarterOpen&&(
        <div className="modal-overlay" onClick={()=>setQuarterOpen(false)}>
          <div className="modal" style={{maxWidth:"1000px",maxHeight:"92vh",overflowY:"auto"}} onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header" style={{position:"sticky",top:0,background:"#fff",zIndex:9}}>
              <div><h2>📅 Cierres Trimestrales {quarterYear}</h2><p style={{fontSize:"13px",color:"#6b7280",margin:"2px 0 0"}}>Quarterly breakdown — entrances, losses and dispatches</p></div>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <select value={quarterYear} onChange={(e)=>{setQuarterYear(parseInt(e.target.value));fetchQuarterly(parseInt(e.target.value));}} style={{padding:"7px 12px",border:"1.5px solid #e5e7eb",borderRadius:"7px",fontSize:"14px",fontWeight:"600"}}>{years.map((y)=><option key={y} value={y}>{y}</option>)}</select>
                <button onClick={downloadQuarterlyExcel} disabled={downloadingQuarter||!quarterData} style={{padding:"8px 16px",background:"#0369a1",color:"#fff",border:"none",borderRadius:"8px",fontSize:"13px",fontWeight:"700",cursor:"pointer"}}>
                  {downloadingQuarter?"Downloading...":"⬇ Excel"}
                </button>
                <button className="modal-close" onClick={()=>setQuarterOpen(false)}>✕</button>
              </div>
            </div>
            <div style={{padding:"16px 24px 24px"}}>
              {quarterLoading?<p style={{textAlign:"center",color:"#9ca3af",padding:"40px 0"}}>Loading...</p>:quarterError?<div className="error-banner">{quarterError}</div>:!quarterData?null:(
                <>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"12px",marginBottom:"24px"}}>
                    {[{label:"Opening Stock",value:`${quarterData.opening_stock?.toLocaleString()} kg`,color:"#92400e",bg:"#fffbeb",border:"#fcd34d"},{label:"Total Entrances",value:`${quarterData.total_entrances_kg?.toLocaleString()} kg`,color:"#2d7a4f",bg:"#f0fdf4",border:"#86efac"},{label:"Total Mermas",value:`${quarterData.total_mermas_kg?.toLocaleString()} kg`,color:"#dc2626",bg:"#fef2f2",border:"#fecaca"},{label:"Total Salidas",value:`${quarterData.total_salidas_kg?.toLocaleString()} kg`,color:"#b45309",bg:"#fffbeb",border:"#fcd34d"},{label:"Ending Stock",value:`${quarterData.year_ending_stock?.toLocaleString()} kg`,color:"#0369a1",bg:"#f0f9ff",border:"#7dd3fc"}].map(({label,value,color,bg,border})=>(
                      <div key={label} style={{background:bg,border:`1.5px solid ${border}`,borderRadius:"10px",padding:"14px 16px"}}>
                        <p style={{fontSize:"11px",color:"#9ca3af",fontWeight:"600",textTransform:"uppercase",margin:"0 0 6px"}}>{label}</p>
                        <p style={{fontSize:"18px",fontWeight:"800",color,margin:0}}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
                    {[1,2,3,4].map((q)=><QuarterCard key={q} q={quarterData.quarters[q]} color={QUARTER_COLORS[q-1]}/>)}
                  </div>
                  {quarterData.total_mermas_kg>0&&(<div style={{marginTop:"20px",background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:"12px",padding:"16px 20px"}}><p style={{fontWeight:"700",fontSize:"14px",color:"#dc2626",margin:"0 0 8px"}}>⚠ Mermas Summary {quarterYear}</p><div style={{display:"flex",gap:"24px",flexWrap:"wrap"}}>{[1,2,3,4].map((q)=>{const qData=quarterData.quarters[q];const qMermas=qData.months.reduce((s,m)=>s+m.mermas,0);if(qMermas===0)return null;return(<div key={q} style={{display:"flex",alignItems:"center",gap:"8px"}}><span style={{width:"10px",height:"10px",borderRadius:"50%",background:QUARTER_COLORS[q-1],display:"inline-block"}}/><span style={{fontSize:"13px",color:"#374151",fontWeight:"600"}}>{qData.label}:</span><span style={{fontSize:"13px",color:"#dc2626",fontWeight:"700"}}>{qMermas.toLocaleString()} kg</span></div>);})}</div></div>)}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ ANNUAL SUMMARY ══ */}
      {annualOpen&&(
        <div className="modal-overlay" onClick={()=>setAnnualOpen(false)}>
          <div className="modal" style={{maxWidth:"960px",maxHeight:"92vh",overflowY:"auto"}} onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header" style={{position:"sticky",top:0,background:"#fff",zIndex:9}}>
              <div><h2>📆 Annual Summary {annualYear}</h2><p style={{fontSize:"13px",color:"#6b7280",margin:"2px 0 0"}}>Full year monthly breakdown</p></div>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <select value={annualYear} onChange={(e)=>{setAnnualYear(parseInt(e.target.value));fetchAnnual(parseInt(e.target.value));}} style={{padding:"7px 12px",border:"1.5px solid #e5e7eb",borderRadius:"7px",fontSize:"14px",fontWeight:"600"}}>{years.map((y)=><option key={y} value={y}>{y}</option>)}</select>
                <button className="modal-close" onClick={()=>setAnnualOpen(false)}>✕</button>
              </div>
            </div>
            <div style={{padding:"16px 24px 24px"}}>
              {annualLoading?<p style={{textAlign:"center",color:"#9ca3af",padding:"40px 0"}}>Loading...</p>:annualError?<div className="error-banner">{annualError}</div>:!annualData?null:(
                <>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px",marginBottom:"24px"}}>
                    {[{label:"Opening Stock",value:`${annualData.opening_stock?.toLocaleString()} kg`,color:"#92400e"},{label:"Total Entrances",value:`${annualData.total_entrances_kg?.toLocaleString()} kg`,color:"#2d7a4f"},{label:"Total Mermas",value:`${annualData.total_mermas_kg?.toLocaleString()} kg`,color:"#dc2626"},{label:"Total Dispatches",value:`${annualData.total_dispatches_kg?.toLocaleString()} kg`,color:"#b45309"}].map(({label,value,color})=>(<div key={label} style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:"10px",padding:"14px 16px"}}><p style={{fontSize:"11px",color:"#9ca3af",fontWeight:"600",textTransform:"uppercase",margin:"0 0 6px"}}>{label}</p><p style={{fontSize:"20px",fontWeight:"800",color,margin:0}}>{value}</p></div>))}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"24px"}}>
                    {[{label:"Horeca Collections",value:annualData.horeca_kg,color:"#1d4ed8",bg:"#eff6ff"},{label:"Urban Collections",value:annualData.urban_kg,color:"#15803d",bg:"#f0fdf4"}].map(({label,value,color,bg})=>{const total=(annualData.horeca_kg||0)+(annualData.urban_kg||0);const pct=total>0?((value/total)*100).toFixed(1):0;return(<div key={label} style={{background:bg,border:"1.5px solid #e5e7eb",borderRadius:"10px",padding:"14px 16px",display:"flex",alignItems:"center",gap:"16px"}}><div style={{flex:1}}><p style={{fontSize:"12px",color:"#9ca3af",fontWeight:"600",textTransform:"uppercase",margin:"0 0 4px"}}>{label}</p><p style={{fontSize:"22px",fontWeight:"800",color,margin:0}}>{value?.toLocaleString()} kg</p></div><p style={{fontSize:"28px",fontWeight:"800",color,margin:0,opacity:0.4}}>{pct}%</p></div>);})}
                  </div>
                  <div style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:"12px",padding:"20px",marginBottom:"20px"}}><p style={{fontWeight:"600",fontSize:"14px",color:"#374151",margin:"0 0 16px"}}>Monthly Entrances vs Dispatches {annualYear}</p><ResponsiveContainer width="100%" height={240}><BarChart data={annualData.monthly} margin={{top:4,right:8,left:0,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/><XAxis dataKey="label" tick={{fontSize:11,fill:"#6b7280"}}/><YAxis tick={{fontSize:12,fill:"#6b7280"}}/><Tooltip content={<CustomTooltip/>}/><Legend wrapperStyle={{fontSize:"12px"}}/><Bar dataKey="entrances_kg" name="Entrances (kg)" fill="#2d7a4f" radius={[3,3,0,0]}/><Bar dataKey="dispatches_kg" name="Dispatches (kg)" fill="#b45309" radius={[3,3,0,0]}/><Bar dataKey="mermas_kg" name="Mermas (kg)" fill="#dc2626" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div>
                  <div style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:"12px",padding:"20px",marginBottom:"20px"}}><p style={{fontWeight:"600",fontSize:"14px",color:"#374151",margin:"0 0 16px"}}>Running Stock {annualYear}</p><ResponsiveContainer width="100%" height={200}><LineChart data={annualData.monthly} margin={{top:4,right:8,left:0,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/><XAxis dataKey="label" tick={{fontSize:11,fill:"#6b7280"}}/><YAxis tick={{fontSize:12,fill:"#6b7280"}}/><Tooltip content={<CustomTooltip/>}/><Line type="monotone" dataKey="stock" name="Stock (kg)" stroke="#0f172a" strokeWidth={2.5} dot={{r:4,fill:"#0f172a"}}/></LineChart></ResponsiveContainer></div>
                  <div className="table-wrapper" style={{margin:0}}><table className="customers-table"><thead><tr><th>Month</th><th>Entrances (kg)</th><th>Mermas (kg)</th><th>Net In</th><th>Dispatches (kg)</th><th>Stock (kg)</th></tr></thead><tbody>{annualData.monthly.map((m)=>(<tr key={m.month} className="table-row"><td style={{fontWeight:"600"}}>{m.label}</td><td style={{color:"#2d7a4f",fontWeight:"600"}}>{m.entrances_kg>0?m.entrances_kg.toLocaleString():"—"}</td><td style={{color:m.mermas_kg>0?"#dc2626":"#9ca3af"}}>{m.mermas_kg>0?`-${m.mermas_kg.toLocaleString()}`:"—"}</td><td style={{fontWeight:"600",color:m.net_kg>=0?"#2d7a4f":"#dc2626"}}>{m.net_kg!==0?(m.net_kg>0?`+${m.net_kg.toLocaleString()}`:m.net_kg.toLocaleString()):"—"}</td><td style={{color:m.dispatches_kg>0?"#b45309":"#9ca3af"}}>{m.dispatches_kg>0?`-${m.dispatches_kg.toLocaleString()}`:"—"}</td><td style={{fontWeight:"700"}}>{m.stock.toLocaleString()} kg</td></tr>))}</tbody><tfoot><tr style={{background:"#f8fafc",borderTop:"2px solid #e5e7eb"}}><td style={{padding:"12px 16px",fontWeight:"600",color:"#6b7280"}}>TOTAL {annualYear}</td><td style={{padding:"12px 16px",fontWeight:"800",color:"#2d7a4f"}}>{annualData.total_entrances_kg?.toLocaleString()} kg</td><td style={{padding:"12px 16px",fontWeight:"700",color:"#dc2626"}}>-{annualData.total_mermas_kg?.toLocaleString()} kg</td><td style={{padding:"12px 16px",fontWeight:"700",color:"#2d7a4f"}}>+{(annualData.total_entrances_kg-annualData.total_mermas_kg).toLocaleString()} kg</td><td style={{padding:"12px 16px",fontWeight:"700",color:"#b45309"}}>-{annualData.total_dispatches_kg?.toLocaleString()} kg</td><td style={{padding:"12px 16px",fontWeight:"800",color:"#0f172a",fontSize:"15px"}}>{annualData.ending_stock?.toLocaleString()} kg</td></tr></tfoot></table></div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          URBAN COLLECTION MODAL
      ══════════════════════════════════════════════════════ */}
      {urbanOpen && (
        <div className="modal-overlay" onClick={() => setUrbanOpen(false)}>
          <div className="modal" style={{ maxWidth: "960px", maxHeight: "92vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>

            <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 9 }}>
              <div>
                <h2>🏙️ Urban Collection Report</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0 0" }}>
                  Resumen Recogida Urbano — per pickup point per date
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {urbanData && (
                  <button
                    onClick={downloadUrbanPdf}
                    disabled={downloadingUrban}
                    style={{
                      padding: "8px 16px", background: "#0369a1", color: "#fff",
                      border: "none", borderRadius: "8px", fontSize: "13px",
                      fontWeight: "700", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >
                    {downloadingUrban ? (
                      <><span style={{ width:"12px",height:"12px",border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite" }}/> Downloading...</>
                    ) : "⬇ Download PDF"}
                  </button>
                )}
                <button className="modal-close" onClick={() => setUrbanOpen(false)}>✕</button>
              </div>
            </div>

            <div style={{ padding: "16px 24px 24px" }}>

              {/* ── Filters ── */}
              <div style={{
                background: "#f0f9ff", border: "1.5px solid #7dd3fc",
                borderRadius: "10px", padding: "16px 18px",
                marginBottom: "20px",
              }}>
                <p style={{ fontWeight: "700", fontSize: "13px", color: "#0369a1", margin: "0 0 12px" }}>
                  Select Supplier and Period
                </p>
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>

                  {/* Supplier — Urban only */}
                  <div style={{ minWidth: "220px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>
                      Urban Supplier <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <select
                      value={urbanFilters.supplier_id}
                      onChange={(e) => setUrbanFilters({ ...urbanFilters, supplier_id: e.target.value })}
                      style={{ padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px", background: "#fff", width: "100%" }}
                    >
                      <option value="">Select Urban supplier...</option>
                      {urbanSuppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {urbanSuppliers.length === 0 && (
                      <p style={{ fontSize: "11px", color: "#f59e0b", margin: "4px 0 0" }}>
                        No Urban suppliers found — add suppliers of type Urban first.
                      </p>
                    )}
                  </div>

                  {/* Date range */}
                  {[["From","date_from"],["To","date_to"]].map(([l,k]) => (
                    <div key={k}>
                      <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>{l}</label>
                      <input type="date" value={urbanFilters[k]}
                        onChange={(e) => setUrbanFilters({ ...urbanFilters, [k]: e.target.value })}
                        style={{ padding: "9px 10px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
                    </div>
                  ))}

                  {/* Period label */}
                  <div style={{ flex: 1, minWidth: "180px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>
                      Period Label (PDF title)
                    </label>
                    <input type="text"
                      placeholder="e.g. 2º SEMESTRE 2024"
                      value={urbanFilters.period_label}
                      onChange={(e) => setUrbanFilters({ ...urbanFilters, period_label: e.target.value })}
                      style={{ padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "14px", width: "100%" }} />
                  </div>

                  {/* Generate button */}
                  <button
                    onClick={() => fetchUrbanCollection(urbanFilters)}
                    disabled={!urbanFilters.supplier_id || urbanLoading}
                    style={{
                      padding: "10px 20px", background: urbanFilters.supplier_id ? "#0369a1" : "#e5e7eb",
                      color: urbanFilters.supplier_id ? "#fff" : "#9ca3af",
                      border: "none", borderRadius: "8px",
                      fontSize: "14px", fontWeight: "700",
                      cursor: urbanFilters.supplier_id ? "pointer" : "not-allowed",
                    }}
                  >
                    {urbanLoading ? "Loading..." : "Generate"}
                  </button>
                </div>
              </div>

              {/* ── Results ── */}
              {urbanError && <div className="error-banner">{urbanError}</div>}

              {!urbanData && !urbanLoading && (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
                  <p style={{ fontSize: "40px", marginBottom: "12px" }}>🏙️</p>
                  <p style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 6px" }}>Select a supplier and click Generate</p>
                  <p style={{ fontSize: "13px", margin: 0 }}>The report will show each pickup point as a column with quantities per collection date</p>
                </div>
              )}

              {urbanLoading && <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Loading...</p>}

              {urbanData && !urbanLoading && (
                <>
                  {/* Summary header — matches PDF style */}
                  <div style={{
                    background: "linear-gradient(135deg, #1e3d2a 0%, #2d5a3d 100%)",
                    borderRadius: "12px", padding: "20px 24px",
                    marginBottom: "20px",
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                  }}>
                    <div>
                      <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>
                        RESUMEN RECOGIDA URBANO
                      </p>
                      <p style={{ fontSize: "20px", fontWeight: "800", color: "#fff", margin: "0 0 4px" }}>
                        {urbanData.supplier_name.toUpperCase()}
                      </p>
                      <p style={{ fontSize: "14px", fontWeight: "600", color: "rgba(255,255,255,0.7)", margin: 0 }}>
                        {urbanFilters.period_label || urbanData.period_label}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", margin: "0 0 4px" }}>TOTAL COLLECTED</p>
                      <p style={{ fontSize: "28px", fontWeight: "800", color: "#86efac", margin: "0 0 4px" }}>
                        {urbanData.grand_total_kg.toLocaleString()} kg
                      </p>
                      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                        {urbanData.total_receipts} collections · {urbanData.pickup_points.length} pickup points
                      </p>
                    </div>
                  </div>

                  {urbanData.rows.length === 0 ? (
                    <p style={{ textAlign: "center", color: "#9ca3af", padding: "32px 0", fontSize: "14px" }}>
                      No collection data found for this supplier in the selected period.
                    </p>
                  ) : (
                    <>
                      {/* Per-pickup-point KPI pills */}
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
                        {urbanData.pickup_points.map((pp, idx) => {
                          const ppTotal = urbanData.totals[idx];
                          const pct = urbanData.grand_total_kg > 0
                            ? ((ppTotal / urbanData.grand_total_kg) * 100).toFixed(1) : 0;
                          return (
                            <div key={pp} style={{
                              background: "#f0f9ff", border: "1.5px solid #7dd3fc",
                              borderRadius: "8px", padding: "8px 14px",
                              display: "flex", alignItems: "center", gap: "8px",
                            }}>
                              <span style={{ fontSize: "12px", color: "#0369a1" }}>📍</span>
                              <div>
                                <p style={{ fontSize: "11px", color: "#9ca3af", margin: "0 0 1px", fontWeight: "600" }}>{pp}</p>
                                <p style={{ fontSize: "14px", fontWeight: "800", color: "#0369a1", margin: 0 }}>
                                  {ppTotal != null ? ppTotal.toLocaleString() : 0} kg
                                  <span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "400", marginLeft: "4px" }}>({pct}%)</span>
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Collection table */}
                      <div className="table-wrapper" style={{ margin: 0 }}>
                        <table className="customers-table">
                          <thead>
                            <tr>
                              <th style={{ background: "#1e3d2a", color: "#fff", minWidth: "90px" }}>FECHA</th>
                              {urbanData.pickup_points.map((pp) => (
                                <th key={pp} style={{ background: "#8dc63f", color: "#fff" }}>{pp}</th>
                              ))}
                              <th style={{ background: "#1e3d2a", color: "#fff" }}>TOTAL</th>
                            </tr>
                          </thead>
                          <tbody>
                            {urbanData.rows.map((row, idx) => (
                              <tr key={row.receipt_id} className="table-row" style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                                <td style={{ fontWeight: "700", fontSize: "13px", fontFamily: "monospace" }}>{row.date}</td>
                                {row.quantities.map((qty, i) => (
                                  <td key={i} style={{
                                    textAlign: "center", fontWeight: "600",
                                    color: qty != null && qty > 0 ? "#1a1a2e" : "#d1d5db",
                                    fontSize: "14px",
                                  }}>
                                    {qty != null && qty > 0 ? qty.toLocaleString() : qty === 0 ? "0" : ""}
                                  </td>
                                ))}
                                <td style={{ fontWeight: "800", color: "#0369a1", fontSize: "14px", textAlign: "center" }}>
                                  {row.total.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: "#8dc63f" }}>
                              <td style={{ padding: "10px 16px", fontWeight: "700", color: "#fff", fontSize: "13px" }}></td>
                              {urbanData.totals.slice(0, -1).map((t, i) => (
                                <td key={i} style={{ padding: "10px 16px", textAlign: "center", fontWeight: "800", color: "#fff", fontSize: "14px" }}>
                                  {t != null ? t.toLocaleString() : ""}
                                </td>
                              ))}
                              <td style={{ padding: "10px 16px", textAlign: "center", fontWeight: "800", color: "#fff", fontSize: "16px" }}>
                                {urbanData.grand_total_kg.toLocaleString()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Info about PDF */}
                      <div style={{
                        marginTop: "16px", background: "#f0f9ff",
                        border: "1px solid #7dd3fc", borderRadius: "8px",
                        padding: "12px 16px", fontSize: "13px", color: "#0369a1",
                      }}>
                        💡 Click <strong>⬇ Download PDF</strong> to generate the official RESUMEN RECOGIDA URBANO document matching the Recial format, ready to send to the municipality.
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ CUSTOMERS LIST ══ */}
      {custListOpen && (
        <div className="modal-overlay" onClick={() => setCustListOpen(false)}>
          <div className="modal" style={{ maxWidth: "900px", maxHeight: "92vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 9 }}>
              <div>
                <h2>📋 Customers List</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0 0" }}>
                  {custListData ? `${custListData.total} customers` : "All customers"}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={downloadCustListPdf} disabled={dlCustList}
                  style={{ padding: "8px 16px", background: "#0369a1", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                  {dlCustList ? "Downloading..." : "⬇ Download PDF"}
                </button>
                <button className="modal-close" onClick={() => setCustListOpen(false)}>✕</button>
              </div>
            </div>
            <div style={{ padding: "16px 24px 24px" }}>
              {custListLoading ? <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Loading...</p>
                : custListError ? <div className="error-banner">{custListError}</div>
                : !custListData?.customers?.length ? <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>No customers found.</p>
                : (
                  <div className="table-wrapper" style={{ margin: 0 }}>
                    <table className="customers-table">
                      <thead>
                        <tr><th>#</th><th>Name</th><th>CIF</th><th>Address</th><th>Email</th><th>Phone</th></tr>
                      </thead>
                      <tbody>
                        {custListData.customers.map((c, idx) => (
                          <tr key={c.id} className="table-row">
                            <td style={{ textAlign: "center", color: "#9ca3af", fontSize: "12px" }}>{idx + 1}</td>
                            <td className="td-name">{c.name}</td>
                            <td style={{ fontFamily: "monospace", fontSize: "13px" }}>{c.cif || "—"}</td>
                            <td style={{ fontSize: "13px", color: "#6b7280" }}>{c.address || "—"}</td>
                            <td style={{ fontSize: "13px", color: "#6b7280" }}>{c.email || "—"}</td>
                            <td style={{ fontSize: "13px" }}>{c.phone || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* ══ SUPPLIERS LIST ══ */}
      {suppListOpen && (
        <div className="modal-overlay" onClick={() => setSuppListOpen(false)}>
          <div className="modal" style={{ maxWidth: "960px", maxHeight: "92vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 9 }}>
              <div>
                <h2>📋 Suppliers List</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0 0" }}>
                  {suppListData ? `${suppListData.total} suppliers · ${suppListData.horeca_count} Horeca · ${suppListData.urban_count} Urban` : "All suppliers"}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={downloadSuppListPdf} disabled={dlSuppList}
                  style={{ padding: "8px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                  {dlSuppList ? "Downloading..." : "⬇ Download PDF"}
                </button>
                <button className="modal-close" onClick={() => setSuppListOpen(false)}>✕</button>
              </div>
            </div>
            <div style={{ padding: "16px 24px 24px" }}>

              {/* Filters */}
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", background: "#f0fdf4", border: "1.5px solid #6ee7b7", borderRadius: "10px", padding: "14px 16px", marginBottom: "20px", flexWrap: "wrap" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>Type</label>
                  <select value={suppListFilters.supplier_type}
                    onChange={(e) => { const f={...suppListFilters, supplier_type:e.target.value, supplier_id:""}; setSuppListFilters(f); fetchSuppList(f); }}
                    style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: "7px", fontSize: "14px", background: "#fff" }}>
                    <option value="">All types</option>
                    <option value="Horeca">Horeca only</option>
                    <option value="Urban">Urban only</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>Specific Supplier</label>
                  <select value={suppListFilters.supplier_id}
                    onChange={(e) => { const f={...suppListFilters, supplier_id:e.target.value}; setSuppListFilters(f); fetchSuppList(f); }}
                    style={{ padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: "7px", fontSize: "14px", background: "#fff", minWidth: "200px" }}>
                    <option value="">All suppliers</option>
                    {suppliers
                      .filter((s) => !suppListFilters.supplier_type || s.supplier_type === suppListFilters.supplier_type)
                      .map((s) => <option key={s.id} value={s.id}>{s.name} ({s.supplier_type})</option>)}
                  </select>
                </div>
                {(suppListFilters.supplier_type || suppListFilters.supplier_id) && (
                  <button onClick={() => { const f={supplier_type:"",supplier_id:""}; setSuppListFilters(f); fetchSuppList(f); }}
                    style={{ padding: "7px 14px", borderRadius: "7px", border: "1.5px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: "13px", cursor: "pointer" }}>
                    Clear
                  </button>
                )}
              </div>

              {suppListLoading ? <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Loading...</p>
                : suppListError ? <div className="error-banner">{suppListError}</div>
                : !suppListData?.suppliers?.length ? <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>No suppliers found.</p>
                : (
                  <>
                    <div className="table-wrapper" style={{ margin: 0 }}>
                      <table className="customers-table">
                        <thead>
                          <tr><th>#</th><th>Name</th><th>Type</th><th>CIF</th><th>Address</th><th>Email</th><th>Phone</th><th>Pickup Pts</th></tr>
                        </thead>
                        <tbody>
                          {suppListData.suppliers.map((s, idx) => (
                            <tr key={s.id} className="table-row">
                              <td style={{ textAlign: "center", color: "#9ca3af", fontSize: "12px" }}>{idx + 1}</td>
                              <td className="td-name">{s.name}</td>
                              <td><TypeBadge type={s.supplier_type} /></td>
                              <td style={{ fontFamily: "monospace", fontSize: "13px" }}>{s.cif || "—"}</td>
                              <td style={{ fontSize: "13px", color: "#6b7280" }}>{s.address || "—"}</td>
                              <td style={{ fontSize: "13px", color: "#6b7280" }}>{s.email || "—"}</td>
                              <td style={{ fontSize: "13px" }}>{s.phone || "—"}</td>
                              <td style={{ textAlign: "center", fontWeight: "600", color: s.pickup_points?.length > 0 ? "#2d7a4f" : "#9ca3af" }}>
                                {s.pickup_points?.length || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Urban pickup points detail */}
                    {suppListData.suppliers.filter(s => s.supplier_type === "Urban" && s.pickup_points?.length > 0).map(s => (
                      <div key={s.id} style={{ marginTop: "20px" }}>
                        <p style={{ fontWeight: "700", fontSize: "14px", color: "#15803d", margin: "0 0 10px" }}>
                          📍 {s.name} — Pickup Points
                        </p>
                        <div className="table-wrapper" style={{ margin: 0 }}>
                          <table className="customers-table">
                            <thead>
                              <tr>
                                <th style={{ background: "#8dc63f", color: "#fff" }}>Pickup Point</th>
                                <th style={{ background: "#8dc63f", color: "#fff" }}>Latitude</th>
                                <th style={{ background: "#8dc63f", color: "#fff" }}>Longitude</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.pickup_points.map((pp) => (
                                <tr key={pp.id} className="table-row">
                                  <td className="td-name">{pp.name}</td>
                                  <td style={{ fontFamily: "monospace", fontSize: "13px", textAlign: "center" }}>
                                    {pp.latitude ? pp.latitude.toFixed(6) : "—"}
                                  </td>
                                  <td style={{ fontFamily: "monospace", fontSize: "13px", textAlign: "center" }}>
                                    {pp.longitude ? pp.longitude.toFixed(6) : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>  
                    ))}
                  </>
                )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          BATCH TRACEABILITY MODAL
      ══════════════════════════════════════════════════════ */}
      {traceOpen && (
        <div className="modal-overlay" onClick={() => { setTraceOpen(false); resetTrace(); }}>
          <div className="modal" style={{ maxWidth: "1000px", maxHeight: "92vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>

            <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 9 }}>
              <div>
                <h2>🧬 Batch Traceability</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0 0" }}>
                  Full chain of custody — every batch ID at every step
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {traceData && (
                  <button onClick={downloadTracePdf} disabled={dlTracePdf}
                    style={{ padding: "8px 16px", background: "#9d174d", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                    {dlTracePdf ? "Downloading..." : "⬇ Download PDF"}
                  </button>
                )}
                <button className="modal-close" onClick={() => { setTraceOpen(false); resetTrace(); }}>✕</button>
              </div>
            </div>

            <div style={{ padding: "16px 24px 24px" }}>

              {/* Direction toggle */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                {[
                  { key: "forward",  label: "→ Forward",  sub: "Receipt → Entrance → Dispatch", color: "#1d4ed8", bg: "#eff6ff" },
                  { key: "backward", label: "← Backward", sub: "Dispatch → Entrance → Receipt", color: "#b45309", bg: "#fffbeb" },
                ].map((opt) => (
                  <button key={opt.key}
                    onClick={() => { setTraceDirection(opt.key); resetTrace(); }}
                    style={{
                      flex: 1, textAlign: "left", padding: "12px 16px",
                      borderRadius: "10px",
                      border: `2px solid ${traceDirection === opt.key ? opt.color : "#e5e7eb"}`,
                      background: traceDirection === opt.key ? opt.bg : "#fff",
                      cursor: "pointer",
                    }}>
                    <p style={{ fontWeight: "800", fontSize: "15px", color: traceDirection === opt.key ? opt.color : "#374151", margin: "0 0 2px" }}>{opt.label}</p>
                    <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>{opt.sub}</p>
                  </button>
                ))}
              </div>

              {/* Search box */}
              <div style={{ position: "relative", marginBottom: "20px" }}>
                <input
                  type="text"
                  placeholder={traceDirection === "forward" ? "Search Receipt batch ID (e.g. REC-2026-001)..." : "Search Dispatch batch ID (e.g. DSP-2026-001)..."}
                  value={traceSearchQ}
                  onChange={(e) => searchTraceBatch(e.target.value)}
                  style={{
                    width: "100%", padding: "12px 16px", fontSize: "14px",
                    border: "1.5px solid #e5e7eb", borderRadius: "10px",
                  }}
                />
                {traceSearching && (
                  <span style={{ position: "absolute", right: "16px", top: "13px", fontSize: "12px", color: "#9ca3af" }}>Searching...</span>
                )}

                {/* Search results dropdown */}
                {traceSearchRes && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                    background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: "10px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 20,
                    maxHeight: "280px", overflowY: "auto",
                  }}>
                    {(traceDirection === "forward" ? traceSearchRes.receipts : traceSearchRes.dispatches).length === 0 ? (
                      <p style={{ padding: "16px", color: "#9ca3af", fontSize: "13px", margin: 0 }}>
                        No {traceDirection === "forward" ? "receipts" : "dispatches"} found matching "{traceSearchQ}"
                      </p>
                    ) : (
                      (traceDirection === "forward" ? traceSearchRes.receipts : traceSearchRes.dispatches).map((item) => (
                        <div key={item.id} onClick={() => selectTraceBatch(item)}
                          style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #f3f4f6", fontSize: "14px" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}>
                          <span style={{ fontFamily: "monospace", fontWeight: "700" }}>{item.batch_id}</span>
                          <span style={{ color: "#9ca3af", marginLeft: "8px" }}>{item.label.split("—")[1]}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {traceError && <div className="error-banner">{traceError}</div>}

              {traceLoading && <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Tracing chain of custody...</p>}

              {!traceData && !traceLoading && !traceSelected && (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
                  <p style={{ fontSize: "40px", marginBottom: "12px" }}>🧬</p>
                  <p style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 6px" }}>
                    Search for a {traceDirection === "forward" ? "Receipt" : "Dispatch"} batch ID above
                  </p>
                  <p style={{ fontSize: "13px", margin: 0 }}>
                    {traceDirection === "forward"
                      ? "Trace forward to see which Entrances and Dispatches it fed into"
                      : "Trace backward to see which Entrances and Receipts are behind it"}
                  </p>
                </div>
              )}

              {/* Tree visualization + results */}
              {traceData && !traceLoading && (
                <>
                  {/* Summary banner */}
                  <div style={{
                    background: traceData.summary.fully_traced ? "#f0fdf4" : "#fffbeb",
                    border: `1.5px solid ${traceData.summary.fully_traced ? "#86efac" : "#fcd34d"}`,
                    borderRadius: "12px", padding: "14px 18px", marginBottom: "20px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <p style={{ fontWeight: "700", fontSize: "14px", color: traceData.summary.fully_traced ? "#15803d" : "#92400e", margin: "0 0 2px" }}>
                        {traceData.summary.fully_traced ? "✓ Full chain traced" : "⚠ Incomplete chain"}
                      </p>
                      <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                        Root: <strong style={{ fontFamily: "monospace" }}>{traceData.root.batch_id}</strong>
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "20px" }}>
                      {traceDirection === "forward" ? (
                        <>
                          <div style={{ textAlign: "center" }}>
                            <p style={{ fontSize: "10px", color: "#9ca3af", margin: "0 0 2px" }}>ENTRANCES</p>
                            <p style={{ fontSize: "18px", fontWeight: "800", color: "#2d7a4f", margin: 0 }}>{traceData.summary.total_entrances}</p>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <p style={{ fontSize: "10px", color: "#9ca3af", margin: "0 0 2px" }}>DISPATCHES</p>
                            <p style={{ fontSize: "18px", fontWeight: "800", color: "#b45309", margin: 0 }}>{traceData.summary.total_dispatches}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ textAlign: "center" }}>
                            <p style={{ fontSize: "10px", color: "#9ca3af", margin: "0 0 2px" }}>ENTRANCES</p>
                            <p style={{ fontSize: "18px", fontWeight: "800", color: "#2d7a4f", margin: 0 }}>{traceData.summary.total_entrances}</p>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <p style={{ fontSize: "10px", color: "#9ca3af", margin: "0 0 2px" }}>RECEIPTS</p>
                            <p style={{ fontSize: "18px", fontWeight: "800", color: "#1d4ed8", margin: 0 }}>{traceData.summary.total_receipts}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tree diagram */}
                  <div style={{ background: "#fafafa", border: "1.5px solid #e5e7eb", borderRadius: "12px", padding: "20px", marginBottom: "20px", overflowX: "auto" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "600px" }}>

                      {/* Root node */}
                      <div style={{
                        background: traceDirection === "forward" ? "#1d4ed8" : "#b45309",
                        color: "#fff", borderRadius: "10px", padding: "10px 20px",
                        fontWeight: "700", fontSize: "14px", fontFamily: "monospace",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                      }}>
                        {traceDirection === "forward" ? "📋" : "🚚"} {traceData.root.batch_id}
                      </div>

                      {/* Connector */}
                      <div style={{ width: "2px", height: "24px", background: "#d1d5db" }} />

                      {/* Entrance row */}
                      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center", position: "relative" }}>
                        {traceData.entrances.map((en) => (
                          <div key={en.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{
                              background: "#2d7a4f", color: "#fff", borderRadius: "10px",
                              padding: "8px 16px", fontWeight: "700", fontSize: "13px", fontFamily: "monospace",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                            }}>
                              🛢️ {en.batch_id}
                            </div>
                            <p style={{ fontSize: "11px", color: "#6b7280", margin: "4px 0 0" }}>
                              {en.quantity_kg?.toFixed(0)} kg · {en.tank_name || "—"}
                            </p>

                            {/* Connector down to leaves */}
                            <div style={{ width: "2px", height: "20px", background: "#d1d5db" }} />

                            {/* Leaves (dispatches or receipts) */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "center" }}>
                              {(traceDirection === "forward" ? en.dispatches : en.receipts).length === 0 ? (
                                <div style={{ fontSize: "11px", color: "#d1d5db", fontStyle: "italic", padding: "6px 0" }}>none yet</div>
                              ) : (
                                (traceDirection === "forward" ? en.dispatches : en.receipts).map((leaf) => (
                                  <div key={leaf.id} style={{
                                    background: traceDirection === "forward" ? "#fffbeb" : "#eff6ff",
                                    border: `1.5px solid ${traceDirection === "forward" ? "#fcd34d" : "#93c5fd"}`,
                                    borderRadius: "8px", padding: "6px 12px",
                                    fontSize: "12px", fontFamily: "monospace", fontWeight: "700",
                                    color: traceDirection === "forward" ? "#92400e" : "#1d4ed8",
                                  }}>
                                    {traceDirection === "forward" ? "🚚" : "📋"} {leaf.batch_id}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Detailed table per entrance */}
                  {traceData.entrances.map((en) => (
                    <div key={en.id} style={{ marginBottom: "16px" }}>
                      <p style={{ fontWeight: "700", fontSize: "13px", color: "#2d7a4f", margin: "0 0 8px" }}>
                        🛢️ Entrance {en.batch_id} — {en.quantity_kg?.toFixed(0)} kg
                      </p>
                      <div className="table-wrapper" style={{ margin: 0 }}>
                        <table className="customers-table">
                          <thead>
                            <tr>
                              <th>{traceDirection === "forward" ? "Dispatch" : "Receipt"} Batch</th>
                              <th>Date</th>
                              <th>{traceDirection === "forward" ? "Customer" : "Supplier"}</th>
                              <th>Quantity (kg)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(traceDirection === "forward" ? en.dispatches : en.receipts).length === 0 ? (
                              <tr><td colSpan={4} className="table-state">No linked records yet</td></tr>
                            ) : (
                              (traceDirection === "forward" ? en.dispatches : en.receipts).map((leaf) => (
                                <tr key={leaf.id} className="table-row">
                                  <td style={{ fontFamily: "monospace", fontWeight: "700" }}>{leaf.batch_id}</td>
                                  <td>{fmt(leaf.date)}</td>
                                  <td className="td-name">{traceDirection === "forward" ? leaf.customer_name : leaf.supplier_name}</td>
                                  <td style={{ fontWeight: "700", color: "#2d7a4f" }}>
                                    {(traceDirection === "forward" ? leaf.quantity : leaf.quantity_kg)?.toFixed(0)} kg
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
