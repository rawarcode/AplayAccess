import { useState } from "react";
import Modal from "../../components/modals/Modal.jsx";

export default function AdminFoods() {
  const [foods, setFoods] = useState([
    {
      id: 1,
      name: "Grilled Fish",
      category: "Main Course",
      price: 450,
      status: "Available",
      image: "https://images.unsplash.com/photo-1542080353-ea2239dc8cc7?w=200&h=200&fit=crop",
    },
    {
      id: 2,
      name: "Caesar Salad",
      category: "Appetizer",
      price: 200,
      status: "Available",
      image: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=200&h=200&fit=crop",
    },
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filteredFoods = foods.filter((f) => {
    const matches = f.name.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = !filterStatus || f.status === filterStatus;
    return matches && statusMatch;
  });

  function openNew() {
    setEditing({
      name: "",
      category: "Main Course",
      price: 0,
      status: "Available",
    });
    setModalOpen(true);
  }

  function openEdit(food) {
    setEditing({ ...food });
    setModalOpen(true);
  }

  function saveFood(e) {
    e.preventDefault();
    if (!editing.name || !editing.price) return;

    setFoods((list) => {
      if (editing.id) {
        return list.map((f) => (f.id === editing.id ? editing : f));
      }
      const nextId = Math.max(0, ...list.map((f) => f.id)) + 1;
      return [...list, { ...editing, id: nextId }];
    });
    setModalOpen(false); 
  }

  function deleteFood(id) {
    if (window.confirm("Delete this food item?")) {
      setFoods((list) => list.filter((f) => f.id !== id));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Food Menu</h1>
          <p className="text-sm text-slate-500 mt-1">
            Add or update food items available for guests.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          <i className="fas fa-plus"></i>
          <span className="text-sm font-medium">New Item</span>
        </button>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 bg-slate-50 border-b border-slate-200">
          <div>
            <p className="text-sm text-slate-600">Total items</p>
            <p className="text-2xl font-semibold text-slate-900">{foods.length}</p>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Search foods..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="min-w-40 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="">Filter by Status</option>
              <option value="Available">Available</option>
              <option value="Unavailable">Unavailable</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 text-left"></th>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Category</th>
                <th className="px-6 py-3 text-left">Price</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredFoods.map((food) => (
                <tr key={food.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <img
                      alt={food.name}
                      className="h-10 w-10 rounded-full object-cover"
                      src={food.image}
                    />
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">{food.name}</td>
                  <td className="px-6 py-4 text-slate-600">{food.category}</td>
                  <td className="px-6 py-4 text-slate-600">₱{food.price}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                        food.status === "Available"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      <span
                        className={
                          food.status === "Available"
                            ? "h-2.5 w-2.5 rounded-full bg-emerald-500"
                            : "h-2.5 w-2.5 rounded-full bg-rose-500"
                        }
                      />
                      {food.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 space-x-3">
                    <button
                      onClick={() => openEdit(food)}
                      className="text-sky-600 hover:text-sky-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteFood(food.id)}
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
        <form onSubmit={saveFood} className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {editing?.id ? "Edit Food" : "Add Food Item"}
              </h2>
              <p className="text-sm text-slate-500">
                {editing?.id
                  ? "Update food menu details."
                  : "Add a new food item to the menu."}
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Food Name</label>
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
                value={editing?.category || "Main Course"}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, category: e.target.value }))
                }
              >
                <option>Appetizer</option>
                <option>Main Course</option>
                <option>Dessert</option>
                <option>Beverage</option>
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
