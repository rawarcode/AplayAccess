import { useEffect, useState } from "react";
import {
  getAdminRooms,
  getAdminAddons,
  toggleAddonActive,
  updateRoomAvailability,
} from "../../lib/adminApi.js";
import Toast, { useToast } from "../../components/ui/Toast.jsx";

// Catalog page for admin — limited CRUD scope. Two sections:
//   - Rooms: change operational status (available / renovation /
//     maintenance / reserved / closed). NO rate / capacity / name
//     edits, NO add / delete (those live under owner-only routes).
//   - Add-ons: toggle is_active. NO create / rename / reprice /
//     delete.
// Owner uses /owner/rooms (with the addons tab) for full CRUD.

const ROOM_STATUSES = [
  { value: "available",   label: "Available",         color: "bg-emerald-100 text-emerald-800" },
  { value: "renovation",  label: "Under Renovation",  color: "bg-rose-100 text-rose-800"       },
  { value: "maintenance", label: "Under Maintenance", color: "bg-amber-100 text-amber-800"     },
  { value: "reserved",    label: "Reserved / Blocked", color: "bg-purple-100 text-purple-800"  },
  { value: "closed",      label: "Temporarily Closed", color: "bg-slate-100 text-slate-600"    },
];

function statusMeta(value) {
  return ROOM_STATUSES.find((s) => s.value === value) ?? ROOM_STATUSES[0];
}

export default function AdminCatalog() {
  const [rooms, setRooms]     = useState([]);
  const [addons, setAddons]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("rooms");
  const [busyId, setBusyId]   = useState(null);
  const [toast, showToast, clearToast, toastType] = useToast();

  useEffect(() => {
    let alive = true;
    Promise.allSettled([getAdminRooms(), getAdminAddons()])
      .then(([roomsRes, addonsRes]) => {
        if (!alive) return;
        setRooms(roomsRes.status === "fulfilled" ? (roomsRes.value?.data?.data ?? []) : []);
        setAddons(addonsRes.status === "fulfilled" ? (addonsRes.value?.data?.data ?? []) : []);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  async function changeRoomStatus(room, nextStatus) {
    if (room.availability_status === nextStatus) return;
    setBusyId(`room-${room.id}`);
    try {
      const res = await updateRoomAvailability(room.id, nextStatus);
      const updated = res.data?.data ?? { ...room, availability_status: nextStatus };
      setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, ...updated } : r)));
      showToast(`Room "${room.name}" → ${statusMeta(nextStatus).label}`, "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update room status.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAddon(addon) {
    setBusyId(`addon-${addon.id}`);
    try {
      const res = await toggleAddonActive(addon.id);
      const updated = res.data?.data ?? { ...addon, is_active: !addon.is_active };
      setAddons((prev) => prev.map((a) => (a.id === addon.id ? { ...a, ...updated } : a)));
      showToast(
        `Add-on "${addon.name}" ${updated.is_active ? "enabled" : "disabled"}.`,
        "success"
      );
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to toggle add-on.", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Toast message={toast} type={toastType} onClose={clearToast} />

      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Catalog</h1>
        <p className="mt-1 text-sm text-slate-500">
          Toggle which rooms and add-ons are currently bookable. To edit rates,
          capacity, or add new entries, the owner uses the full catalog.
        </p>
      </div>

      {/* Section toggle */}
      <div className="inline-flex bg-slate-100 rounded-lg p-1 mb-6">
        {[
          { key: "rooms",  label: "Rooms",   count: rooms.length },
          { key: "addons", label: "Add-ons", count: addons.length },
        ].map((s) => {
          const active = section === s.key;
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={active}
              onClick={() => setSection(s.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                active
                  ? "bg-white shadow text-slate-900"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {s.label}
              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
                {s.count}
              </span>
            </button>
          );
        })}
      </div>

      {section === "rooms" ? (
        <RoomsSection rooms={rooms} loading={loading} busyId={busyId} onChange={changeRoomStatus} />
      ) : (
        <AddonsSection addons={addons} loading={loading} busyId={busyId} onToggle={toggleAddon} />
      )}
    </div>
  );
}

function RoomsSection({ rooms, loading, busyId, onChange }) {
  if (loading) return <SkeletonRows />;
  if (rooms.length === 0) {
    return <EmptyState icon="fa-bed" text="No rooms in the catalog yet." />;
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Room</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Current status</th>
            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Change to</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rooms.map((room) => {
            const meta = statusMeta(room.availability_status);
            const busy = busyId === `room-${room.id}`;
            return (
              <tr key={room.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-sm text-slate-900">{room.name}</p>
                  {room.beds && <p className="text-xs text-slate-400">{room.beds}</p>}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 capitalize">{room.category}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>
                    {meta.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <select
                      value={room.availability_status}
                      onChange={(e) => onChange(room, e.target.value)}
                      disabled={busy}
                      aria-label={`Change status for ${room.name}`}
                      className="border border-slate-200 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-50"
                    >
                      {ROOM_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AddonsSection({ addons, loading, busyId, onToggle }) {
  if (loading) return <SkeletonRows />;
  if (addons.length === 0) {
    return <EmptyState icon="fa-tags" text="No add-ons in the catalog yet." />;
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Add-on</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Price</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Toggle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {addons.map((a) => {
            const busy = busyId === `addon-${a.id}`;
            return (
              <tr key={a.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-sm text-slate-900">{a.name}</p>
                  {a.description && <p className="text-xs text-slate-400">{a.description}</p>}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">₱{Number(a.price).toLocaleString("en-PH")}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      a.is_active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {a.is_active ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onToggle(a)}
                      disabled={busy}
                      aria-label={a.is_active ? `Disable ${a.name}` : `Enable ${a.name}`}
                      className={`relative inline-flex items-center h-7 w-12 rounded-full transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand/50 ${
                        a.is_active ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 bg-white rounded-full shadow transform transition ${
                          a.is_active ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" aria-busy="true">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {Array.from({ length: 4 }).map((_, i) => (
              <th key={i} className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded animate-pulse" /></th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: 4 }).map((__, j) => (
                <td key={j} className="px-4 py-3">
                  <div className="h-3 bg-slate-200 rounded" style={{ width: `${50 + ((i + j) * 7) % 40}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-16 text-center">
      <i className={`fas ${icon} text-3xl text-slate-300 mb-3 block`} aria-hidden="true" />
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  );
}
