import { useEffect, useState, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import Modal from "../../components/modals/Modal.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import Toast, { useToast } from "../../components/ui/Toast";
import { getPromoCodes, createPromoCode, updatePromoCode, deletePromoCode } from "../../lib/adminApi.js";
import { localDateStr } from "../../lib/format";
import useDebounce from "../../hooks/useDebounce.js";

const EMPTY_FORM = { code: "", type: "percentage", value: "", max_uses: "", expires_at: "" };
const PAGE_SIZE = 10;

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const rand = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `APLAYA-${rand}`;
}

const formatDiscount = (code) =>
  code.type === "percentage" ? `${code.value}%` : `\u20B1${Number(code.value).toLocaleString()}`;

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "\u2014";

const isExpired = (code) => code.expires_at && new Date(code.expires_at) < new Date();

/* ── Pagination ellipsis helper ── */
function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export default function PromoCodes() {
  const [toast, showToast, clearToast, toastType, toastAction] = useToast();

  /* ── data ── */
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── modals ── */
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewItem, setViewItem] = useState(null);

  /* ── confirm dialogs ── */
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(null); // "create" | "edit" | null

  /* ── form ── */
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  /* ── unsaved changes guard ── */
  const editSnapshot = useRef(null);

  /* ── undo delete ── */
  const undoTimerRef = useRef(null);
  const undoItemRef = useRef(null);

  /* ── table controls ── */
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [filterStatus, setFilterStatus] = useState("all"); // all | active | inactive | expired
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(() => localStorage.getItem("promo_sortBy") || "Code");
  const [sortDir, setSortDir] = useState(() => localStorage.getItem("promo_sortDir") || "asc");
  const [selected, setSelected] = useState(new Set());

  const searchRef = useRef(null);

  /* ── persist sort ── */
  useEffect(() => { localStorage.setItem("promo_sortBy", sortBy); }, [sortBy]);
  useEffect(() => { localStorage.setItem("promo_sortDir", sortDir); }, [sortDir]);

  /* ── load ── */
  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getPromoCodes()
      .then((res) => { setCodes(res.data.data); setLoadError(false); })
      .catch(() => { showToast("Failed to load promo codes.", "error"); setLoadError(true); })
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  /* ── flush undo on unmount ── */
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        if (undoItemRef.current) {
          deletePromoCode(undoItemRef.current.id).catch(() => {});
          undoItemRef.current = null;
        }
      }
    };
  }, []);

  /* ── keyboard shortcut Ctrl+N ── */
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        openCreate();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── filter + sort + paginate ── */
  const filtered = codes.filter((c) => {
    if (filterStatus === "active" && (!c.is_active || isExpired(c))) return false;
    if (filterStatus === "inactive" && c.is_active) return false;
    if (filterStatus === "expired" && !isExpired(c)) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return c.code.toLowerCase().includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal;
    if (sortBy === "Discount") { aVal = Number(a.value); bVal = Number(b.value); }
    else if (sortBy === "Expires") { aVal = new Date(a.expires_at || "9999").getTime(); bVal = new Date(b.expires_at || "9999").getTime(); }
    else if (sortBy === "Uses") { aVal = a.uses_count || 0; bVal = b.uses_count || 0; }
    else if (sortBy === "Status") { aVal = (a.is_active && !isExpired(a)) ? 0 : 1; bVal = (b.is_active && !isExpired(b)) ? 0 : 1; }
    else { aVal = a.code.toLowerCase(); bVal = b.code.toLowerCase(); }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterStatus]);

  /* ── CRUD ── */
  function openCreate() {
    const initial = { ...EMPTY_FORM, code: generateCode() };
    setForm(initial);
    setFormError("");
    editSnapshot.current = JSON.stringify(initial);
    setCreateOpen(true);
  }

  function openEdit(code) {
    setEditTarget(code);
    setViewItem(null);
    const initial = {
      code: code.code,
      type: code.type,
      value: String(code.value),
      max_uses: code.max_uses ? String(code.max_uses) : "",
      expires_at: code.expires_at ? code.expires_at.substring(0, 10) : "",
    };
    setForm(initial);
    setFormError("");
    editSnapshot.current = JSON.stringify(initial);
  }

  function guardedCloseCreate() {
    if (JSON.stringify(form) !== editSnapshot.current) {
      setDiscardConfirm("create");
    } else {
      setCreateOpen(false);
    }
  }

  function guardedCloseEdit() {
    if (JSON.stringify(form) !== editSnapshot.current) {
      setDiscardConfirm("edit");
    } else {
      setEditTarget(null);
    }
  }

  function openDuplicate(item) {
    const initial = {
      code: generateCode(),
      type: item.type,
      value: String(item.value),
      max_uses: item.max_uses ? String(item.max_uses) : "",
      expires_at: "",
    };
    setForm(initial);
    setFormError("");
    editSnapshot.current = JSON.stringify(initial);
    setViewItem(null);
    setCreateOpen(true);
  }

  function handleSubmitCreate(e) {
    e.preventDefault();
    setFormError("");
    if (!form.code.trim()) { setFormError("Code is required."); return; }
    if (!form.value) { setFormError("Discount value is required."); return; }
    setConfirmOpen(true);
  }

  async function handleConfirmCreate() {
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: parseFloat(form.value),
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        expires_at: form.expires_at || null,
      };
      await createPromoCode(payload);
      setConfirmOpen(false);
      setCreateOpen(false);
      showToast("Promo code created!", "success");
      load();
    } catch (err) {
      const msg = err?.response?.data?.errors?.code?.[0] || err?.response?.data?.message || "Failed to create promo code.";
      setFormError(msg);
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitEdit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        expires_at: form.expires_at || null,
      };
      await updatePromoCode(editTarget.id, payload);
      setEditTarget(null);
      showToast("Promo code updated!", "success");
      load();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Failed to update promo code.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(code) {
    try {
      await updatePromoCode(code.id, { is_active: !code.is_active });
      setCodes((prev) => prev.map((c) => (c.id === code.id ? { ...c, is_active: !c.is_active } : c)));
      if (viewItem?.id === code.id) setViewItem((v) => ({ ...v, is_active: !v.is_active }));
      showToast(code.is_active ? "Promo code deactivated." : "Promo code activated.", "success");
    } catch {
      showToast("Failed to update status.", "error");
    }
  }

  function handleDelete(item) {
    // Flush any pending undo before starting a new one
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      if (undoItemRef.current) {
        deletePromoCode(undoItemRef.current.id).catch(() => {});
        undoItemRef.current = null;
      }
    }

    setDeleteTarget(null);
    if (viewItem?.id === item.id) setViewItem(null);

    // Optimistic removal
    setCodes((prev) => prev.filter((c) => c.id !== item.id));
    undoItemRef.current = item;

    const undoFn = () => {
      clearTimeout(undoTimerRef.current);
      undoItemRef.current = null;
      load(); // restore from server
    };

    showToast(`"${item.code}" deleted.`, "success", { label: "Undo", onClick: undoFn });

    undoTimerRef.current = setTimeout(() => {
      if (undoItemRef.current?.id === item.id) {
        deletePromoCode(item.id).catch(() => showToast("Failed to delete promo code.", "error"));
        undoItemRef.current = null;
      }
    }, 6000);
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      showToast("Code copied to clipboard!", "success");
    } catch {
      showToast("Failed to copy.", "error");
    }
  }

  /* ── bulk ── */
  function toggleSelect(id) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleSelectAll() {
    const allOnPage = paginated.every((c) => selected.has(c.id));
    if (allOnPage) setSelected(new Set());
    else setSelected(new Set(paginated.map((c) => c.id)));
  }
  async function bulkAction(action) {
    const ids = [...selected];
    try {
      if (action === "delete") {
        await Promise.all(ids.map((id) => deletePromoCode(id)));
        showToast(`${ids.length} code(s) deleted.`, "success");
      } else {
        const activate = action === "activate";
        await Promise.all(ids.map((id) => updatePromoCode(id, { is_active: activate })));
        showToast(`${ids.length} code(s) ${activate ? "activated" : "deactivated"}.`, "success");
      }
      setSelected(new Set());
      load();
    } catch {
      showToast("Some operations failed.", "error");
    }
  }

  /* ── sort ── */
  function handleSort(key) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("asc"); }
  }

  /* ── stats ── */
  const activeCount = codes.filter((c) => c.is_active && !isExpired(c)).length;
  const expiredCount = codes.filter((c) => isExpired(c)).length;

  /* ── view modal stat card helpers ── */
  function usesCardColor(item) {
    if (!item.max_uses) return { bg: "bg-emerald-100", text: "text-emerald-600", icon: "text-emerald-600" };
    const ratio = (item.uses_count || 0) / item.max_uses;
    if (ratio >= 1) return { bg: "bg-rose-100", text: "text-rose-600", icon: "text-rose-600" };
    if (ratio >= 0.8) return { bg: "bg-amber-100", text: "text-amber-600", icon: "text-amber-600" };
    return { bg: "bg-emerald-100", text: "text-emerald-600", icon: "text-emerald-600" };
  }

  /* ── skeleton ── */
  const SkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        <td className="px-5 py-3 w-10"><div className="h-4 w-4 bg-slate-200 rounded"></div></td>
        <td className="px-5 py-3"><div className="h-5 bg-slate-200 rounded w-28"></div></td>
        <td className="px-5 py-3"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
        <td className="px-5 py-3"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
        <td className="px-5 py-3"><div className="h-4 bg-slate-200 rounded w-14"></div></td>
        <td className="px-5 py-3"><div className="h-5 bg-slate-200 rounded-full w-16"></div></td>
        <td className="px-5 py-3"><div className="h-6 bg-slate-200 rounded w-28 ml-auto"></div></td>
      </tr>
    ));

  return (
    <div className="p-6 space-y-6">
      <Helmet><title>Promo Codes — Aplaya Beach Resort</title></Helmet>
      <Toast message={toast} type={toastType} onClose={clearToast} action={toastAction} />

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <i className="fas fa-ticket-alt text-indigo-600"></i>
            </span>
            Promo Codes
          </h1>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">Create and manage discount codes for guests.</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition">
          <i className="fas fa-plus text-xs"></i>
          <span className="text-sm font-medium">New Promo Code</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-mono leading-none">
            Ctrl+N
          </kbd>
        </button>
      </div>

      {/* Load error banner */}
      {loadError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-sm text-rose-700 font-medium flex items-center gap-2">
            <i className="fas fa-exclamation-triangle"></i>
            Failed to load promo codes.
          </span>
          <button onClick={load}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition">
            <i className="fas fa-redo mr-1.5"></i>Retry
          </button>
        </div>
      )}

      {/* Search + Filter */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input ref={searchRef} type="text" aria-label="Search promo codes" placeholder="Search by code..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-sm placeholder:text-slate-400 transition" />
          {searchTerm && (
            <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
              <i className="fas fa-times-circle text-sm"></i>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {[
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "inactive", label: "Inactive" },
            { key: "expired", label: "Expired" },
          ].map((f) => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold transition ${
                filterStatus === f.key
                  ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3 flex items-center justify-between animate-hero-fade-in opacity-0">
          <span className="text-sm font-medium text-indigo-800">
            <i className="fas fa-check-circle mr-2"></i>{selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => bulkAction("activate")}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition">
              <i className="fas fa-check mr-1.5"></i>Activate
            </button>
            <button onClick={() => bulkAction("deactivate")}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition">
              <i className="fas fa-pause mr-1.5"></i>Deactivate
            </button>
            <button onClick={() => setBulkDeleteConfirm(true)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition">
              <i className="fas fa-trash mr-1.5"></i>Delete
            </button>
            <button onClick={() => setSelected(new Set())}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 transition">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {/* Stats header */}
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-slate-600">Total</p>
              <p className="text-2xl font-semibold text-slate-900">{codes.length}</p>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div>
              <p className="text-sm text-slate-600">Active</p>
              <p className="text-2xl font-semibold text-emerald-600">{activeCount}</p>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div>
              <p className="text-sm text-slate-600">Expired</p>
              <p className="text-2xl font-semibold text-rose-500">{expiredCount}</p>
            </div>
          </div>
          {(debouncedSearch || filterStatus !== "all") && (
            <span className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200">
              Showing {filtered.length} of {codes.length}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 w-10"></th>
                  <th className="px-5 py-3 text-left">Code</th>
                  <th className="px-5 py-3 text-left">Discount</th>
                  <th className="px-5 py-3 text-left">Expires</th>
                  <th className="px-5 py-3 text-left">Uses</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100"><SkeletonRows /></tbody>
            </table>
          ) : sorted.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 mb-4">
                <i className="fas fa-ticket-alt text-slate-300 text-2xl"></i>
              </div>
              <p className="text-slate-500 font-medium">
                {debouncedSearch || filterStatus !== "all" ? "No promo codes match your search." : "No promo codes yet."}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {debouncedSearch || filterStatus !== "all"
                  ? "Try adjusting your search or filter."
                  : 'Click "New Promo Code" to create your first one.'}
              </p>
              {(debouncedSearch || filterStatus !== "all") && (
                <button onClick={() => { setSearchTerm(""); setFilterStatus("all"); }}
                  className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  <i className="fas fa-times mr-1.5"></i>Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <table className="w-full text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 w-10">
                      <input type="checkbox" checked={paginated.every((c) => selected.has(c.id)) && paginated.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
                    </th>
                    {[["Code","Code"],["Discount","Discount"],["Expires","Expires"],["Uses","Uses"],["Status","Status"]].map(([label,key]) => (
                      <th key={key} className="px-5 py-3 text-left">
                        <button onClick={() => handleSort(key)}
                          className="flex items-center gap-1 hover:text-indigo-600 transition-colors group">
                          {label}
                          <span className="text-slate-400 group-hover:text-indigo-400">
                            {sortBy === key
                              ? <i className={`fas fa-arrow-${sortDir === "asc" ? "up" : "down"} text-indigo-500`}></i>
                              : <i className="fas fa-sort opacity-40"></i>}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginated.map((code, idx) => (
                    <tr key={code.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setViewItem(code)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewItem(code); } }}
                      className={`cursor-pointer transition-all hover:bg-indigo-50/40 hover:shadow-sm ${idx % 2 === 1 ? "bg-slate-50/50" : ""} ${!code.is_active ? "opacity-60" : ""}`}>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(code.id)}
                          onChange={() => toggleSelect(code.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md text-xs tracking-wide">
                            {code.code}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-indigo-700">{formatDiscount(code)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={isExpired(code) ? "text-rose-500 font-medium" : "text-slate-600"}>
                          {formatDate(code.expires_at)}
                          {isExpired(code) && <span className="ml-1 text-[10px]">(expired)</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {code.uses_count || 0}{code.max_uses ? ` / ${code.max_uses}` : ""}
                      </td>
                      <td className="px-5 py-3">
                        {code.is_active && !isExpired(code) ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>Active
                          </span>
                        ) : isExpired(code) ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                            <span className="h-2 w-2 rounded-full bg-rose-500"></span>Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                            <span className="h-2 w-2 rounded-full bg-slate-400"></span>Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => copyCode(code.code)} title="Copy code"
                            className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
                            <i className="fas fa-copy text-xs"></i>
                          </button>
                          <button onClick={() => openEdit(code)} title="Edit"
                            className="h-8 w-8 rounded-lg hover:bg-sky-50 flex items-center justify-center text-sky-600 hover:text-sky-800 transition">
                            <i className="fas fa-pen text-xs"></i>
                          </button>
                          <button onClick={() => openDuplicate(code)} title="Duplicate"
                            className="h-8 w-8 rounded-lg hover:bg-violet-50 flex items-center justify-center text-violet-500 hover:text-violet-700 transition">
                            <i className="fas fa-clone text-xs"></i>
                          </button>
                          <button onClick={() => toggleActive(code)} title={code.is_active ? "Deactivate" : "Activate"}
                            className={`h-8 w-8 rounded-lg flex items-center justify-center transition ${code.is_active
                              ? "hover:bg-amber-50 text-amber-500 hover:text-amber-700"
                              : "hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700"}`}>
                            <i className={`fas ${code.is_active ? "fa-toggle-off" : "fa-toggle-on"} text-xs`}></i>
                          </button>
                          <button onClick={() => setDeleteTarget(code)} title="Delete"
                            className="h-8 w-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-rose-400 hover:text-rose-600 transition">
                            <i className="fas fa-trash text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Showing {(safePage - 1) * PAGE_SIZE + 1}&ndash;{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                      className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                      <i className="fas fa-chevron-left text-xs"></i>
                    </button>
                    {getPageNumbers(safePage, totalPages).map((n, idx) =>
                      n === "..." ? (
                        <span key={`ellipsis-${idx}`} className="h-8 min-w-[2rem] flex items-center justify-center text-xs text-slate-400">
                          &hellip;
                        </span>
                      ) : (
                        <button key={n} onClick={() => setPage(n)}
                          className={`h-8 min-w-[2rem] rounded-lg text-xs font-semibold transition ${
                            n === safePage
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}>
                          {n}
                        </button>
                      )
                    )}
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                      className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                      <i className="fas fa-chevron-right text-xs"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Retry */}
        {!loading && codes.length === 0 && !debouncedSearch && filterStatus === "all" && (
          <div className="px-6 pb-6 flex justify-center">
            <button onClick={load}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1.5">
              <i className="fas fa-redo text-xs"></i>Retry loading
            </button>
          </div>
        )}
      </div>

      {/* ── View Detail Modal ── */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} maxWidth="max-w-sm">
        {viewItem && (() => {
          const uc = usesCardColor(viewItem);
          return (
            <div>
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                    <i className="fas fa-ticket-alt text-indigo-600 text-lg"></i>
                  </span>
                  <div>
                    <h3 className="font-mono font-bold text-slate-900 tracking-wide">{viewItem.code}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {viewItem.is_active && !isExpired(viewItem) ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Active</span>
                      ) : isExpired(viewItem) ? (
                        <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-semibold">Expired</span>
                      ) : (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">Inactive</span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setViewItem(null)}
                  className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-3">
                  {/* Discount card */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                    <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center mx-auto mb-1.5">
                      <i className="fas fa-percent text-indigo-600 text-xs"></i>
                    </div>
                    <p className="text-sm font-bold text-indigo-700">{formatDiscount(viewItem)}</p>
                    <p className="text-[10px] text-slate-400">Discount</p>
                  </div>
                  {/* Type card */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                    <div className="h-8 w-8 rounded-lg bg-sky-100 flex items-center justify-center mx-auto mb-1.5">
                      <i className={`fas ${viewItem.type === "percentage" ? "fa-percent" : "fa-peso-sign"} text-sky-600 text-xs`}></i>
                    </div>
                    <p className="text-sm font-bold text-sky-700 capitalize">{viewItem.type}</p>
                    <p className="text-[10px] text-slate-400">Type</p>
                  </div>
                  {/* Uses card */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                    <div className={`h-8 w-8 rounded-lg ${uc.bg} flex items-center justify-center mx-auto mb-1.5`}>
                      <i className={`fas fa-chart-bar ${uc.icon} text-xs`}></i>
                    </div>
                    <p className={`text-sm font-bold ${uc.text}`}>
                      {viewItem.uses_count || 0}{viewItem.max_uses ? ` / ${viewItem.max_uses}` : ""}
                    </p>
                    <p className="text-[10px] text-slate-400">Uses</p>
                  </div>
                  {/* Expiry card */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                    <div className={`h-8 w-8 rounded-lg ${isExpired(viewItem) ? "bg-rose-100" : "bg-slate-200"} flex items-center justify-center mx-auto mb-1.5`}>
                      <i className={`fas fa-calendar-alt ${isExpired(viewItem) ? "text-rose-600" : "text-slate-500"} text-xs`}></i>
                    </div>
                    <p className={`text-sm font-bold ${isExpired(viewItem) ? "text-rose-600" : "text-slate-700"}`}>{formatDate(viewItem.expires_at)}</p>
                    <p className="text-[10px] text-slate-400">Expires</p>
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6 flex justify-end gap-2">
                <button onClick={() => setViewItem(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition">Close</button>
                <button onClick={() => copyCode(viewItem.code)}
                  className="px-4 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-medium transition">
                  <i className="fas fa-copy mr-1.5 text-xs"></i>Copy
                </button>
                <button onClick={() => openDuplicate(viewItem)}
                  className="px-4 py-2 border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl text-sm font-medium transition">
                  <i className="fas fa-clone mr-1.5 text-xs"></i>Duplicate
                </button>
                <button onClick={() => openEdit(viewItem)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition">
                  <i className="fas fa-pen mr-1.5 text-xs"></i>Edit
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Create Modal ── */}
      <Modal open={createOpen} onClose={guardedCloseCreate} maxWidth="max-w-md">
        <form onSubmit={handleSubmitCreate}>
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <i className="fas fa-ticket-alt text-indigo-600 text-lg"></i>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">New Promo Code</h2>
                <p className="text-xs text-slate-400">Create a discount code for guests</p>
              </div>
            </div>
            <button type="button" onClick={guardedCloseCreate}
              className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {formError && (
              <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                <i className="fas fa-exclamation-circle shrink-0"></i>{formError}
              </div>
            )}

            {/* Code */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-indigo-100 flex items-center justify-center"><i className="fas fa-tag text-indigo-500 text-[10px]"></i></span>
                  Promo Code
                </h3>
              </div>
              <div className="p-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Code <span className="text-red-400">*</span></label>
                <div className="flex gap-2">
                  <input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} required
                    placeholder="APLAYA-XXXX"
                    className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 placeholder:text-slate-300 transition" />
                  <button type="button" onClick={() => setForm((p) => ({ ...p, code: generateCode() }))}
                    className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition" title="Generate random code">
                    <i className="fas fa-dice"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Discount */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-emerald-100 flex items-center justify-center"><i className="fas fa-percent text-emerald-500 text-[10px]"></i></span>
                  Discount
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { t: "percentage", label: "Percentage", sub: "e.g. 10% off", icon: "fa-percent", bg: "peer-checked:bg-emerald-50 peer-checked:border-emerald-300 peer-checked:ring-1 peer-checked:ring-emerald-200" },
                      { t: "fixed", label: "Fixed Amount", sub: "e.g. \u20B1500 off", icon: "fa-peso-sign", bg: "peer-checked:bg-sky-50 peer-checked:border-sky-300 peer-checked:ring-1 peer-checked:ring-sky-200" },
                    ].map(({ t, label, sub, icon, bg }) => (
                      <label key={t} className="relative cursor-pointer select-none">
                        <input type="radio" name="type" value={t} checked={form.type === t}
                          onChange={() => setForm((p) => ({ ...p, type: t }))} className="peer sr-only" />
                        <div className={`flex flex-col items-center gap-1.5 p-3.5 bg-white border border-slate-200 rounded-lg transition-all hover:border-slate-300 ${bg}`}>
                          <i className={`fas ${icon} text-slate-400`}></i>
                          <span className="text-xs font-semibold text-slate-700">{label}</span>
                          <span className="text-[10px] text-slate-400">{sub}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    {form.type === "percentage" ? "Discount %" : "Discount Amount"} <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">
                      {form.type === "percentage" ? "%" : "\u20B1"}
                    </span>
                    <input type="number" min="0" max={form.type === "percentage" ? 100 : undefined} step="any"
                      value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} required
                      placeholder={form.type === "percentage" ? "e.g. 10" : "e.g. 500"}
                      className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 placeholder:text-slate-300 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Limits */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-amber-100 flex items-center justify-center"><i className="fas fa-sliders text-amber-500 text-[10px]"></i></span>
                  Limits <span className="text-slate-400 text-xs font-normal ml-1">optional</span>
                </h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Max Uses</label>
                  <input type="number" min="1" value={form.max_uses} onChange={(e) => setForm((p) => ({ ...p, max_uses: e.target.value }))}
                    placeholder="Unlimited"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 placeholder:text-slate-300 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Expiry Date</label>
                  <input type="date" value={form.expires_at} min={localDateStr()}
                    onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition" />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
            <button type="button" onClick={guardedCloseCreate}
              className="px-5 py-2.5 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium transition">Cancel</button>
            <button type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition flex items-center gap-2">
              <i className="fas fa-eye"></i> Review & Confirm
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Confirmation Modal ── */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="max-w-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <i className="fas fa-clipboard-check text-emerald-600 text-lg"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Confirm Promo Code</h2>
              <p className="text-xs text-slate-400">Review before creating</p>
            </div>
          </div>
          <button onClick={() => setConfirmOpen(false)}
            className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <div className="divide-y divide-slate-200">
              {[
                ["Code", <span key="code" className="font-mono font-bold text-slate-900 bg-amber-50 px-2 py-0.5 rounded">{form.code.trim().toUpperCase()}</span>],
                ["Discount", <span key="disc" className="font-semibold text-indigo-700">{form.type === "percentage" ? `${form.value}% off` : `\u20B1${Number(form.value).toLocaleString()} off`}</span>],
                ["Type", <span key="type" className="text-slate-700 capitalize">{form.type}</span>],
                ["Max Uses", form.max_uses ? <span key="uses" className="text-slate-700">{form.max_uses}</span> : <span key="uses" className="text-slate-400 italic">Unlimited</span>],
                ["Expiry", form.expires_at ? <span key="exp" className="text-slate-700">{new Date(form.expires_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</span> : <span key="exp" className="text-slate-400 italic">No expiry</span>],
                ["Status", <span key="status" className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Active on creation</span>],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-slate-500 font-medium">{label}</span>
                  <span className="text-sm">{val}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setConfirmOpen(false)}
              className="px-5 py-2.5 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium transition">
              Back to Edit
            </button>
            <button onClick={handleConfirmCreate} disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold shadow-sm transition flex items-center gap-2">
              {saving ? <><i className="fas fa-spinner fa-spin"></i> Creating...</> : <><i className="fas fa-check"></i> Confirm & Create</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal open={!!editTarget} onClose={guardedCloseEdit} maxWidth="max-w-md">
        {editTarget && (
          <form onSubmit={handleSubmitEdit}>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <i className="fas fa-pen text-indigo-600 text-lg"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Edit {editTarget.code}</h2>
                  <p className="text-xs text-slate-400">Update limits and expiry</p>
                </div>
              </div>
              <button type="button" onClick={guardedCloseEdit}
                className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {formError && (
                <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  <i className="fas fa-exclamation-circle shrink-0"></i>{formError}
                </div>
              )}

              {/* Read-only info */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-md bg-slate-200 flex items-center justify-center"><i className="fas fa-lock text-slate-500 text-[10px]"></i></span>
                    Code Details <span className="text-slate-400 text-xs font-normal ml-1">read-only</span>
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Code</p>
                    <p className="font-mono font-bold text-slate-900 bg-white px-3 py-2 rounded-lg border border-slate-200">{editTarget.code}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Discount</p>
                    <p className="font-semibold text-indigo-600 bg-white px-3 py-2 rounded-lg border border-slate-200">{formatDiscount(editTarget)}</p>
                  </div>
                </div>
              </div>

              {/* Editable limits */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-md bg-amber-100 flex items-center justify-center"><i className="fas fa-sliders text-amber-500 text-[10px]"></i></span>
                    Limits
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Max Uses</label>
                    <input type="number" min="1" value={form.max_uses} onChange={(e) => setForm((p) => ({ ...p, max_uses: e.target.value }))}
                      placeholder="Unlimited"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 placeholder:text-slate-300 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Expiry Date</label>
                    <input type="date" value={form.expires_at} onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition" />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button type="button" onClick={guardedCloseEdit}
                className="px-5 py-2.5 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium transition">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold shadow-sm transition">
                {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</> : <><i className="fas fa-check mr-2"></i>Save Changes</>}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Delete ConfirmDialog ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Promo Code"
        message={deleteTarget && <>Delete <strong className="font-mono">{deleteTarget?.code}</strong>? You can undo within 6 seconds.</>}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ── Bulk Delete ConfirmDialog ── */}
      <ConfirmDialog
        open={bulkDeleteConfirm}
        title="Delete Selected Codes"
        message={<>Delete <strong>{selected.size}</strong> selected promo code(s)? This action cannot be undone.</>}
        confirmLabel="Delete All"
        variant="danger"
        onConfirm={() => { setBulkDeleteConfirm(false); bulkAction("delete"); }}
        onCancel={() => setBulkDeleteConfirm(false)}
      />

      {/* ── Discard Unsaved Changes ConfirmDialog ── */}
      <ConfirmDialog
        open={!!discardConfirm}
        title="Discard unsaved changes?"
        message="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard"
        variant="warning"
        onConfirm={() => {
          if (discardConfirm === "create") setCreateOpen(false);
          else if (discardConfirm === "edit") setEditTarget(null);
          setDiscardConfirm(null);
        }}
        onCancel={() => setDiscardConfirm(null)}
      />
    </div>
  );
}
