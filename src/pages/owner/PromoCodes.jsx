import { useEffect, useState } from "react";
import { getPromoCodes, createPromoCode, updatePromoCode, deletePromoCode } from "../../lib/adminApi.js";

const EMPTY_FORM = {
  code: "",
  type: "percentage",
  value: "",
  max_uses: "",
  expires_at: "",
};

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const rand = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `APLAYA-${rand}`;
}

function Badge({ active }) {
  return active ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Inactive</span>
  );
}

export default function PromoCodes() {
  const [codes,      setCodes]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [search,     setSearch]     = useState("");
  const [toast,      setToast]      = useState(null); // { msg, type }

  const [createOpen,  setCreateOpen]  = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);  // confirmation step
  const [editTarget,  setEditTarget]  = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form,      setForm]      = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving,    setSaving]    = useState(false);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await getPromoCodes();
      setCodes(res.data.data);
    } catch {
      setError("Failed to load promo codes.");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, code: generateCode() });
    setFormError("");
    setCreateOpen(true);
  }

  function openEdit(code) {
    setEditTarget(code);
    setForm({
      code:       code.code,
      type:       code.type,
      value:      String(code.value),
      max_uses:   code.max_uses ? String(code.max_uses) : "",
      expires_at: code.expires_at ? code.expires_at.substring(0, 10) : "",
    });
    setFormError("");
  }

  // Step 1 — validate form then show confirmation
  function handleSubmitCreate(e) {
    e.preventDefault();
    setFormError("");
    if (!form.code.trim()) { setFormError("Code is required."); return; }
    if (!form.value)        { setFormError("Discount value is required."); return; }
    setConfirmOpen(true);
  }

  // Step 2 — confirmed, call API
  async function handleConfirmCreate() {
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        code:       form.code.trim().toUpperCase(),
        type:       form.type,
        value:      parseFloat(form.value),
        max_uses:   form.max_uses ? parseInt(form.max_uses) : null,
        expires_at: form.expires_at || null,
      };
      await createPromoCode(payload);
      setConfirmOpen(false);
      setCreateOpen(false);
      load();
    } catch (err) {
      const msg =
        err?.response?.data?.errors?.code?.[0] ||
        err?.response?.data?.message ||
        "Failed to create promo code.";
      setFormError(msg);
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitEdit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        max_uses:   form.max_uses ? parseInt(form.max_uses) : null,
        expires_at: form.expires_at || null,
      };
      await updatePromoCode(editTarget.id, payload);
      setEditTarget(null);
      load();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Failed to update promo code.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(code) {
    try {
      await updatePromoCode(code.id, { is_active: !code.is_active });
      setCodes(prev => prev.map(c => c.id === code.id ? { ...c, is_active: !c.is_active } : c));
      showToast(code.is_active ? "Promo code deactivated." : "Promo code activated.");
    } catch {
      showToast("Failed to update status.", "error");
    }
  }

  async function handleDelete() {
    try {
      await deletePromoCode(deleteTarget.id);
      setDeleteTarget(null);
      load();
      showToast("Promo code deleted.");
    } catch {
      showToast("Failed to delete promo code.", "error");
    }
  }

  const formatDiscount = (code) =>
    code.type === "percentage" ? `${code.value}%` : `₱${Number(code.value).toLocaleString()}`;

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

  const isExpired = (code) => code.expires_at && new Date(code.expires_at) < new Date();

  const filtered = codes.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-500 mt-1">Create and manage discount codes for guests</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              placeholder="Search code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a8a] focus:border-[#1e3a8a] w-44"
            />
          </div>
          <button
            onClick={openCreate}
            className="bg-[#1e3a8a] hover:bg-[#152c6e] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-plus"></i> New Promo Code
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <i className="fas fa-spinner fa-spin text-2xl mb-3 block"></i>Loading promo codes...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">{error}</div>
        ) : codes.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <i className="fas fa-tag text-3xl mb-3 block text-gray-300"></i>
            No promo codes yet. Create one to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Code</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Discount</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Expires</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Uses</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">
                      No promo codes match your search.
                    </td>
                  </tr>
                ) : filtered.map(code => (
                  <tr key={code.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <span className="font-mono font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                        {code.code}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-[#1e3a8a]">{formatDiscount(code)}</td>
                    <td className="px-5 py-3">
                      <span className={isExpired(code) ? "text-red-500" : "text-gray-600"}>
                        {formatDate(code.expires_at)}
                        {isExpired(code) && <span className="ml-1 text-xs">(expired)</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {code.uses_count}{code.max_uses ? ` / ${code.max_uses}` : ""}
                    </td>
                    <td className="px-5 py-3">
                      <Badge active={code.is_active && !isExpired(code)} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {/* Toggle active */}
                        <button
                          onClick={() => toggleActive(code)}
                          title={code.is_active ? "Deactivate" : "Activate"}
                          className={`text-xs px-2 py-1 rounded border font-medium transition ${
                            code.is_active
                              ? "border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                              : "border-green-300 text-green-700 hover:bg-green-50"
                          }`}
                        >
                          {code.is_active ? "Deactivate" : "Activate"}
                        </button>
                        {/* Edit */}
                        <button
                          onClick={() => openEdit(code)}
                          className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium"
                        >
                          Edit
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => setDeleteTarget(code)}
                          className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Modal ── */}
      {createOpen && (
        <Modal title="New Promo Code" onClose={() => setCreateOpen(false)}>
          <form onSubmit={handleSubmitCreate} className="space-y-4">
            {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{formError}</p>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <div className="flex gap-2">
                <input
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
                  placeholder="APLAYA-XXXX"
                  required
                />
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, code: generateCode() }))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50"
                  title="Auto-generate code"
                >
                  <i className="fas fa-dice"></i>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
              <div className="flex gap-3">
                {["percentage", "fixed"].map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value={t}
                      checked={form.type === t}
                      onChange={() => setForm(p => ({ ...p, type: t }))}
                      className="accent-[#1e3a8a]"
                    />
                    <span className="text-sm capitalize">{t === "percentage" ? "Percentage (%)" : "Fixed Amount (₱)"}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {form.type === "percentage" ? "Discount %" : "Discount Amount (₱)"}
              </label>
              <input
                type="number"
                min="0"
                max={form.type === "percentage" ? 100 : undefined}
                step="any"
                value={form.value}
                onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#1e3a8a] focus:border-[#1e3a8a] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder={form.type === "percentage" ? "e.g. 10" : "e.g. 500"}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="number"
                  min="1"
                  value={form.max_uses}
                  onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="date"
                  value={form.expires_at}
                  min={new Date().toISOString().substring(0, 10)}
                  onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreateOpen(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit"
                className="px-4 py-2 text-sm bg-[#1e3a8a] hover:bg-[#152c6e] text-white rounded-md font-medium flex items-center gap-2">
                <i className="fas fa-eye"></i> Review & Confirm
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Confirmation Modal ── */}
      {confirmOpen && (
        <Modal title="Confirm Promo Code" onClose={() => setConfirmOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Please review the details before creating this promo code.</p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-2.5 text-gray-500 font-medium w-36">Code</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-gray-900 bg-yellow-50">
                      {form.code.trim().toUpperCase()}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-gray-500 font-medium">Discount</td>
                    <td className="px-4 py-2.5 font-semibold text-[#1e3a8a]">
                      {form.type === "percentage"
                        ? `${form.value}% off`
                        : `₱${Number(form.value).toLocaleString()} off`}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-gray-500 font-medium">Type</td>
                    <td className="px-4 py-2.5 text-gray-700 capitalize">{form.type}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-gray-500 font-medium">Max Uses</td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {form.max_uses ? form.max_uses : <span className="text-gray-400 italic">Unlimited</span>}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-gray-500 font-medium">Expiry Date</td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {form.expires_at
                        ? new Date(form.expires_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
                        : <span className="text-gray-400 italic">No expiry</span>}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-gray-500 font-medium">Status</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active on creation
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Back to Edit
              </button>
              <button onClick={handleConfirmCreate} disabled={saving}
                className="px-4 py-2 text-sm bg-[#1e3a8a] hover:bg-[#152c6e] disabled:opacity-60 text-white rounded-md font-medium flex items-center gap-2">
                {saving
                  ? <><i className="fas fa-spinner fa-spin"></i> Creating...</>
                  : <><i className="fas fa-check"></i> Confirm & Create</>}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        <Modal title={`Edit ${editTarget.code}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{formError}</p>}

            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Code:</span> <span className="font-mono">{editTarget.code}</span></p>
              <p><span className="font-medium">Discount:</span> {formatDiscount(editTarget)}</p>
              <p className="text-xs text-gray-400">Code and discount type/value cannot be changed after creation.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="number"
                  min="1"
                  value={form.max_uses}
                  onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#1e3a8a]"
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#1e3a8a]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-sm bg-[#1e3a8a] hover:bg-[#152c6e] disabled:opacity-60 text-white rounded-md font-medium">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <Modal title="Delete Promo Code" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to delete <span className="font-mono font-semibold">{deleteTarget.code}</span>?
            This cannot be undone. Bookings that already used this code will keep their discount.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleDelete}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md font-medium">
              Delete
            </button>
          </div>
        </Modal>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white
          ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          <i className={`fas ${toast.type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check'}`}></i>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="absolute inset-0 bg-gray-500/75" />
        <div className="relative bg-white w-full max-w-md rounded-xl shadow-xl">
          <div className="flex items-center justify-between p-5 border-b">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
