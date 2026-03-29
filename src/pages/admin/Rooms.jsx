import { useState, useEffect, useCallback } from "react";
import Modal from "../../components/modals/Modal.jsx";
import { getAdminRooms, createAdminRoom, updateAdminRoom } from "../../lib/adminApi";
import Toast, { useToast } from "../../components/ui/Toast";

// ── Availability status config ────────────────────────────────────────────────
const AVAIL = {
  available:   { label: "Available",            color: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500", icon: "fa-check-circle" },
  renovation:  { label: "Under Renovation",     color: "bg-rose-100 text-rose-800",       dot: "bg-rose-500",    icon: "fa-hard-hat"    },
  maintenance: { label: "Under Maintenance",    color: "bg-amber-100 text-amber-800",     dot: "bg-amber-500",   icon: "fa-wrench"      },
  reserved:    { label: "Reserved / Blocked",   color: "bg-purple-100 text-purple-800",   dot: "bg-purple-500",  icon: "fa-lock"        },
  closed:      { label: "Temporarily Closed",   color: "bg-slate-100 text-slate-600",     dot: "bg-slate-400",   icon: "fa-ban"         },
};

// ── Housekeeping status config ────────────────────────────────────────────────
const HK = {
  clean:    { label: "Clean",    color: "bg-sky-100 text-sky-800",    dot: "bg-sky-500"    },
  dirty:    { label: "Dirty",    color: "bg-rose-100 text-rose-800",  dot: "bg-rose-500"   },
  cleaning: { label: "Cleaning", color: "bg-amber-100 text-amber-800",dot: "bg-amber-500"  },
};

const BLANK = {
  name: "", description: "", day_rate: 1500, overnight_rate: 2000,
  capacity: 2, size: "", beds: "", occupancy: "", view: "", image: "",
  availability_status: "available",
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

  const load = useCallback(() => {
    setLoading(true);
    getAdminRooms()
      .then(r => setRooms(r.data.data))
      .catch(() => setError("Failed to load rooms."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rooms.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAvail  = !filterAvail || r.availability_status === filterAvail;
    return matchSearch && matchAvail;
  });

  function openNew()      { setEditing({ ...BLANK }); setSaveError(""); setModalOpen(true); }
  function openEdit(room) { setEditing({ ...room, availability_status: room.availability_status || "available" }); setSaveError(""); setViewRoom(null); setModalOpen(true); }
  function setField(k, v) { setEditing(x => ({ ...x, [k]: v })); }

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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Room Management</h1>
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
                    <tr
                      key={room.id}
                      onClick={() => setViewRoom(room)}
                      className={`cursor-pointer transition-colors ${isUnavailable ? "opacity-60 bg-slate-50 hover:bg-slate-100" : "hover:bg-slate-50"}`}
                    >
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
                            <span className={`h-2 w-2 rounded-full ${hk.dot}`} />
                            {hk.label}
                          </span>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(room)} className="text-sky-600 hover:text-sky-800 font-medium">
                          Edit
                        </button>
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

                {/* Availability highlight */}
                {avail !== "available" && (
                  <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${AVAIL[avail].color}`}>
                    <i className={`fas ${AVAIL[avail].icon}`}></i>
                    {AVAIL[avail].label}
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
                    ["View",           viewRoom.view || "—"],
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
                </div>
              </div>
              <div className="px-6 pb-6 flex justify-end gap-2">
                <button onClick={() => setViewRoom(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50">
                  Close
                </button>
                <button onClick={() => openEdit(viewRoom)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm">
                  Edit
                </button>
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

            {/* Availability — full width, prominent */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Availability Status *</label>
              <select value={editing?.availability_status || "available"} onChange={e => setField("availability_status", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm">
                {Object.entries(AVAIL).map(([val, { label, icon }]) => (
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
              <label className="block text-sm font-medium text-slate-700 mb-1">View</label>
              <input placeholder="e.g. Ocean View" value={editing?.view || ""} onChange={e => setField("view", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
              <input type="url" placeholder="https://…" value={editing?.image || ""} onChange={e => setField("image", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
          </div>

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
