import { useState, useEffect, useCallback } from "react";
import Modal from "../../components/modals/Modal.jsx";
import { getAdminRooms, createAdminRoom, updateAdminRoom } from "../../lib/adminApi";
import { RESORT_ID } from "../../lib/config.js";
import Toast, { useToast } from "../../components/ui/Toast";
import ImageUpload from "../../components/ui/ImageUpload.jsx";

// ── Availability status config ─────────────────────────────────────────────
const AVAIL = {
  available:   { label: "Available",          color: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500", icon: "fa-check-circle" },
  renovation:  { label: "Under Renovation",   color: "bg-rose-100 text-rose-800",       dot: "bg-rose-500",    icon: "fa-hard-hat"     },
  maintenance: { label: "Under Maintenance",  color: "bg-amber-100 text-amber-800",     dot: "bg-amber-500",   icon: "fa-wrench"       },
  reserved:    { label: "Reserved / Blocked", color: "bg-purple-100 text-purple-800",   dot: "bg-purple-500",  icon: "fa-lock"         },
  closed:      { label: "Temporarily Closed", color: "bg-slate-100 text-slate-600",     dot: "bg-slate-400",   icon: "fa-ban"          },
};

// ── Housekeeping status config ─────────────────────────────────────────────
const HK = {
  clean:    { label: "Clean",    color: "bg-sky-100 text-sky-800",    dot: "bg-sky-500"    },
  dirty:    { label: "Dirty",    color: "bg-rose-100 text-rose-800",  dot: "bg-rose-500"   },
  cleaning: { label: "Cleaning", color: "bg-amber-100 text-amber-800",dot: "bg-amber-500"  },
};

// ── Feature icon palette ───────────────────────────────────────────────────
const FEATURE_ICONS = [
  { icon: "fa-wifi",            label: "WiFi"         },
  { icon: "fa-tv",              label: "TV"           },
  { icon: "fa-snowflake",       label: "AC"           },
  { icon: "fa-coffee",          label: "Coffee"       },
  { icon: "fa-bath",            label: "Bath"         },
  { icon: "fa-shower",          label: "Shower"       },
  { icon: "fa-water-ladder",    label: "Pool"         },
  { icon: "fa-umbrella-beach",  label: "Beach"        },
  { icon: "fa-lock",            label: "Safe"         },
  { icon: "fa-door-open",       label: "Balcony"      },
  { icon: "fa-couch",           label: "Living Area"  },
  { icon: "fa-utensils",        label: "Dining"       },
  { icon: "fa-dumbbell",        label: "Gym"          },
  { icon: "fa-spa",             label: "Spa"          },
  { icon: "fa-wind",            label: "Fan"          },
  { icon: "fa-concierge-bell",  label: "Room Service" },
  { icon: "fa-parking",         label: "Parking"      },
  { icon: "fa-star",            label: "Premium"      },
  { icon: "fa-microphone",      label: "Videoke"      },
  { icon: "fa-check",           label: "Other"        },
];

const BLANK = {
  name: "", category: "room", description: "", day_rate: 1500, overnight_rate: 2000, rate_24hr: 2500,
  capacity: 2, capacity_label: "", quantity: 1,
  size: "", beds: "", occupancy: "", view: "", image: "",
  availability_status: "available", features: [], allowed_booking_types: null,
};

const COTTAGE_TEMPLATE = {
  ...BLANK,
  name: "Cottage", category: "cottage", capacity: 10, capacity_label: "Up to 10 pax",
  quantity: 1, day_rate: 2000, overnight_rate: 2500, rate_24hr: 3500,
  features: [{ text: "Beachside", icon: "fa-umbrella-beach" }],
};

const PAVILION_TEMPLATE = {
  ...BLANK,
  name: "Pavilion", category: "pavilion", capacity: 30, capacity_label: "Up to 30 pax",
  quantity: 1, day_rate: 3000, overnight_rate: 4000, rate_24hr: 5000,
  features: [{ text: "Open Air", icon: "fa-wind" }, { text: "Pool View", icon: "fa-water-ladder" }],
};

const ADMIN_CATEGORY_TABS = [
  { key: "",         label: "All",       icon: "fa-th-large"       },
  { key: "room",     label: "Rooms",     icon: "fa-bed"            },
  { key: "cottage",  label: "Cottages",  icon: "fa-umbrella-beach" },
  { key: "pavilion", label: "Pavilions", icon: "fa-archway"        },
];

function getRoomCategory(r) {
  if (r.category) return r.category;
  const n = (r.name || "").toLowerCase();
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

// ── Live card preview ──────────────────────────────────────────────────────
function RoomPreview({ room }) {
  return (
    <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white text-sm">
      <div className="relative h-40 bg-slate-100">
        {room.image
          ? <img src={room.image} alt={room.name} className="w-full h-full object-cover"
              onError={e => { e.target.style.display = "none"; }} />
          : <div className="w-full h-full flex items-center justify-center text-slate-300">
              <i className="fas fa-image text-4xl"></i>
            </div>
        }
      </div>
      <div className="p-4">
        <p className="font-bold text-slate-900 text-base mb-1">{room.name || <span className="text-slate-300 italic">Room name</span>}</p>
        {room.description && <p className="text-slate-500 text-xs mb-3 line-clamp-2">{room.description}</p>}
        {room.features?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {room.features.slice(0, 4).map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
                <i className={`fas ${f.icon || "fa-check"} text-[10px]`}></i> {f.text}
              </span>
            ))}
            {room.features.length > 4 && <span className="text-xs text-slate-400">+{room.features.length - 4} more</span>}
          </div>
        )}
        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <div>
            <span className="font-bold text-blue-600">₱{Number(room.day_rate || 0).toLocaleString()}</span>
            <span className="text-slate-400 text-xs"> / day</span>
          </div>
          <span className="text-xs text-slate-400">max {room.capacity || "—"} pax</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminRooms() {
  const [rooms,        setRooms]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState(null);
  const [saveError,    setSaveError]    = useState("");
  const [toast, showToast, clearToast, toastType] = useToast();
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [viewRoom,     setViewRoom]     = useState(null);
  const [searchTerm,      setSearchTerm]      = useState("");
  const [filterAvail,     setFilterAvail]     = useState("");
  const [filterCategory,  setFilterCategory]  = useState("");

  // Feature input state
  const [featureInput,   setFeatureInput]   = useState("");
  const [selectedIcon,   setSelectedIcon]   = useState("fa-check");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getAdminRooms()
      .then(r => setRooms(r.data.data))
      .catch(() => setError("Failed to load rooms."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  const [sortBy,  setSortBy]  = useState('Name');
  const [sortDir, setSortDir] = useState('asc');

  const filtered = rooms.filter(r => {
    const matchSearch    = r.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAvail     = !filterAvail     || r.availability_status === filterAvail;
    const matchCategory  = !filterCategory  || getRoomCategory(r) === filterCategory;
    return matchSearch && matchAvail && matchCategory;
  }).sort((a, b) => {
    let aVal, bVal;
    if (sortBy === 'Name')           { aVal = a.name.toLowerCase();           bVal = b.name.toLowerCase(); }
    else if (sortBy === 'Capacity')       { aVal = Number(a.capacity);              bVal = Number(b.capacity); }
    else if (sortBy === 'Day Rate')       { aVal = Number(a.day_rate);              bVal = Number(b.day_rate); }
    else if (sortBy === 'Overnight Rate') { aVal = Number(a.overnight_rate);        bVal = Number(b.overnight_rate); }
    else if (sortBy === 'Availability')   { aVal = a.availability_status ?? '';     bVal = b.availability_status ?? ''; }
    else                                  { aVal = a.housekeeping_status ?? '';     bVal = b.housekeeping_status ?? ''; }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  function openNew() {
    setEditing({ ...BLANK });
    setSaveError("");
    setFeatureInput("");
    setSelectedIcon("fa-check");
    setIconPickerOpen(false);
    setModalOpen(true);
  }

  function openNewCottage() {
    setEditing({ ...COTTAGE_TEMPLATE });
    setSaveError("");
    setFeatureInput("");
    setSelectedIcon("fa-umbrella-beach");
    setIconPickerOpen(false);
    setModalOpen(true);
  }

  function openNewPavilion() {
    setEditing({ ...PAVILION_TEMPLATE });
    setSaveError("");
    setFeatureInput("");
    setSelectedIcon("fa-wind");
    setIconPickerOpen(false);
    setModalOpen(true);
  }

  function openEdit(room) {
    const features = (room.features || []).map(f =>
      typeof f === "string" ? { text: f, icon: "fa-check" } : f
    );
    setEditing({ ...room, availability_status: room.availability_status || "available", features });
    setSaveError("");
    setFeatureInput("");
    setSelectedIcon("fa-check");
    setIconPickerOpen(false);
    setViewRoom(null);
    setModalOpen(true);
  }

  function setField(k, v) { setEditing(x => ({ ...x, [k]: v })); }

  function addFeature() {
    const text = featureInput.trim();
    if (!text) return;
    const existing = editing.features || [];
    if (!existing.find(f => f.text === text)) {
      setField("features", [...existing, { text, icon: selectedIcon }]);
    }
    setFeatureInput("");
  }

  function removeFeature(idx) {
    setField("features", (editing.features || []).filter((_, i) => i !== idx));
  }

  async function saveRoom(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name:                editing.name,
      category:            editing.category || "room",
      description:         editing.description,
      day_rate:            Number(editing.day_rate),
      overnight_rate:      Number(editing.overnight_rate),
      rate_24hr:           Number(editing.rate_24hr ?? 0),
      capacity:            Number(editing.capacity),
      capacity_label:      editing.capacity_label || undefined,
      quantity:            Number(editing.quantity ?? 1),
      availability_status: editing.availability_status || "available",
      size:                editing.size      || undefined,
      beds:                editing.beds      || undefined,
      occupancy:           editing.occupancy || undefined,
      view:                editing.view      || undefined,
      image:               editing.image     || undefined,
      features:               editing.features?.length ? editing.features : null,
      allowed_booking_types:  editing.allowed_booking_types?.length ? editing.allowed_booking_types : null,
      resort_id:              RESORT_ID,
    };
    try {
      editing.id ? await updateAdminRoom(editing.id, payload) : await createAdminRoom(payload);
      setModalOpen(false);
      load();
    } catch (err) {
      setSaveError(err?.response?.data?.message || "Failed to save room.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 mt-1">Manage rooms, rates, and availability status.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openNewCottage}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl shadow-sm text-sm font-medium">
            <i className="fas fa-umbrella-beach"></i>Add Cottage
          </button>
          <button onClick={openNewPavilion}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl shadow-sm text-sm font-medium">
            <i className="fas fa-archway"></i>Add Pavilion
          </button>
          <button onClick={openNew}
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl shadow-sm text-sm font-medium">
            <i className="fas fa-plus"></i>New Room
          </button>
        </div>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4">{error}</div>}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {ADMIN_CATEGORY_TABS.map(tab => {
          const count = tab.key === ""
            ? rooms.length
            : rooms.filter(r => getRoomCategory(r) === tab.key).length;
          return (
            <button key={tab.key}
              onClick={() => setFilterCategory(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                filterCategory === tab.key
                  ? "bg-sky-600 text-white border-sky-600 shadow"
                  : "bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-600"
              }`}
            >
              <i className={`fas ${tab.icon} text-xs`}></i>
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                filterCategory === tab.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
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
              <input type="text" placeholder="Search rooms…"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>
            <select value={filterAvail} onChange={e => setFilterAvail(e.target.value)}
              className="min-w-44 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm">
              <option value="">All Availability</option>
              {Object.entries(AVAIL).map(([val, { label }]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <p className="px-6 py-10 text-center text-slate-400"><i className="fas fa-spinner fa-spin mr-2"></i>Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-slate-400">No rooms found.</p>
          ) : (
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left"></th>
                  {[['Name','Name'],['Qty','Qty'],['Capacity','Capacity'],['Day Rate','Day Rate'],['Overnight Rate','Overnight Rate'],['24hr Rate','24hr Rate'],['Availability','Availability'],['Housekeeping','Housekeeping']].map(([label,key]) => (
                    <th key={key} className="px-6 py-3 text-left">
                      <button onClick={() => { if(sortBy===key) setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortBy(key);setSortDir('asc');} }}
                        className="flex items-center gap-1 hover:text-blue-600 transition-colors group">
                        {label}
                        <span className="text-slate-400 group-hover:text-blue-400">
                          {sortBy===key ? <i className={`fas fa-arrow-${sortDir==='asc'?'up':'down'} text-blue-500`}></i> : <i className="fas fa-sort opacity-40"></i>}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filtered.map(room => {
                  const avail = room.availability_status || "available";
                  const hk    = HK[room.housekeeping_status];
                  const isUnavailable = avail !== "available";
                  return (
                    <tr key={room.id} onClick={() => setViewRoom(room)}
                      className={`cursor-pointer transition-colors ${isUnavailable ? "opacity-60 bg-slate-50 hover:bg-slate-100" : "hover:bg-slate-50"}`}>
                      <td className="px-6 py-4">
                        {room.image
                          ? <img src={room.image} alt={room.name} className="h-10 w-10 rounded-full object-cover" />
                          : <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400"><i className="fas fa-bed"></i></div>
                        }
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          {room.name}
                          {(() => {
                            const cat = getRoomCategory(room);
                            const catStyle = { cottage: "bg-amber-100 text-amber-700", pavilion: "bg-emerald-100 text-emerald-700" }[cat];
                            return catStyle ? (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${catStyle}`}>{cat}</span>
                            ) : null;
                          })()}
                        </div>
                        {room.capacity_label && <span className="text-xs text-slate-400">{room.capacity_label}</span>}
                        {room.allowed_booking_types?.length > 0 && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                            {room.allowed_booking_types.join("/")} only
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-center">{room.quantity ?? 1}</td>
                      <td className="px-6 py-4 text-slate-600">{room.capacity} pax</td>
                      <td className="px-6 py-4 text-slate-600">₱{Number(room.day_rate).toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-600">₱{Number(room.overnight_rate).toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-600">₱{Number(room.rate_24hr ?? 0).toLocaleString()}</td>
                      <td className="px-6 py-4"><AvailBadge status={avail} /></td>
                      <td className="px-6 py-4">
                        {hk ? (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${hk.color}`}>
                            <span className={`h-2 w-2 rounded-full ${hk.dot}`} />{hk.label}
                          </span>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(room)} className="text-sky-600 hover:text-sky-800 font-medium">Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* View Room Modal */}
      {viewRoom && (() => {
        const avail = viewRoom.availability_status || "available";
        const hk    = HK[viewRoom.housekeeping_status];
        const features = (viewRoom.features || []).map(f =>
          typeof f === "string" ? { text: f, icon: "fa-check" } : f
        );
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Room Details</h3>
                <button onClick={() => setViewRoom(null)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="p-6 space-y-4">
                {viewRoom.image && (
                  <img src={viewRoom.image} alt={viewRoom.name} className="w-full h-40 object-cover rounded-xl" />
                )}
                {avail !== "available" && (
                  <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${AVAIL[avail].color}`}>
                    <i className={`fas ${AVAIL[avail].icon}`}></i>{AVAIL[avail].label}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ["Name",     viewRoom.name],
                    ["Category", (() => { const c = viewRoom.category || getRoomCategory(viewRoom); return c.charAt(0).toUpperCase() + c.slice(1); })()],
                    ["Capacity", viewRoom.capacity_label || `${viewRoom.capacity} pax`],
                    ["Quantity",       `${viewRoom.quantity ?? 1} unit(s)`],
                    ["Day Rate",       `₱${Number(viewRoom.day_rate).toLocaleString()}`],
                    ["Overnight Rate", `₱${Number(viewRoom.overnight_rate).toLocaleString()}`],
                    ["24hr Rate",      `₱${Number(viewRoom.rate_24hr ?? 0).toLocaleString()}`],
                    ["Size",           viewRoom.size || "—"],
                    ["Beds",           viewRoom.beds || "—"],
                    ["Occupancy",      viewRoom.occupancy || "—"],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-slate-500 text-xs">{label}</p>
                      <p className="font-semibold text-slate-900">{val}</p>
                    </div>
                  ))}
                  <div>
                    <p className="text-slate-500 text-xs">Housekeeping</p>
                    {hk
                      ? <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${hk.color}`}><span className={`h-1.5 w-1.5 rounded-full ${hk.dot}`}/>{hk.label}</span>
                      : <p className="font-semibold text-slate-900">—</p>
                    }
                  </div>
                  {viewRoom.description && (
                    <div className="col-span-2">
                      <p className="text-slate-500 text-xs">Description</p>
                      <p className="text-slate-700">{viewRoom.description}</p>
                    </div>
                  )}
                  {viewRoom.allowed_booking_types?.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-slate-500 text-xs mb-1">Booking Type Restriction</p>
                      <div className="flex gap-2">
                        {viewRoom.allowed_booking_types.map(t => (
                          <span key={t} className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                            {t === "day" ? "Day only" : t === "night" ? "Night only" : "24hr only"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {features.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-slate-500 text-xs mb-2">Room Features</p>
                      <div className="flex flex-wrap gap-1.5">
                        {features.map((f, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-700 rounded-full text-xs font-medium">
                            <i className={`fas ${f.icon} text-[10px]`}></i> {f.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="px-6 pb-6 flex justify-end gap-2">
                <button onClick={() => setViewRoom(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50">Close</button>
                <button onClick={() => openEdit(viewRoom)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm">Edit</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit / Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveRoom} className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{editing?.id ? "Edit Room" : "Add New Room"}</h2>
              <p className="text-sm text-slate-500">{editing?.id ? "Update room details, rates, and availability." : "Create a new room listing."}</p>
            </div>
            <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Room Name *</label>
              <input required value={editing?.name || ""} onChange={e => setField("name", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
              <select value={editing?.category || "room"} onChange={e => setField("category", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm">
                <option value="room">Room</option>
                <option value="cottage">Cottage</option>
                <option value="pavilion">Pavilion</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
              <textarea required rows={2} value={editing?.description || ""} onChange={e => setField("description", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm resize-none" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Availability Status *</label>
              <select value={editing?.availability_status || "available"} onChange={e => setField("availability_status", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm">
                {Object.entries(AVAIL).map(([val, { label }]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              {editing?.availability_status && editing.availability_status !== "available" && (
                <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                  <i className="fas fa-exclamation-triangle"></i>
                  This room will not appear for booking until set back to Available.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Day Rate (₱) <span className="text-red-500">*</span></label>
              <input required type="number" min={0} value={editing?.day_rate ?? 1500} onChange={e => setField("day_rate", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Overnight Rate (₱) <span className="text-red-500">*</span></label>
              <input required type="number" min={0} value={editing?.overnight_rate ?? 2000} onChange={e => setField("overnight_rate", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">24hr Rate (₱) <span className="text-red-500">*</span></label>
              <input required type="number" min={0} value={editing?.rate_24hr ?? 2500} onChange={e => setField("rate_24hr", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity (units) <span className="text-red-500">*</span></label>
              <input required type="number" min={1} value={editing?.quantity ?? 1} onChange={e => setField("quantity", e.target.value)}
                placeholder="e.g. 12 for Small Cottages"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Capacity (pax) <span className="text-red-500">*</span></label>
              <input required type="number" min={1} value={editing?.capacity ?? 2} onChange={e => setField("capacity", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Capacity Label</label>
              <input placeholder="e.g. 4–5 pax" value={editing?.capacity_label || ""} onChange={e => setField("capacity_label", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Size</label>
              <input placeholder="e.g. 35 sqm" value={editing?.size || ""} onChange={e => setField("size", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Beds</label>
              <input placeholder="e.g. 1 King Bed" value={editing?.beds || ""} onChange={e => setField("beds", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Occupancy</label>
              <input placeholder="e.g. Max 4 Guests" value={editing?.occupancy || ""} onChange={e => setField("occupancy", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Room Image</label>
              <ImageUpload
                value={editing?.image || ""}
                onChange={url => setField("image", url)}
                folder="rooms"
                label="Upload Room Image"
              />
            </div>

            {/* ── Room Features with icon picker ── */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Room Features</label>
              <p className="text-xs text-slate-400 mb-2">Shown in the "Room Amenities" list on the Rooms page. Pick an icon then type the feature.</p>

              <div className="flex gap-2 mb-2">
                {/* Icon picker toggle */}
                <div className="relative">
                  <button type="button" onClick={() => setIconPickerOpen(p => !p)}
                    className="h-[38px] px-3 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700 shrink-0">
                    <i className={`fas ${selectedIcon} text-blue-500`}></i>
                    <i className="fas fa-chevron-down text-xs text-slate-400"></i>
                  </button>
                  {iconPickerOpen && (
                    <div className="absolute left-0 top-10 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-2 grid grid-cols-5 gap-1 w-48">
                      {FEATURE_ICONS.map(({ icon, label }) => (
                        <button key={icon} type="button" title={label}
                          onClick={() => { setSelectedIcon(icon); setIconPickerOpen(false); }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition ${selectedIcon === icon ? "bg-blue-100 text-blue-600" : "hover:bg-slate-100 text-slate-500"}`}>
                          <i className={`fas ${icon}`}></i>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  value={featureInput}
                  onChange={e => setFeatureInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}
                  placeholder="e.g. Air Conditioning"
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                />
                <button type="button" onClick={addFeature}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium shrink-0">
                  Add
                </button>
              </div>

              {(editing?.features || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editing.features.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-700 rounded-full text-xs font-medium">
                      <i className={`fas ${f.icon || "fa-check"} text-[10px]`}></i>
                      {f.text}
                      <button type="button" onClick={() => removeFeature(i)} className="text-sky-400 hover:text-red-500 ml-0.5">
                        <i className="fas fa-times text-[10px]"></i>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Allowed Booking Types ── */}
          <div className="border-t border-slate-100 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Allowed Booking Types</label>
            <p className="text-xs text-slate-400 mb-3">Leave all unchecked to allow all types (day, night, 24hr).</p>
            <div className="flex gap-5">
              {[
                { key: "day",   label: "Day (6AM–6PM)",   icon: "fa-sun"   },
                { key: "night", label: "Night (6PM–7AM)", icon: "fa-moon"  },
                { key: "24hr",  label: "24 Hours",        icon: "fa-clock" },
              ].map(({ key, label, icon }) => {
                const checked = (editing?.allowed_booking_types ?? []).includes(key);
                return (
                  <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        const current = editing?.allowed_booking_types ?? [];
                        const next = e.target.checked
                          ? [...current, key]
                          : current.filter(t => t !== key);
                        setField("allowed_booking_types", next.length ? next : null);
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
                    />
                    <i className={`fas ${icon} text-slate-400 text-xs`}></i>
                    {label}
                  </label>
                );
              })}
            </div>
            {editing?.allowed_booking_types?.length > 0 && (
              <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                <i className="fas fa-exclamation-triangle"></i>
                Guests can only select: {editing.allowed_booking_types.join(", ")}.
              </p>
            )}
          </div>

          {/* ── Live preview ── */}
          {editing && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400 uppercase font-semibold mb-2 tracking-wide">Card Preview</p>
              <RoomPreview room={editing} />
            </div>
          )}

          {saveError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
              <i className="fas fa-exclamation-circle shrink-0"></i>{saveError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-slate-600 rounded-xl hover:bg-slate-50 text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm disabled:opacity-60">
              {saving ? "Saving…" : "Save Room"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
