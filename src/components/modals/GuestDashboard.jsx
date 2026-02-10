export default function GuestDashboard({ open, user, onClose, onLogout }) {
    if (!open) return null;
  
    return (
      <div className="fixed inset-0 z-50 bg-gray-100 overflow-y-auto">
        <div className="min-h-screen flex flex-col">
          <header className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏖️</span>
                <span className="text-xl font-bold text-blue-600">Aplaya Beach Resort</span>
              </div>
              <button onClick={onLogout} className="text-gray-700 hover:text-blue-600 text-sm font-medium">
                Logout
              </button>
            </div>
          </header>
  
          <main className="flex-grow">
            <div className="max-w-7xl mx-auto px-4 py-8">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-3xl font-bold text-gray-900">
                  Welcome Back, <span className="text-blue-700">{user?.name || "Guest"}</span>!
                </h1>
                <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900">
                  Close
                </button>
              </div>
  
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
                <div className="bg-blue-100 p-4 rounded-lg shadow-sm text-center">
                  <p className="text-sm font-medium text-gray-700">Upcoming Bookings</p>
                  <p className="text-2xl font-bold text-blue-700">1</p>
                </div>
                <div className="bg-green-100 p-4 rounded-lg shadow-sm text-center">
                  <p className="text-sm font-medium text-gray-700">Past Bookings</p>
                  <p className="text-2xl font-bold text-green-700">1</p>
                </div>
                <div className="bg-yellow-100 p-4 rounded-lg shadow-sm text-center">
                  <p className="text-sm font-medium text-gray-700">Pending Actions</p>
                  <p className="text-2xl font-bold text-yellow-700">0</p>
                </div>
              </div>
  
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Bookings</h2>
                  <div className="border rounded-lg p-4 shadow-sm">
                    <p className="font-bold text-gray-800">Deluxe Ocean View</p>
                    <p className="text-sm text-gray-600">Dec 15 - Dec 20</p>
                    <p className="text-sm text-gray-600">2 Guests</p>
                    <p className="text-sm text-gray-600">Booking ID: RES-2023-001</p>
                  </div>
                </div>
  
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Past Bookings</h2>
                  <div className="border rounded-lg p-4 shadow-sm">
                    <p className="font-bold text-gray-800">Beachfront Suite</p>
                    <p className="text-sm text-gray-600">Aug 10 - Aug 15</p>
                    <p className="text-sm text-gray-600">2 Guests</p>
                    <p className="text-sm text-gray-600">Booking ID: RES-2023-000</p>
                  </div>
                </div>
  
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Account Details</h2>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Full Name</p>
                      <p className="text-gray-900">{user?.name || "Guest"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Email</p>
                      <p className="text-gray-900">{user?.email || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Phone</p>
                      <p className="text-gray-900">{user?.phone || "-"}</p>
                    </div>
                  </div>
                </div>
  
                <div className="bg-white p-6 rounded-xl shadow-md lg:col-span-3">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Booking Calendar</h2>
                  <p className="text-gray-500 text-center">Calendar view coming soon...</p>
                </div>
  
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Local Weather</h2>
                  <div className="text-center">
                    <p className="text-4xl font-bold text-gray-800">32°C</p>
                    <p className="text-gray-600">Sunny</p>
                    <p className="text-sm text-gray-500 mt-2">Aplaya Beach, Today</p>
                  </div>
                </div>
  
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Account Security</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-700">Two-Factor Authentication</p>
                      <span className="text-green-600 text-sm">Enabled</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-700">Last Login</p>
                      <span className="text-gray-600 text-sm">2 hours ago</span>
                    </div>
                    <a href="#" className="text-sm text-blue-600 hover:underline">
                      Manage Security
                    </a>
                  </div>
                </div>
              </div>
  
              <div className="py-6 mt-8 text-center text-sm text-gray-600">
                © 2025 Aplaya Beach Resort. All rights reserved.
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }
  