import { useState } from "react";

export default function AdminDashboard() {
  const [stats] = useState({
    totalGuests:         1248,
    availableRooms:      42,
    monthlyTransactions: 57,
    foodOrders:          356,
  });

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of resort operations and recent activity.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
              <i className="fas fa-users text-xl"></i>
            </div>
            <div>
              <p className="text-gray-500">Total Guests</p>
              <h3 className="text-2xl font-bold">{stats.totalGuests.toLocaleString()}</h3>
              <p className="text-sm text-green-500">+12% since last month</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
              <i className="fas fa-bed text-xl"></i>
            </div>
            <div>
              <p className="text-gray-500">Available Rooms</p>
              <h3 className="text-2xl font-bold">{stats.availableRooms}</h3>
              <p className="text-sm text-green-500">2 rooms added this week</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600 mr-4">
              <i className="fas fa-money-bill-wave text-xl"></i>
            </div>
            <div>
              <p className="text-gray-500">Transactions</p>
              <h3 className="text-2xl font-bold">{stats.monthlyTransactions}</h3>
              <p className="text-sm text-green-500">+4% from last month</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
              <i className="fas fa-utensils text-xl"></i>
            </div>
            <div>
              <p className="text-gray-500">Food Orders</p>
              <h3 className="text-2xl font-bold">{stats.foodOrders}</h3>
              <p className="text-sm text-gray-500">Top: Grilled Fish</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bookings & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Bookings */}
        <div className="bg-white rounded-lg shadow">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Recent Bookings</h2>
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">View all</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-gray-700">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">Room</th>
                  <th className="px-6 py-3 text-left">Guest</th>
                  <th className="px-6 py-3 text-left">Dates</th>
                  <th className="px-6 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4">Deluxe Suite #201</td>
                  <td className="px-6 py-4">John Smith</td>
                  <td className="px-6 py-4">Jun 15 - Jun 20</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">Checked In</span>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4">Beach Villa #105</td>
                  <td className="px-6 py-4">Sarah Johnson</td>
                  <td className="px-6 py-4">Jun 18 - Jun 25</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">Upcoming</span>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4">Family Bungalow #302</td>
                  <td className="px-6 py-4">Michael Brown</td>
                  <td className="px-6 py-4">Jun 10 - Jun 15</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">Completed</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Recent Activity</h2>
            <p className="text-sm text-gray-500">Keep track of what's happening right now.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600 shrink-0">
                <i className="fas fa-user-plus"></i>
              </div>
              <div>
                <p className="font-medium text-gray-900">New user registered</p>
                <p className="text-sm text-gray-500">Robert Johnson created an account (2 hours ago)</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-green-100 text-green-600 shrink-0">
                <i className="fas fa-bed"></i>
              </div>
              <div>
                <p className="font-medium text-gray-900">Room booked</p>
                <p className="text-sm text-gray-500">Deluxe Suite #204 booked by Emily Davis (5 hours ago)</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600 shrink-0">
                <i className="fas fa-utensils"></i>
              </div>
              <div>
                <p className="font-medium text-gray-900">Food order</p>
                <p className="text-sm text-gray-500">Order #245 placed from Beach Villa #103 (1 day ago)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
