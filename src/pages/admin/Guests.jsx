import { useState } from "react";

export default function AdminGuests() {
  const [guests, setGuests] = useState([
    {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      phone: "+63 917 123 4567",
      status: "Active",
      totalBookings: 3,
      totalSpent: 15000,
      joinDate: "2023-06-15",
    },
    {
      id: 2,
      name: "Maria Garcia",
      email: "maria@example.com",
      phone: "+63 917 987 6543",
      status: "Active",
      totalBookings: 1,
      totalSpent: 5600,
      joinDate: "2024-01-10",
    },
    {
      id: 3,
      name: "Robert Lee",
      email: "robert@example.com",
      phone: "+63 917 555 1234",
      status: "Inactive",
      totalBookings: 2,
      totalSpent: 8900,
      joinDate: "2023-08-22",
    },
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedGuest, setSelectedGuest] = useState(null);

  const filteredGuests = guests.filter((g) => {
    const matches = g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.email.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = !filterStatus || g.status === filterStatus;
    return matches && statusMatch;
  });

  function toggleStatus(id) {
    setGuests((list) =>
      list.map((g) =>
        g.id === id ? { ...g, status: g.status === "Active" ? "Inactive" : "Active" } : g
      )
    );
  }

  const totalGuests = guests.length;
  const activeGuests = guests.filter((g) => g.status === "Active").length;
  const totalRevenue = guests.reduce((sum, g) => sum + g.totalSpent, 0);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Guest Records</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="bg-blue-100 rounded-full p-3">
                <i className="fas fa-users text-blue-600 text-xl"></i>
              </div>
              <div className="ml-4">
                <p className="text-gray-500 text-sm">Total Guests</p>
                <p className="text-2xl font-bold">{totalGuests}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="bg-green-100 rounded-full p-3">
                <i className="fas fa-user-check text-green-600 text-xl"></i>
              </div>
              <div className="ml-4">
                <p className="text-gray-500 text-sm">Active Guests</p>
                <p className="text-2xl font-bold">{activeGuests}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="bg-purple-100 rounded-full p-3">
                <i className="fas fa-peso-sign text-purple-600 text-xl"></i>
              </div>
              <div className="ml-4">
                <p className="text-gray-500 text-sm">Total Revenue</p>
                <p className="text-2xl font-bold">₱{totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 md:flex-none">
            <input
              type="text"
              placeholder="Search guests by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg border border-gray-300 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">Filter by Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Bookings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredGuests.map((guest) => (
                <tr key={guest.id}>
                  <td className="px-6 py-4 text-sm font-medium">{guest.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{guest.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{guest.phone}</td>
                  <td className="px-6 py-4 text-sm">{guest.totalBookings}</td>
                  <td className="px-6 py-4 text-sm font-medium">₱{guest.totalSpent.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        guest.status === "Active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {guest.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button
                      onClick={() => setSelectedGuest(guest)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <i className="fas fa-eye"></i>
                    </button>
                    <button
                      onClick={() => toggleStatus(guest.id)}
                      className="text-yellow-600 hover:text-yellow-900"
                    >
                      {guest.status === "Active" ? (
                        <i className="fas fa-ban"></i>
                      ) : (
                        <i className="fas fa-check"></i>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedGuest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Guest Details</h3>
              <button
                onClick={() => setSelectedGuest(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-gray-500 text-sm">Name</p>
                <p className="font-semibold">{selectedGuest.name}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Email</p>
                <p className="font-semibold">{selectedGuest.email}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Phone</p>
                <p className="font-semibold">{selectedGuest.phone}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Joined</p>
                <p className="font-semibold">{selectedGuest.joinDate}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Total Bookings</p>
                <p className="font-semibold">{selectedGuest.totalBookings}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Total Spent</p>
                <p className="font-semibold">₱{selectedGuest.totalSpent.toLocaleString()}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedGuest(null)}
              className="mt-6 w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
