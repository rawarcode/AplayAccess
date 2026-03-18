import { useState } from "react";
import Modal from "../../components/modals/Modal.jsx";
import AlertModal from "../../components/modals/AlertModal.jsx";

const initialUsers = [
  { id: 1, name: "Alice", email: "alice@example.com", role: "admin", isActive: true },
  { id: 2, name: "Bob", email: "bob@example.com", role: "staff", isActive: true },
];

export default function AdminUsers() {
  const [users, setUsers] = useState(initialUsers);
  const [editing, setEditing] = useState(null); // user object being edited
  const [modalOpen, setModalOpen] = useState(false);
  const [alert, setAlert] = useState({ open: false, type: "info", title: "", message: "" });

  function closeAlert() {
    setAlert((a) => ({ ...a, open: false }));
  }

  function openNew() {
    setEditing({ name: "", email: "", role: "staff", isActive: true });
    setModalOpen(true);
  }

  function openEdit(user) {
    setEditing({ ...user });
    setModalOpen(true);
  }

  function saveUser(e) {
    e.preventDefault();
    if (!editing.name || !editing.email) {
      setAlert({ open: true, type: "error", title: "Error", message: "Name and email are required" });
      return;
    }

    setUsers((list) => {
      if (editing.id) {
        return list.map((u) => (u.id === editing.id ? editing : u));
      }
      const nextId = Math.max(0, ...list.map((u) => u.id)) + 1;
      return [...list, { ...editing, id: nextId }];
    });
    setModalOpen(false);
  }

  function toggleActive(id) {
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, isActive: !u.isActive } : u)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage users, roles, and access for the admin portal.</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
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
            <input
              type="text"
              placeholder="Search users..."
              value={""}
              onChange={() => {}}
              className="w-full pr-10 pl-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          </div>
        </div>

        <div className="overflow-x-auto">
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
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={
                    u.isActive
                      ? "hover:bg-slate-50"
                      : "bg-slate-50 italic opacity-90 hover:bg-slate-100"
                  }
                >
                  <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                  <td className="px-6 py-4 text-slate-600">{u.email}</td>
                  <td className="px-6 py-4 capitalize">{u.role}</td>
                  <td className="px-6 py-4">
                    <span
                      className={
                        u.isActive
                          ? "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold"
                          : "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-semibold"
                      }
                    >
                      <span
                        className={
                          u.isActive
                            ? "h-2.5 w-2.5 rounded-full bg-emerald-500"
                            : "h-2.5 w-2.5 rounded-full bg-rose-500"
                        }
                      />
                      {u.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-6 py-4 space-x-3">
                    <button
                      onClick={() => openEdit(u)}
                      className="text-sky-600 hover:text-sky-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (u.isActive) {
                          const confirmed = window.confirm(
                            "Deactivate this user? They will lose access until reactivated."
                          );
                          if (!confirmed) return;
                        }
                        toggleActive(u.id);
                      }}
                      className={
                        u.isActive
                          ? "text-rose-600 hover:text-rose-800 font-medium"
                          : "text-emerald-600 hover:text-emerald-800 font-medium"
                      }
                    >
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* modal form */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveUser} className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {editing?.id ? "Edit User" : "Add New User"}
              </h2>
              <p className="text-sm text-slate-500">
                {editing?.id
                  ? "Update the user details and role."
                  : "Create a new staff or admin account."}
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
                onChange={(e) => setEditing((u) => ({ ...u, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.email || ""}
                onChange={(e) => setEditing((u) => ({ ...u, email: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={editing?.role || "staff"}
                onChange={(e) => setEditing((u) => ({ ...u, role: e.target.value }))}
              >
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div className="flex flex-col sm:flex-row items-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl shadow-sm"
              >
                Save User
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <AlertModal
        open={alert.open}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
    </div>
  );
}
