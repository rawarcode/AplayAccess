import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "../../components/modals/Modal.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import Toast, { useToast } from "../../components/ui/Toast";
import { getAdminGuests, updateAdminUser } from "../../lib/adminApi";
import useDebounce from "../../hooks/useDebounce.js";
import { fmtGuestEmail } from "../../lib/format.js";
import { useAuth } from "../../context/AuthContext.jsx";

const PAGE_SIZE = 10;

export default function AdminGuests() {
  const [toast, showToast, clearToast, toastType] = useToast();
  const { user: currentUser } = useAuth();
  // Only owner can flip a guest's auth flag — backend
  // Admin\UserController::update rejects admin callers attempting to
  // touch non-front_desk targets, so we hide the toggle UI for admin
  // to avoid serving them a button that always 403s.
  const canToggle = currentUser?.role === "owner";

  /* ── data ── */
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  // Holds the guest currently in the toggle-active confirmation
  // dialog. Activating is non-destructive; deactivating locks the
  // user out, so both flows go through the dialog for consistency
  // with the Staff tab pattern.
  const [confirmToggle, setConfirmToggle] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  /* ── modals ── */
  const [viewGuest, setViewGuest] = useState(null);

  /* ── table controls ── */
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(() => localStorage.getItem("guests_sortBy") || "Name");
  const [sortDir, setSortDir] = useState(() => localStorage.getItem("guests_sortDir") || "asc");

  const searchRef = useRef(null);

  /* ── persist sort ── */
  useEffect(() => { localStorage.setItem("guests_sortBy", sortBy); }, [sortBy]);
  useEffect(() => { localStorage.setItem("guests_sortDir", sortDir); }, [sortDir]);

  /* ── load ── */
  const load = useCallback(() => {
    setLoading(true);
    getAdminGuests()
      .then((r) => setGuests(r.data.data))
      .catch(() => showToast("Failed to load guests.", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  // Refetch on tab focus + visibilitychange so a deactivation done in
  // another tab/window (e.g., owner toggling the user via the Staff
  // tab, or the user self-deleting their account) propagates here
  // without requiring a manual page refresh. Without this, the
  // Active/Disabled badge can disagree with live login behavior for
  // however long the operator stays on the page.
  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== 'visible') return;
      load();
    }
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  /* ── filter + sort + paginate ── */
  const filtered = guests.filter((g) => {
    if (filterStatus === "active" && !g.is_active) return false;
    if (filterStatus === "inactive" && g.is_active) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return g.name.toLowerCase().includes(q) || g.email.toLowerCase().includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal;
    if (sortBy === "Email") { aVal = a.email.toLowerCase(); bVal = b.email.toLowerCase(); }
    else if (sortBy === "Bookings") { aVal = a.total_bookings || 0; bVal = b.total_bookings || 0; }
    else if (sortBy === "Spent") { aVal = Number(a.total_spent) || 0; bVal = Number(b.total_spent) || 0; }
    else if (sortBy === "Joined") { aVal = new Date(a.joined || a.created_at || 0).getTime(); bVal = new Date(b.joined || b.created_at || 0).getTime(); }
    else if (sortBy === "Last Booking") { aVal = new Date(a.last_booking || 0).getTime(); bVal = new Date(b.last_booking || 0).getTime(); }
    else if (sortBy === "Status") { aVal = a.is_active ? 0 : 1; bVal = b.is_active ? 0 : 1; }
    else { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterStatus]);

  /* ── helpers ── */
  async function copyEmail(email) {
    try { await navigator.clipboard.writeText(email); showToast("Email copied!", "success"); }
    catch { showToast("Failed to copy.", "error"); }
  }

  // Flip a guest's auth flag via PATCH /api/admin/users/{id}. Backend
  // already supports this for owner callers (admin gets 403). Optimistic
  // update on success — the focus-refetch effect above will reconcile
  // anyway if the API response disagrees with our local guess.
  async function handleToggleActive(g) {
    if (!g) return;
    setTogglingId(g.id);
    try {
      await updateAdminUser(g.id, { is_active: !g.is_active });
      const next = !g.is_active;
      setGuests((list) => list.map((x) => (x.id === g.id ? { ...x, is_active: next } : x)));
      if (viewGuest?.id === g.id) setViewGuest((v) => ({ ...v, is_active: next }));
      showToast(`${g.name} ${next ? "activated" : "deactivated"}.`, "success");
    } catch (err) {
      showToast(err?.response?.data?.message || `Failed to ${g.is_active ? "deactivate" : "activate"} ${g.name}.`, "error");
    } finally {
      setTogglingId(null);
      setConfirmToggle(null);
    }
  }

  function handleSort(key) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("asc"); }
  }

  function getInitials(name) {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  }

  /* ── stats ── */
  const activeCount = guests.filter((g) => g.is_active).length;
  const totalRevenue = guests.reduce((s, g) => s + (Number(g.total_spent) || 0), 0);

  /* ── skeleton ── */
  const SkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="h-9 w-9 bg-slate-200 rounded-full"></div><div className="space-y-1.5"><div className="h-4 bg-slate-200 rounded w-32"></div><div className="h-3 bg-slate-200 rounded w-40"></div></div></div></td>
        <td className="px-6 py-4 hidden md:table-cell"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-10"></div></td>
        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
        <td className="px-6 py-4 hidden lg:table-cell"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
        <td className="px-6 py-4 hidden lg:table-cell"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
        <td className="px-6 py-4"><div className="h-5 bg-slate-200 rounded-full w-16"></div></td>
        <td className="px-6 py-4"><div className="h-6 bg-slate-200 rounded w-16 ml-auto"></div></td>
      </tr>
    ));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center">
              <i className="fas fa-users text-sky-600" aria-hidden="true"></i>
            </span>
            Guests
          </h2>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">View guest accounts, booking history, and spending.
            <span className="text-slate-400 ml-1" title="Guests are marked inactive if they have no bookings in the past 6 months and their account is older than 6 months.">
              <i className="fas fa-circle-info text-xs ml-0.5" aria-hidden="true"></i>
            </span>
          </p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
          <input ref={searchRef} type="text" aria-label="Search guests" placeholder="Search by name or email..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-400 transition" />
          {searchTerm && (
            <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
              <i className="fas fa-times-circle text-sm" aria-hidden="true"></i>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {[
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "inactive", label: "Disabled" },
          ].map((f) => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                filterStatus === f.key
                  ? "bg-info-bg text-info-fg ring-1 ring-sky-200"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {/* Stats header */}
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-slate-600">Total</p>
              <p className="text-2xl font-semibold text-slate-900">{guests.length}</p>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div>
              <p className="text-sm text-slate-600">Active</p>
              <p className="text-2xl font-semibold text-emerald-600">{activeCount}</p>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div>
              <p className="text-sm text-slate-600">Revenue</p>
              <p className="text-2xl font-semibold text-indigo-600">{"\u20B1"}{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
          {(debouncedSearch || filterStatus !== "all") && (
            <span className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200">
              Showing {filtered.length} of {guests.length}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <>
            <table className="hidden md:table min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left">Guest</th>
                  <th className="px-6 py-3 text-left hidden md:table-cell">Phone</th>
                  <th className="px-6 py-3 text-left">Bookings</th>
                  <th className="px-6 py-3 text-left">Total Spent</th>
                  <th className="px-6 py-3 text-left hidden lg:table-cell">Joined</th>
                  <th className="px-6 py-3 text-left hidden lg:table-cell">Last Booking</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100"><SkeletonRows /></tbody>
            </table>
            <ul className="md:hidden space-y-3 p-4" aria-busy="true" aria-label="Loading guests">
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
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
                    {Array.from({ length: 4 }).map((__, j) => (
                      <div key={j}>
                        <div className="h-2.5 bg-slate-100 rounded w-12 mb-1.5" />
                        <div className="h-3 bg-slate-200 rounded w-16" />
                      </div>
                    ))}
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
                {debouncedSearch || filterStatus !== "all" ? "No guests match your search." : "No guests yet."}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {debouncedSearch || filterStatus !== "all"
                  ? "Try adjusting your search or filter."
                  : "Guests will appear here once they register."}
              </p>
              {(debouncedSearch || filterStatus !== "all") && (
                <button onClick={() => { setSearchTerm(""); setFilterStatus("all"); }}
                  className="mt-4 text-sm text-sky-600 hover:text-sky-700 font-medium">
                  <i className="fas fa-times mr-1.5" aria-hidden="true"></i>Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table — wrapped in hidden md:table so the
                  mobile card list (rendered below) is the sole listing
                  visible <md. Was already using `hidden md:table-cell`
                  per-column hiding, but on phones that left only 5/8
                  columns crammed sideways. The card stack mirrors the
                  pattern used across the other ported listing pages. */}
              <table className="hidden md:table min-w-full text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <tr>
                    {[
                      ["Guest", "Name", ""],
                      ["Phone", "Phone", "hidden md:table-cell"],
                      ["Bookings", "Bookings", ""],
                      ["Total Spent", "Spent", ""],
                      ["Joined", "Joined", "hidden lg:table-cell"],
                      ["Last Booking", "Last Booking", "hidden lg:table-cell"],
                      ["Status", "Status", ""],
                    ].map(([label, key, hide]) => (
                      <th key={key} className={`px-6 py-3 text-left ${hide}`}>
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
                  {paginated.map((g, idx) => (
                    <tr key={g.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setViewGuest(g)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewGuest(g); } }}
                      className={`cursor-pointer transition-all hover:bg-sky-50/40 hover:shadow-sm ${idx % 2 === 1 ? "bg-slate-50/50" : ""} ${!g.is_active ? "opacity-60" : ""}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {getInitials(g.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{g.name}</p>
                            <p className="text-xs text-slate-400 truncate">{fmtGuestEmail(g.email)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 hidden md:table-cell">{g.phone || "\u2014"}</td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-800">{g.total_bookings || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-800">{"\u20B1"}{Number(g.total_spent || 0).toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs hidden lg:table-cell whitespace-nowrap">{g.joined || "\u2014"}</td>
                      <td className="px-6 py-4 text-slate-400 text-xs hidden lg:table-cell whitespace-nowrap">{g.last_booking || "\u2014"}</td>
                      <td className="px-6 py-4">
                        {/* Two distinct signals stacked. The Active /
                            Disabled badge tracks the auth flag — same
                            meaning as on the Staff tab and matches what
                            login enforces. The Recent / Stale pill
                            below tracks the engagement heuristic
                            separately so marketing-style "do they still
                            book here?" info is preserved without
                            misleading a reader into thinking 'Inactive
                            engagement' = 'cannot log in'. */}
                        <div className="flex flex-col items-start gap-1">
                          <span
                            title={g.is_active ? "Account can log in" : "Account is deactivated and cannot log in"}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              g.is_active ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg"
                            }`}
                          >
                            <span className={`h-2 w-2 rounded-full ${g.is_active ? "bg-success-ring" : "bg-danger-ring"}`} />
                            {g.is_active ? "Active" : "Disabled"}
                          </span>
                          <span
                            title={g.is_engaged ? "Booked within the last 6 months or new account" : "No bookings in 6+ months"}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${
                              g.is_engaged ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <i className={`fas ${g.is_engaged ? "fa-clock" : "fa-hourglass-half"} text-[8px]`} aria-hidden="true"></i>
                            {g.is_engaged ? "Recent" : "Stale"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => copyEmail(g.email)} title="Copy email"
                            className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
                            <i className="fas fa-envelope text-xs" aria-hidden="true"></i>
                          </button>
                          <button onClick={() => setViewGuest(g)} title="View"
                            className="h-8 w-8 rounded-lg hover:bg-sky-50 flex items-center justify-center text-sky-600 hover:text-sky-800 transition">
                            <i className="fas fa-eye text-xs" aria-hidden="true"></i>
                          </button>
                          {canToggle && (
                            <button
                              onClick={() => setConfirmToggle(g)}
                              disabled={togglingId === g.id}
                              title={g.is_active ? `Deactivate ${g.name}` : `Activate ${g.name}`}
                              aria-label={g.is_active ? `Deactivate ${g.name}` : `Activate ${g.name}`}
                              className={`h-8 w-8 rounded-lg flex items-center justify-center transition disabled:opacity-50 ${
                                g.is_active
                                  ? "hover:bg-rose-50 text-rose-500 hover:text-rose-700"
                                  : "hover:bg-emerald-50 text-emerald-600 hover:text-emerald-800"
                              }`}
                            >
                              <i className={`fas ${g.is_active ? "fa-toggle-off" : "fa-toggle-on"} text-xs`} aria-hidden="true"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile card list — same paginated set as the desktop
                  table. Whole-card click opens the detail modal. The
                  copy-email + view buttons stay as a small action
                  cluster on the bottom-right of each card; tap
                  propagation stopped so a button tap doesn't also
                  trigger setViewGuest. */}
              <ul className="md:hidden space-y-3 p-4">
                {paginated.map((g) => (
                  <li key={g.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setViewGuest(g)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewGuest(g); } }}
                      className={`rounded-xl border border-slate-200 bg-white shadow-sm p-4 cursor-pointer hover:bg-sky-50/40 transition focus:outline-none focus:ring-2 focus:ring-sky-400 ${!g.is_active ? 'opacity-70' : ''}`}
                    >
                      {/* Top — avatar + name/email + status pill */}
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-sky-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                          {getInitials(g.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{g.name}</p>
                          <p className="text-xs text-slate-500 truncate">{fmtGuestEmail(g.email)}</p>
                          {g.phone && <p className="text-xs text-slate-400 truncate mt-0.5">{g.phone}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            title={g.is_active ? 'Account can log in' : 'Account is deactivated and cannot log in'}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              g.is_active ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg'
                            }`}
                          >
                            <span className={`h-2 w-2 rounded-full ${g.is_active ? 'bg-success-ring' : 'bg-danger-ring'}`} aria-hidden="true" />
                            {g.is_active ? 'Active' : 'Disabled'}
                          </span>
                          <span
                            title={g.is_engaged ? 'Booked within the last 6 months or new account' : 'No bookings in 6+ months'}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${
                              g.is_engaged ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <i className={`fas ${g.is_engaged ? 'fa-clock' : 'fa-hourglass-half'} text-[8px]`} aria-hidden="true"></i>
                            {g.is_engaged ? 'Recent' : 'Stale'}
                          </span>
                        </div>
                      </div>

                      {/* Stats — 2x2 grid (Bookings, Spent, Joined,
                          Last Booking). Same fields as the desktop
                          row's `hidden lg:table-cell` columns — the
                          card surfaces them all on phones. */}
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">Bookings</p>
                          <p className="text-sm text-slate-800 font-semibold mt-0.5">{g.total_bookings || 0}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">Total Spent</p>
                          <p className="text-sm text-slate-800 font-semibold mt-0.5">{'₱'}{Number(g.total_spent || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">Joined</p>
                          <p className="text-xs text-slate-600 mt-0.5 truncate">{g.joined || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">Last Booking</p>
                          <p className="text-xs text-slate-600 mt-0.5 truncate">{g.last_booking || '—'}</p>
                        </div>
                      </div>

                      {/* Action cluster — copy email + explicit view
                          button. setViewGuest is also fired by the
                          whole-card click, but the explicit button is
                          the more discoverable affordance. */}
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => copyEmail(g.email)} aria-label={`Copy email for ${g.name}`}
                          className="h-10 w-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
                          <i className="fas fa-envelope text-xs" aria-hidden="true"></i>
                        </button>
                        <button onClick={() => setViewGuest(g)} aria-label={`View ${g.name}`}
                          className="h-10 w-10 rounded-lg hover:bg-sky-50 flex items-center justify-center text-sky-600 hover:text-sky-800 transition">
                          <i className="fas fa-eye text-xs" aria-hidden="true"></i>
                        </button>
                        {canToggle && (
                          <button
                            onClick={() => setConfirmToggle(g)}
                            disabled={togglingId === g.id}
                            aria-label={g.is_active ? `Deactivate ${g.name}` : `Activate ${g.name}`}
                            className={`h-10 w-10 rounded-lg flex items-center justify-center transition disabled:opacity-50 ${
                              g.is_active
                                ? "hover:bg-rose-50 text-rose-500 hover:text-rose-700"
                                : "hover:bg-emerald-50 text-emerald-600 hover:text-emerald-800"
                            }`}
                          >
                            <i className={`fas ${g.is_active ? "fa-toggle-off" : "fa-toggle-on"} text-xs`} aria-hidden="true"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Showing {(safePage - 1) * PAGE_SIZE + 1}{"\u2013"}{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                      className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                      <i className="fas fa-chevron-left text-xs" aria-hidden="true"></i>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                      <button key={n} onClick={() => setPage(n)}
                        className={`h-8 min-w-[2rem] rounded-lg text-xs font-semibold transition ${
                          n === safePage
                            ? "bg-sky-600 text-white shadow-sm"
                            : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}>
                        {n}
                      </button>
                    ))}
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                      className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                      <i className="fas fa-chevron-right text-xs" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Retry */}
        {!loading && guests.length === 0 && !debouncedSearch && filterStatus === "all" && (
          <div className="px-6 pb-6 flex justify-center">
            <button onClick={load}
              className="text-sm text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1.5">
              <i className="fas fa-redo text-xs" aria-hidden="true"></i>Retry loading
            </button>
          </div>
        )}
      </div>

      {/* ── View Guest Modal ── */}
      <Modal open={!!viewGuest} onClose={() => setViewGuest(null)} maxWidth="max-w-md">
        {viewGuest && (
          <div>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center">
                  <i className="fas fa-user text-sky-600" aria-hidden="true"></i>
                </span>
                Guest Details
              </h3>
              <button onClick={() => setViewGuest(null)}
                className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Avatar + name card */}
              <div className="flex items-center gap-4 p-4 bg-sky-50 rounded-xl border border-sky-100">
                <div className="h-16 w-16 rounded-full bg-sky-500 text-white flex items-center justify-center text-xl font-bold shadow-md ring-4 ring-white">
                  {getInitials(viewGuest.name)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-lg truncate">{viewGuest.name}</p>
                  <p className="text-sm text-slate-500 truncate">{fmtGuestEmail(viewGuest.email)}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span title={viewGuest.is_active ? "Account can log in" : "Account is deactivated and cannot log in"}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      viewGuest.is_active ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${viewGuest.is_active ? "bg-success-ring" : "bg-danger-ring"}`}></span>
                      {viewGuest.is_active ? "Active" : "Disabled"}
                    </span>
                    <span title={viewGuest.is_engaged ? "Booked within the last 6 months or new account" : "No bookings in 6+ months"}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${
                      viewGuest.is_engaged ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      <i className={`fas ${viewGuest.is_engaged ? "fa-clock" : "fa-hourglass-half"} text-[8px]`} aria-hidden="true"></i>
                      {viewGuest.is_engaged ? "Recent" : "Stale"}
                    </span>
                    {viewGuest.joined && (
                      <span className="text-[10px] text-slate-400">
                        <i className="fas fa-calendar-alt mr-1" aria-hidden="true"></i>Joined {viewGuest.joined}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats mini-cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                  <div className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center mx-auto mb-2">
                    <i className="fas fa-calendar-check text-sky-600 text-sm" aria-hidden="true"></i>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{viewGuest.total_bookings || 0}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mt-0.5">Bookings</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                  <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center mx-auto mb-2">
                    <i className="fas fa-peso-sign text-indigo-600 text-sm" aria-hidden="true"></i>
                  </div>
                  <p className="text-2xl font-bold text-indigo-600">{"\u20B1"}{Number(viewGuest.total_spent || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mt-0.5">Total Spent</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                  <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-2">
                    <i className="fas fa-clock-rotate-left text-amber-600 text-sm" aria-hidden="true"></i>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{viewGuest.last_booking || "Never"}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mt-0.5">Last Booking</p>
                </div>
              </div>

              {/* Contact info card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-md bg-sky-100 flex items-center justify-center">
                      <i className="fas fa-address-card text-sky-500 text-[10px]" aria-hidden="true"></i>
                    </span>Contact Info
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Email</p>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 truncate">{fmtGuestEmail(viewGuest.email)}</p>
                      {!/@removed\.local$/i.test(viewGuest.email ?? '') && (
                        <button onClick={() => copyEmail(viewGuest.email)} title="Copy"
                          className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition shrink-0">
                          <i className="fas fa-copy text-[10px]" aria-hidden="true"></i>
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Phone</p>
                    <p className="font-semibold text-slate-900">{viewGuest.phone || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Joined</p>
                    <p className="font-semibold text-slate-900">{viewGuest.joined || "\u2014"}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-2 flex-wrap">
              <button onClick={() => setViewGuest(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition">Close</button>
              {!/@removed\.local$/i.test(viewGuest.email ?? '') && (
                <button onClick={() => copyEmail(viewGuest.email)}
                  className="px-4 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-medium transition">
                  <i className="fas fa-envelope mr-1.5 text-xs" aria-hidden="true"></i>Copy Email
                </button>
              )}
              {/* Owner-only toggle. Anonymized accounts (deleted_*@removed.local)
                  intentionally don't get this button — reactivating a
                  ghost record after self-delete would conflict with the
                  account-delete flow's anonymization contract. */}
              {canToggle && !/@removed\.local$/i.test(viewGuest.email ?? '') && (
                <button
                  onClick={() => setConfirmToggle(viewGuest)}
                  disabled={togglingId === viewGuest.id}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 ${
                    viewGuest.is_active
                      ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  <i className={`fas ${viewGuest.is_active ? "fa-toggle-off" : "fa-toggle-on"} mr-1.5 text-xs`} aria-hidden="true"></i>
                  {viewGuest.is_active ? "Deactivate" : "Activate"}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Toast message={toast} type={toastType} onClose={clearToast} />

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.is_active ? "Deactivate Guest" : "Activate Guest"}
        message={
          confirmToggle?.is_active
            ? <><strong>{confirmToggle?.name}</strong> will be locked out of their account until reactivated. Existing bookings stay intact.</>
            : <>Restore login access for <strong>{confirmToggle?.name}</strong>?</>
        }
        confirmLabel={confirmToggle?.is_active ? "Deactivate" : "Activate"}
        variant={confirmToggle?.is_active ? "warning" : "info"}
        onConfirm={() => handleToggleActive(confirmToggle)}
        onCancel={() => setConfirmToggle(null)}
      />
    </div>
  );
}
