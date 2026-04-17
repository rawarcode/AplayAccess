import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "../../components/modals/Modal.jsx";
import Toast, { useToast } from "../../components/ui/Toast";
import { getAdminGuests } from "../../lib/adminApi";
import useDebounce from "../../hooks/useDebounce.js";

const PAGE_SIZE = 10;

export default function AdminGuests() {
  const [toast, showToast, clearToast, toastType] = useToast();

  /* ── data ── */
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);

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
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center">
              <i className="fas fa-users text-sky-600"></i>
            </span>
            Guests
          </h1>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">View guest accounts, booking history, and spending.
            <span className="text-slate-400 ml-1" title="Guests are marked inactive if they have no bookings in the past 6 months and their account is older than 6 months.">
              <i className="fas fa-circle-info text-xs ml-0.5"></i>
            </span>
          </p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input ref={searchRef} type="text" aria-label="Search guests" placeholder="Search by name or email..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-400 transition" />
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
          ].map((f) => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                filterStatus === f.key
                  ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200"
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
            <table className="min-w-full text-sm">
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
          ) : sorted.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 mb-4">
                <i className="fas fa-users text-slate-300 text-2xl"></i>
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
                  <i className="fas fa-times mr-1.5"></i>Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <table className="min-w-full text-sm text-slate-700">
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
                            <p className="text-xs text-slate-400 truncate">{g.email}</p>
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
                        <span title={g.is_active ? "Booked within the last 6 months or new account" : "No bookings in 6+ months"}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          g.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                        }`}>
                          <span className={`h-2 w-2 rounded-full ${g.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                          {g.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => copyEmail(g.email)} title="Copy email"
                            className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
                            <i className="fas fa-envelope text-xs"></i>
                          </button>
                          <button onClick={() => setViewGuest(g)} title="View"
                            className="h-8 w-8 rounded-lg hover:bg-sky-50 flex items-center justify-center text-sky-600 hover:text-sky-800 transition">
                            <i className="fas fa-eye text-xs"></i>
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
                    Showing {(safePage - 1) * PAGE_SIZE + 1}{"\u2013"}{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                      className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                      <i className="fas fa-chevron-left text-xs"></i>
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
                      <i className="fas fa-chevron-right text-xs"></i>
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
              <i className="fas fa-redo text-xs"></i>Retry loading
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
                  <i className="fas fa-user text-sky-600"></i>
                </span>
                Guest Details
              </h3>
              <button onClick={() => setViewGuest(null)}
                className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Avatar + name card */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-sky-50 to-indigo-50 rounded-xl border border-sky-100">
                <div className="h-16 w-16 rounded-full bg-sky-500 text-white flex items-center justify-center text-xl font-bold shadow-md ring-4 ring-white">
                  {getInitials(viewGuest.name)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-lg truncate">{viewGuest.name}</p>
                  <p className="text-sm text-slate-500 truncate">{viewGuest.email}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span title={viewGuest.is_active ? "Booked within the last 6 months or new account" : "No bookings in 6+ months"}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      viewGuest.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${viewGuest.is_active ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                      {viewGuest.is_active ? "Active" : "Inactive"}
                    </span>
                    {viewGuest.joined && (
                      <span className="text-[10px] text-slate-400">
                        <i className="fas fa-calendar-alt mr-1"></i>Joined {viewGuest.joined}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats mini-cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                  <div className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center mx-auto mb-2">
                    <i className="fas fa-calendar-check text-sky-600 text-sm"></i>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{viewGuest.total_bookings || 0}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mt-0.5">Bookings</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                  <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center mx-auto mb-2">
                    <i className="fas fa-peso-sign text-indigo-600 text-sm"></i>
                  </div>
                  <p className="text-2xl font-bold text-indigo-600">{"\u20B1"}{Number(viewGuest.total_spent || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mt-0.5">Total Spent</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                  <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-2">
                    <i className="fas fa-clock-rotate-left text-amber-600 text-sm"></i>
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
                      <i className="fas fa-address-card text-sky-500 text-[10px]"></i>
                    </span>Contact Info
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Email</p>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 truncate">{viewGuest.email}</p>
                      <button onClick={() => copyEmail(viewGuest.email)} title="Copy"
                        className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition shrink-0">
                        <i className="fas fa-copy text-[10px]"></i>
                      </button>
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
            <div className="px-6 pb-6 flex justify-end gap-2">
              <button onClick={() => setViewGuest(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition">Close</button>
              <button onClick={() => copyEmail(viewGuest.email)}
                className="px-4 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-medium transition">
                <i className="fas fa-envelope mr-1.5 text-xs"></i>Copy Email
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Toast message={toast} type={toastType} onClose={clearToast} />
    </div>
  );
}
