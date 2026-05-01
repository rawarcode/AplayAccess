import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Modal from "../../components/modals/Modal.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import Toast, { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext.jsx";
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, toggleStaffActive } from "../../lib/adminApi";
import useDebounce from "../../hooks/useDebounce.js";
import OwnerGuests from "./Guests.jsx";
import PasswordRequirements, { checkPasswordStrength } from "../../components/ui/PasswordRequirements.jsx";
import { uploadFile } from "../../lib/uploadApi.js";

// Shared tab-bar pill used at the top of merged owner pages. Lives here
// because its styling stays consistent across Users↔Guests,
// Rooms↔Add-ons, and Content↔Announcements merges.
function TabBar({ tabs, active, onChange }) {
  return (
    <div className="px-6 pt-6 pb-0">
      <div className="inline-flex bg-white rounded-xl shadow-sm border border-slate-200 p-1" role="tablist">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => onChange(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition inline-flex items-center gap-2 ${
              active === t.key
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.icon && <i className={`fas ${t.icon} text-xs`} aria-hidden="true" />}
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
export { TabBar };

const BLANK = { name: "", email: "", phone: "", role: "front_desk", password: "", is_active: true, avatar: "" };
const PAGE_SIZE = 10;

const ROLE_LABELS = { front_desk: "Front Desk", admin: "Admin", owner: "Owner" };
const ROLE_COLORS = {
  front_desk: "bg-info-bg text-info-fg",
  admin:      "bg-violet-100 text-violet-800",
  owner:      "bg-warning-bg text-warning-fg",
};
const ROLE_AVATAR = {
  owner:      "bg-warning-ring",
  admin:      "bg-violet-500",
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
  // Admin sees a scoped-down version of this same page: front_desk
  // staff only, with create + edit + toggle-active permitted on those
  // rows. Delete and bulk actions remain owner-only. The role picker
  // inside the create/edit modal is locked to "Front Desk" for admin
  // — backend rejects any other role from an admin caller (UserController
  // store/update guards).
  const isAdminView = currentUser?.role === "admin";
  const [toast, showToast, clearToast, toastType, toastAction] = useToast();
  // Tab state synced to the URL so deep-links (/owner/users?tab=guests)
  // and the legacy /owner/guests redirect both land on the right tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'guests' ? 'guests' : 'staff';
  const setActiveTab = (key) => {
    if (key === 'staff') setSearchParams({});
    else setSearchParams({ tab: key });
  };

  /* ── data ── */
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileRef = useRef(null);

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
  // Admin only ever needs to see front_desk staff (the only role
  // they're allowed to toggle). Initialize the filter accordingly so
  // the chips don't even need to be visible to them.
  const [filterRole, setFilterRole] = useState(isAdminView ? "front_desk" : "all");
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

  /* ── Ctrl+N keyboard shortcut (admin + owner can both create) ── */
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

  function onPickAvatar() {
    avatarFileRef.current?.click();
  }

  async function onAvatarChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadFile(f, 'avatars');
      setField("avatar", url);
    } catch {
      showToast("Failed to upload image. Please try again.", "error");
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  }

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

  // Save flow: form submit → requestSaveUser (validates + opens
  // confirm) → user confirms → saveUser (does the API call). Staff
  // create/edit affects who can sign in and what they can do, so a
  // confirm gates the commit.
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  function requestSaveUser(e) {
    e.preventDefault();
    if (!editing.name || !editing.email) { showToast("Name and email are required.", "error"); return; }
    if (!editing.id && !editing.password) { showToast("Password is required for new users.", "error"); return; }
    setSaveConfirmOpen(true);
  }

  async function saveUser() {
    // Validation already ran in requestSaveUser; go straight to API.
    setSaveConfirmOpen(false);
    setSaving(true);
    const payload = {
      name: editing.name,
      email: editing.email,
      phone: editing.phone || undefined,
      role: editing.role,
      is_active: editing.is_active,
      avatar: editing.avatar || null,
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
      // Admin uses the narrow toggle endpoint (admin_or_owner). Owner
      // continues to use the full update endpoint (owner_role) since
      // they may pair the toggle with other field changes elsewhere.
      if (isAdminView) {
        await toggleStaffActive(u.id);
      } else {
        await updateAdminUser(u.id, { is_active: !u.is_active });
      }
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

  // Backend refuses to modify/delete owner accounts, so the UI hides those
  // controls too. The current user is also excluded to prevent self-lockout.
  function isProtected(u) { return u.id === currentUser?.id || u.role === "owner"; }
  // Admin can only toggle front_desk accounts (backend toggleStaffActive
  // returns 403 for any other role). Owner can toggle anyone non-protected.
  function canToggleActive(u) {
    if (isProtected(u)) return false;
    if (isAdminView && u.role !== "front_desk") return false;
    return true;
  }
  function canDelete(u) { return !isAdminView && !isProtected(u); }
  // Admin can edit only front_desk staff; owner can edit any non-protected
  // account. Backend UserController::update enforces the same scoping
  // (admin caller + non-front_desk target → 403).
  function canEdit(u) {
    if (isProtected(u)) return false;
    if (isAdminView && u.role !== "front_desk") return false;
    return true;
  }

  /* ── bulk ── */
  function toggleSelect(id) {
    // Don't let protected rows into the selection set
    const u = users.find((x) => x.id === id);
    if (u && isProtected(u)) return;
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleSelectAll() {
    const selectable = paginated.filter((u) => !isProtected(u));
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
    // Defensive guard: strip any protected ids that may have slipped in
    const ids = [...selected].filter((id) => {
      const u = users.find((x) => x.id === id);
      return u && !isProtected(u);
    });
    if (ids.length === 0) {
      showToast("No eligible users selected.", "error");
      return;
    }
    // Use allSettled so partial failures still report accurately, and always
    // reload + clear selection afterwards so the UI reflects real state.
    const runOne = action === "delete"
      ? (id) => deleteAdminUser(id)
      : (id) => updateAdminUser(id, { is_active: action === "activate" });
    const results = await Promise.allSettled(ids.map(runOne));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.length - ok;
    const verb = action === "delete" ? "deleted" : (action === "activate" ? "activated" : "deactivated");
    if (fail === 0) {
      showToast(`${ok} user(s) ${verb}.`, "success");
    } else if (ok === 0) {
      showToast(`Failed to ${action} ${fail} user(s).`, "error");
    } else {
      showToast(`${ok} ${verb}, ${fail} failed.`, "error");
    }
    setSelected(new Set());
    load();
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

  const TABS = [
    { key: 'staff',  icon: 'fa-users-cog',  label: 'Staff'  },
    { key: 'guests', icon: 'fa-user-check', label: 'Guests' },
  ];

  // Guests tab — render the Guests page as-is. It has its own header
  // + table + detail modal; just prepended with the shared tab bar.
  if (activeTab === 'guests') {
    return (
      <>
        <Helmet><title>Guests — Aplaya Beach Resort</title></Helmet>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
        <OwnerGuests />
      </>
    );
  }

  return (
    <>
      <Helmet><title>Staff Users — Aplaya Beach Resort</title></Helmet>
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
    <div className="p-6 space-y-6">
      <Toast message={toast} type={toastType} onClose={clearToast} action={toastAction} />

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center">
              <i className="fas fa-users-cog text-sky-600" aria-hidden="true"></i>
            </span>
            Staff Users
          </h2>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">
            {isAdminView
              ? "Add, edit, and toggle front-desk accounts. Admin and owner accounts stay with the owner."
              : "Manage staff accounts, roles, and access."}
          </p>
        </div>
        <button onClick={openNew}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 transition">
          <i className="fas fa-user-plus text-xs" aria-hidden="true"></i>
          <span className="text-sm font-medium">{isAdminView ? "Add Front Desk" : "Add User"}</span>
          <kbd className="ml-1.5 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-mono leading-none">
            Ctrl+N
          </kbd>
        </button>
      </div>

      {/* Load error banner */}
      {loadError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-sm text-rose-700 font-medium">
            <i className="fas fa-exclamation-triangle mr-2" aria-hidden="true"></i>Failed to load users. Please try again.
          </span>
          <button onClick={load}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition">
            <i className="fas fa-redo mr-1.5" aria-hidden="true"></i>Retry
          </button>
        </div>
      )}

      {/* Search + Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
          <input ref={searchRef} type="text" aria-label="Search users" placeholder="Search by name or email..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-400 transition" />
          {searchTerm && (
            <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
              <i className="fas fa-times-circle text-sm" aria-hidden="true"></i>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Role filters — admin only ever sees front_desk so the
              chips are redundant for them; render a static label
              instead so the layout doesn't shift. */}
          {isAdminView ? (
            <span className="px-3.5 py-2 rounded-full text-xs font-semibold bg-info-bg text-info-fg ring-1 ring-sky-200">
              Front Desk
            </span>
          ) : (
            [
              { key: "all", label: "All Roles" },
              { key: "owner", label: "Owner" },
              { key: "admin", label: "Admin" },
              { key: "front_desk", label: "Front Desk" },
            ].map((f) => (
              <button key={f.key} onClick={() => setFilterRole(f.key)}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold transition ${
                  filterRole === f.key
                    ? "bg-info-bg text-info-fg ring-1 ring-sky-200"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}>
                {f.label}
              </button>
            ))
          )}
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
                  ? "bg-info-bg text-info-fg ring-1 ring-sky-200"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar — owner only (admin has no bulk privileges) */}
      {!isAdminView && selected.size > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-5 py-3 flex items-center justify-between animate-hero-fade-in opacity-0">
          <span className="text-sm font-medium text-sky-800">
            <i className="fas fa-check-circle mr-2" aria-hidden="true"></i>{selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => bulkAction("activate")}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition">
              <i className="fas fa-check mr-1.5" aria-hidden="true"></i>Activate
            </button>
            <button onClick={() => bulkAction("deactivate")}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition">
              <i className="fas fa-pause mr-1.5" aria-hidden="true"></i>Deactivate
            </button>
            <button onClick={() => setBulkDeleteConfirm(true)}
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
              {["owner", "admin", "front_desk"].map((r) => (
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
            <>
            <table className="hidden md:table min-w-full text-sm">
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
            {/* Mobile loading skeleton — matches the card-stack shape
                rendered when data lands. */}
            <ul className="md:hidden space-y-3 p-4" aria-busy="true" aria-label="Loading users">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-slate-200 rounded w-32" />
                      <div className="h-3 bg-slate-100 rounded w-44" />
                    </div>
                    <div className="h-5 bg-slate-200 rounded-full w-16" />
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <div className="h-5 bg-slate-200 rounded-full w-20" />
                    <div className="h-8 bg-slate-200 rounded w-28" />
                  </div>
                </li>
              ))}
            </ul>
            </>
          ) : sorted.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 mb-4">
                <i className="fas fa-users text-slate-300 text-2xl" aria-hidden="true"></i>
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
                <button onClick={() => { setSearchTerm(""); setFilterRole(isAdminView ? "front_desk" : "all"); setFilterStatus("all"); }}
                  className="mt-4 text-sm text-sky-600 hover:text-sky-700 font-medium">
                  <i className="fas fa-times mr-1.5" aria-hidden="true"></i>Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table — wrapped in hidden md:table so the
                  mobile card list (rendered below) is the sole listing
                  visible <md. Five columns with avatar + multiple
                  action buttons doesn't fit phone widths. */}
              <table className="hidden md:table min-w-full text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 w-10">
                      {!isAdminView && (
                        <input type="checkbox"
                          checked={allPageSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400" />
                      )}
                    </th>
                    {[["User", "Name"], ["Role", "Role"], ["Status", "Status"]].map(([label, key]) => (
                      <th key={key} className="px-6 py-3 text-left">
                        <button onClick={() => handleSort(key)}
                          className="flex items-center gap-1 hover:text-sky-600 transition-colors group">
                          {label}
                          <span className="text-slate-400 group-hover:text-sky-400">
                            {sortBy === key
                              ? <i className={`fas fa-arrow-${sortDir === "asc" ? "up" : "down"} text-sky-500`} aria-hidden="true"></i>
                              : <i className="fas fa-sort opacity-40" aria-hidden="true"></i>}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Restructured rows: dropped role="button" + tabIndex + the
                      whole-row onClick. Tab order no longer walks into a
                      "row button" then immediately into nested form
                      controls — each row is a static <tr> and the user
                      name is its own button (the natural click affordance).
                      Mirrors the admin/Catalog.jsx template from 8391ff3. */}
                  {paginated.map((u, idx) => (
                    <tr key={u.id}
                      className={`transition-all ${idx % 2 === 1 ? "bg-slate-50/50" : ""} ${!u.is_active ? "opacity-60" : ""}`}>
                      <td className="px-6 py-4">
                        {!isAdminView && u.id !== currentUser?.id ? (
                          <input type="checkbox" checked={selected.has(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            aria-label={`Select ${u.name}`}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400" />
                        ) : <div className="h-4 w-4" aria-hidden="true"></div>}
                      </td>
                      <td className="px-6 py-4">
                        <button type="button" onClick={() => setViewUser(u)}
                          className="flex items-center gap-3 text-left w-full hover:text-sky-700 group focus:outline-none focus:ring-2 focus:ring-sky-400 rounded-md p-1 -m-1">
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt=""
                              className="h-9 w-9 rounded-full object-cover shrink-0"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className={`h-9 w-9 rounded-full ${ROLE_AVATAR[u.role] || "bg-slate-400"} text-white flex items-center justify-center text-xs font-bold shrink-0`} aria-hidden="true">
                              {getInitials(u.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 group-hover:text-sky-700 truncate">
                              {u.name}
                              {u.id === currentUser?.id && <span className="ml-1.5 text-[10px] text-slate-400 font-normal">(you)</span>}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{u.email}</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] || "bg-slate-100 text-slate-700"}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                          u.is_active ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg"}`}>
                          <span className={`h-2 w-2 rounded-full ${u.is_active ? "bg-success-ring" : "bg-danger-ring"}`} aria-hidden="true" />
                          {u.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" onClick={() => copyEmail(u.email)} aria-label={`Copy email for ${u.name}`}
                            className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
                            <i className="fas fa-envelope text-sm" aria-hidden="true"></i>
                          </button>
                          {canEdit(u) && (
                            <button type="button" onClick={() => openEdit(u)} aria-label={`Edit ${u.name}`}
                              className="h-11 w-11 rounded-lg hover:bg-sky-50 flex items-center justify-center text-sky-700 hover:text-sky-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
                              <i className="fas fa-pen text-sm" aria-hidden="true"></i>
                            </button>
                          )}
                          {canToggleActive(u) && (
                            <button type="button" onClick={() => setConfirmToggle(u)} aria-label={u.is_active ? `Deactivate ${u.name}` : `Activate ${u.name}`}
                              className={`h-11 w-11 rounded-lg flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${u.is_active
                                ? "hover:bg-warning-bg text-warning-fg focus-visible:ring-amber-500"
                                : "hover:bg-success-bg text-success-fg focus-visible:ring-emerald-500"}`}>
                              <i className={`fas ${u.is_active ? "fa-toggle-off" : "fa-toggle-on"} text-sm`} aria-hidden="true"></i>
                            </button>
                          )}
                          {canDelete(u) && (
                            <button type="button" onClick={() => setConfirmDelete(u)} aria-label={`Delete ${u.name}`}
                              className="h-11 w-11 rounded-lg hover:bg-danger-bg text-danger-fg flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2">
                              <i className="fas fa-trash text-sm" aria-hidden="true"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile card list — same data + actions as the desktop
                  table. Card click opens the user-detail modal (same
                  as clicking the user's name on desktop). Bulk-select
                  checkbox sits inline with the avatar; hidden in admin
                  view (matches desktop behavior — bulk actions are
                  owner-only). Action buttons get tap-target height
                  and stop propagation so a tap doesn't also open the
                  detail modal. */}
              <ul className="md:hidden space-y-3 p-4">
                {paginated.map((u) => {
                  const isMe = u.id === currentUser?.id;
                  return (
                    <li key={u.id}>
                      <div className={`rounded-xl border border-slate-200 bg-white shadow-sm p-4 ${!u.is_active ? 'opacity-70' : ''}`}>
                        <div className="flex items-start gap-3">
                          {!isAdminView && !isMe && (
                            <input
                              type="checkbox"
                              checked={selected.has(u.id)}
                              onChange={() => toggleSelect(u.id)}
                              aria-label={`Select ${u.name}`}
                              className="mt-2 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400 shrink-0"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setViewUser(u)}
                            className="flex-1 flex items-center gap-3 text-left min-w-0 focus:outline-none focus:ring-2 focus:ring-sky-400 rounded-md p-1 -m-1"
                            aria-label={`View ${u.name}`}
                          >
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" loading="lazy" decoding="async" />
                            ) : (
                              <div className={`h-10 w-10 rounded-full ${ROLE_AVATAR[u.role] || 'bg-slate-400'} text-white flex items-center justify-center text-sm font-bold shrink-0`} aria-hidden="true">
                                {getInitials(u.name)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-900 truncate">
                                {u.name}
                                {isMe && <span className="ml-1.5 text-[10px] text-slate-400 font-normal">(you)</span>}
                              </p>
                              <p className="text-xs text-slate-500 truncate">{u.email}</p>
                            </div>
                          </button>
                          <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            u.is_active ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg'}`}>
                            <span className={`h-2 w-2 rounded-full ${u.is_active ? 'bg-success-ring' : 'bg-danger-ring'}`} aria-hidden="true" />
                            {u.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-700'}`}>
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => copyEmail(u.email)} aria-label={`Copy email for ${u.name}`}
                              className="h-10 w-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
                              <i className="fas fa-envelope text-xs" aria-hidden="true"></i>
                            </button>
                            {canEdit(u) && (
                              <button onClick={() => openEdit(u)} aria-label={`Edit ${u.name}`}
                                className="h-10 w-10 rounded-lg hover:bg-sky-50 flex items-center justify-center text-sky-600 hover:text-sky-800 transition">
                                <i className="fas fa-pen text-xs" aria-hidden="true"></i>
                              </button>
                            )}
                            {canToggleActive(u) && (
                              <button onClick={() => setConfirmToggle(u)} aria-label={u.is_active ? `Deactivate ${u.name}` : `Activate ${u.name}`}
                                className={`h-10 w-10 rounded-lg flex items-center justify-center transition ${u.is_active
                                  ? 'hover:bg-warning-bg text-warning-fg'
                                  : 'hover:bg-success-bg text-success-fg'}`}>
                                <i className={`fas ${u.is_active ? 'fa-toggle-off' : 'fa-toggle-on'} text-xs`} aria-hidden="true"></i>
                              </button>
                            )}
                            {canDelete(u) && (
                              <button onClick={() => setConfirmDelete(u)} aria-label={`Delete ${u.name}`}
                                className="h-10 w-10 rounded-lg hover:bg-danger-bg text-danger-fg flex items-center justify-center transition">
                                <i className="fas fa-trash text-xs" aria-hidden="true"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Showing {(safePage - 1) * PAGE_SIZE + 1}{"\u2013"}{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                      aria-label="Previous page"
                      className="h-11 w-11 rounded-lg border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
                      <i className="fas fa-chevron-left text-sm" aria-hidden="true"></i>
                    </button>
                    {getPageNumbers(safePage, totalPages).map((n, i) =>
                      n === "..." ? (
                        <span key={`ellipsis-${i}`} className="h-11 min-w-[2.75rem] flex items-center justify-center text-sm text-slate-500 select-none">
                          &hellip;
                        </span>
                      ) : (
                        <button key={n} type="button" onClick={() => setPage(n)}
                          aria-label={`Go to page ${n}`}
                          aria-current={n === safePage ? 'page' : undefined}
                          className={`h-11 min-w-[2.75rem] rounded-lg text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                            n === safePage
                              ? "bg-sky-600 text-white shadow-sm focus-visible:ring-sky-500"
                              : "border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400"
                          }`}>
                          {n}
                        </button>
                      )
                    )}
                    <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
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

        {/* Retry */}
        {!loading && users.length === 0 && !debouncedSearch && filterRole === "all" && filterStatus === "all" && (
          <div className="px-6 pb-6 flex justify-center">
            <button onClick={load}
              className="text-sm text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1.5">
              <i className="fas fa-redo text-xs" aria-hidden="true"></i>Retry loading
            </button>
          </div>
        )}
      </div>

      {/* ── View User Modal ── */}
      <Modal open={!!viewUser} onClose={() => setViewUser(null)} maxWidth="max-w-md" label={viewUser ? `User details — ${viewUser.name}` : 'User details'}>
        {viewUser && (
          <div>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center">
                  <i className="fas fa-user text-sky-600" aria-hidden="true"></i>
                </span>
                User Details
              </h3>
              <button onClick={() => setViewUser(null)}
                className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Avatar + name */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                {viewUser.avatar ? (
                  <img
                    src={viewUser.avatar}
                    alt={viewUser.name}
                    className="h-14 w-14 rounded-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className={`h-14 w-14 rounded-full ${ROLE_AVATAR[viewUser.role] || "bg-slate-400"} text-white flex items-center justify-center text-lg font-bold`}>
                    {getInitials(viewUser.name)}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-900 text-lg">{viewUser.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{viewUser.email}</p>
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                  <div className="h-8 w-8 rounded-lg bg-sky-100 flex items-center justify-center mx-auto mb-1.5">
                    <i className="fas fa-shield-halved text-sky-600 text-xs" aria-hidden="true"></i>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">{ROLE_LABELS[viewUser.role] || viewUser.role}</p>
                  <p className="text-[10px] text-slate-400">Role</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center mx-auto mb-1.5 ${viewUser.is_active ? "bg-emerald-100" : "bg-rose-100"}`}>
                    <i className={`fas ${viewUser.is_active ? "fa-check-circle text-emerald-600" : "fa-times-circle text-rose-600"} text-xs`} aria-hidden="true"></i>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">{viewUser.is_active ? "Active" : "Disabled"}</p>
                  <p className="text-[10px] text-slate-400">Status</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                  <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center mx-auto mb-1.5">
                    <i className="fas fa-calendar text-violet-600 text-xs" aria-hidden="true"></i>
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
                <i className="fas fa-envelope mr-1.5 text-xs" aria-hidden="true"></i>Copy Email
              </button>
              {canEdit(viewUser) && (
                <button onClick={() => openEdit(viewUser)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium transition">
                  <i className="fas fa-pen mr-1.5 text-xs" aria-hidden="true"></i>Edit
                </button>
              )}
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

      {/* ── Save User ConfirmDialog ── */}
      <ConfirmDialog
        open={saveConfirmOpen}
        title={editing?.id ? "Save user changes?" : "Create user?"}
        message={editing?.id
          ? <>Save changes to <strong>{editing?.name || 'this user'}</strong>? Role + status changes take effect on their next sign-in.</>
          : <>Create <strong>{editing?.name || 'this user'}</strong> as a <strong>{editing?.role}</strong>? They'll be able to sign in immediately.</>}
        confirmLabel={editing?.id ? "Save changes" : "Create user"}
        variant={editing?.id ? "info" : "warning"}
        onConfirm={saveUser}
        onCancel={() => setSaveConfirmOpen(false)}
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
      <Modal open={modalOpen} onClose={guardedCloseModal} label={editing && editing.id ? `Edit user — ${editing.name}` : 'Add new user'}>
        {editing && (
          <form onSubmit={requestSaveUser}>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                  <i className={`fas ${editing.id ? "fa-user-pen" : "fa-user-plus"} text-sky-600 text-lg`} aria-hidden="true"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{editing.id ? "Edit User" : "Add New User"}</h2>
                  <p className="text-xs text-slate-400">{editing.id ? "Update details, role, or reset password" : "Create a new staff account"}</p>
                </div>
              </div>
              <button type="button" onClick={guardedCloseModal}
                className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Account Info */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-md bg-sky-100 flex items-center justify-center">
                      <i className="fas fa-id-card text-sky-500 text-[10px]" aria-hidden="true"></i>
                    </span>Account Info
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Avatar upload — full-width row above name/email */}
                  <div className="md:col-span-2 flex items-center gap-4 pb-4 border-b border-slate-200">
                    <div className="relative">
                      {editing.avatar ? (
                        <img
                          src={editing.avatar}
                          alt={editing.name || "Staff"}
                          className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-sm"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className={`h-16 w-16 rounded-full text-white flex items-center justify-center text-xl font-semibold ${ROLE_AVATAR[editing.role] || "bg-slate-400"}`}>
                          {(editing.name || "?").trim().split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={onPickAvatar}
                        disabled={uploadingAvatar}
                        className="absolute -bottom-1 -right-1 bg-sky-600 text-white rounded-full w-7 h-7 flex items-center justify-center border-2 border-white hover:bg-sky-700 disabled:opacity-60"
                        title="Change photo"
                        aria-label="Change profile photo"
                      >
                        {uploadingAvatar
                          ? <i className="fas fa-spinner fa-spin text-[11px]" aria-hidden="true"></i>
                          : <i className="fas fa-camera text-[11px]" aria-hidden="true"></i>}
                      </button>
                      <input
                        ref={avatarFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onAvatarChange}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Profile Photo</p>
                      <p className="text-xs text-slate-400 mt-0.5">Optional. Click the camera to upload.</p>
                      {editing.avatar && (
                        <button
                          type="button"
                          onClick={() => setField("avatar", "")}
                          className="text-xs text-rose-600 hover:text-rose-700 mt-1"
                        >
                          <i className="fas fa-trash-alt mr-1" aria-hidden="true"></i>Remove
                        </button>
                      )}
                    </div>
                  </div>
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
                      <i className="fas fa-shield-halved text-violet-500 text-[10px]" aria-hidden="true"></i>
                    </span>Access & Security
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Role <span className="text-red-400">*</span></label>
                    {/* Admin can only create/edit front_desk staff —
                        backend rejects any other role from an admin
                        caller, so render a single locked tile rather
                        than a two-option picker the user can't use. */}
                    <div className={`grid gap-3 ${isAdminView ? "grid-cols-1" : "grid-cols-2"}`}>
                      {[
                        { key: "front_desk", label: "Front Desk", icon: "fa-headset",      bg: "peer-checked:bg-sky-50 peer-checked:border-sky-300 peer-checked:ring-1 peer-checked:ring-sky-200" },
                        { key: "admin",      label: "Admin",      icon: "fa-user-shield",  bg: "peer-checked:bg-violet-50 peer-checked:border-violet-300 peer-checked:ring-1 peer-checked:ring-violet-200" },
                      ]
                        .filter(({ key }) => !isAdminView || key === "front_desk")
                        .map(({ key, label, icon, bg }) => (
                        <label key={key} className="relative cursor-pointer select-none">
                          <input type="radio" name="role" value={key} checked={editing.role === key}
                            onChange={() => setField("role", key)} className="peer sr-only"
                            disabled={isAdminView} />
                          <div className={`flex flex-col items-center gap-1.5 p-3 bg-white border border-slate-200 rounded-lg transition-all hover:border-slate-300 ${bg} ${isAdminView ? "bg-sky-50 border-sky-300 ring-1 ring-sky-200" : ""}`}>
                            <i className={`fas ${icon} text-slate-400`} aria-hidden="true"></i>
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
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><i className="fas fa-lock text-xs" aria-hidden="true"></i></span>
                      <input type={showPassword ? "text" : "password"} value={editing.password || ""} onChange={(e) => setField("password", e.target.value)}
                        required={!editing.id} minLength={8}
                        placeholder={editing.id ? "Enter new password to change" : "Meet all requirements below"}
                        className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-300 transition" />
                      <button type="button" onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                        aria-label={showPassword ? "Hide password" : "Show password"}>
                        <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"} text-xs`} aria-hidden="true"></i>
                      </button>
                    </div>
                    {/* Live requirements checklist — shown only when the
                        field has content. For edit mode, leaving it blank
                        keeps the current password (requirements irrelevant). */}
                    {(editing.password ?? "").length > 0 && (
                      <PasswordRequirements value={editing.password} />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button type="button" onClick={guardedCloseModal}
                className="inline-flex items-center justify-center min-h-11 px-5 py-2.5 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">Cancel</button>
              {/* Save is disabled when the password field is in an invalid
                  state: required-and-missing on create, OR non-empty and
                  not passing all strength rules (applies to both create
                  and edit — if the owner types a password, it must be
                  strong; edit can still skip the field to keep current). */}
              <button type="submit" disabled={
                saving
                || (!editing?.id && !checkPasswordStrength(editing?.password))
                || ((editing?.password ?? "").length > 0 && !checkPasswordStrength(editing?.password))
              }
                className="inline-flex items-center justify-center min-h-11 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
                {saving ? <><i className="fas fa-spinner fa-spin mr-2" aria-hidden="true"></i>Saving...</> : <><i className="fas fa-check mr-2" aria-hidden="true"></i>Save User</>}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
    </>
  );
}
