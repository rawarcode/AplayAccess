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
  available:   { label: "Available",          color: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500", icon: "fa-check-circle" },
  renovation:  { label: "Under Renovation",   color: "bg-rose-100 text-rose-800",       dot: "bg-rose-500",    icon: "fa-hard-hat"     },
  maintenance: { label: "Under Maintenance",  color: "bg-amber-100 text-amber-800",     dot: "bg-amber-500",   icon: "fa-wrench"       },
  reserved:    { label: "Reserved / Blocked", color: "bg-purple-100 text-purple-800",   dot: "bg-purple-500",  icon: "fa-lock"         },
  closed:      { label: "Temporarily Closed", color: "bg-slate-100 text-slate-600",     dot: "bg-slate-400",   icon: "fa-ban"          },
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
          <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
            <i className="fas fa-bed text-sky-600 text-lg"></i>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Rooms Catalog</h1>
            <p className="text-sm text-slate-500">Toggle which rooms are currently bookable. Owner controls rates and inventory.</p>
            {rooms.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1.5">
                {[
                  { count: countRoom,     label: "Rooms",     icon: "fa-bed",            bg: "bg-sky-50 text-sky-700 border-sky-200" },
                  { count: countCottage,  label: "Cottages",  icon: "fa-umbrella-beach", bg: "bg-amber-50 text-amber-700 border-amber-200" },
                  { count: countPavilion, label: "Pavilions", icon: "fa-archway",        bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                ].map(({ count, label, icon, bg }) => (
                  <span key={label} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${bg}`}>
                    <i className={`fas ${icon} text-[10px]`}></i>{count} {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} type="button"
          className="inline-flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition disabled:opacity-50"
          title="Refresh">
          <i className={`fas fa-sync-alt ${refreshing ? "fa-spin" : ""}`}></i>
          <span>Refresh</span>
        </button>
      </div>

      {/* Error with retry */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-6 text-center">
          <i className="fas fa-exclamation-triangle text-3xl mb-3 block"></i>
          <p className="font-medium mb-3">{error}</p>
          <button onClick={() => load()} type="button"
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700 transition">
            <i className="fas fa-redo mr-2"></i>Retry
          </button>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_TABS.map((tab) => {
          const count = tab.key === ""
            ? rooms.length
            : rooms.filter((r) => getRoomCategory(r) === tab.key).length;
          const active = filterCategory === tab.key;
          return (
            <button key={tab.key} type="button" onClick={() => setFilterCategory(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                active
                  ? "bg-sky-600 text-white border-sky-600 shadow"
                  : "bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-600"
              }`}>
              <i className={`fas ${tab.icon} text-xs`}></i>
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
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input ref={searchRef} type="text" aria-label="Search rooms" placeholder="Search rooms..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <select value={filterAvail} onChange={(e) => setFilterAvail(e.target.value)} aria-label="Filter by availability"
              className="min-w-44 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm bg-white">
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
                <i className="fas fa-bed text-slate-300 text-2xl"></i>
              </div>
              <p className="text-slate-500 font-medium">
                {debouncedSearch || filterAvail || filterCategory
                  ? "No rooms match your filters."
                  : "No rooms in the catalog yet."}
              </p>
              {(debouncedSearch || filterAvail || filterCategory) && (
                <button onClick={() => { setSearchTerm(""); setFilterAvail(""); setFilterCategory(""); }} type="button"
                  className="mt-4 text-sm text-sky-600 hover:text-sky-700 font-medium">
                  <i className="fas fa-times mr-1.5"></i>Clear filters
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
                  <th className="px-4 py-3 text-right">Change to</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {paginated.map((room, idx) => {
                  const avail = room.availability_status || "available";
                  const isUnavailable = avail !== "available";
                  const cat = getRoomCategory(room);
                  const catStyle = { cottage: "bg-amber-100 text-amber-700", pavilion: "bg-emerald-100 text-emerald-700" }[cat];
                  const busy = busyId === room.id;
                  return (
                    <tr key={room.id} role="button" tabIndex={0}
                      onClick={() => setViewRoom(room)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewRoom(room); } }}
                      className={`cursor-pointer transition-all hover:bg-sky-50/40 hover:shadow-sm ${idx % 2 === 1 ? "bg-slate-50/50" : ""} ${isUnavailable ? "opacity-60" : ""}`}>
                      <td className="px-4 py-4">
                        {room.image
                          ? <img src={room.image} alt={room.name} className="h-10 w-10 rounded-full object-cover" loading="lazy" decoding="async" />
                          : <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400"><i className="fas fa-bed"></i></div>}
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          {room.name}
                          {catStyle && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${catStyle}`}>{cat}</span>
                          )}
                        </div>
                        {room.capacity_label && <span className="text-xs text-slate-400">{room.capacity_label}</span>}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{room.quantity ?? 1}</td>
                      <td className="px-4 py-4 text-slate-600">{room.capacity ?? "—"} pax</td>
                      <td className="px-4 py-4 text-slate-600">{"₱"}{Number(room.day_rate || 0).toLocaleString()}</td>
                      <td className="px-4 py-4"><AvailBadge status={avail} /></td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <select value={avail}
                            onChange={(e) => changeStatus(room, e.target.value)}
                            disabled={busy}
                            aria-label={`Change status for ${room.name}`}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-50">
                            {Object.entries(AVAIL).map(([val, { label }]) => (
                              <option key={val} value={val}>{label}</option>
                            ))}
                          </select>
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{showFrom}</span>{"–"}<span className="font-semibold text-slate-700">{showTo}</span> of{" "}
              <span className="font-semibold text-slate-700">{filtered.length}</span> rooms
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} type="button"
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                <i className="fas fa-chevron-left text-xs"></i>
              </button>
              {getPageNumbers(safePage, totalPages).map((n, i) =>
                n === "..." ? (
                  <span key={`d-${i}`} className="h-8 min-w-[2rem] flex items-center justify-center text-xs text-slate-400">…</span>
                ) : (
                  <button key={n} onClick={() => setPage(n)} type="button"
                    className={`h-8 min-w-[2rem] rounded-lg text-xs font-semibold transition ${
                      n === safePage ? "bg-sky-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}>
                    {n}
                  </button>
                )
              )}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} type="button"
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
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
                  <div className="h-9 w-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                    <i className="fas fa-bed"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{viewRoom.name}</h3>
                    <p className="text-xs text-slate-400 capitalize">{getRoomCategory(viewRoom)} details</p>
                  </div>
                </div>
                <button onClick={() => setViewRoom(null)} aria-label="Close" type="button"
                  className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                {viewRoom.image && (
                  <img src={viewRoom.image} alt={viewRoom.name} loading="lazy" className="w-full h-44 object-cover rounded-xl" />
                )}

                {avail !== "available" && (
                  <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${AVAIL[avail].color}`}>
                    <i className={`fas ${AVAIL[avail].icon}`}></i>{AVAIL[avail].label}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Day Rate",   value: `₱${Number(viewRoom.day_rate || 0).toLocaleString()}`,       icon: "fa-sun",   bg: "bg-amber-50",   text: "text-amber-700",   iconBg: "bg-amber-100 text-amber-500" },
                    { label: "Overnight",  value: `₱${Number(viewRoom.overnight_rate || 0).toLocaleString()}`, icon: "fa-moon",  bg: "bg-indigo-50",  text: "text-indigo-700",  iconBg: "bg-indigo-100 text-indigo-500" },
                    { label: "24 Hours",   value: `₱${Number(viewRoom.rate_24hr || 0).toLocaleString()}`,      icon: "fa-clock", bg: "bg-emerald-50", text: "text-emerald-700", iconBg: "bg-emerald-100 text-emerald-500" },
                  ].map(({ label, value, icon, bg, text, iconBg }) => (
                    <div key={label} className={`rounded-xl ${bg} border border-slate-100 p-3 text-center`}>
                      <div className={`h-8 w-8 rounded-lg ${iconBg} flex items-center justify-center mx-auto mb-1.5`}>
                        <i className={`fas ${icon} text-xs`}></i>
                      </div>
                      <p className={`text-sm font-bold ${text}`}>{value}</p>
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
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Status</span>
                  <select value={avail}
                    onChange={(e) => changeStatus(viewRoom, e.target.value)}
                    disabled={busyId === viewRoom.id}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-50">
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
    <div className="divide-y divide-slate-100" aria-busy="true">
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
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <i className="fas fa-puzzle-piece text-emerald-600"></i>
            </span>
            Add-ons Catalog
          </h1>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">Toggle which add-ons are bookable. Owner controls pricing and inventory.</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} type="button"
          className="inline-flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition disabled:opacity-50"
          title="Refresh">
          <i className={`fas fa-sync-alt ${refreshing ? "fa-spin" : ""}`}></i>
          <span>Refresh</span>
        </button>
      </div>

      {/* Search + Filter bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input ref={searchRef} type="text" placeholder="Search add-ons by name or description..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-sm placeholder:text-slate-400 transition" />
          {searchTerm && (
            <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }} type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
              <i className="fas fa-times-circle text-sm"></i>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {["all", "active", "inactive"].map((f) => (
            <button key={f} onClick={() => setFilterStatus(f)} type="button"
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold capitalize transition ${
                filterStatus === f
                  ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
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
            <div className="px-6 py-16 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-rose-100 mb-4">
                <i className="fas fa-exclamation-triangle text-rose-400 text-2xl"></i>
              </div>
              <p className="text-slate-700 font-semibold">Failed to load add-ons</p>
              <p className="text-sm text-slate-400 mt-1 mb-5">Check your connection and try again.</p>
              <button onClick={() => load()} type="button"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition">
                <i className="fas fa-redo text-xs"></i>Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 mb-4">
                <i className="fas fa-puzzle-piece text-slate-300 text-2xl"></i>
              </div>
              <p className="text-slate-500 font-medium">
                {debouncedSearch || filterStatus !== "all"
                  ? "No add-ons match your search."
                  : "No add-ons yet."}
              </p>
              {(debouncedSearch || filterStatus !== "all") && (
                <button onClick={() => { setSearchTerm(""); setFilterStatus("all"); }} type="button"
                  className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                  <i className="fas fa-times mr-1.5"></i>Clear filters
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
                  <th className="px-6 py-3 text-right">Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginated.map((item, idx) => {
                  const busy = busyId === item.id;
                  return (
                    <tr key={item.id} role="button" tabIndex={0}
                      onClick={() => setViewItem(item)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewItem(item); } }}
                      className={`cursor-pointer transition-all hover:bg-emerald-50/40 hover:shadow-sm ${idx % 2 === 1 ? "bg-slate-50/50" : ""} ${!item.is_active ? "opacity-60" : ""}`}>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <span className="flex items-center gap-2.5">
                          <span className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <i className={`fas ${item.icon || "fa-tag"} text-slate-500 text-sm`}></i>
                          </span>
                          {item.name || <span className="italic text-slate-400">Unnamed</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-800">{"₱"}{Number(item.price).toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">{item.max_qty}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          item.per_booking ? "bg-purple-100 text-purple-800" : "bg-sky-100 text-sky-800"
                        }`}>
                          {item.per_booking ? "Per Booking" : "Per Item"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                          item.is_active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          <span className={`h-2 w-2 rounded-full ${item.is_active ? "bg-emerald-500" : "bg-rose-500"}`} />
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <button type="button" onClick={() => toggle(item)} disabled={busy}
                            aria-label={item.is_active ? `Disable ${item.name}` : `Enable ${item.name}`}
                            className={`relative inline-flex items-center h-7 w-12 rounded-full transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                              item.is_active ? "bg-emerald-500" : "bg-slate-300"
                            }`}>
                            <span className={`inline-block h-5 w-5 bg-white rounded-full shadow transform transition ${
                              item.is_active ? "translate-x-6" : "translate-x-1"
                            }`} />
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
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing {(safePage - 1) * PAGE_SIZE + 1}{"–"}{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} type="button"
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                <i className="fas fa-chevron-left text-xs"></i>
              </button>
              {getPageNumbers(safePage, totalPages).map((n, i) =>
                n === "..." ? (
                  <span key={`d-${i}`} className="h-8 min-w-[2rem] flex items-center justify-center text-xs text-slate-400">…</span>
                ) : (
                  <button key={n} onClick={() => setPage(n)} type="button"
                    className={`h-8 min-w-[2rem] rounded-lg text-xs font-semibold transition ${
                      n === safePage ? "bg-emerald-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}>
                    {n}
                  </button>
                )
              )}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} type="button"
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Add-on Modal */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} maxWidth="max-w-sm">
        {viewItem && (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <i className={`fas ${viewItem.icon || "fa-tag"} text-emerald-600`}></i>
                </span>
                {viewItem.name || <span className="italic text-slate-400">Unnamed</span>}
              </h3>
              <button onClick={() => setViewItem(null)} aria-label="Close" type="button"
                className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-6 w-6 rounded-md bg-emerald-100 flex items-center justify-center">
                      <i className="fas fa-peso-sign text-emerald-600 text-[10px]"></i>
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Price</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-800">{"₱"}{Number(viewItem.price).toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-sky-50 border border-sky-100 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-6 w-6 rounded-md bg-sky-100 flex items-center justify-center">
                      <i className="fas fa-boxes-stacked text-sky-600 text-[10px]"></i>
                    </span>
                    <span className="text-[10px] font-semibold text-sky-600 uppercase tracking-wide">Max Qty</span>
                  </div>
                  <p className="text-lg font-bold text-sky-800">{viewItem.max_qty}</p>
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
                  <p className={`font-semibold mt-0.5 ${viewItem.is_active ? "text-emerald-700" : "text-rose-700"}`}>
                    {viewItem.is_active ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <button type="button" onClick={() => toggle(viewItem)} disabled={busyId === viewItem.id}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${
                  viewItem.is_active
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                }`}>
                <i className={`fas ${viewItem.is_active ? "fa-toggle-off" : "fa-toggle-on"} text-xs`}></i>
                {viewItem.is_active ? "Disable" : "Enable"}
              </button>
              <button onClick={() => setViewItem(null)} type="button"
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition">
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
    <table className="min-w-full text-sm" aria-busy="true">
      <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
        <tr>
          <th className="px-6 py-3 text-left">Name</th>
          <th className="px-6 py-3 text-left">Price</th>
          <th className="px-6 py-3 text-left">Max Qty</th>
          <th className="px-6 py-3 text-left">Type</th>
          <th className="px-6 py-3 text-left">Status</th>
          <th className="px-6 py-3 text-right">Toggle</th>
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
            <td className="px-6 py-4 text-right"><div className="h-7 w-12 bg-slate-200 rounded-full inline-block"></div></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
