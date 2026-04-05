import { useState, useEffect, useCallback } from "react";
import Modal from "../../components/modals/Modal.jsx";
import Toast, { useToast } from "../../components/ui/Toast";
import { getAdminAddons, createAdminAddon, updateAdminAddon } from "../../lib/adminApi";

const ICONS = { Pillow: "fa-bed", Karaoke: "fa-microphone" };

const BLANK = {
  name: "", description: "", price: 0, max_qty: 1, per_booking: false, is_active: true,
};

export default function AdminAddons() {
  const [toast, showToast, clearToast, toastType] = useToast();

  const [sortBy,  setSortBy]  = useState('Name');
  const [sortDir, setSortDir] = useState('asc');
  const [addons,    setAddons]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewItem,  setViewItem]  = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getAdminAddons()
      .then(r => setAddons(r.data.data))
      .catch(() => showToast("Failed to load add-ons.", "error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing({ ...BLANK });
    setViewItem(null);
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing({ ...item });
    setViewItem(null);
    setModalOpen(true);
  }

  function setField(k, v) {
    setEditing(x => ({ ...x, [k]: v }));
  }

  async function saveAddon(e) {
    e.preventDefault();
    if (!editing.name?.trim()) {
      showToast("Name is required.", "error");
      return;
    }
    setSaving(true);
    const payload = {
      name:        editing.name.trim(),
      description: editing.description || undefined,
      price:       Number(editing.price),
      max_qty:     Number(editing.max_qty),
      per_booking: Boolean(editing.per_booking),
      is_active:   Boolean(editing.is_active),
    };
    try {
      if (editing.id) {
        await updateAdminAddon(editing.id, payload);
      } else {
        await createAdminAddon(payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to save.", "error");
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
      showToast("Failed to update status.", "error");
    }
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 mt-1">Manage bookable add-ons guests can attach to their reservation.</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          <i className="fas fa-plus"></i>
          <span className="text-sm font-medium">New Add-on</span>
        </button>
      </div>

      {/* Table card */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200">
          <p className="text-sm text-slate-600">Total add-ons</p>
          <p className="text-2xl font-semibold text-slate-900">{addons.length}</p>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <p className="px-6 py-10 text-center text-slate-400">
              <i className="fas fa-spinner fa-spin mr-2"></i>Loading…
            </p>
          ) : addons.length === 0 ? (
            <p className="px-6 py-10 text-center text-slate-400">No add-ons yet. Click "New Add-on" to create one.</p>
          ) : (
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  {[['Name','Name'],['Price','Price'],['Max Qty','Max Qty'],['Type','Type'],['Status','Status']].map(([label,key]) => (
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
              <tbody className="divide-y divide-slate-200">
                {[...addons].sort((a, b) => {
                  let aVal, bVal;
                  if (sortBy === 'Price')    { aVal = Number(a.price);   bVal = Number(b.price); }
                  else if (sortBy === 'Max Qty') { aVal = Number(a.max_qty); bVal = Number(b.max_qty); }
                  else if (sortBy === 'Type')    { aVal = a.per_booking ? 'per booking' : 'per item'; bVal = b.per_booking ? 'per booking' : 'per item'; }
                  else if (sortBy === 'Status')  { aVal = a.is_active ? 0 : 1; bVal = b.is_active ? 0 : 1; }
                  else { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); }
                  if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
                  if (aVal > bVal) return sortDir === 'asc' ?  1 : -1;
                  return 0;
                }).map(item => (
                  <tr
                    key={item.id}
                    onClick={() => setViewItem(item)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <span className="flex items-center gap-2">
                        <i className={`fas ${ICONS[item.name] || "fa-tag"} text-slate-400`}></i>
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
                        <button onClick={() => openEdit(item)} className="text-sky-600 hover:text-sky-800 font-medium">
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
                <i className={`fas ${ICONS[viewItem.name] || "fa-tag"} text-slate-500`}></i>
                {viewItem.name}
              </h3>
              <button onClick={() => setViewItem(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Price",    `₱${Number(viewItem.price).toLocaleString()}`],
                  ["Max Qty",  viewItem.max_qty],
                  ["Type",     viewItem.per_booking ? "Per Booking (flat)" : "Per Item"],
                  ["Status",   viewItem.is_active ? "Active" : "Inactive"],
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
              <button onClick={() => setViewItem(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50">
                Close
              </button>
              <button onClick={() => openEdit(viewItem)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm">
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveAddon} className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {editing?.id ? `Edit — ${editing.name}` : "New Add-on"}
              </h2>
              <p className="text-sm text-slate-500">
                {editing?.id ? "Update pricing and settings." : "Create a new bookable add-on for guests."}
              </p>
            </div>
            <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Name — editable on create, read-only on edit */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              {editing?.id ? (
                <div className="w-full px-4 py-2 border border-slate-100 rounded-xl bg-slate-50 text-sm text-slate-500">
                  {editing.name}
                </div>
              ) : (
                <input
                  required
                  placeholder="e.g. Extra Towel"
                  value={editing?.name || ""}
                  onChange={e => setField("name", e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                />
              )}
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                placeholder="Short description shown to guests"
                value={editing?.description || ""}
                onChange={e => setField("description", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price (₱) *</label>
              <input
                required type="number" min={0}
                value={editing?.price ?? 0}
                onChange={e => setField("price", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
            </div>

            {/* Max Qty */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Qty *</label>
              <input
                required type="number" min={1} max={100}
                value={editing?.max_qty ?? 1}
                onChange={e => setField("max_qty", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pricing Type *</label>
              <select
                value={editing?.per_booking ? "1" : "0"}
                onChange={e => setField("per_booking", e.target.value === "1")}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              >
                <option value="0">Per Item (×qty)</option>
                <option value="1">Per Booking (flat fee)</option>
              </select>
              <p className="mt-1 text-xs text-slate-400">
                {editing?.per_booking
                  ? "One flat charge per booking regardless of quantity."
                  : "Price multiplied by the quantity the guest selects."}
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={editing?.is_active ? "1" : "0"}
                onChange={e => setField("is_active", e.target.value === "1")}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>

          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-slate-600 rounded-xl hover:bg-slate-50 text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm disabled:opacity-60">
              {saving ? "Saving…" : editing?.id ? "Save Changes" : "Create Add-on"}
            </button>
          </div>
        </form>
      </Modal>

      <Toast message={toast} type={toastType} onClose={clearToast} />
    </div>
  );
}
