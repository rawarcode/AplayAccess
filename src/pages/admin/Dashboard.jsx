import { useState } from "react";

export default function AdminDashboard() {
  const [stats] = useState({
    totalGuests: 1248,
    availableRooms: 42,
    monthlyTransactions: 57,
    foodOrders: 356,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Overview of resort operations and recent activity.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative p-3 bg-white/70 rounded-xl shadow-sm border border-slate-200 text-slate-600 hover:bg-white">
            <i className="fas fa-bell"></i>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white"></span>
          </button>
          <button className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl shadow-sm">
            <i className="fas fa-plus"></i>
            <span className="text-sm font-medium">New Report</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 text-white shadow-lg p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/15">
              <i className="fas fa-users text-xl"></i>
            </div>
            <div>
              <p className="text-sm opacity-80">Total Guests</p>
              <h3 className="text-3xl font-semibold tracking-tight">{stats.totalGuests.toLocaleString()}</h3>
            </div>
          </div>
          <div className="mt-4 text-xs opacity-80">+12% since last month</div>
        </div>

        <div className="rounded-2xl bg-linear-to-br from-cyan-500 to-sky-600 text-white shadow-lg p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/15">
              <i className="fas fa-bed text-xl"></i>
            </div>
            <div>
              <p className="text-sm opacity-80">Available Rooms</p>
              <h3 className="text-3xl font-semibold tracking-tight">{stats.availableRooms}</h3>
            </div>
          </div>
          <div className="mt-4 text-xs opacity-80">2 rooms added this week</div>
        </div>

        <div className="rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-lg p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/15">
              <i className="fas fa-money-bill-wave text-xl"></i>
            </div>
            <div>
              <p className="text-sm opacity-80">Transactions</p>
              <h3 className="text-3xl font-semibold tracking-tight">{stats.monthlyTransactions}</h3>
            </div>
          </div>
          <div className="mt-4 text-xs opacity-80">+4% compared to last month</div>
        </div>

        <div className="rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-lg p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/15">
              <i className="fas fa-utensils text-xl"></i>
            </div>
            <div>
              <p className="text-sm opacity-80">Food Orders</p>
              <h3 className="text-3xl font-semibold tracking-tight">{stats.foodOrders}</h3>
            </div>
          </div>
          <div className="mt-4 text-xs opacity-80">Most popular item: Grilled Fish</div>
        </div>
      </div>

      {/* Recent Bookings & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <div className="rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 bg-slate-50 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recent Bookings</h2>
              <p className="text-sm text-slate-500">Latest booking activity across the resort.</p>
            </div>
            <button className="text-sky-600 hover:text-sky-700 text-sm font-semibold">
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">Room</th>
                  <th className="px-6 py-3 text-left">Guest</th>
                  <th className="px-6 py-3 text-left">Dates</th>
                  <th className="px-6 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-4">Deluxe Suite #201</td>
                  <td className="px-6 py-4">John Smith</td>
                  <td className="px-6 py-4">Jun 15 - Jun 20</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                      Checked In
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-4">Beach Villa #105</td>
                  <td className="px-6 py-4">Sarah Johnson</td>
                  <td className="px-6 py-4">Jun 18 - Jun 25</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-semibold">
                      Upcoming
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-4">Family Bungalow #302</td>
                  <td className="px-6 py-4">Michael Brown</td>
                  <td className="px-6 py-4">Jun 10 - Jun 15</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                      Completed
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 bg-slate-50 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <p className="text-sm text-slate-500">Keep track of what’s happening right now.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex gap-4">
              <div className="shrink-0 p-3 rounded-2xl bg-sky-100 text-sky-700">
                <i className="fas fa-user-plus"></i>
              </div>
              <div>
                <p className="font-semibold text-slate-900">New user registered</p>
                <p className="text-sm text-slate-500">Robert Johnson created an account (2 hours ago)</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="shrink-0 p-3 rounded-2xl bg-emerald-100 text-emerald-700">
                <i className="fas fa-bed"></i>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Room booked</p>
                <p className="text-sm text-slate-500">Deluxe Suite #204 booked by Emily Davis (5 hours ago)</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="shrink-0 p-3 rounded-2xl bg-indigo-100 text-indigo-700">
                <i className="fas fa-utensils"></i>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Food order</p>
                <p className="text-sm text-slate-500">Order #245 placed from Beach Villa #103 (1 day ago)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
