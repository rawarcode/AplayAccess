import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "../../components/modals/Modal.jsx";
import Toast, { useToast } from "../../components/ui/Toast";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import {
  getAdminAnnouncements,
  createAdminAnnouncement,
  updateAdminAnnouncement,
  deleteAdminAnnouncement,
} from "../../lib/adminApi";
import { isVideoUrl } from "../../lib/uploadApi.js";
import MediaPicker from "../../components/ui/MediaPicker.jsx";
import useDebounce from "../../hooks/useDebounce.js";

const BLANK = {
  title: "",
  body: "",
  media_url: "",
  is_active: true,
  is_pinned: false,
  published_at: new Date().toISOString().slice(0, 16),
};

const BODY_MAX = 1000;
const PAGE_SIZE = 10;
const UNDO_DELAY = 6000;

function formatDate(str) {
  if (!str) return "\u2014";
  return new Date(str).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Pagination ellipsis helper */
function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total]);
  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 1 && i <= total) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push("...");
    result.push(p);
    prev = p;
  }
  return result;
}

export default function AdminAnnouncements() {
  const [toast, showToast, clearToast, toastType, toastAction] = useToast();

  /* ── state ── */
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [filterStatus, setFilterStatus] = useState("all"); // all | active | inactive | pinned
  const [page, setPage] = useState(1);

  const [sortBy, setSortBy] = useState(() => localStorage.getItem("ann_sortBy") || "Published");
  const [sortDir, setSortDir] = useState(() => localStorage.getItem("ann_sortDir") || "desc");

  const [selected, setSelected] = useState(new Set());

  const searchRef = useRef(null);
  const editSnapshot = useRef(null);
  const undoTimerRef = useRef(null);
  const undoItemRef = useRef(null);

  /* ── persist sort ── */
  useEffect(() => { localStorage.setItem("ann_sortBy", sortBy); }, [sortBy]);
  useEffect(() => { localStorage.setItem("ann_sortDir", sortDir); }, [sortDir]);

  /* ── Ctrl+N shortcut ── */
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        openNew();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── load ── */
  const load = useCallback(() => {
    setLoading(true);
    getAdminAnnouncements()
      .then((r) => {
        setAnnouncements(r.data?.data ?? []);
        setLoadError(false);
      })
      .catch(() => {
        setLoadError(true);
        showToast("Failed to load announcements.", "error");
      })
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  /* ── filter + sort + paginate ── */
  const filtered = announcements.filter((a) => {
    if (filterStatus === "active" && !a.is_active) return false;
    if (filterStatus === "inactive" && a.is_active) return false;
    if (filterStatus === "pinned" && !a.is_pinned) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return a.title.toLowerCase().includes(q) || (a.body || "").toLowerCase().includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal;
    if (sortBy === "Title") { aVal = a.title.toLowerCase(); bVal = b.title.toLowerCase(); }
    else if (sortBy === "Status") { aVal = a.is_active ? 0 : 1; bVal = b.is_active ? 0 : 1; }
    else { aVal = new Date(a.published_at || 0).getTime(); bVal = new Date(b.published_at || 0).getTime(); }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterStatus]);

  /* ── CRUD ── */
  function openNew() {
    const fresh = { ...BLANK, published_at: new Date().toISOString().slice(0, 16) };
    setEditing(fresh);
    editSnapshot.current = JSON.stringify(fresh);
    setViewItem(null);
    setModalOpen(true);
  }

  function openEdit(item) {
    const obj = {
      ...item,
      published_at: item.published_at
        ? new Date(item.published_at).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
    };
    setEditing(obj);
    editSnapshot.current = JSON.stringify(obj);
    setViewItem(null);
    setModalOpen(true);
  }

  function openDuplicate(item) {
    const clone = { ...item };
    delete clone.id;
    clone.title = `${item.title} (Copy)`;
    clone.published_at = new Date().toISOString().slice(0, 16);
    setEditing(clone);
    editSnapshot.current = JSON.stringify(clone);
    setViewItem(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    editSnapshot.current = null;
  }

  function guardedCloseModal() {
    if (editing && editSnapshot.current && JSON.stringify(editing) !== editSnapshot.current) {
      setDiscardConfirm(true);
    } else {
      closeModal();
    }
  }

  function setField(k, v) {
    setEditing((x) => ({ ...x, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    if (!editing.title?.trim()) { showToast("Title is required.", "error"); return; }
    if (!editing.body?.trim()) { showToast("Body is required.", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        title: editing.title,
        body: editing.body,
        media_url: editing.media_url || null,
        is_active: editing.is_active,
        is_pinned: editing.is_pinned,
        published_at: editing.published_at || null,
      };
      if (editing.id) {
        await updateAdminAnnouncement(editing.id, payload);
        showToast("Announcement updated!", "success");
      } else {
        await createAdminAnnouncement(payload);
        showToast("Announcement created!", "success");
      }
      closeModal();
      load();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors ?? {})?.[0]?.[0] ||
        "Save failed.";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  /* ── Undo-delete pattern ── */
  function handleDelete(item) {
    // Clear any previous undo timer
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      // Previous undo expired context — fire actual delete for that item
      if (undoItemRef.current) {
        deleteAdminAnnouncement(undoItemRef.current.id).catch(() => {});
      }
    }

    // Optimistic removal
    setAnnouncements((list) => list.filter((a) => a.id !== item.id));
    if (viewItem?.id === item.id) setViewItem(null);
    setConfirmDelete(null);
    undoItemRef.current = item;

    showToast(`"${item.title}" deleted.`, "success", {
      label: "Undo",
      onClick: () => {
        // Restore item
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
        undoItemRef.current = null;
        load(); // re-fetch to restore
      },
    });

    undoTimerRef.current = setTimeout(() => {
      const toDelete = undoItemRef.current;
      undoTimerRef.current = null;
      undoItemRef.current = null;
      if (toDelete) {
        deleteAdminAnnouncement(toDelete.id).catch(() => {
          showToast("Delete failed.", "error");
          load();
        });
      }
    }, UNDO_DELAY);
  }

  // Cleanup undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        if (undoItemRef.current) {
          deleteAdminAnnouncement(undoItemRef.current.id).catch(() => {});
        }
      }
    };
  }, []);

  async function toggleActive(item) {
    try {
      await updateAdminAnnouncement(item.id, { is_active: !item.is_active });
      setAnnouncements((list) => list.map((a) => (a.id === item.id ? { ...a, is_active: !a.is_active } : a)));
      if (viewItem?.id === item.id) setViewItem((v) => ({ ...v, is_active: !v.is_active }));
      showToast(`${item.title} ${item.is_active ? "deactivated" : "activated"}.`, "success");
    } catch {
      showToast("Failed to update status.", "error");
    }
  }

  /* ── bulk ── */
  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const pageIds = new Set(paginated.map((a) => a.id));
    const allPageSelected = paginated.length > 0 && paginated.every((a) => selected.has(a.id));
    if (allPageSelected) {
      // Deselect only current page IDs
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of pageIds) next.delete(id);
        return next;
      });
    } else {
      // Select all current page IDs
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of pageIds) next.add(id);
        return next;
      });
    }
  }

  async function bulkAction(action) {
    const ids = [...selected];
    try {
      if (action === "delete") {
        await Promise.all(ids.map((id) => deleteAdminAnnouncement(id)));
        showToast(`${ids.length} announcement(s) deleted.`, "success");
      } else {
        const activate = action === "activate";
        await Promise.all(ids.map((id) => updateAdminAnnouncement(id, { is_active: activate })));
        showToast(`${ids.length} announcement(s) ${activate ? "activated" : "deactivated"}.`, "success");
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

  /* ── skeleton ── */
  const SkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        <td className="px-4 py-3 w-10"><div className="h-4 w-4 bg-slate-200 rounded"></div></td>
        <td className="px-4 py-3"><div className="h-10 w-10 bg-slate-200 rounded-lg"></div></td>
        <td className="px-4 py-3"><div className="space-y-1.5"><div className="h-4 bg-slate-200 rounded w-48"></div><div className="h-3 bg-slate-200 rounded w-64"></div></div></td>
        <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
        <td className="px-4 py-3"><div className="h-6 bg-slate-200 rounded-full w-16 mx-auto"></div></td>
        <td className="px-4 py-3"><div className="h-6 bg-slate-200 rounded w-24 ml-auto"></div></td>
      </tr>
    ));

  const activeCount = announcements.filter((a) => a.is_active).length;
  const pinnedCount = announcements.filter((a) => a.is_pinned).length;

  const pageNumbers = getPageNumbers(safePage, totalPages);

  return (
    <div className="p-6 space-y-6">
      {/* Toast at top so it overlays modals */}
      <Toast message={toast} type={toastType} onClose={clearToast} action={toastAction} />

      {/* Page header */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <i className="fas fa-bullhorn text-indigo-600"></i>
            </span>
            Announcements
          </h1>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">Post updates, event notices, and promos visible to guests.</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
        >
          <i className="fas fa-plus text-xs"></i>
          <span className="text-sm font-medium">New Announcement</span>
          <kbd className="hidden sm:inline-flex ml-2 px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-mono">Ctrl+N</kbd>
        </button>
      </div>

      {/* Load error banner */}
      {loadError && !loading && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-5 py-4">
          <div className="h-9 w-9 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
            <i className="fas fa-exclamation-triangle text-rose-500"></i>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-800">Failed to load announcements</p>
            <p className="text-xs text-rose-600 mt-0.5">Please check your connection and try again.</p>
          </div>
          <button onClick={load}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition">
            <i className="fas fa-redo mr-1.5 text-xs"></i>Retry
          </button>
        </div>
      )}

      {/* Search + Filter */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by title or body..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-sm placeholder:text-slate-400 transition"
          />
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
            { key: "pinned", label: "Pinned" },
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
              <p className="text-2xl font-semibold text-slate-900">{announcements.length}</p>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div>
              <p className="text-sm text-slate-600">Active</p>
              <p className="text-2xl font-semibold text-emerald-600">{activeCount}</p>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div>
              <p className="text-sm text-slate-600">Pinned</p>
              <p className="text-2xl font-semibold text-amber-600">{pinnedCount}</p>
            </div>
          </div>
          {(debouncedSearch || filterStatus !== "all") && (
            <span className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200">
              Showing {filtered.length} of {announcements.length}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-4 py-3 text-left w-16">Media</th>
                  <th className="px-4 py-3 text-left">Title / Body</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Published</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100"><SkeletonRows /></tbody>
            </table>
          ) : sorted.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 mb-4">
                <i className="fas fa-bullhorn text-slate-300 text-2xl"></i>
              </div>
              <p className="text-slate-500 font-medium">
                {debouncedSearch || filterStatus !== "all" ? "No announcements match your search." : "No announcements yet."}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {debouncedSearch || filterStatus !== "all"
                  ? "Try adjusting your search or filter."
                  : 'Click "New Announcement" to create the first one.'}
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
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox"
                        checked={paginated.length > 0 && paginated.every((a) => selected.has(a.id))}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
                    </th>
                    <th className="px-4 py-3 text-left w-16">Media</th>
                    {[["Title / Body", "Title"], ["Published", "Published"], ["Status", "Status"]].map(([label, key]) => (
                      <th key={key} className={`px-4 py-3 text-left ${key === "Published" ? "hidden md:table-cell" : ""} ${key === "Status" ? "text-center" : ""}`}>
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
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginated.map((item, idx) => (
                    <tr
                      key={item.id}
                      onClick={() => setViewItem(item)}
                      className={`cursor-pointer transition-all hover:bg-indigo-50/40 hover:shadow-sm ${idx % 2 === 1 ? "bg-slate-50/50" : ""} ${!item.is_active ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
                      </td>

                      {/* Media thumb */}
                      <td className="px-4 py-3">
                        {item.media_url ? (
                          <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                            {isVideoUrl(item.media_url) ? (
                              <div className="relative w-full h-full">
                                <video src={item.media_url} muted className="w-full h-full object-cover" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <i className="fas fa-play text-white text-[10px]"></i>
                                </div>
                              </div>
                            ) : (
                              <img src={item.media_url} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
                            <i className="fas fa-image text-sm"></i>
                          </div>
                        )}
                      </td>

                      {/* Title + body */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.is_pinned && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                              <i className="fas fa-thumbtack text-[8px]"></i>Pinned
                            </span>
                          )}
                          <span className="font-semibold text-slate-800">{item.title}</span>
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{item.body}</p>
                        {item.creator?.name && (
                          <p className="text-slate-300 text-[10px] mt-0.5">by {item.creator.name}</p>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell whitespace-nowrap text-xs">
                        {formatDate(item.published_at)}
                      </td>

                      {/* Active */}
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleActive(item)}
                          title={item.is_active ? "Deactivate" : "Activate"}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full transition ${
                            item.is_active
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${item.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                          {item.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(item)} title="Edit"
                            className="h-8 w-8 rounded-lg hover:bg-sky-50 flex items-center justify-center text-sky-600 hover:text-sky-800 transition">
                            <i className="fas fa-pen text-xs"></i>
                          </button>
                          <button onClick={() => openDuplicate(item)} title="Duplicate"
                            className="h-8 w-8 rounded-lg hover:bg-violet-50 flex items-center justify-center text-violet-500 hover:text-violet-700 transition">
                            <i className="fas fa-copy text-xs"></i>
                          </button>
                          <button onClick={() => setConfirmDelete(item)} title="Delete"
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
                    {pageNumbers.map((n, i) =>
                      n === "..." ? (
                        <span key={`ellipsis-${i}`} className="h-8 min-w-[2rem] flex items-center justify-center text-xs text-slate-400 select-none">
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

        {/* Retry on empty */}
        {!loading && announcements.length === 0 && !debouncedSearch && filterStatus === "all" && (
          <div className="px-6 pb-6 flex justify-center">
            <button onClick={load}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1.5">
              <i className="fas fa-redo text-xs"></i>Retry loading
            </button>
          </div>
        )}
      </div>

      {/* ── View Detail Modal ── */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} maxWidth="max-w-lg">
        {viewItem && (
          <div>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <i className="fas fa-bullhorn text-indigo-600 text-lg"></i>
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 truncate">{viewItem.title}</h3>
                  {viewItem.creator?.name && (
                    <p className="text-xs text-slate-400 mt-0.5">by {viewItem.creator.name}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setViewItem(null)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Stat cards row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                  <div className={`h-8 w-8 rounded-lg ${viewItem.is_active ? "bg-emerald-100" : "bg-slate-100"} flex items-center justify-center mx-auto mb-1.5`}>
                    <i className={`fas ${viewItem.is_active ? "fa-eye text-emerald-600" : "fa-eye-slash text-slate-400"} text-xs`}></i>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">{viewItem.is_active ? "Active" : "Inactive"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                  <div className={`h-8 w-8 rounded-lg ${viewItem.is_pinned ? "bg-amber-100" : "bg-slate-100"} flex items-center justify-center mx-auto mb-1.5`}>
                    <i className={`fas fa-thumbtack ${viewItem.is_pinned ? "text-amber-600" : "text-slate-400"} text-xs`}></i>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">{viewItem.is_pinned ? "Pinned" : "Not Pinned"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                  <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center mx-auto mb-1.5">
                    <i className="fas fa-calendar text-indigo-600 text-xs"></i>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">{formatDate(viewItem.published_at)}</p>
                </div>
              </div>

              {/* Media */}
              {viewItem.media_url && (
                <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 max-h-56 flex items-center justify-center">
                  {isVideoUrl(viewItem.media_url) ? (
                    <video src={viewItem.media_url} controls className="max-h-56 w-full object-contain" />
                  ) : (
                    <img src={viewItem.media_url} alt="" className="max-h-56 object-contain" />
                  )}
                </div>
              )}

              {/* Body */}
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{viewItem.body}</p>
              </div>
            </div>

            <div className="px-6 pb-6 flex justify-end gap-2">
              <button onClick={() => setViewItem(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition">
                Close
              </button>
              <button onClick={() => openDuplicate(viewItem)}
                className="px-4 py-2 border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl text-sm font-medium transition">
                <i className="fas fa-copy mr-1.5 text-xs"></i>Duplicate
              </button>
              <button onClick={() => openEdit(viewItem)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition">
                <i className="fas fa-pen mr-1.5 text-xs"></i>Edit
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete ConfirmDialog ── */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Announcement"
        message={confirmDelete ? <>Are you sure you want to delete <strong>"{confirmDelete.title}"</strong>? This cannot be undone.</> : ""}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* ── Bulk Delete ConfirmDialog ── */}
      <ConfirmDialog
        open={bulkDeleteConfirm}
        title="Delete Selected Announcements"
        message={`Are you sure you want to delete ${selected.size} announcement(s)? This cannot be undone.`}
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setBulkDeleteConfirm(false);
          bulkAction("delete");
        }}
        onCancel={() => setBulkDeleteConfirm(false)}
      />

      {/* ── Discard Changes ConfirmDialog ── */}
      <ConfirmDialog
        open={discardConfirm}
        title="Discard unsaved changes?"
        message="You have unsaved changes. Are you sure you want to close without saving?"
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        variant="warning"
        onConfirm={() => {
          setDiscardConfirm(false);
          closeModal();
        }}
        onCancel={() => setDiscardConfirm(false)}
      />

      {/* ── Create / Edit Modal ── */}
      <Modal open={modalOpen} onClose={guardedCloseModal} maxWidth="max-w-2xl">
        {editing && (
          <form onSubmit={save}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <i className="fas fa-bullhorn text-indigo-600 text-lg"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{editing.id ? "Edit Announcement" : "New Announcement"}</h2>
                  <p className="text-xs text-slate-400">{editing.id ? "Update content and settings" : "Post an update visible to guests"}</p>
                </div>
              </div>
              <button type="button" onClick={guardedCloseModal}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Content */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-md bg-indigo-100 flex items-center justify-center">
                      <i className="fas fa-pen-nib text-indigo-500 text-[10px]"></i>
                    </span>Content
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Title <span className="text-red-400">*</span></label>
                    <input type="text" value={editing.title} onChange={(e) => setField("title", e.target.value)} required
                      placeholder="e.g. Summer Promo 2026"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-sm placeholder:text-slate-300 transition" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Body <span className="text-red-400">*</span></label>
                      <span className={`text-[10px] font-medium ${(editing.body?.length || 0) > BODY_MAX ? "text-rose-500" : "text-slate-400"}`}>
                        {editing.body?.length || 0}/{BODY_MAX}
                      </span>
                    </div>
                    <textarea value={editing.body} onChange={(e) => setField("body", e.target.value)} required rows={4}
                      placeholder="Write your announcement here\u2026"
                      maxLength={BODY_MAX + 50}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-sm placeholder:text-slate-300 resize-none transition" />
                  </div>
                </div>
              </div>

              {/* Media */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-md bg-pink-100 flex items-center justify-center">
                      <i className="fas fa-image text-pink-500 text-[10px]"></i>
                    </span>Media <span className="text-slate-400 text-xs font-normal ml-1">optional</span>
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <MediaPicker
                    value={editing.media_url ?? ""}
                    onChange={(url) => setField("media_url", url)}
                    previousUrl={editing.id ? editing.media_url : null}
                    folder="announcements"
                    accept="image/*,video/*"
                    label="Upload Photo or Video"
                  />
                  {editing.media_url && (
                    <div className="rounded-lg overflow-hidden border border-slate-200 bg-white max-h-52 flex items-center justify-center">
                      {isVideoUrl(editing.media_url) ? (
                        <video src={editing.media_url} controls className="max-h-52 w-full object-contain" />
                      ) : (
                        <img src={editing.media_url} alt="Preview" className="max-h-52 object-contain" onError={(e) => { e.target.style.display = "none"; }} />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Publishing */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-md bg-emerald-100 flex items-center justify-center">
                      <i className="fas fa-calendar-check text-emerald-500 text-[10px]"></i>
                    </span>Publishing
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Published At</label>
                    <input type="datetime-local" value={editing.published_at ?? ""} onChange={(e) => setField("published_at", e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-sm transition" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Pinned toggle */}
                    <div
                      onClick={() => setField("is_pinned", !editing.is_pinned)}
                      className="flex items-center justify-between cursor-pointer select-none p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`h-7 w-7 rounded-md flex items-center justify-center ${editing.is_pinned ? "bg-amber-100" : "bg-slate-100"}`}>
                          <i className={`fas fa-thumbtack text-xs ${editing.is_pinned ? "text-amber-500" : "text-slate-400"}`}></i>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">Pinned</p>
                          <p className="text-[10px] text-slate-400">Shows at top of list</p>
                        </div>
                      </div>
                      <div className={`relative w-11 h-6 rounded-full transition-colors ${editing.is_pinned ? "bg-amber-500" : "bg-slate-300"}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${editing.is_pinned ? "left-6" : "left-1"}`} />
                      </div>
                    </div>
                    {/* Active toggle */}
                    <div
                      onClick={() => setField("is_active", !editing.is_active)}
                      className="flex items-center justify-between cursor-pointer select-none p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`h-7 w-7 rounded-md flex items-center justify-center ${editing.is_active ? "bg-emerald-100" : "bg-slate-100"}`}>
                          <i className={`fas ${editing.is_active ? "fa-eye text-emerald-500" : "fa-eye-slash text-slate-400"} text-xs`}></i>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">Active</p>
                          <p className="text-[10px] text-slate-400">Visible to guests</p>
                        </div>
                      </div>
                      <div className={`relative w-11 h-6 rounded-full transition-colors ${editing.is_active ? "bg-emerald-500" : "bg-slate-300"}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${editing.is_active ? "left-6" : "left-1"}`} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button type="button" onClick={guardedCloseModal}
                className="px-5 py-2.5 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium transition">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 shadow-sm transition">
                {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</> : <><i className="fas fa-check mr-2"></i>{editing.id ? "Save Changes" : "Create"}</>}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
