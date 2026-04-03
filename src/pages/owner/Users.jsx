import { useState, useEffect, useCallback } from "react";
import Modal from "../../components/modals/Modal.jsx";
import AlertModal from "../../components/modals/AlertModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getAdminUsers, createAdminUser, updateAdminUser } from "../../lib/adminApi";

const BLANK = { name: "", email: "", phone: "", role: "front_desk", password: "", is_active: true };

const ROLE_LABELS = { admin: "Admin", front_desk: "Front Desk", owner: "Owner" };
const ROLE_COLORS = {
  admin:      "bg-purple-100 text-purple-800",
  front_desk: "bg-sky-100 text-sky-800",
  owner:      "bg-amber-100 text-amber-800",
};

export default function OwnerUsers() {
  const { user: currentUser } = useAuth();

  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [viewUser,   setViewUser]   = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [alert,      setAlert]      = useState({ open: false, type: "info", title: "", message: "" });

  const load = useCallback(() => {
    setLoading(true);
    getAdminUsers()
      .then(r => setUsers(r.data.data))
      .catch(() => showAlert("error", "Error", "Failed to load users."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function showAlert(type, title, message) {
    setAlert({ open: true, type, title, message });
  }

  function openNew()   { setEditing({ ...BLANK }); setModalOpen(true); }
  function openEdit(u) { setEditing({ ...u, password: "" }); setViewUser(null); setModalOpen(true); }
  function setField(k, v) { setEditing(x => ({ ...x, [k]: v })); }

  async function saveUser(e) {
    e.preventDefault();
    if (!editing.name || !editing.email) {
      showAlert("error", "Error", "Name and email are required.");
      return;
    }
    if (!editing.id && !editing.password) {
      showAlert("error", "Error", "Password is required for new users.");
      return;
    }
    setSaving(true);
    const payload = {
      name:      editing.name,
      email:     editing.email,
      phone:     editing.phone  || undefined,
      role:      editing.role,
      is_active: editing.is_active,
      ...(editing.password ? { password: editing.password } : {}),
    };
    try {
      if (editing.id) {
        await updateAdminUser(editing.id, payload);
      } else {
        await createAdminUser(payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      showAlert("error", "Error", err?.response?.data?.message || "Failed to save user.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u) {
    const msg = u.is_active
      ? `Deactivate ${u.name}? They will lose access until reactivated.`
      : `Activate ${u.name}?`;
    if (!window.confirm(msg)) return;
    try {
      await updateAdminUser(u.id, { is_active: !u.is_active });
      setUsers(list => list.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
      if (viewUser?.id === u.id) setViewUser(v => ({ ...v, is_active: !v.is_active }));
    } catch (err) {
      showAlert("error", "Error", err?.response?.data?.message || "Failed to update user status.");
    }
  }

  // Owner can toggle anyone except themselves
  function canToggleActive(u) {
    return u.id !== currentUser?.id;
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 mt-1">Manage staff accounts, roles, and access.</p>
        </div>
        <button onClick={openNew}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-xl shadow-sm">
          <i className="fas fa-user-plus"></i>
          <span className="text-sm font-medium">Add User</span>
        </button>
      </div>

      <div className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 bg-slate-50 border-b border-slate-200">
          <div>
            <p className="text-sm text-slate-600">Total users</p>
            <p className="text-2xl font-semibold text-slate-900">{users.length}</p>
          </div>
          <div className="relative w-full md:w-72">
            <input type="text" placeholder="Search users…" value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
            />
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <p className="px-6 py-10 text-center text-slate-400"><i className="fas fa-spinner fa-spin mr-2"></i>Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-slate-400">No users found.</p>
          ) : (
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Email</th>
                  <th className="px-6 py-3 text-left">Role</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map(u => (
                  <tr
                    key={u.id}
                    onClick={() => setViewUser(u)}
                    className={`cursor-pointer ${u.is_active ? "hover:bg-slate-50" : "bg-slate-50 opacity-75 hover:bg-slate-100"}`}
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {u.name}
                      {u.id === currentUser?.id && (
                        <span className="ml-2 text-xs text-slate-400">(you)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] || "bg-slate-100 text-slate-700"}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                        u.is_active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                        <span className={`h-2 w-2 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {u.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEdit(u)} className="text-sky-600 hover:text-sky-800 font-medium">
                          Edit
                        </button>
                        {canToggleActive(u) && (
                          <button
                            onClick={() => toggleActive(u)}
                            className={u.is_active ? "text-amber-600 hover:text-amber-800 font-medium" : "text-emerald-600 hover:text-emerald-800 font-medium"}
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* View User Modal */}
      {viewUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">User Details</h3>
              <button onClick={() => setViewUser(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="h-12 w-12 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center text-lg font-semibold">
                  {viewUser.name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{viewUser.name}</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[viewUser.role] || "bg-slate-100 text-slate-700"}`}>
                    {ROLE_LABELS[viewUser.role] || viewUser.role}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Email",   viewUser.email],
                  ["Phone",   viewUser.phone || "—"],
                  ["Status",  viewUser.is_active ? "Active" : "Disabled"],
                  ["Joined",  viewUser.created_at ? new Date(viewUser.created_at).toLocaleDateString("en-PH") : "—"],
                ].map(([label, val]) => (
                  <div key={label} className={label === "Email" ? "col-span-2" : ""}>
                    <p className="text-slate-500 text-xs">{label}</p>
                    <p className="font-semibold text-slate-900">{val}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-2">
              <button onClick={() => setViewUser(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50">
                Close
              </button>
              <button onClick={() => openEdit(viewUser)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm">
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveUser} className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{editing?.id ? "Edit User" : "Add New User"}</h2>
              <p className="text-sm text-slate-500">{editing?.id ? "Update details, role, or reset password." : "Create a new staff account."}</p>
            </div>
            <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input required value={editing?.name || ""} onChange={e => setField("name", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input required type="email" value={editing?.email || ""} onChange={e => setField("email", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input value={editing?.phone || ""} onChange={e => setField("phone", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
              <select value={editing?.role || "front_desk"} onChange={e => setField("role", e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm">
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="front_desk">Front Desk</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password {editing?.id ? <span className="text-slate-400 font-normal">(leave blank to keep current)</span> : "*"}
              </label>
              <input type="password" value={editing?.password || ""} onChange={e => setField("password", e.target.value)}
                required={!editing?.id} minLength={8}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-slate-600 rounded-xl hover:bg-slate-50 text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm disabled:opacity-60">
              {saving ? "Saving…" : "Save User"}
            </button>
          </div>
        </form>
      </Modal>

      <AlertModal open={alert.open} onClose={() => setAlert(a => ({ ...a, open: false }))}
        type={alert.type} title={alert.title} message={alert.message} />
    </div>
  );
}
