import { useState } from "react";
import Modal from "../../components/modals/Modal.jsx";

export default function AdminServices() {
  const [services, setServices] = useState([
    {
      id: 1,
      name: "Massage Therapy",
      category: "Wellness",
      price: 800,
      duration: "60 mins",
      status: "Available",
      description: "Professional relaxation massage",
    },
    {
      id: 2,
      name: "Airport Transfer",
      category: "Transportation",
      price: 1500,
      duration: "Varies",
      status: "Available",
      description: "Private airport transportation",
    },
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const filteredServices = services.filter((s) => {
    const matches = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const categoryMatch = !filterCategory || s.category === filterCategory;
    return matches && categoryMatch;
  });

  function openNew() {
    setEditing({
      name: "",
      category: "Wellness",
      price: 0,
      duration: "",
      status: "Available",
      description: "",
    });
    setModalOpen(true);
  }

  function openEdit(service) {
    setEditing({ ...service });
    setModalOpen(true);
  }

  function saveService(e) {
    e.preventDefault();
    if (!editing.name || !editing.price) return;

    setServices((list) => {
      if (editing.id) {
        return list.map((s) => (s.id === editing.id ? editing : s));
      }
      const nextId = Math.max(0, ...list.map((s) => s.id)) + 1;
      return [...list, { ...editing, id: nextId }];
    });
    setModalOpen(false);
  }

  function deleteService(id) {
    if (window.confirm("Delete this service?")) {
      setServices((list) => list.filter((s) => s.id !== id));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Services</h1>
          <p className="text-sm text-slate-500 mt-1">
            Offer guests additional services and manage availability.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          <i className="fas fa-plus"></i>
          <span className="text-sm font-medium">New Service</span>
        </button>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 bg-slate-50 border-b border-slate-200">
          <div>
            <p className="text-sm text-slate-600">Total services</p>
            <p className="text-2xl font-semibold text-slate-900">{services.length}</p>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="min-w-45 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="">Filter by Category</option>
              <option value="Wellness">Wellness</option>
              <option value="Transportation">Transportation</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Dining">Dining</option>
              <option value="Activities">Activities</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 text-left">Service Name</th>
                <th className="px-6 py-3 text-left">Category</th>
                <th className="px-6 py-3 text-left">Price</th>
                <th className="px-6 py-3 text-left">Duration</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredServices.map((service) => (
                <tr key={service.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{service.name}</td>
                  <td className="px-6 py-4 text-slate-600">{service.category}</td>
                  <td className="px-6 py-4 text-slate-600">₱{service.price}</td>
                  <td className="px-6 py-4 text-slate-600">{service.duration}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                        service.status === "Available"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      <span
                        className={
                          service.status === "Available"
                            ? "h-2.5 w-2.5 rounded-full bg-emerald-500"
                            : "h-2.5 w-2.5 rounded-full bg-rose-500"
                        }
                      />
                      {service.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 space-x-3">
                    <button
                      onClick={() => openEdit(service)}
                      className="text-sky-600 hover:text-sky-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteService(service.id)}
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
        <form onSubmit={saveService} className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {editing?.id ? "Edit Service" : "Add Service"}
              </h2>
              <p className="text-sm text-slate-500">
                {editing?.id
                  ? "Update service details."
                  : "Add a new service offering."}
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Service Name</label>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.category || "Wellness"}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, category: e.target.value }))
                }
              >
                <option>Wellness</option>
                <option>Transportation</option>
                <option>Entertainment</option>
                <option>Dining</option>
                <option>Activities</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price (₱)</label>
              <input
                type="number"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.price || 0}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, price: parseFloat(e.target.value) }))
                }
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
              <input
                type="text"
                placeholder="e.g., 60 mins, 2 hours, Varies"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.duration || ""}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, duration: e.target.value }))
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
                <option>Unavailable</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
              rows="3"
              value={editing?.description || ""}
              onChange={(e) =>
                setEditing((x) => ({ ...x, description: e.target.value }))
              }
            />
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
              Save
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
