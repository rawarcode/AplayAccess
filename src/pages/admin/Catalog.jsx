import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  getAdminRooms,
  getAdminAddons,
  toggleAddonActive,
  updateRoomAvailability,
} from "../../lib/adminApi.js";
import Modal from "../../components/modals/Modal.jsx";
import Toast, { useToast } from "../../components/ui/Toast.jsx";
import useDebounce from "../../hooks/useDebounce.js";
import { TabBar } from "../owner/Users.jsx";

// Catalog page — admin's curation surface. Two tabs (Rooms / Add-ons),
// each visually consistent with the equivalent owner page (owner/Rooms,
// owner/Addons) but stripped to a single capability:
//   - Rooms: change availability_status (5 enum values). No rate /
//     capacity / name edits, no create / delete.
//   - Add-ons: toggle is_active. No create / rename / reprice / delete.
// Owner uses /owner/rooms (with the addons sub-tab) for full CRUD.

const PAGE_SIZE = 10;

const AVAIL = {
  available:   { label: "Available",          color: "bg-success-bg text-success-fg",   dot: "bg-success-ring",  icon: "fa-check-circle" },
  renovation:  { label: "Under Renovation",   color: "bg-danger-bg text-danger-fg",     dot: "bg-danger-ring",   icon: "fa-hard-hat"     },
  maintenance: { label: "Under Maintenance",  color: "bg-warning-bg text-warning-fg",   dot: "bg-warning-ring",  icon: "fa-wrench"       },
  reserved:    { label: "Reserved / Blocked", color: "bg-info-bg text-info-fg",         dot: "bg-info-ring",     icon: "fa-lock"         },
  closed:      { label: "Temporarily Closed", color: "bg-slate-100 text-slate-600",     dot: "bg-slate-400",     icon: "fa-ban"          },
};

const CATEGORY_TABS = [
  { key: "",         label: "All",       icon: "fa-th-large"       },
  { key: "room",     label: "Rooms",     icon: "fa-bed"            },
  { key: "cottage",  label: "Cottages",  icon: "fa-umbrella-beach" },
  { key: "pavilion", label: "Pavilions", icon: "fa-archway"        },
  { key: "tent",     label: "Tents",     icon: "fa-campground"     },
];

function getRoomCategory(r) {
  if (r.category) return r.category;
  const n = (r.name || "").toLowerCase();
  if (n.includes("tent"))     return "tent";
  if (n.includes("cottage"))  return "cottage";
  if (n.includes("pavilion")) return "pavilion";
  return "room";
}

function AvailBadge({ status }) {
  const cfg = AVAIL[status] || AVAIL.available;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

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

const TABS = [
  { key: "rooms",  icon: "fa-bed",            label: "Rooms"   },
  { key: "addons", icon: "fa-concierge-bell", label: "Add-ons" },
];

export default function AdminCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "addons" ? "addons" : "rooms";
  const setActiveTab = (key) => {
    if (key === "rooms") setSearchParams({});
    else setSearchParams({ tab: key });
  };

  return (
    <>
      <Helmet><title>Catalog — Aplaya Beach Resort</title></Helmet>
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === "rooms" ? <RoomsTab /> : <AddonsTab />}
    </>
  );
}

/* ───────────────────────── ROOMS TAB ───────────────────────── */

