import { useState } from "react";
import Modal from "../../components/modals/Modal.jsx";

const initialRooms = [
  {
    id: 1,
    number: "#201",
    name: "Deluxe Suite",
    type: "Deluxe Suite",
    capacity: "2 Adults",
    price: 250,
    status: "Available",
    image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=200&h=200&fit=crop",
  },
  {
    id: 2,
    number: "#105",
    name: "Beach Villa",
    type: "Beach Villa",
    capacity: "4 Adults",
    price: 350,
    status: "Occupied",
    image: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=200&h=200&fit=crop",
  },
  {
    id: 3,
    number: "#302",
    name: "Family Bungalow",
    type: "Family Bungalow",
    capacity: "6 Adults",
    price: 450,
    status: "Maintenance",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=200&fit=crop",
  },
];

export default function AdminRooms() {
  const [rooms, setRooms] = useState(initialRooms);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch =
      room.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !filterType || room.type === filterType;
    const matchesStatus = !filterStatus || room.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  function openNew() {
    setEditing({
      number: "",
      name: "",
      type: "Standard",
      capacity: "",
      price: 0,
      status: "Available",
    });
    setModalOpen(true);
  }

  function openEdit(room) {
    setEditing({ ...room });
    setModalOpen(true);
  }

  function saveRoom(e) {
    e.preventDefault();
    if (!editing.number || !editing.name) return;

    setRooms((list) => {
      if (editing.id) {
        return list.map((r) => (r.id === editing.id ? editing : r));
      }
      const nextId = Math.max(0, ...list.map((r) => r.id)) + 1;
      return [...list, { ...editing, id: nextId }];
    });
    setModalOpen(false);
  }

  function deleteRoom(id) {
    if (window.confirm("Are you sure you want to delete this room?")) {
      setRooms((list) => list.filter((r) => r.id !== id));
    }
  }

  const statusColors = {
    Available: "bg-emerald-100 text-emerald-800",
    Occupied: "bg-sky-100 text-sky-800",
    Maintenance: "bg-amber-100 text-amber-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Room Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage rooms, availability, and pricing in one place.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          <i className="fas fa-plus"></i>
          <span className="text-sm font-medium">New Room</span>
        </button>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 bg-slate-50 border-b border-slate-200">
          <div>
            <p className="text-sm text-slate-600">Total Rooms</p>
            <p className="text-2xl font-semibold text-slate-900">{rooms.length}</p>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="min-w-40 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value="">Filter by Type</option>
                <option value="Standard">Standard</option>
                <option value="Deluxe Suite">Deluxe Suite</option>
                <option value="Beach Villa">Beach Villa</option>
                <option value="Family Bungalow">Family Bungalow</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="min-w-40 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value="">Filter by Status</option>
                <option value="Available">Available</option>
                <option value="Occupied">Occupied</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 text-left"></th>
                <th className="px-6 py-3 text-left">Room Number</th>
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-left">Capacity</th>
                <th className="px-6 py-3 text-left">Price/Night</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredRooms.map((room) => (
                <tr key={room.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <img
                      alt={room.name}
                      className="h-10 w-10 rounded-full object-cover"
                      src={room.image}
                    />
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">{room.number}</td>
                  <td className="px-6 py-4 text-slate-600">{room.type}</td>
                  <td className="px-6 py-4 text-slate-600">{room.capacity}</td>
                  <td className="px-6 py-4 text-slate-600">₱{room.price}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                        statusColors[room.status] || "bg-slate-100 text-slate-800"
                      }`}
                    >
                      <span
                        className={
                          room.status === "Available"
                            ? "h-2.5 w-2.5 rounded-full bg-emerald-500"
                            : room.status === "Occupied"
                            ? "h-2.5 w-2.5 rounded-full bg-sky-500"
                            : "h-2.5 w-2.5 rounded-full bg-amber-500"
                        }
                      />
                      {room.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 space-x-3">
                    <button
                      onClick={() => openEdit(room)}
                      className="text-sky-600 hover:text-sky-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteRoom(room.id)}
                      className="text-rose-600 hover:text-rose-800 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveRoom} className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {editing?.id ? "Edit Room" : "Add New Room"}
              </h2>
              <p className="text-sm text-slate-500">
                {editing?.id
                  ? "Update room details and availability."
                  : "Create a new room listing."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Room Number</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.number || ""}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, number: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Room Name</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.name || ""}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, name: e.target.value }))
                }
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Room Type</label>
              <select
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.type || "Standard"}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, type: e.target.value }))
                }
              >
                <option>Standard</option>
                <option>Deluxe</option>
                <option>Suite</option>
                <option>Family</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price per Night (₱)</label>
              <input
                type="number"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.price || 0}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, price: parseFloat(e.target.value) }))
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Capacity</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.capacity || ""}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, capacity: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.status || "Available"}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, status: e.target.value }))
                }
              >
                <option>Available</option>
                <option>Occupied</option>
                <option>Maintenance</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-slate-600 rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl"
            >
              Save Room
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
