import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "../../components/modals/Modal.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import Toast, { useToast } from "../../components/ui/Toast";
import { getAdminAddons, createAdminAddon, updateAdminAddon, deleteAdminAddon } from "../../lib/adminApi";
import useDebounce from "../../hooks/useDebounce.js";

const BLANK = {
  name: "", icon: "fa-tag", description: "", price: 0, max_qty: 1, per_booking: false, is_active: true,
};

const PAGE_SIZE = 10;

export default function AdminAddons() {
  const [toast, showToast, clearToast, toastType, toastAction] = useToast(6000);
  const undoRef = useRef(null);

  /* ── state ── */
  const [sortBy,  setSortBy]  = useState(() => localStorage.getItem("addons_sortBy") || "Name");
  const [sortDir, setSortDir] = useState(() => localStorage.getItem("addons_sortDir") || "asc");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [filterStatus, setFilterStatus] = useState("all"); // all | active | inactive
  const [page, setPage] = useState(1);

  const [addons,    setAddons]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewItem,  setViewItem]  = useState(null);

  const [selected, setSelected] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const searchRef = useRef(null);

  /* ── persist sort ── */
  useEffect(() => { localStorage.setItem("addons_sortBy", sortBy); }, [sortBy]);
  useEffect(() => { localStorage.setItem("addons_sortDir", sortDir); }, [sortDir]);

  /* ── load ── */
  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getAdminAddons()
      .then(r => setAddons(r.data.data))
      .catch(() => { setLoadError(true); showToast("Failed to load add-ons.", "error"); })
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (undoRef.current) clearTimeout(undoRef.current.timer); }, []);

  /* ── filter + sort + paginate ── */
  const filtered = addons.filter(a => {
    if (filterStatus === "active" && !a.is_active) return false;
    if (filterStatus === "inactive" && a.is_active) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return a.name.toLowerCase().includes(q) || (a.description || "").toLowerCase().includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal;
    if (sortBy === "Price")       { aVal = Number(a.price);   bVal = Number(b.price); }
    else if (sortBy === "Max Qty") { aVal = Number(a.max_qty); bVal = Number(b.max_qty); }
    else if (sortBy === "Type")    { aVal = a.per_booking ? 1 : 0; bVal = b.per_booking ? 1 : 0; }
    else if (sortBy === "Status")  { aVal = a.is_active ? 0 : 1; bVal = b.is_active ? 0 : 1; }
    else { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ?  1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // reset page when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, filterStatus]);

  /* ── pagination helpers (ellipsis) ── */
  function getPageNumbers() {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("...");
      const start = Math.max(2, safePage - 1);
      const end   = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }

  /* ── CRUD helpers ── */
  function openNew() {
    const data = { ...BLANK };
    setEditing(data);
    setEditSnapshot(JSON.stringify(data));
    setViewItem(null);
    setModalOpen(true);
  }

  function openEdit(item) {
    const data = { ...item };
    setEditing(data);
    setEditSnapshot(JSON.stringify(data));
    setViewItem(null);
    setModalOpen(true);
  }

  function openDuplicate(item) {
    const clone = { ...item };
    delete clone.id;
    clone.name = `${item.name} (Copy)`;
    setEditing(clone);
    setEditSnapshot(JSON.stringify(clone));
    setViewItem(null);
    setModalOpen(true);
  }

  function guardedCloseModal() {
    if (editing && editSnapshot && JSON.stringify(editing) !== editSnapshot) {
      setDiscardOpen(true);
      return;
    }
    setModalOpen(false);
    setEditing(null);
  }

  function confirmDiscard() {
    setDiscardOpen(false);
    setModalOpen(false);
    setEditing(null);
  }

  function setField(k, v) {
    setEditing(x => ({ ...x, [k]: v }));
  }

  // Save flow: form submit → requestSaveAddon (validates + opens
  // confirm) → user confirms → saveAddon (does the API call).
  // Add-ons are inventory items — wrong price or max_qty propagates
  // to every booking that picks them, so confirm gates the commit.
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  function requestSaveAddon(e) {
    e.preventDefault();
    if (!editing.name?.trim()) {
      showToast("Name is required.", "error");
      return;
    }
    setSaveConfirmOpen(true);
  }

  async function saveAddon() {
    setSaveConfirmOpen(false);
    setSaving(true);
    const payload = {
      name:        editing.name.trim(),
      icon:        editing.icon?.trim() || "fa-tag",
      description: editing.description || undefined,
      price:       Number(editing.price),
      max_qty:     Number(editing.max_qty),
      per_booking: Boolean(editing.per_booking),
      is_active:   Boolean(editing.is_active),
    };
    try {
      if (editing.id) {
        await updateAdminAddon(editing.id, payload);
        showToast("Add-on updated successfully!", "success");
      } else {
        await createAdminAddon(payload);
        showToast("Add-on created successfully!", "success");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    try {
      await updateAdminAddon(item.id, { is_active: !item.is_active });
      setAddons(list => list.map(a => a.id === item.id ? { ...a, is_active: !a.is_active } : a));
      if (viewItem?.id === item.id) setViewItem(v => ({ ...v, is_active: !v.is_active }));
      showToast(`${item.name} ${item.is_active ? "deactivated" : "activated"}.`, "success");
    } catch {
      showToast("Failed to update status.", "error");
    }
  }

  /* ── #9 single delete with undo ── */
  function handleDelete(item) {
    // Cancel any pending undo
    if (undoRef.current) { clearTimeout(undoRef.current.timer); undoRef.current = null; }

    // Optimistic removal
    setAddons(prev => prev.filter(a => a.id !== item.id));
    setConfirmDelete(null);
    if (viewItem?.id === item.id) setViewItem(null);
    setSelected(prev => { const next = new Set(prev); next.delete(item.id); return next; });

    const timer = setTimeout(async () => {
      try {
        await deleteAdminAddon(item.id);
      } catch {
        // Restore on API fail
        setAddons(prev => [...prev, item]);
        showToast("Failed to delete add-on.", "error");
      }
      undoRef.current = null;
    }, 6000);

    undoRef.current = { timer, item };

    showToast(`"${item.name}" deleted.`, "success", {
      label: "Undo",
      onClick: () => {
        clearTimeout(timer);
        undoRef.current = null;
        setAddons(prev => [...prev, item]);
      },
    });
  }

  /* ── #2 bulk delete with confirm + undo ── */
  function handleBulkDelete() {
    if (undoRef.current) { clearTimeout(undoRef.current.timer); undoRef.current = null; }

    const ids = [...selected];
    const removedItems = addons.filter(a => ids.includes(a.id));

    // Optimistic removal
    setAddons(prev => prev.filter(a => !ids.includes(a.id)));
    setSelected(new Set());
    setBulkDeleteOpen(false);

    const timer = setTimeout(async () => {
      try {
        await Promise.all(ids.map(id => deleteAdminAddon(id)));
      } catch {
        setAddons(prev => [...prev, ...removedItems]);
        showToast("Some deletions failed.", "error");
      }
      undoRef.current = null;
    }, 6000);

    undoRef.current = { timer, items: removedItems };

    showToast(`${ids.length} add-on${ids.length > 1 ? "s" : ""} deleted.`, "success", {
      label: "Undo",
      onClick: () => {
        clearTimeout(timer);
        undoRef.current = null;
        setAddons(prev => [...prev, ...removedItems]);
      },
    });
  }

  /* ── bulk ── */
  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /* ── #3 fix stale selection — only toggle current page IDs ── */
  function toggleSelectAll() {
    const pageIds = new Set(paginated.map(a => a.id));
    setSelected(prev => {
      const allPageSelected = paginated.length > 0 && paginated.every(a => prev.has(a.id));
      if (allPageSelected) {
        // Deselect only this page's IDs
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      } else {
        // Select this page's IDs (keep others)
        const next = new Set(prev);
        pageIds.forEach(id => next.add(id));
        return next;
      }
    });
  }

  async function bulkToggle(activate) {
    const ids = [...selected];
    try {
      await Promise.all(ids.map(id => updateAdminAddon(id, { is_active: activate })));
      showToast(`${ids.length} add-on(s) ${activate ? "activated" : "deactivated"}.`, "success");
      setSelected(new Set());
      load();
    } catch {
      showToast("Some updates failed.", "error");
    }
  }

  /* ── sort click ── */
  function handleSort(key) {
    if (sortBy === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortDir("asc"); }
  }

  /* ── skeleton rows ── */
  const SkeletonRows = () => (
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-3/4"></div></td>
        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-10"></div></td>
        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
      </tr>
    ))
  );

  /* ── helpers for select-all checkbox state ── */
  const allPageSelected = paginated.length > 0 && paginated.every(a => selected.has(a.id));
  const somePageSelected = paginated.some(a => selected.has(a.id)) && !allPageSelected;

  return (
    <div className="p-6 space-y-6">
      <Toast message={toast} type={toastType} onClose={clearToast} action={toastAction} />

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <i className="fas fa-puzzle-piece text-emerald-600" aria-hidden="true"></i>
            </span>
            Add-ons
          </h2>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">Manage bookable add-ons guests can attach to their reservation.</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
        >
          <i className="fas fa-plus text-xs" aria-hidden="true"></i>
          <span className="text-sm font-medium">New Add-on</span>
        </button>
      </div>

      {/* Search + Filter bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search add-ons by name or description..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-sm placeholder:text-slate-400 transition"
          />
          {searchTerm && (
            <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
              <i className="fas fa-times-circle text-sm" aria-hidden="true"></i>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {["all", "active", "inactive"].map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold capitalize transition ${
                filterStatus === f
                  ? "bg-success-bg text-success-fg ring-1 ring-emerald-200"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}>
              {f === "all" ? "All" : f === "active" ? "Active" : "Inactive"}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 flex items-center justify-between animate-hero-fade-in opacity-0">
          <span className="text-sm font-medium text-emerald-800">
            <i className="fas fa-check-circle mr-2" aria-hidden="true"></i>{selected.size} add-on{selected.size > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => bulkToggle(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition">
              <i className="fas fa-check mr-1.5" aria-hidden="true"></i>Activate
            </button>
            <button onClick={() => bulkToggle(false)}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition">
              <i className="fas fa-pause mr-1.5" aria-hidden="true"></i>Deactivate
            </button>
            <button onClick={() => setBulkDeleteOpen(true)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition">
              <i className="fas fa-trash mr-1.5" aria-hidden="true"></i>Delete
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
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">Total add-ons</p>
            <p className="text-2xl font-semibold text-slate-900">{addons.length}</p>
          </div>
          {debouncedSearch || filterStatus !== "all" ? (
            <span className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200">
              Showing {filtered.length} of {addons.length}
            </span>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <>
            <table className="hidden md:table min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 w-10"></th>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Price</th>
                  <th className="px-6 py-3 text-left">Max Qty</th>
                  <th className="px-6 py-3 text-left">Type</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <SkeletonRows />
              </tbody>
            </table>
            <ul className="md:hidden space-y-3 p-4" aria-busy="true" aria-label="Loading add-ons">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-200 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-slate-200 rounded w-32" />
                      <div className="h-3 bg-slate-100 rounded w-20" />
                    </div>
                    <div className="h-5 bg-slate-200 rounded-full w-16" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
                    <div className="h-8 bg-slate-100 rounded" />
                    <div className="h-8 bg-slate-100 rounded" />
                  </div>
                </li>
              ))}
            </ul>
            </>
          ) : loadError && addons.length === 0 ? (
            /* ── #6 error state with retry ── */
            <div className="px-6 py-16 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-rose-100 mb-4">
                <i className="fas fa-exclamation-triangle text-rose-400 text-2xl" aria-hidden="true"></i>
              </div>
              <p className="text-slate-700 font-semibold">Failed to load add-ons</p>
              <p className="text-sm text-slate-400 mt-1 mb-5">Check your connection and try again.</p>
              <button onClick={load}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition">
                <i className="fas fa-redo text-xs" aria-hidden="true"></i>Retry
              </button>
            </div>
          ) : sorted.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 mb-4">
                <i className="fas fa-puzzle-piece text-slate-300 text-2xl" aria-hidden="true"></i>
              </div>
              <p className="text-slate-500 font-medium">
                {debouncedSearch || filterStatus !== "all"
                  ? "No add-ons match your search."
                  : "No add-ons yet."}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {debouncedSearch || filterStatus !== "all"
                  ? "Try adjusting your search or filter."
                  : 'Click "New Add-on" to create your first one.'}
              </p>
              {(debouncedSearch || filterStatus !== "all") && (
                <button onClick={() => { setSearchTerm(""); setFilterStatus("all"); }}
                  className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                  <i className="fas fa-times mr-1.5" aria-hidden="true"></i>Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table — wrapped hidden md:table so the mobile
                  card list (rendered below) is the sole listing visible
                  <md. 7 cols + 4 inline action buttons doesn't fit
                  phone widths. */}
              <table className="hidden md:table min-w-full text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-6 py-3 w-10">
                      <input type="checkbox"
                        checked={allPageSelected}
                        ref={el => { if (el) el.indeterminate = somePageSelected; }}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400" />
                    </th>
                    {[["Name","Name"],["Price","Price"],["Max Qty","Max Qty"],["Type","Type"],["Status","Status"]].map(([label,key]) => (
                      <th key={key} className="px-6 py-3 text-left">
                        <button onClick={() => handleSort(key)}
                          className="flex items-center gap-1 hover:text-emerald-600 transition-colors group">
                          {label}
                          <span className="text-slate-400 group-hover:text-emerald-400">
                            {sortBy===key ? <i className={`fas fa-arrow-${sortDir==="asc"?"up":"down"} text-emerald-500`} aria-hidden="true"></i> : <i className="fas fa-sort opacity-40" aria-hidden="true"></i>}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="px-6 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginated.map((item, idx) => (
                    <tr
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setViewItem(item)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewItem(item); } }}
                      className={`cursor-pointer transition-all hover:bg-emerald-50/40 hover:shadow-sm ${idx % 2 === 1 ? "bg-slate-50/50" : ""}`}
                    >
                      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400" />
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <span className="flex items-center gap-2.5">
                          <span className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <i className={`fas ${item.icon || "fa-tag"} text-slate-500 text-sm`} aria-hidden="true"></i>
                          </span>
                          {item.name || <span className="italic text-slate-400">Unnamed</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-800">{"\u20B1"}{Number(item.price).toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">{item.max_qty}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          item.per_booking ? "bg-purple-100 text-purple-800" : "bg-info-bg text-info-fg"
                        }`}>
                          {item.per_booking ? "Per Booking" : "Per Item"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                          item.is_active ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg"
                        }`}>
                          <span className={`h-2 w-2 rounded-full ${item.is_active ? "bg-success-ring" : "bg-danger-ring"}`} />
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => openEdit(item)} title={`Edit ${item.name}`} aria-label={`Edit ${item.name}`}
                            className="h-11 w-11 rounded-lg hover:bg-sky-50 flex items-center justify-center text-sky-700 hover:text-sky-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
                            <i className="fas fa-pen text-sm" aria-hidden="true"></i>
                          </button>
                          <button type="button" onClick={() => openDuplicate(item)} title={`Duplicate ${item.name}`} aria-label={`Duplicate ${item.name}`}
                            className="h-11 w-11 rounded-lg hover:bg-violet-50 flex items-center justify-center text-violet-600 hover:text-violet-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">
                            <i className="fas fa-copy text-sm" aria-hidden="true"></i>
                          </button>
                          <button type="button"
                            onClick={() => toggleActive(item)} title={item.is_active ? `Deactivate ${item.name}` : `Activate ${item.name}`} aria-label={item.is_active ? `Deactivate ${item.name}` : `Activate ${item.name}`}
                            className={`h-11 w-11 rounded-lg flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${item.is_active
                              ? "hover:bg-amber-50 text-amber-600 hover:text-amber-800 focus-visible:ring-amber-500"
                              : "hover:bg-emerald-50 text-emerald-600 hover:text-emerald-800 focus-visible:ring-emerald-500"}`}
                          >
                            <i className={`fas ${item.is_active ? "fa-toggle-off" : "fa-toggle-on"} text-sm`} aria-hidden="true"></i>
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(item)} title={`Delete ${item.name}`} aria-label={`Delete ${item.name}`}
                            className="h-11 w-11 rounded-lg hover:bg-rose-50 flex items-center justify-center text-rose-600 hover:text-rose-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2">
                            <i className="fas fa-trash text-sm" aria-hidden="true"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile card list — same paginated set. Whole-card tap
                  opens the detail viewer; action buttons (edit /
                  duplicate / toggle / delete) sit inline at the
                  bottom with stopPropagation so taps don't also fire
                  the card click. */}
              <ul className="md:hidden space-y-3 p-4">
                {paginated.map((item) => (
                  <li key={item.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setViewItem(item)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewItem(item); } }}
                      className={`rounded-xl border border-slate-200 bg-white shadow-sm p-4 cursor-pointer hover:bg-emerald-50/40 transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${!item.is_active ? 'opacity-70' : ''}`}
                    >
                      {/* Top row — checkbox + icon + name + status pill */}
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${item.name || 'add-on'}`}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400 shrink-0"
                        />
                        <span className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <i className={`fas ${item.icon || 'fa-tag'} text-slate-500`} aria-hidden="true"></i>
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {item.name || <span className="italic text-slate-400">Unnamed</span>}
                          </p>
                          <p className="text-base font-semibold text-slate-800 mt-0.5">
                            {'₱'}{Number(item.price).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            item.is_active ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg'
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${item.is_active ? 'bg-success-ring' : 'bg-danger-ring'}`} aria-hidden="true" />
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {/* Body — Max Qty + Type */}
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">Max Qty</p>
                          <p className="text-sm text-slate-700 mt-0.5">{item.max_qty}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">Type</p>
                          <span className={`mt-0.5 inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            item.per_booking ? 'bg-purple-100 text-purple-800' : 'bg-info-bg text-info-fg'
                          }`}>
                            {item.per_booking ? 'Per Booking' : 'Per Item'}
                          </span>
                        </div>
                      </div>

                      {/* Action cluster — same four buttons as desktop. */}
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openEdit(item)} aria-label={`Edit ${item.name || 'add-on'}`}
                          className="h-10 w-10 rounded-lg hover:bg-sky-50 flex items-center justify-center text-sky-600 hover:text-sky-800 transition">
                          <i className="fas fa-pen text-xs" aria-hidden="true"></i>
                        </button>
                        <button onClick={() => openDuplicate(item)} aria-label={`Duplicate ${item.name || 'add-on'}`}
                          className="h-10 w-10 rounded-lg hover:bg-violet-50 flex items-center justify-center text-violet-500 hover:text-violet-700 transition">
                          <i className="fas fa-copy text-xs" aria-hidden="true"></i>
                        </button>
                        <button
                          onClick={() => toggleActive(item)}
                          aria-label={item.is_active ? `Deactivate ${item.name || 'add-on'}` : `Activate ${item.name || 'add-on'}`}
                          className={`h-10 w-10 rounded-lg flex items-center justify-center transition ${item.is_active
                            ? 'hover:bg-amber-50 text-amber-500 hover:text-amber-700'
                            : 'hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700'}`}
                        >
                          <i className={`fas ${item.is_active ? 'fa-toggle-off' : 'fa-toggle-on'} text-xs`} aria-hidden="true"></i>
                        </button>
                        <button onClick={() => setConfirmDelete(item)} aria-label={`Delete ${item.name || 'add-on'}`}
                          className="h-10 w-10 rounded-lg hover:bg-rose-50 flex items-center justify-center text-rose-400 hover:text-rose-600 transition">
                          <i className="fas fa-trash text-xs" aria-hidden="true"></i>
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* ── #7 Pagination with ellipsis ── */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                      aria-label="Previous page"
                      className="h-11 w-11 rounded-lg border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
                      <i className="fas fa-chevron-left text-sm" aria-hidden="true"></i>
                    </button>
                    {getPageNumbers().map((n, i) =>
                      n === "..." ? (
                        <span key={`ellipsis-${i}`} className="h-11 min-w-[2.75rem] flex items-center justify-center text-sm text-slate-500">…</span>
                      ) : (
                        <button key={n} type="button" onClick={() => setPage(n)}
                          aria-label={`Go to page ${n}`}
                          aria-current={n === safePage ? 'page' : undefined}
                          className={`h-11 min-w-[2.75rem] rounded-lg text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                            n === safePage
                              ? "bg-emerald-600 text-white shadow-sm focus-visible:ring-emerald-500"
                              : "border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400"
                          }`}>
                          {n}
                        </button>
                      )
                    )}
                    <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                      aria-label="Next page"
                      className="h-11 w-11 rounded-lg border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
                      <i className="fas fa-chevron-right text-sm" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── #8 View Detail Modal — colored stat cards ── */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} maxWidth="max-w-sm" label={viewItem ? `Add-on details — ${viewItem.name}` : 'Add-on details'}>
        {viewItem && (
          <div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <i className={`fas ${viewItem.icon || "fa-tag"} text-emerald-600`} aria-hidden="true"></i>
                </span>
                {viewItem.name || <span className="italic text-slate-400">Unnamed</span>}
              </h3>
              <button type="button" onClick={() => setViewItem(null)} className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" aria-label="Close">
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Price card */}
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-6 w-6 rounded-md bg-emerald-100 flex items-center justify-center">
                      <i className="fas fa-peso-sign text-emerald-600 text-[10px]" aria-hidden="true"></i>
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Price</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-800">{"\u20B1"}{Number(viewItem.price).toLocaleString()}</p>
                </div>
                {/* Max Qty card */}
                <div className="rounded-xl bg-sky-50 border border-sky-100 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-6 w-6 rounded-md bg-sky-100 flex items-center justify-center">
                      <i className="fas fa-layer-group text-sky-600 text-[10px]" aria-hidden="true"></i>
                    </span>
                    <span className="text-[10px] font-semibold text-sky-600 uppercase tracking-wide">Max Qty</span>
                  </div>
                  <p className="text-lg font-bold text-sky-800">{viewItem.max_qty}</p>
                </div>
                {/* Type card */}
                <div className={`rounded-xl border p-3.5 ${viewItem.per_booking ? "bg-purple-50 border-purple-100" : "bg-sky-50 border-sky-100"}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`h-6 w-6 rounded-md flex items-center justify-center ${viewItem.per_booking ? "bg-purple-100" : "bg-sky-100"}`}>
                      <i className={`fas ${viewItem.per_booking ? "fa-receipt" : "fa-layer-group"} text-[10px] ${viewItem.per_booking ? "text-purple-600" : "text-sky-600"}`} aria-hidden="true"></i>
                    </span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${viewItem.per_booking ? "text-purple-600" : "text-sky-600"}`}>Type</span>
                  </div>
                  <p className={`text-sm font-bold ${viewItem.per_booking ? "text-purple-800" : "text-sky-800"}`}>
                    {viewItem.per_booking ? "Per Booking (flat)" : "Per Item"}
                  </p>
                </div>
                {/* Status card */}
                <div className={`rounded-xl border p-3.5 ${viewItem.is_active ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`h-6 w-6 rounded-md flex items-center justify-center ${viewItem.is_active ? "bg-emerald-100" : "bg-rose-100"}`}>
                      <i className={`fas ${viewItem.is_active ? "fa-check-circle" : "fa-pause-circle"} text-[10px] ${viewItem.is_active ? "text-emerald-600" : "text-rose-600"}`} aria-hidden="true"></i>
                    </span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${viewItem.is_active ? "text-emerald-600" : "text-rose-600"}`}>Status</span>
                  </div>
                  <p className={`text-sm font-bold ${viewItem.is_active ? "text-emerald-800" : "text-rose-800"}`}>
                    {viewItem.is_active ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
              {viewItem.description && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-slate-700">{viewItem.description}</p>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex justify-end gap-2">
              <button onClick={() => setViewItem(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition">
                Close
              </button>
              <button onClick={() => openDuplicate(viewItem)}
                className="px-4 py-2 border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl text-sm font-medium transition">
                <i className="fas fa-copy mr-1.5 text-xs" aria-hidden="true"></i>Duplicate
              </button>
              <button onClick={() => openEdit(viewItem)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition">
                <i className="fas fa-pen mr-1.5 text-xs" aria-hidden="true"></i>Edit
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Save Add-on Confirm ── */}
      <ConfirmDialog
        open={saveConfirmOpen}
        title={editing?.id ? "Save add-on changes?" : "Create add-on?"}
        message={editing?.id
          ? <>Save changes to <strong>{editing?.name || 'this add-on'}</strong>? Pricing and inventory will apply to new bookings from now on.</>
          : <>Create <strong>{editing?.name || 'this add-on'}</strong> at <strong>₱{Number(editing?.price ?? 0).toLocaleString()}</strong>? It becomes available immediately.</>}
        confirmLabel={editing?.id ? "Save changes" : "Create add-on"}
        variant={editing?.id ? "info" : "warning"}
        onConfirm={saveAddon}
        onCancel={() => setSaveConfirmOpen(false)}
      />

      {/* ── Delete Confirm (single) ── */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Add-on"
        message={<>Are you sure you want to delete <strong>"{confirmDelete?.name}"</strong>? You can undo within 6 seconds.</>}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* ── #2 Bulk Delete Confirm ── */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Delete Selected Add-ons"
        message={<>Delete <strong>{selected.size}</strong> add-on{selected.size > 1 ? "s" : ""}? You can undo within 6 seconds.</>}
        confirmLabel={`Delete ${selected.size}`}
        variant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />

      {/* ── Discard Changes Confirm ── */}
      <ConfirmDialog
        open={discardOpen}
        title="Unsaved Changes"
        message="You have unsaved changes. Discard them?"
        confirmLabel="Discard"
        variant="warning"
        onConfirm={confirmDiscard}
        onCancel={() => setDiscardOpen(false)}
      />

      {/* ── Create / Edit Modal ── */}
      <Modal open={modalOpen} onClose={guardedCloseModal} maxWidth="max-w-xl" label={editing ? `Edit add-on — ${editing.name}` : 'Add new add-on'}>
        <form onSubmit={requestSaveAddon}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <i className={`fas ${editing?.icon || "fa-tag"} text-emerald-600 text-lg`} aria-hidden="true"></i>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{editing?.id ? `Edit \u2014 ${editing.name || "Unnamed"}` : "New Add-on"}</h2>
                <p className="text-xs text-slate-400">{editing?.id ? "Update pricing and settings" : "Create a bookable add-on for guests"}</p>
              </div>
            </div>
            <button type="button" onClick={guardedCloseModal}
              className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
              <i className="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>

          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {/* Basic Info */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-sky-100 flex items-center justify-center">
                    <i className="fas fa-info-circle text-sky-500 text-[10px]" aria-hidden="true"></i>
                  </span>Basic Info
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Name <span className="text-red-400">*</span></label>
                  {editing?.id ? (
                    <div className="w-full px-3.5 py-2.5 border border-slate-100 rounded-lg bg-slate-100 text-sm text-slate-500">{editing.name || <span className="italic">Unnamed</span>}</div>
                  ) : (
                    <input required placeholder="e.g. Extra Towel" value={editing?.name || ""} onChange={e => setField("name", e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-sm placeholder:text-slate-300 transition" />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Description</label>
                  <input placeholder="Short description shown to guests" value={editing?.description || ""} onChange={e => setField("description", e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-sm placeholder:text-slate-300 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Icon</label>
                  <div className="grid grid-cols-8 gap-1.5">
                    {[
                      { icon: "fa-tag", label: "Tag" }, { icon: "fa-bed", label: "Bed" }, { icon: "fa-microphone", label: "Karaoke" },
                      { icon: "fa-utensils", label: "Food" }, { icon: "fa-glass-cheers", label: "Drinks" }, { icon: "fa-spa", label: "Spa" },
                      { icon: "fa-swimmer", label: "Pool" }, { icon: "fa-umbrella-beach", label: "Beach" }, { icon: "fa-gamepad", label: "Games" },
                      { icon: "fa-tv", label: "TV" }, { icon: "fa-wifi", label: "WiFi" }, { icon: "fa-car", label: "Parking" },
                      { icon: "fa-shuttle-van", label: "Transport" }, { icon: "fa-snowflake", label: "AC" }, { icon: "fa-fire", label: "BBQ" },
                      { icon: "fa-campfire", label: "Bonfire" }, { icon: "fa-camera", label: "Photo" }, { icon: "fa-birthday-cake", label: "Event" },
                      { icon: "fa-music", label: "Music" }, { icon: "fa-first-aid", label: "First Aid" }, { icon: "fa-broom", label: "Cleaning" },
                      { icon: "fa-concierge-bell", label: "Service" }, { icon: "fa-life-ring", label: "Safety" }, { icon: "fa-anchor", label: "Nautical" },
                    ].map(({ icon, label }) => (
                      <button key={icon} type="button" title={label} onClick={() => setField("icon", icon)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                          editing?.icon === icon
                            ? "border-emerald-400 bg-emerald-50 text-emerald-600 ring-2 ring-emerald-200 shadow-sm"
                            : "border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-white hover:text-slate-600"
                        }`}>
                        <i className={`fas ${icon} text-base`} aria-hidden="true"></i>
                        <span className="text-[9px] leading-none text-center truncate w-full">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-emerald-100 flex items-center justify-center">
                    <i className="fas fa-peso-sign text-emerald-500 text-[10px]" aria-hidden="true"></i>
                  </span>Pricing
                </h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Price <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">{"\u20B1"}</span>
                    <input required type="number" min={0} value={editing?.price ?? ""} onChange={e => setField("price", e.target.value)}
                      className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-sm transition" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Max Qty <span className="text-red-400">*</span></label>
                  <input required type="number" min={1} max={100} value={editing?.max_qty ?? ""} onChange={e => setField("max_qty", e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-sm transition" />
                </div>
                {/* ── #4 pricing type radio — conditional class instead of peer-checked on icon ── */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Pricing Type <span className="text-red-400">*</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { val: false, label: "Per Item", sub: "Price \u00D7 quantity", icon: "fa-layer-group", activeBg: "bg-sky-50 border-sky-300 ring-1 ring-sky-200", activeIcon: "text-sky-500" },
                      { val: true,  label: "Per Booking", sub: "Flat fee once", icon: "fa-receipt", activeBg: "bg-purple-50 border-purple-300 ring-1 ring-purple-200", activeIcon: "text-purple-500" },
                    ].map(({ val, label, sub, icon, activeBg, activeIcon }) => {
                      const isChecked = Boolean(editing?.per_booking) === val;
                      return (
                        <button key={String(val)} type="button" onClick={() => setField("per_booking", val)}
                          className={`flex flex-col items-center gap-1.5 p-3.5 border rounded-lg transition-all cursor-pointer ${
                            isChecked ? activeBg : "bg-white border-slate-200 hover:border-slate-300"
                          }`}>
                          <i className={`fas ${icon} ${isChecked ? activeIcon : "text-slate-400"}`} aria-hidden="true"></i>
                          <span className="text-xs font-semibold text-slate-700">{label}</span>
                          <span className="text-[10px] text-slate-400">{sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-amber-100 flex items-center justify-center">
                    <i className="fas fa-cog text-amber-500 text-[10px]" aria-hidden="true"></i>
                  </span>Settings
                </h3>
              </div>
              <div className="p-4">
                <div
                  onClick={() => setField("is_active", !editing?.is_active)}
                  className="flex items-center justify-between cursor-pointer select-none p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${editing?.is_active ? "bg-emerald-100" : "bg-slate-100"}`}>
                      <i className={`fas ${editing?.is_active ? "fa-check-circle text-emerald-500" : "fa-pause-circle text-slate-400"}`} aria-hidden="true"></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{editing?.is_active ? "Active" : "Inactive"}</p>
                      <p className="text-xs text-slate-400">{editing?.is_active ? "Visible and bookable by guests" : "Hidden from guests"}</p>
                    </div>
                  </div>
                  <div
                    className={`relative w-11 h-6 rounded-full transition-colors ${editing?.is_active ? "bg-success-ring" : "bg-slate-300"}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${editing?.is_active ? "left-6" : "left-1"}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
            <button type="button" onClick={guardedCloseModal}
              className="inline-flex items-center justify-center min-h-11 px-5 py-2.5 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">Cancel</button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center justify-center min-h-11 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
              {saving ? <><i className="fas fa-spinner fa-spin mr-2" aria-hidden="true"></i>Saving...</> : <><i className="fas fa-check mr-2" aria-hidden="true"></i>{editing?.id ? "Save Changes" : "Create Add-on"}</>}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