function RoomsTab() {
  const [rooms,        setRooms]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState(null);
  const [busyId,       setBusyId]       = useState(null);
  const [viewRoom,     setViewRoom]     = useState(null);
  const [searchTerm,   setSearchTerm]   = useState("");
  const [filterAvail,  setFilterAvail]  = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [page,         setPage]         = useState(1);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [toast, showToast, clearToast, toastType] = useToast();
  const searchRef = useRef(null);

  const load = useCallback((silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError(null);
    getAdminRooms()
      .then((r) => setRooms(r.data?.data ?? []))
      .catch(() => setError("Failed to load rooms."))
      .finally(() => { silent ? setRefreshing(false) : setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterAvail, filterCategory]);

  const filtered = useMemo(() => rooms.filter((r) => {
    if (filterCategory && getRoomCategory(r) !== filterCategory) return false;
    if (filterAvail && (r.availability_status || "available") !== filterAvail) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return (r.name || "").toLowerCase().includes(q);
    }
    return true;
  }), [rooms, filterCategory, filterAvail, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showFrom   = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showTo     = Math.min(safePage * PAGE_SIZE, filtered.length);

  const countRoom     = useMemo(() => rooms.filter((r) => getRoomCategory(r) === "room").length,     [rooms]);
  const countCottage  = useMemo(() => rooms.filter((r) => getRoomCategory(r) === "cottage").length,  [rooms]);
  const countPavilion = useMemo(() => rooms.filter((r) => getRoomCategory(r) === "pavilion").length, [rooms]);

  async function changeStatus(room, nextStatus) {
    if ((room.availability_status || "available") === nextStatus) return;
    setBusyId(room.id);
    try {
      const res = await updateRoomAvailability(room.id, nextStatus);
      const updated = res.data?.data ?? { ...room, availability_status: nextStatus };
      setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, ...updated } : r)));
      if (viewRoom?.id === room.id) setViewRoom((v) => ({ ...v, ...updated }));
      showToast(`"${room.name}" → ${(AVAIL[nextStatus] || AVAIL.available).label}`, "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update room status.", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* Header card */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-info-bg flex items-center justify-center shrink-0">
            <i className="fas fa-bed text-info-fg text-lg" aria-hidden="true"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Rooms Catalog</h2>
            <p className="text-sm text-slate-500">Toggle which rooms are currently bookable. Owner controls rates and inventory.</p>
            {/* Category counts use a single neutral pill style — color
                is reserved for status (AvailBadge). Earlier rotation
                of sky/amber/emerald per category was decorative noise
                that didn't help admin distinguish action targets. */}
            {rooms.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1.5">
                {[
                  { count: countRoom,     label: "Rooms",     icon: "fa-bed"            },
                  { count: countCottage,  label: "Cottages",  icon: "fa-umbrella-beach" },
                  { count: countPavilion, label: "Pavilions", icon: "fa-archway"        },
                ].map(({ count, label, icon }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
                    <i className={`fas ${icon} text-[10px]`} aria-hidden="true"></i>{count} {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} type="button"
          aria-label="Refresh rooms list"
          className="inline-flex items-center gap-2 h-10 px-4 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition disabled:opacity-50">
          <i className={`fas fa-sync-alt ${refreshing ? "fa-spin" : ""}`} aria-hidden="true"></i>
          <span>Refresh</span>
        </button>
      </div>

      {/* Error with retry */}
      {error && (
        <div className="bg-danger-bg border border-danger-bg text-danger-fg rounded-xl p-6 text-center" role="alert">
          <i className="fas fa-exclamation-triangle text-3xl mb-3 block" aria-hidden="true"></i>
          <p className="font-medium mb-3">{error}</p>
          <button onClick={() => load()} type="button"
            className="px-4 py-2 bg-danger-fg text-white rounded-lg text-sm hover:opacity-90 transition">
            <i className="fas fa-redo mr-2" aria-hidden="true"></i>Retry
          </button>
        </div>
      )}

      {/* Category filters — these toggle a single table view, not
          separate panels, so role="group" + aria-pressed is the
          correct pattern (was: role="tablist" which promises tabpanels). */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter rooms by category">
        {CATEGORY_TABS.map((tab) => {
          const count = tab.key === ""
            ? rooms.length
            : rooms.filter((r) => getRoomCategory(r) === tab.key).length;
          const active = filterCategory === tab.key;
          return (
            <button key={tab.key} type="button" onClick={() => setFilterCategory(tab.key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold border transition-all ${
                active
                  ? "bg-brand text-white border-brand shadow"
                  : "bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand"
              }`}>
              <i className={`fas ${tab.icon} text-xs`} aria-hidden="true"></i>
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table card */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 bg-slate-50 border-b border-slate-200">
          <div>
            <p className="text-sm text-slate-600">{filterCategory ? `${filterCategory.charAt(0).toUpperCase() + filterCategory.slice(1)}s` : "Total Rooms"}</p>
            <p className="text-2xl font-semibold text-slate-900">{filtered.length}</p>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true"></i>
              <input ref={searchRef} type="text" aria-label="Search rooms" placeholder="Search rooms..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand text-sm" />
            </div>
            <select value={filterAvail} onChange={(e) => setFilterAvail(e.target.value)} aria-label="Filter by availability"
              className="min-w-44 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand text-sm bg-white">
              <option value="">All Availability</option>
              {Object.entries(AVAIL).map(([val, { label }]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <RoomsSkeleton />
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 mb-4">
                <i className="fas fa-bed text-slate-300 text-2xl" aria-hidden="true"></i>
              </div>
              <p className="text-slate-500 font-medium">
                {debouncedSearch || filterAvail || filterCategory
                  ? "No rooms match your filters."
                  : "No rooms in the catalog yet."}
              </p>
              {(debouncedSearch || filterAvail || filterCategory) && (
                <button onClick={() => { setSearchTerm(""); setFilterAvail(""); setFilterCategory(""); }} type="button"
                  className="mt-4 text-sm text-brand hover:text-brand-dark font-medium">
                  <i className="fas fa-times mr-1.5" aria-hidden="true"></i>Clear filters
                </button>
              )}
            </div>
          ) : (
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left w-12"></th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Qty</th>
                  <th className="px-4 py-3 text-left">Capacity</th>
                  <th className="px-4 py-3 text-left">Day Rate</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {/* Restructured rows: dropped role="button" + nested <select>.
                    The status change now lives only in the View modal —
                    keeps the row free of nested interactive controls
                    (a11y), and the modal is where admin makes other
                    detailed decisions about a room anyway. */}
                {paginated.map((room, idx) => {
                  const avail = room.availability_status || "available";
                  const isUnavailable = avail !== "available";
                  return (
                    <tr key={room.id}
                      className={`transition-all ${idx % 2 === 1 ? "bg-slate-50/50" : ""} ${isUnavailable ? "opacity-60" : ""}`}>
                      <td className="px-4 py-4">
                        {room.image
                          ? <img src={room.image} alt="" className="h-10 w-10 rounded-full object-cover" loading="lazy" decoding="async" />
                          : <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400" aria-hidden="true"><i className="fas fa-bed"></i></div>}
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900">
                        {room.name}
                        {room.capacity_label && <span className="block text-xs text-slate-400">{room.capacity_label}</span>}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{room.quantity ?? 1}</td>
                      <td className="px-4 py-4 text-slate-600">{room.capacity ?? "—"} pax</td>
                      <td className="px-4 py-4 text-slate-600">{"₱"}{Number(room.day_rate || 0).toLocaleString()}</td>
                      <td className="px-4 py-4"><AvailBadge status={avail} /></td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          <button type="button" onClick={() => setViewRoom(room)}
                            aria-label={`View ${room.name}`}
                            className="inline-flex items-center justify-center h-11 min-w-[44px] px-3 rounded-lg text-sm font-medium text-brand hover:bg-info-bg transition">
                            <i className="fas fa-eye mr-1.5 text-xs" aria-hidden="true"></i>View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && totalPages > 1 && (
          <nav aria-label="Rooms pagination" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{showFrom}</span>{"–"}<span className="font-semibold text-slate-700">{showTo}</span> of{" "}
              <span className="font-semibold text-slate-700">{filtered.length}</span> rooms
            </p>
            {/* WCAG 2.5.5 — 44×44 touch targets */}
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} type="button"
                aria-label="Previous page"
                className="h-11 w-11 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                <i className="fas fa-chevron-left text-xs" aria-hidden="true"></i>
              </button>
              {getPageNumbers(safePage, totalPages).map((n, i) =>
                n === "..." ? (
                  <span key={`d-${i}`} className="h-11 min-w-[2.75rem] flex items-center justify-center text-xs text-slate-400" aria-hidden="true">…</span>
                ) : (
                  <button key={n} onClick={() => setPage(n)} type="button"
                    aria-label={`Page ${n}`}
                    aria-current={n === safePage ? "page" : undefined}
                    className={`h-11 min-w-[2.75rem] rounded-lg text-xs font-semibold transition ${
                      n === safePage ? "bg-brand text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}>
                    {n}
                  </button>
                )
              )}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} type="button"
                aria-label="Next page"
                className="h-11 w-11 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                <i className="fas fa-chevron-right text-xs" aria-hidden="true"></i>
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* View Room Modal */}
      <Modal open={!!viewRoom} onClose={() => setViewRoom(null)} maxWidth="max-w-lg">
        {viewRoom && (() => {
          const avail = viewRoom.availability_status || "available";
          return (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-info-bg text-info-fg flex items-center justify-center">
                    <i className="fas fa-bed" aria-hidden="true"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{viewRoom.name}</h3>
                    <p className="text-xs text-slate-400 capitalize">{getRoomCategory(viewRoom)} details</p>
                  </div>
                </div>
                <button onClick={() => setViewRoom(null)} aria-label="Close" type="button"
                  className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
                  <i className="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                {viewRoom.image && (
                  <img src={viewRoom.image} alt={viewRoom.name} loading="lazy" className="w-full h-44 object-cover rounded-xl" />
                )}

                {avail !== "available" && (
                  <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${AVAIL[avail].color}`} role="status">
                    <i className={`fas ${AVAIL[avail].icon}`} aria-hidden="true"></i>{AVAIL[avail].label}
                  </div>
                )}

                {/* Rate cards — neutral surface, single hue. The earlier
                    amber/indigo/emerald rotation was decorative, not
                    semantic; consistent neutral scans faster. */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Day Rate",  value: `₱${Number(viewRoom.day_rate || 0).toLocaleString()}`,       icon: "fa-sun"   },
                    { label: "Overnight", value: `₱${Number(viewRoom.overnight_rate || 0).toLocaleString()}`, icon: "fa-moon"  },
                    { label: "24 Hours",  value: `₱${Number(viewRoom.rate_24hr || 0).toLocaleString()}`,      icon: "fa-clock" },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                      <div className="h-8 w-8 rounded-lg bg-white text-slate-500 flex items-center justify-center mx-auto mb-1.5">
                        <i className={`fas ${icon} text-xs`} aria-hidden="true"></i>
                      </div>
                      <p className="text-sm font-bold text-slate-800">{value}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Capacity</p>
                    <p className="font-semibold text-slate-900 mt-0.5">{viewRoom.capacity ?? "—"} pax</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Quantity</p>
                    <p className="font-semibold text-slate-900 mt-0.5">{viewRoom.quantity ?? 1}</p>
                  </div>
                  {viewRoom.beds && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Beds</p>
                      <p className="font-semibold text-slate-900 mt-0.5">{viewRoom.beds}</p>
                    </div>
                  )}
                  {viewRoom.description && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Description</p>
                      <p className="text-slate-700 mt-0.5">{viewRoom.description}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label htmlFor={`room-status-${viewRoom.id}`} className="text-xs text-slate-500 uppercase tracking-wide">
                    Status
                  </label>
                  <select id={`room-status-${viewRoom.id}`} value={avail}
                    onChange={(e) => changeStatus(viewRoom, e.target.value)}
                    disabled={busyId === viewRoom.id}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50">
                    {Object.entries(AVAIL).map(([val, { label }]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => setViewRoom(null)} type="button"
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition">
                  Close
                </button>
              </div>
            </>
          );
        })()}
      </Modal>
    </div>
  );
}

function RoomsSkeleton() {
  return (
    <div className="divide-y divide-slate-100" aria-busy="true" role="status">
      <span className="sr-only">Loading rooms…</span>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-6 py-4 flex items-center gap-6 animate-pulse">
          <div className="h-10 w-10 rounded-full bg-slate-200 shrink-0"></div>
          <div className="h-4 bg-slate-200 rounded w-32"></div>
          <div className="h-4 bg-slate-100 rounded w-10"></div>
          <div className="h-4 bg-slate-100 rounded w-16"></div>
          <div className="h-4 bg-slate-200 rounded w-20"></div>
          <div className="h-5 bg-slate-200 rounded-full w-24"></div>
          <div className="h-8 bg-slate-100 rounded-lg w-32 ml-auto"></div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── ADD-ONS TAB ───────────────────────── */

function AddonsTab() {
  const [addons,       setAddons]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [loadError,    setLoadError]    = useState(false);
  const [busyId,       setBusyId]       = useState(null);
  const [viewItem,     setViewItem]     = useState(null);
  const [searchTerm,   setSearchTerm]   = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page,         setPage]         = useState(1);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [toast, showToast, clearToast, toastType] = useToast();
  const searchRef = useRef(null);

  const load = useCallback((silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setLoadError(false);
    getAdminAddons()
      .then((r) => setAddons(r.data?.data ?? []))
      .catch(() => { setLoadError(true); showToast("Failed to load add-ons.", "error"); })
      .finally(() => { silent ? setRefreshing(false) : setLoading(false); });
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterStatus]);

  const filtered = useMemo(() => addons.filter((a) => {
    if (filterStatus === "active" && !a.is_active) return false;
    if (filterStatus === "inactive" && a.is_active) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return a.name.toLowerCase().includes(q) || (a.description || "").toLowerCase().includes(q);
    }
    return true;
  }), [addons, filterStatus, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  async function toggle(item) {
    setBusyId(item.id);
    try {
      const res = await toggleAddonActive(item.id);
      const updated = res.data?.data ?? { ...item, is_active: !item.is_active };
      setAddons((prev) => prev.map((a) => (a.id === item.id ? { ...a, ...updated } : a)));
      if (viewItem?.id === item.id) setViewItem((v) => ({ ...v, ...updated }));
      showToast(`"${item.name}" ${updated.is_active ? "enabled" : "disabled"}.`, "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to toggle add-on.", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* Header card */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-success-bg flex items-center justify-center">
              <i className="fas fa-puzzle-piece text-success-fg" aria-hidden="true"></i>
            </span>
            Add-ons Catalog
          </h2>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">Toggle which add-ons are bookable. Owner controls pricing and inventory.</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} type="button"
          aria-label="Refresh add-ons list"
          className="inline-flex items-center gap-2 h-10 px-4 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition disabled:opacity-50">
          <i className={`fas fa-sync-alt ${refreshing ? "fa-spin" : ""}`} aria-hidden="true"></i>
          <span>Refresh</span>
        </button>
      </div>

      {/* Search + Filter bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
          <input ref={searchRef} type="text" aria-label="Search add-ons" placeholder="Search add-ons by name or description..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand text-sm placeholder:text-slate-400 transition" />
          {searchTerm && (
            <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }} type="button"
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
              <i className="fas fa-times-circle text-sm" aria-hidden="true"></i>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Filter add-ons by status">
          {["all", "active", "inactive"].map((f) => (
            <button key={f} onClick={() => setFilterStatus(f)} type="button"
              aria-pressed={filterStatus === f}
              className={`h-10 px-4 rounded-lg text-xs font-semibold capitalize transition ${
                filterStatus === f
                  ? "bg-brand text-white"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}>
              {f === "all" ? "All" : f === "active" ? "Active" : "Inactive"}
            </button>
          ))}
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">Total add-ons</p>
            <p className="text-2xl font-semibold text-slate-900">{addons.length}</p>
          </div>
          {(debouncedSearch || filterStatus !== "all") && (
            <span className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200">
              Showing {filtered.length} of {addons.length}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <AddonsSkeleton />
          ) : loadError && addons.length === 0 ? (
            <div className="px-6 py-16 text-center" role="alert">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-danger-bg mb-4">
                <i className="fas fa-exclamation-triangle text-danger-fg text-2xl" aria-hidden="true"></i>
              </div>
              <p className="text-slate-700 font-semibold">Failed to load add-ons</p>
              <p className="text-sm text-slate-400 mt-1 mb-5">Check your connection and try again.</p>
              <button onClick={() => load()} type="button"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-xl shadow-sm transition">
                <i className="fas fa-redo text-xs" aria-hidden="true"></i>Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 mb-4">
                <i className="fas fa-puzzle-piece text-slate-300 text-2xl" aria-hidden="true"></i>
              </div>
              <p className="text-slate-500 font-medium">
                {debouncedSearch || filterStatus !== "all"
                  ? "No add-ons match your search."
                  : "No add-ons yet."}
              </p>
              {(debouncedSearch || filterStatus !== "all") && (
                <button onClick={() => { setSearchTerm(""); setFilterStatus("all"); }} type="button"
                  className="mt-4 text-sm text-brand hover:text-brand-dark font-medium">
                  <i className="fas fa-times mr-1.5" aria-hidden="true"></i>Clear filters
                </button>
              )}
            </div>
          ) : (
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Price</th>
                  <th className="px-6 py-3 text-left">Max Qty</th>
                  <th className="px-6 py-3 text-left">Type</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* Same restructure as RoomsTab — drop role="button" +
                    nested toggle button. Open the modal via a clearly
                    labeled View button; the toggle lives in the modal
                    where admin already takes deliberate action. */}
                {paginated.map((item, idx) => (
                  <tr key={item.id}
                    className={`transition-all ${idx % 2 === 1 ? "bg-slate-50/50" : ""} ${!item.is_active ? "opacity-60" : ""}`}>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <span className="flex items-center gap-2.5">
                        <span className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <i className={`fas ${item.icon || "fa-tag"} text-slate-500 text-sm`} aria-hidden="true"></i>
                        </span>
                        {item.name || <span className="italic text-slate-400">Unnamed</span>}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-800">{"₱"}{Number(item.price).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">{item.max_qty}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {item.per_booking ? "Per Booking" : "Per Item"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        item.is_active ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg"
                      }`}>
                        <span className={`h-2 w-2 rounded-full ${item.is_active ? "bg-success-ring" : "bg-danger-ring"}`} aria-hidden="true" />
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <button type="button" onClick={() => setViewItem(item)}
                          aria-label={`View ${item.name}`}
                          className="inline-flex items-center justify-center h-11 min-w-[44px] px-3 rounded-lg text-sm font-medium text-brand hover:bg-info-bg transition">
                          <i className="fas fa-eye mr-1.5 text-xs" aria-hidden="true"></i>View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination — 44×44 touch targets per WCAG 2.5.5 */}
        {!loading && filtered.length > 0 && totalPages > 1 && (
          <nav aria-label="Add-ons pagination" className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing {(safePage - 1) * PAGE_SIZE + 1}{"–"}{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} type="button"
                aria-label="Previous page"
                className="h-11 w-11 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                <i className="fas fa-chevron-left text-xs" aria-hidden="true"></i>
              </button>
              {getPageNumbers(safePage, totalPages).map((n, i) =>
                n === "..." ? (
                  <span key={`d-${i}`} className="h-11 min-w-[2.75rem] flex items-center justify-center text-xs text-slate-400" aria-hidden="true">…</span>
                ) : (
                  <button key={n} onClick={() => setPage(n)} type="button"
                    aria-label={`Page ${n}`}
                    aria-current={n === safePage ? "page" : undefined}
                    className={`h-11 min-w-[2.75rem] rounded-lg text-xs font-semibold transition ${
                      n === safePage ? "bg-brand text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}>
                    {n}
                  </button>
                )
              )}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} type="button"
                aria-label="Next page"
                className="h-11 w-11 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                <i className="fas fa-chevron-right text-xs" aria-hidden="true"></i>
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* View Add-on Modal */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} maxWidth="max-w-sm">
        {viewItem && (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-xl bg-success-bg flex items-center justify-center">
                  <i className={`fas ${viewItem.icon || "fa-tag"} text-success-fg`} aria-hidden="true"></i>
                </span>
                {viewItem.name || <span className="italic text-slate-400">Unnamed</span>}
              </h3>
              <button onClick={() => setViewItem(null)} aria-label="Close" type="button"
                className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-6 w-6 rounded-md bg-white flex items-center justify-center">
                      <i className="fas fa-peso-sign text-slate-500 text-[10px]" aria-hidden="true"></i>
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Price</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800">{"₱"}{Number(viewItem.price).toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-6 w-6 rounded-md bg-white flex items-center justify-center">
                      <i className="fas fa-boxes-stacked text-slate-500 text-[10px]" aria-hidden="true"></i>
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Max Qty</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800">{viewItem.max_qty}</p>
                </div>
              </div>

              {viewItem.description && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Description</p>
                  <p className="text-sm text-slate-700 mt-0.5">{viewItem.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Type</p>
                  <p className="font-semibold text-slate-900 mt-0.5">{viewItem.per_booking ? "Per Booking" : "Per Item"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Status</p>
                  <p className={`font-semibold mt-0.5 ${viewItem.is_active ? "text-success-fg" : "text-danger-fg"}`}>
                    {viewItem.is_active ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <button type="button" onClick={() => toggle(viewItem)} disabled={busyId === viewItem.id}
                aria-label={viewItem.is_active ? `Disable ${viewItem.name}` : `Enable ${viewItem.name}`}
                className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${
                  viewItem.is_active
                    ? "bg-warning-bg text-warning-fg hover:opacity-90"
                    : "bg-success-bg text-success-fg hover:opacity-90"
                }`}>
                <i className={`fas ${viewItem.is_active ? "fa-toggle-off" : "fa-toggle-on"} text-xs`} aria-hidden="true"></i>
                {viewItem.is_active ? "Disable" : "Enable"}
              </button>
              <button onClick={() => setViewItem(null)} type="button"
                className="h-11 px-4 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition">
                Close
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function AddonsSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading add-ons…</span>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
          <tr>
            <th className="px-6 py-3 text-left">Name</th>
            <th className="px-6 py-3 text-left">Price</th>
            <th className="px-6 py-3 text-left">Max Qty</th>
            <th className="px-6 py-3 text-left">Type</th>
            <th className="px-6 py-3 text-left">Status</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="animate-pulse">
              <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-3/4"></div></td>
              <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
              <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-10"></div></td>
              <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
              <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
              <td className="px-6 py-4 text-right"><div className="h-8 w-16 bg-slate-200 rounded-lg inline-block"></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
