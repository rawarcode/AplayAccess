import { useState, useEffect } from "react";
import { getAdminGuests } from "../../lib/adminApi";

export default function AdminGuests() {
  const [guests,        setGuests]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [searchTerm,    setSearchTerm]    = useState("");
  const [filterStatus,  setFilterStatus]  = useState("");
  const [selectedGuest, setSelectedGuest] = useState(null);

  useEffect(() => {
    getAdminGuests()
      .then(r => setGuests(r.data.data))
      .catch(() => setError("Failed to load guests."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = guests.filter(g => {
    const matchSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        g.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = !filterStatus ||
      (filterStatus === "Active"   && g.is_active) ||
      (filterStatus === "Inactive" && !g.is_active);
    return matchSearch && matchStatus;
  });

  const totalRevenue = guests.reduce((s, g) => s + g.total_spent, 0);
  const activeCount  = guests.filter(g => g.is_active).length;

  return (
    <div className="p-6 space-y-6">

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Total Guests",   value: guests.length,                      icon: "fa-users",       color: "bg-blue-100 text-blue-600" },
          { label: "Active Guests",  value: activeCount,                        icon: "fa-user-check",  color: "bg-green-100 text-green-600" },
          { label: "Total Revenue",  value: `₱${totalRevenue.toLocaleString()}`,icon: "fa-peso-sign",   color: "bg-purple-100 text-purple-600" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`p-3 rounded-full mr-4 ${c.color}`}><i className={`fas ${c.icon} text-xl`}></i></div>
              <div>
                <p className="text-gray-500 text-sm">{c.label}</p>
                <h3 className="text-2xl font-bold">{c.value}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4">{error}</div>}

      <div className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 bg-slate-50 border-b border-slate-200">
          <div>
            <p className="text-sm text-slate-600">Total guests</p>
            <p className="text-2xl font-semibold text-slate-900">{guests.length}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <input type="text" placeholder="Search guests…" value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pr-10 pl-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <p className="px-6 py-10 text-center text-slate-400"><i className="fas fa-spinner fa-spin mr-2"></i>Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-slate-400">No guests found.</p>
          ) : (
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Email</th>
                  <th className="px-6 py-3 text-left">Phone</th>
                  <th className="px-6 py-3 text-left">Bookings</th>
                  <th className="px-6 py-3 text-left">Total Spent</th>
                  <th className="px-6 py-3 text-left">Joined</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map(g => (
                  <tr
                    key={g.id}
                    onClick={() => setSelectedGuest(g)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">{g.name}</td>
                    <td className="px-6 py-4 text-slate-500">{g.email}</td>
                    <td className="px-6 py-4 text-slate-500">{g.phone}</td>
                    <td className="px-6 py-4">{g.total_bookings}</td>
                    <td className="px-6 py-4 font-medium">₱{Number(g.total_spent).toLocaleString()}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{g.joined}</td>
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setSelectedGuest(g)} className="text-sky-600 hover:text-sky-800 font-medium text-sm">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Guest detail modal */}
      {selectedGuest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Guest Details</h3>
              <button onClick={() => setSelectedGuest(null)} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Name",           selectedGuest.name],
                  ["Email",          selectedGuest.email],
                  ["Phone",          selectedGuest.phone],
                  ["Joined",         selectedGuest.joined],
                  ["Total Bookings", selectedGuest.total_bookings],
                  ["Total Spent",    `₱${Number(selectedGuest.total_spent).toLocaleString()}`],
                ].map(([label, val]) => (
                  <div key={label} className={label === "Email" ? "col-span-2" : ""}>
                    <p className="text-slate-500">{label}</p>
                    <p className="font-semibold text-slate-900">{val}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end">
              <button onClick={() => setSelectedGuest(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
