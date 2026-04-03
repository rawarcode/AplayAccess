import { useState, useEffect, useCallback } from "react";
import Modal from "../../components/modals/Modal.jsx";
import AlertModal from "../../components/modals/AlertModal.jsx";
import { getAdminAddons, updateAdminAddon } from "../../lib/adminApi";

const ICONS = { Pillow: "fa-bed", Karaoke: "fa-microphone" };

export default function AdminInventory() {
  const [addons,     setAddons]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [viewItem,   setViewItem]   = useState(null);
  const [alert,      setAlert]      = useState({ open: false, type: "info", title: "", message: "" });

  const load = useCallback(() => {
    setLoading(true);
    getAdminAddons()
      .then(r => setAddons(r.data.data))
      .catch(() => showAlert("error", "Error", "Failed to load inventory."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function showAlert(type, title, message) {
    setAlert({ open: true, type, title, message });
  }

  function openEdit(item) {
    setEditing({ ...item });
    setViewItem(null);
    setModalOpen(true);
  }

  async function saveAddon(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAdminAddon(editing.id, {
        price:       Number(editing.price),
        max_qty:     Number(editing.max_qty),
        is_active:   editing.is_active,
      });
      setModalOpen(false);
      load();
    } catch (err) {
      showAlert("error", "Error", err?.response?.data?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    try {
      await updateAdminAddon(item.id, { is_active: !item.is_active });
      setAddons(list => list.map(a => a.id === item.id ? { ...a, is_active: !a.is_active } : a));
      if (viewItem?.id === item.id) setViewItem(v => ({ ...v, is_active: !v.is_active }));
    } catch {
      showAlert("error", "Error", "Failed to update status.");
    }
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 mt-1">Manage add-on items available to guests.</p>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200">
          <p className="text-sm text-slate-600">Total items</p>
          <p className="text-2xl font-semibold text-slate-900">{addons.length}</p>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <p className="px-6 py-10 text-center text-slate-400">
              <i className="fas fa-spinner fa-spin mr-2"></i>Loading…
            </p>
          ) : addons.length === 0 ? (
            <p className="px-6 py-10 text-center text-slate-400">No items found.</p>
          ) : (
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">Item</th>
                  <th className="px-6 py-3 text-left">Price</th>
                  <th className="px-6 py-3 text-left">Max Qty</th>
                  <th className="px-6 py-3 text-left">Type</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {addons.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => setViewItem(item)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <span className="flex items-center gap-2">
                        <i className={`fas ${ICONS[item.name] || "fa-box"} text-slate-400`}></i>
                        {item.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">₱{Number(item.price).toLocaleString()}</td>
                    <td className="px-6 py-4">{item.max_qty}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
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
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEdit(item)}
                          className="text-sky-600 hover:text-sky-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(item)}
                          className={item.is_active
                            ? "text-amber-600 hover:text-amber-800 font-medium"
                            : "text-emerald-600 hover:text-emerald-800 font-medium"}
                        >
                          {item.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* View Detail Modal */}
      {viewItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <i className={`fas ${ICONS[viewItem.name] || "fa-box"} text-slate-500`}></i>
                {viewItem.name}
              </h3>
              <button onClick={() => setViewItem(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Price",       `₱${Number(viewItem.price).toLocaleString()}`],
                  ["Max Qty",     viewItem.max_qty],
                  ["Type",        viewItem.per_booking ? "Per Booking (flat)" : "Per Item"],
                  ["Status",      viewItem.is_active ? "Active" : "Inactive"],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-slate-500 text-xs">{label}</p>
                    <p className="font-semibold text-slate-900">{val}</p>
                  </div>
                ))}
                {viewItem.description && (
                  <div className="col-span-2">
                    <p className="text-slate-500 text-xs">Description</p>
                    <p className="text-slate-700">{viewItem.description}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-2">
              <button
                onClick={() => setViewItem(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => openEdit(viewItem)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveAddon} className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Edit — {editing?.name}</h2>
              <p className="text-sm text-slate-500">Update pricing and availability.</p>
            </div>
            <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price (₱) *</label>
              <input
                required type="number" min={0}
                value={editing?.price ?? 0}
                onChange={e => setEditing(x => ({ ...x, price: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Qty *</label>
              <input
                required type="number" min={1} max={100}
                value={editing?.max_qty ?? 1}
                onChange={e => setEditing(x => ({ ...x, max_qty: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={editing?.is_active ? "1" : "0"}
                onChange={e => setEditing(x => ({ ...x, is_active: e.target.value === "1" }))}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            <i className="fas fa-info-circle mr-1"></i>
            Type and name are fixed. Contact a developer to add new item types.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-slate-600 rounded-xl hover:bg-slate-50 text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      <AlertModal
        open={alert.open} onClose={() => setAlert(a => ({ ...a, open: false }))}
        type={alert.type} title={alert.title} message={alert.message}
      />
    </div>
  );
}
