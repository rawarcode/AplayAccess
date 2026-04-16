import { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import Modal from "../../components/modals/Modal.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import Toast, { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext.jsx";
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from "../../lib/adminApi";
import useDebounce from "../../hooks/useDebounce.js";

const BLANK = { name: "", email: "", phone: "", role: "front_desk", password: "", is_active: true };
const PAGE_SIZE = 10;

const ROLE_LABELS = { front_desk: "Front Desk", owner: "Owner" };
const ROLE_COLORS = {
  front_desk: "bg-sky-100 text-sky-800",
  owner:      "bg-amber-100 text-amber-800",
};
const ROLE_AVATAR = {
  owner:      "bg-amber-500",
  front_desk: "bg-sky-500",
};

/* ── Pagination ellipsis helper ── */
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

export default function OwnerUsers() {
  const { user: currentUser } = useAuth();
  const [toast, showToast, clearToast, toastType, toastAction] = useToast();

  /* ── data ── */
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /* ── modals ── */
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const [confirmToggle, setConfirmToggle] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  /* ── table controls ── */
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(() => localStorage.getItem("users_sortBy") || "Name");
  const [sortDir, setSortDir] = useState(() => localStorage.getItem("users_sortDir") || "asc");
  const [selected, setSelected] = useState(new Set());

  const searchRef = useRef(null);
  const editSnapshot = useRef(null);
  const undoTimerRef = useRef(null);
  const undoItemRef = useRef(null);

  /* ── persist sort ── */
  useEffect(() => { localStorage.setItem("users_sortBy", sortBy); }, [sortBy]);
  useEffect(() => { localStorage.setItem("users_sortDir", sortDir); }, [sortDir]);

  /* ── load ── */
  const load = useCallback(() => {
    setLoading(true);
    getAdminUsers()
      .then((r) => { setUsers(r.data.data); setLoadError(false); })
      .catch(() => { showToast("Failed to load users.", "error"); setLoadError(true); })
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  // Flush pending undo delete on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        if (undoItemRef.current) deleteAdminUser(undoItemRef.current.id).catch(() => {});
      }
    };
  }, []);

  /* ── Ctrl+N keyboard shortcut ── */
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        openNew();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── filter + sort + paginate ── */
  const filtered = users.filter((u) => {
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (filterStatus === "active" && !u.is_active) return false;
    if (filterStatus === "inactive" && u.is_active) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal;
    if (sortBy === "Email") { aVal = a.email.toLowerCase(); bVal = b.email.toLowerCase(); }
    else if (sortBy === "Role") { aVal = a.role; bVal = b.role; }
    else if (sortBy === "Status") { aVal = a.is_active ? 0 : 1; bVal = b.is_active ? 0 : 1; }
    else { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterRole, filterStatus]);

  /* ── CRUD ── */
  function openNew() {
    const blank = { ...BLANK };
    setEditing(blank);
    editSnapshot.current = JSON.stringify(blank);
    setViewUser(null);
    setShowPassword(false);
    setModalOpen(true);
  }
  function openEdit(u) {
    const obj = { ...u, password: "" };
    setEditing(obj);
    editSnapshot.current = JSON.stringify(obj);
    setViewUser(null);
    setShowPassword(false);
    setModalOpen(true);
  }
  function setField(k, v) { setEditing((x) => ({ ...x, [k]: v })); }

  function closeModal() {
    setModalOpen(false);
    editSnapshot.current = null;
  }

  function guardedCloseModal() {
    if (editing && editSnapshot.current && JSON.stringify(editing) !== editSnapshot.current) {
      setDiscardConfirm(true);
    } else {
      closeModal();
    }
  }

  async function saveUser(e) {
    e.preventDefault();
    if (!editing.name || !editing.email) { showToast("Name and email are required.", "error"); return; }
    if (!editing.id && !editing.password) { showToast("Password is required for new users.", "error"); return; }
    setSaving(true);
    const payload = {
      name: editing.name,
      email: editing.email,
      phone: editing.phone || undefined,
      role: editing.role,
      is_active: editing.is_active,
      ...(editing.password ? { password: editing.password } : {}),
    };
    try {
      if (editing.id) {
        await updateAdminUser(editing.id, payload);
        showToast("User updated!", "success");
      } else {
        await createAdminUser(payload);
        showToast("User created!", "success");
      }
      closeModal();
      load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to save user.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(u) {
    try {
      await updateAdminUser(u.id, { is_active: !u.is_active });
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, is_active: !x.is_active } : x)));
      if (viewUser?.id === u.id) setViewUser((v) => ({ ...v, is_active: !v.is_active }));
      showToast(`${u.name} ${u.is_active ? "deactivated" : "activated"}.`, "success");
      setConfirmToggle(null);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update user status.", "error");
    }
  }

  function handleDelete(u) {
    // Optimistic removal + 6s undo window
    setConfirmDelete(null);
    if (viewUser?.id === u.id) setViewUser(null);
    undoItemRef.current = u;
    setUsers(prev => prev.filter(x => x.id !== u.id));

    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(async () => {
      try {
        await deleteAdminUser(u.id);
      } catch {
        // Restore on API failure
        load();
        showToast("Failed to delete user.", "error");
      }
      undoItemRef.current = null;
    }, 6000);

    showToast(`${u.name} deleted.`, "success", {
      label: "Undo",
      onClick: () => {
        clearTimeout(undoTimerRef.current);
        if (undoItemRef.current) {
          load(); // Reload to restore
          undoItemRef.current = null;
          showToast("Delete undone.", "success");
        }
      },
    });
  }

  async function copyEmail(email) {
    try { await navigator.clipboard.writeText(email); showToast("Email copied!", "success"); }
    catch { showToast("Failed to copy.", "error"); }
  }

  function canToggleActive(u) { return u.id !== currentUser?.id; }
  function canDelete(u) { return u.id !== currentUser?.id; }

  /* ── bulk ── */
  function toggleSelect(id) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleSelectAll() {
    const selectable = paginated.filter((u) => u.id !== currentUser?.id);
    const allSelected = selectable.length > 0 && selectable.every((u) => selected.has(u.id));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        selectable.forEach((u) => next.delete(u.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        selectable.forEach((u) => next.add(u.id));
        return next;
      });
    }
  }
  async function bulkAction(action) {
    const ids = [...selected];
    try {
      if (action === "delete") {
        await Promise.all(ids.map((id) => deleteAdminUser(id)));
        showToast(`${ids.length} user(s) deleted.`, "success");
      } else {
        const activate = action === "activate";
        await Promise.all(ids.map((id) => updateAdminUser(id, { is_active: activate })));
        showToast(`${ids.length} user(s) ${activate ? "activated" : "deactivated"}.`, "success");
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
  const activeCount = users.filter((u) => u.is_active).length;
  const roleCount = (r) => users.filter((u) => u.role === r).length;

  function getInitials(name) {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  }

  /* ── select-all checkbox state ── */
  const selectableOnPage = paginated.filter((u) => u.id !== currentUser?.id);
  const allPageSelected = selectableOnPage.length > 0 && selectableOnPage.every((u) => selected.has(u.id));

  /* ── skeleton ── */
  const SkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        <td className="px-6 py-4 w-10"><div className="h-4 w-4 bg-slate-200 rounded"></div></td>
        <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="h-9 w-9 bg-slate-200 rounded-full"></div><div className="space-y-1.5"><div className="h-4 bg-slate-200 rounded w-32"></div><div className="h-3 bg-slate-200 rounded w-40"></div></div></div></td>
        <td className="px-6 py-4"><div className="h-5 bg-slate-200 rounded-full w-20"></div></td>
        <td className="px-6 py-4"><div className="h-5 bg-slate-200 rounded-full w-16"></div></td>
        <td className="px-6 py-4"><div className="h-6 bg-slate-200 rounded w-24 ml-auto"></div></td>
      </tr>
    ));

  return (
    <div className="p-6 space-y-6">
      <Helmet><title>Staff Users — Aplaya Beach Resort</title></Helmet>
      <Toast message={toast} type={toastType} onClose={clearToast} action={toastAction} />

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center">
              <i className="fas fa-users-cog text-sky-600"></i>
            </span>
            Staff Users
          </h1>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">Manage staff accounts, roles, and access.</p>
        </div>
        <button onClick={openNew}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 transition">
          <i className="fas fa-user-plus text-xs"></i>
          <span className="text-sm font-medium">Add User</span>
          <kbd className="ml-1.5 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-mono leading-none">
            Ctrl+N
          </kbd>
        </button>
      </div>

      {/* Load error banner */}
      {loadError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-sm text-rose-700 font-medium">
            <i className="fas fa-exclamation-triangle mr-2"></i>Failed to load users. Please try again.
          </span>
          <button onClick={load}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition">
            <i className="fas fa-redo mr-1.5"></i>Retry
          </button>
        </div>
      )}

      {/* Search + Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input ref={searchRef} type="text" placeholder="Search by name or email..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-400 transition" />
          {searchTerm && (
            <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
              <i className="fas fa-times-circle text-sm"></i>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Role filters */}
          {[
            { key: "all", label: "All Roles" },
            { key: "owner", label: "Owner" },
            { key: "front_desk", label: "Front Desk" },
          ].map((f) => (
            <button key={f.key} onClick={() => setFilterRole(f.key)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold transition ${
                filterRole === f.key
                  ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}>
              {f.label}
            </button>
          ))}
          <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>
          {/* Status filters */}
          {[
            { key: "all", label: "Any Status" },
            { key: "active", label: "Active" },
            { key: "inactive", label: "Inactive" },
          ].map((f) => (
            <button key={`s-${f.key}`} onClick={() => setFilterStatus(f.key)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold transition ${
                filterStatus === f.key
                  ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-5 py-3 flex items-center justify-between animate-hero-fade-in opacity-0">
          <span className="text-sm font-medium text-sky-800">
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
              <p className="text-2xl font-semibold text-slate-900">{users.length}</p>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div>
              <p className="text-sm text-slate-600">Active</p>
              <p className="text-2xl font-semibold text-emerald-600">{activeCount}</p>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex items-center gap-4">
              {["owner", "front_desk"].map((r) => (
                <div key={r} className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{ROLE_LABELS[r]}</p>
                  <p className="text-lg font-semibold text-slate-700">{roleCount(r)}</p>
                </div>
              ))}
            </div>
          </div>
          {(debouncedSearch || filterRole !== "all" || filterStatus !== "all") && (
            <span className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200">
              Showing {filtered.length} of {users.length}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 w-10"></th>
                  <th className="px-6 py-3 text-left">User</th>
                  <th className="px-6 py-3 text-left">Role</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100"><SkeletonRows /></tbody>
            </table>
          ) : sorted.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 mb-4">
                <i className="fas fa-users text-slate-300 text-2xl"></i>
              </div>
              <p className="text-slate-500 font-medium">
                {debouncedSearch || filterRole !== "all" || filterStatus !== "all" ? "No users match your filters." : "No staff users yet."}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {debouncedSearch || filterRole !== "all" || filterStatus !== "all"
                  ? "Try adjusting your search or filters."
                  : 'Click "Add User" to create your first staff account.'}
              </p>
              {(debouncedSearch || filterRole !== "all" || filterStatus !== "all") && (
                <button onClick={() => { setSearchTerm(""); setFilterRole("all"); setFilterStatus("all"); }}
                  className="mt-4 text-sm text-sky-600 hover:text-sky-700 font-medium">
                  <i className="fas fa-times mr-1.5"></i>Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <table className="min-w-full text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 w-10">
                      <input type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400" />
                    </th>
                    {[["User", "Name"], ["Role", "Role"], ["Status", "Status"]].map(([label, key]) => (
                      <th key={key} className="px-6 py-3 text-left">
                        <button onClick={() => handleSort(key)}
                          className="flex items-center gap-1 hover:text-sky-600 transition-colors group">
                          {label}
                          <span className="text-slate-400 group-hover:text-sky-400">
                            {sortBy === key
                              ? <i className={`fas fa-arrow-${sortDir === "asc" ? "up" : "down"} text-sky-500`}></i>
                              : <i className="fas fa-sort opacity-40"></i>}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginated.map((u, idx) => (
                    <tr key={u.id}
                      onClick={() => setViewUser(u)}
                      className={`cursor-pointer transition-all hover:bg-sky-50/40 hover:shadow-sm ${idx % 2 === 1 ? "bg-slate-50/50" : ""} ${!u.is_active ? "opacity-60" : ""}`}>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        {u.id !== currentUser?.id ? (
                          <input type="checkbox" checked={selected.has(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400" />
                        ) : <div className="h-4 w-4"></div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full ${ROLE_AVATAR[u.role] || "bg-slate-400"} text-white flex items-center justify-center text-xs font-bold shrink-0`}>
                            {getInitials(u.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">
                              {u.name}
                              {u.id === currentUser?.id && <span className="ml-1.5 text-[10px] text-slate-400 font-normal">(you)</span>}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] || "bg-slate-100 text-slate-700"}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                          u.is_active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                          <span className={`h-2 w-2 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-rose-500"}`} />
                          {u.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => copyEmail(u.email)} title="Copy email"
                            className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
                            <i className="fas fa-envelope text-xs"></i>
                          </button>
                          <button onClick={() => openEdit(u)} title="Edit"
                            className="h-8 w-8 rounded-lg hover:bg-sky-50 flex items-center justify-center text-sky-600 hover:text-sky-800 transition">
                            <i className="fas fa-pen text-xs"></i>
                          </button>
                          {canToggleActive(u) && (
                            <button onClick={() => setConfirmToggle(u)} title={u.is_active ? "Deactivate" : "Activate"}
                              className={`h-8 w-8 rounded-lg flex items-center justify-center transition ${u.is_active
                                ? "hover:bg-amber-50 text-amber-500 hover:text-amber-700"
                                : "hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700"}`}>
                              <i className={`fas ${u.is_active ? "fa-toggle-off" : "fa-toggle-on"} text-xs`}></i>
                            </button>
                          )}
                          {canDelete(u) && (
                            <button onClick={() => setConfirmDelete(u)} title="Delete"
                              className="h-8 w-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-rose-400 hover:text-rose-600 transition">
                              <i className="fas fa-trash text-xs"></i>
                            </button>
                          )}
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
                    Showing {(safePage - 1) * PAGE_SIZE + 1}{"\u2013"}{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                      className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                      <i className="fas fa-chevron-left text-xs"></i>
                    </button>
                    {getPageNumbers(safePage, totalPages).map((n, i) =>
                      n === "..." ? (
                        <span key={`ellipsis-${i}`} className="h-8 min-w-[2rem] flex items-center justify-center text-xs text-slate-400 select-none">
                          &hellip;
                        </span>
                      ) : (
                        <button key={n} onClick={() => setPage(n)}
                          className={`h-8 min-w-[2rem] rounded-lg text-xs font-semibold transition ${
                            n === safePage
                              ? "bg-sky-600 text-white shadow-sm"
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
        {!loading && users.length === 0 && !debouncedSearch && filterRole === "all" && filterStatus === "all" && (
          <div className="px-6 pb-6 flex justify-center">
            <button onClick={load}
              className="text-sm text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1.5">
              <i className="fas fa-redo text-xs"></i>Retry loading
            </button>
          </div>
        )}
      </div>

      {/* ── View User Modal ── */}
      <Modal open={!!viewUser} onClose={() => setViewUser(null)} maxWidth="max-w-md">
        {viewUser && (
          <div>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center">
                  <i className="fas fa-user text-sky-600"></i>
                </span>
                User Details
              </h3>
              <button onClick={() => setViewUser(null)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Avatar + name */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                <div className={`h-14 w-14 rounded-full ${ROLE_AVATAR[viewUser.role] || "bg-slate-400"} text-white flex items-center justify-center text-lg font-bold`}>
                  {getInitials(viewUser.name)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-lg">{viewUser.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{viewUser.email}</p>
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                  <div className="h-8 w-8 rounded-lg bg-sky-100 flex items-center justify-center mx-auto mb-1.5">
                    <i className="fas fa-shield-halved text-sky-600 text-xs"></i>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">{ROLE_LABELS[viewUser.role] || viewUser.role}</p>
                  <p className="text-[10px] text-slate-400">Role</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center mx-auto mb-1.5 ${viewUser.is_active ? "bg-emerald-100" : "bg-rose-100"}`}>
                    <i className={`fas ${viewUser.is_active ? "fa-check-circle text-emerald-600" : "fa-times-circle text-rose-600"} text-xs`}></i>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">{viewUser.is_active ? "Active" : "Disabled"}</p>
                  <p className="text-[10px] text-slate-400">Status</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                  <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center mx-auto mb-1.5">
                    <i className="fas fa-calendar text-violet-600 text-xs"></i>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    {viewUser.created_at ? new Date(viewUser.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "\u2014"}
                  </p>
                  <p className="text-[10px] text-slate-400">Joined</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wide">Phone</p>
                  <p className="font-semibold text-slate-900 mt-0.5">{viewUser.phone || "\u2014"}</p>
                </div>
                {viewUser.last_login_at && (
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wide">Last Login</p>
                    <p className="font-semibold text-slate-900 mt-0.5">
                      {new Date(viewUser.last_login_at).toLocaleString("en-PH")}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-2">
              <button onClick={() => setViewUser(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition">Close</button>
              <button onClick={() => copyEmail(viewUser.email)}
                className="px-4 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-medium transition">
                <i className="fas fa-envelope mr-1.5 text-xs"></i>Copy Email
              </button>
              <button onClick={() => openEdit(viewUser)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium transition">
                <i className="fas fa-pen mr-1.5 text-xs"></i>Edit
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Toggle Active ConfirmDialog ── */}
      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.is_active ? "Deactivate User" : "Activate User"}
        message={
          confirmToggle?.is_active
            ? <><strong>{confirmToggle?.name}</strong> will lose access until reactivated.</>
            : <>Restore access for <strong>{confirmToggle?.name}</strong>?</>
        }
        confirmLabel={confirmToggle?.is_active ? "Deactivate" : "Activate"}
        variant={confirmToggle?.is_active ? "warning" : "info"}
        onConfirm={() => handleToggleActive(confirmToggle)}
        onCancel={() => setConfirmToggle(null)}
      />

      {/* ── Delete ConfirmDialog ── */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete User"
        message={<>Are you sure you want to delete <strong>{confirmDelete?.name}</strong>? You can undo within 6 seconds.</>}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* ── Bulk Delete ConfirmDialog ── */}
      <ConfirmDialog
        open={bulkDeleteConfirm}
        title="Delete Selected Users"
        message={<>Are you sure you want to delete <strong>{selected.size}</strong> selected user(s)? This cannot be undone.</>}
        confirmLabel="Delete All"
        variant="danger"
        onConfirm={() => { setBulkDeleteConfirm(false); bulkAction("delete"); }}
        onCancel={() => setBulkDeleteConfirm(false)}
      />

      {/* ── Discard Changes ConfirmDialog ── */}
      <ConfirmDialog
        open={discardConfirm}
        title="Discard Changes"
        message="You have unsaved changes. Discard them?"
        confirmLabel="Discard"
        variant="warning"
        onConfirm={() => { setDiscardConfirm(false); closeModal(); }}
        onCancel={() => setDiscardConfirm(false)}
      />

      {/* ── Edit / Create Modal ── */}
      <Modal open={modalOpen} onClose={guardedCloseModal}>
        {editing && (
          <form onSubmit={saveUser}>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                  <i className={`fas ${editing.id ? "fa-user-pen" : "fa-user-plus"} text-sky-600 text-lg`}></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{editing.id ? "Edit User" : "Add New User"}</h2>
                  <p className="text-xs text-slate-400">{editing.id ? "Update details, role, or reset password" : "Create a new staff account"}</p>
                </div>
              </div>
              <button type="button" onClick={guardedCloseModal}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Account Info */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-md bg-sky-100 flex items-center justify-center">
                      <i className="fas fa-id-card text-sky-500 text-[10px]"></i>
                    </span>Account Info
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Name <span className="text-red-400">*</span></label>
                    <input required value={editing.name || ""} onChange={(e) => setField("name", e.target.value)}
                      placeholder="Full name"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-300 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Email <span className="text-red-400">*</span></label>
                    <input required type="email" value={editing.email || ""} onChange={(e) => setField("email", e.target.value)}
                      placeholder="user@example.com"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-300 transition" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Phone</label>
                    <input value={editing.phone || ""} onChange={(e) => setField("phone", e.target.value)}
                      placeholder="09xx xxx xxxx"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-300 transition" />
                  </div>
                </div>
              </div>

              {/* Access & Security */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-md bg-violet-100 flex items-center justify-center">
                      <i className="fas fa-shield-halved text-violet-500 text-[10px]"></i>
                    </span>Access & Security
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Role <span className="text-red-400">*</span></label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: "owner", label: "Owner", icon: "fa-crown", bg: "peer-checked:bg-amber-50 peer-checked:border-amber-300 peer-checked:ring-1 peer-checked:ring-amber-200" },
                        { key: "front_desk", label: "Front Desk", icon: "fa-headset", bg: "peer-checked:bg-sky-50 peer-checked:border-sky-300 peer-checked:ring-1 peer-checked:ring-sky-200" },
                      ].map(({ key, label, icon, bg }) => (
                        <label key={key} className="relative cursor-pointer select-none">
                          <input type="radio" name="role" value={key} checked={editing.role === key}
                            onChange={() => setField("role", key)} className="peer sr-only" />
                          <div className={`flex flex-col items-center gap-1.5 p-3 bg-white border border-slate-200 rounded-lg transition-all hover:border-slate-300 ${bg}`}>
                            <i className={`fas ${icon} text-slate-400`}></i>
                            <span className="text-xs font-semibold text-slate-700">{label}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Password {editing.id ? <span className="text-slate-400 font-normal normal-case">(leave blank to keep current)</span> : <span className="text-red-400">*</span>}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><i className="fas fa-lock text-xs"></i></span>
                      <input type={showPassword ? "text" : "password"} value={editing.password || ""} onChange={(e) => setField("password", e.target.value)}
                        required={!editing.id} minLength={8}
                        placeholder={editing.id ? "Enter new password to change" : "Min. 8 characters"}
                        className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-300 transition" />
                      <button type="button" onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                        aria-label={showPassword ? "Hide password" : "Show password"}>
                        <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"} text-xs`}></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button type="button" onClick={guardedCloseModal}
                className="px-5 py-2.5 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium transition">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 shadow-sm transition">
                {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</> : <><i className="fas fa-check mr-2"></i>Save User</>}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
