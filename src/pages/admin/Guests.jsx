import { useState } from "react";

const initialGuests = [
  { id: 1, name: "John Doe",     email: "john@example.com",   phone: "+63 917 123 4567", status: "Active",   totalBookings: 3, totalSpent: 15000, joinDate: "2023-06-15" },
  { id: 2, name: "Maria Garcia", email: "maria@example.com",  phone: "+63 917 987 6543", status: "Active",   totalBookings: 1, totalSpent: 5600,  joinDate: "2024-01-10" },
  { id: 3, name: "Robert Lee",   email: "robert@example.com", phone: "+63 917 555 1234", status: "Inactive", totalBookings: 2, totalSpent: 8900,  joinDate: "2023-08-22" },
];

export default function AdminGuests() {
  const [guests,        setGuests]        = useState(initialGuests);
  const [searchTerm,    setSearchTerm]    = useState("");
  const [filterStatus,  setFilterStatus]  = useState("");
  const [selectedGuest, setSelectedGuest] = useState(null);

  const totalGuests   = guests.length;
  const activeGuests  = guests.filter((g) => g.status === "Active").length;
  const totalRevenue  = guests.reduce((sum, g) => sum + g.totalSpent, 0);

  const filtered = guests.filter((g) => {
    const matchSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        g.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = !filterStatus || g.status === filterStatus;
    return matchSearch && matchStatus;
  });

  function toggleStatus(id) {
    setGuests((list) =>
      list.map((g) => g.id === id ? { ...g, status: g.status === "Active" ? "Inactive" : "Active" } : g)
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
              <i className="fas fa-users text-xl"></i>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Guests</p>
              <h3 className="text-2xl font-bold">{totalGuests}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
              <i className="fas fa-user-check text-xl"></i>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Active Guests</p>
              <h3 className="text-2xl font-bold">{activeGuests}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
              <i className="fas fa-peso-sign text-xl"></i>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Revenue</p>
              <h3 className="text-2xl font-bold">₱{totalRevenue.toLocaleString()}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 bg-slate-50 border-b border-slate-200">
          <div>
            <p className="text-sm text-slate-600">Total guests</p>
            <p className="text-2xl font-semibold text-slate-900">{guests.length}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search guests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pr-10 pl-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Email</th>
                <th className="px-6 py-3 text-left">Phone</th>
                <th className="px-6 py-3 text-left">Bookings</th>
                <th className="px-6 py-3 text-left">Total Spent</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">No guests found.</td>
                </tr>
              ) : filtered.map((g) => (
                <tr key={g.id} className={g.status === "Active" ? "hover:bg-slate-50" : "bg-slate-50 opacity-75 hover:bg-slate-100"}>
                  <td className="px-6 py-4 font-medium text-slate-900">{g.name}</td>
                  <td className="px-6 py-4 text-slate-500">{g.email}</td>
                  <td className="px-6 py-4 text-slate-500">{g.phone}</td>
                  <td className="px-6 py-4">{g.totalBookings}</td>
                  <td className="px-6 py-4 font-medium">₱{g.totalSpent.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                      g.status === "Active"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}>
                      <span className={`h-2 w-2 rounded-full ${g.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {g.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 space-x-3">
                    <button
                      onClick={() => setSelectedGuest(g)}
                      className="text-sky-600 hover:text-sky-800 font-medium"
                    >
                      View
                    </button>
                    <button
                      onClick={() => toggleStatus(g.id)}
                      className={g.status === "Active" ? "text-rose-600 hover:text-rose-800 font-medium" : "text-emerald-600 hover:text-emerald-800 font-medium"}
                    >
                      {g.status === "Active" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Guest detail modal */}
      {selectedGuest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Guest Details</h3>
              <button onClick={() => setSelectedGuest(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Name</p>
                  <p className="font-semibold text-slate-900">{selectedGuest.name}</p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    selectedGuest.status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${selectedGuest.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                    {selectedGuest.status}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500">Email</p>
                  <p className="font-semibold text-slate-900">{selectedGuest.email}</p>
                </div>
                <div>
                  <p className="text-slate-500">Phone</p>
                  <p className="font-semibold text-slate-900">{selectedGuest.phone}</p>
                </div>
                <div>
                  <p className="text-slate-500">Joined</p>
                  <p className="font-semibold text-slate-900">{selectedGuest.joinDate}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total Bookings</p>
                  <p className="font-semibold text-slate-900">{selectedGuest.totalBookings}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total Spent</p>
                  <p className="font-semibold text-slate-900">₱{selectedGuest.totalSpent.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end">
              <button
                onClick={() => setSelectedGuest(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
