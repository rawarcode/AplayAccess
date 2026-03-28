import { useState } from "react";
import Modal from "../../components/modals/Modal.jsx";

const initialItems = [
  { id: 1, name: "Bath Towels", category: "linen", quantity: 20, reorderLevel: 5, unit: "pcs" },
  { id: 2, name: "Shampoo", category: "toiletries", quantity: 8, reorderLevel: 10, unit: "bottles" },
];

export default function AdminInventory() {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function openNew() {
    setEditing({ name: "", category: "", quantity: 0, reorderLevel: 0, unit: "" });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing({ ...item });
    setModalOpen(true);
  }

  function saveItem(e) {
    e.preventDefault();
    if (!editing.name) return;
    setItems((list) => {
      if (editing.id) {
        return list.map((i) => (i.id === editing.id ? editing : i));
      }
      const next = Math.max(0, ...list.map((i) => i.id)) + 1;
      return [...list, { ...editing, id: next }];
    });
    setModalOpen(false);
  }

  function lowStock(i) {
    return i.quantity <= i.reorderLevel;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track stock levels and know when to reorder.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          <i className="fas fa-plus"></i>
          <span className="text-sm font-medium">Add Item</span>
        </button>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 bg-slate-50 border-b border-slate-200">
          <div>
            <p className="text-sm text-slate-600">Total items</p>
            <p className="text-2xl font-semibold text-slate-900">{items.length}</p>
          </div>
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search inventory..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Category</th>
                <th className="px-6 py-3 text-left">Qty</th>
                <th className="px-6 py-3 text-left">Reorder</th>
                <th className="px-6 py-3 text-left">Unit</th>
                <th className="px-6 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredItems.map((i) => (
                <tr key={i.id} className={lowStock(i) ? "bg-rose-50 hover:bg-rose-50" : "hover:bg-slate-50"}>
                  <td className="px-6 py-4 font-medium text-slate-900">{i.name}</td>
                  <td className="px-6 py-4 text-slate-600">{i.category}</td>
                  <td className="px-6 py-4">
                    <span className={lowStock(i) ? "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-semibold" : "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold"}>
                      {i.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{i.reorderLevel}</td>
                  <td className="px-6 py-4 text-slate-600">{i.unit}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openEdit(i)}
                      className="text-sky-600 hover:text-sky-800 font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveItem} className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {editing?.id ? "Edit Item" : "New Item"}
              </h2>
              <p className="text-sm text-slate-500">
                {editing?.id
                  ? "Update inventory details."
                  : "Add a new inventory item."}
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.name || ""}
                onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <input
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.category || ""}
                onChange={(e) => setEditing((x) => ({ ...x, category: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Qty</label>
              <input
                type="number"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.quantity || 0}
                onChange={(e) => setEditing((x) => ({ ...x, quantity: +e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reorder Level</label>
              <input
                type="number"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.reorderLevel || 0}
                onChange={(e) => setEditing((x) => ({ ...x, reorderLevel: +e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
              <input
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.unit || ""}
                onChange={(e) => setEditing((x) => ({ ...x, unit: e.target.value }))}
              />
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
