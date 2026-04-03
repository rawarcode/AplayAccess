import { useState, useEffect, useCallback } from "react";
import Modal from "../../components/modals/Modal.jsx";
import { getAdminRooms, createAdminRoom, updateAdminRoom } from "../../lib/adminApi";
import Toast, { useToast } from "../../components/ui/Toast";

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
  { icon: "fa-check",           label: "Other"        },
];

const BLANK = {
  name: "", description: "", day_rate: 1500, overnight_rate: 2000,
  capacity: 2, size: "", beds: "", occupancy: "", view: "", image: "",
  availability_status: "available", features: [],
};

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
  const rate = Number(room.day_rate || 0);
  let badge = null;
  if (rate >= 6000)      badge = { text: "Premium",    cls: "bg-purple-600" };
  else if (rate >= 4500) badge = { text: "Popular",    cls: "bg-green-600"  };
  else if (rate > 0)     badge = { text: "Best Value", cls: "bg-blue-600"   };

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
        {badge && (
          <div className={`absolute top-2 right-2 ${badge.cls} text-white px-2 py-0.5 rounded text-xs font-medium`}>
            {badge.text}
          </div>
        )}
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
  const [searchTerm,   setSearchTerm]   = useState("");
  const [filterAvail,  setFilterAvail]  = useState("");

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

  const filtered = rooms.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAvail  = !filterAvail || r.availability_status === filterAvail;
    return matchSearch && matchAvail;
  });

  function openNew() {
    setEditing({ ...BLANK });
    setSaveError("");
    setFeatureInput("");
    setSelectedIcon("fa-check");
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
      description:         editing.description,
      day_rate:            Number(editing.day_rate),
      overnight_rate:      Number(editing.overnight_rate),
      capacity:            Number(editing.capacity),
      availability_status: editing.availability_status || "available",
      size:                editing.size      || undefined,
      beds:                editing.beds      || undefined,
      occupancy:           editing.occupancy || undefined,
      view:                editing.view      || undefined,
      image:               editing.image     || undefined,
      features:            editing.features?.length ? editing.features : null,
      resort_id:           1,
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
        <button onClick={openNew}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-xl shadow-sm">
          <i className="fas fa-plus"></i>
          <span className="text-sm font-medium">New Room</span>
        </button>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4">{error}</div>}

      {/* Table card */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 bg-slate-50 border-b border-slate-200">
          <div>
            <p className="text-sm text-slate-600">Total Rooms</p>
            <p className="text-2xl font-semibold text-slate-900">{rooms.length}</p>
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
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Capacity</th>
                  <th className="px-6 py-3 text-left">Day Rate</th>
                  <th className="px-6 py-3 text-left">Overnight Rate</th>
                  <th className="px-6 py-3 text-left">Availability</th>
                  <th className="px-6 py-3 text-left">Housekeeping</th>
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
                        {room.name}
                        {room.size && <span className="ml-1 text-xs text-slate-400">· {room.size}</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{room.capacity} pax</td>
                      <td className="px-6 py-4 text-slate-600">₱{Number(room.day_rate).toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-600">₱{Number(room.overnight_rate).toLocaleString()}</td>
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
                <button onClick={() => setViewRoom(null)} className="text-slate-400 hover:text-slate-600">
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
                    ["Name",           viewRoom.name],
                    ["Capacity",       `${viewRoom.capacity} pax`],
                    ["Day Rate",       `₱${Number(viewRoom.day_rate).toLocaleString()}`],
                    ["Overnight Rate", `₱${Number(viewRoom.overnight_rate).toLocaleString()}`],
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
            <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Room Name *</label>
              <input required value={editing?.name || ""} onChange={e => setField("name", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Day Rate (₱) *</label>
              <input required type="number" min={0} value={editing?.day_rate ?? 1500} onChange={e => setField("day_rate", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Overnight Rate (₱) *</label>
              <input required type="number" min={0} value={editing?.overnight_rate ?? 2000} onChange={e => setField("overnight_rate", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Capacity (pax) *</label>
              <input required type="number" min={1} value={editing?.capacity ?? 2} onChange={e => setField("capacity", e.target.value)}
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
              <input type="url" placeholder="https://…" value={editing?.image || ""} onChange={e => setField("image", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
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
