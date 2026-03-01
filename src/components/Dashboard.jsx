import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Layout/Sidebar';
import Chart from 'chart.js/auto';

const Dashboard = () => {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState({
    accountSettings: false,
    allNotifications: false
  });
  
  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    // Handle click outside for dropdowns
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Initialize chart
    if (chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      
      chartInstance.current = new Chart(chartRef.current, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Occupancy %',
            data: [65, 59, 80, 81, 56, 95, 100],
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { callback: (value) => value + '%' }
            }
          }
        }
      });
    }
  }, []);

  const openModal = (modalName) => {
    setModalOpen({ ...modalOpen, [modalName]: true });
    setProfileOpen(false);
  };

  const closeModal = (modalName) => {
    setModalOpen({ ...modalOpen, [modalName]: false });
  };

  const saveAccountSettings = () => {
    const firstName = document.getElementById('firstName')?.value;
    const lastName = document.getElementById('lastName')?.value;
    const email = document.getElementById('userEmail')?.value;
    
    if (!firstName || !lastName || !email) {
      alert('Please fill in all required fields');
      return;
    }
    
    alert('Account settings saved successfully!');
    closeModal('accountSettings');
  };

  const confirmLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      window.location.href = 'login.html';
    }
  };

  return (
    <Sidebar>
      {/* Account Settings Modal */}
      {modalOpen.accountSettings && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-8 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Account Settings</h3>
              <button onClick={() => closeModal('accountSettings')} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="mb-6">
              <h4 className="font-medium mb-3 text-gray-700">Profile Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" id="firstName" defaultValue="Sarah" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" id="lastName" defaultValue="Johnson" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" id="userEmail" defaultValue="sarah.johnson@aplayaresort.com" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" id="userPhone" defaultValue="+639123456789" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <input type="text" id="userPosition" defaultValue="Resort Owner" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" readOnly />
              </div>
            </div>

            <div className="mb-6">
              <h4 className="font-medium mb-3 text-gray-700">Change Password</h4>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input type="password" id="currentPassword" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" id="newPassword" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input type="password" id="confirmPassword" className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button onClick={() => closeModal('accountSettings')} className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={saveAccountSettings} className="px-4 py-2 border rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Notifications Modal */}
      {modalOpen.allNotifications && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-6 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">All Notifications</h3>
              <button onClick={() => closeModal('allNotifications')} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="overflow-y-auto max-h-96">
              <div className="space-y-3">
                {/* Today's Notifications */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">Today</h4>
                  <div className="space-y-2">
                    <div className="notification-item unread p-3 bg-blue-50 border-b">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-blue-600">New Reservation</div>
                        <span className="text-xs text-gray-500">2 min ago</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Room 305 booked by Robert Chen for 3 nights</p>
                      <div className="flex mt-2 space-x-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">New</span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Confirmed</span>
                      </div>
                    </div>

                    <div className="notification-item unread p-3 bg-blue-50 border-b">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-blue-600">Check-out Reminder</div>
                        <span className="text-xs text-gray-500">1 hour ago</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Room 205 checking out today at 11 AM</p>
                      <div className="mt-2">
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Pending</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Yesterday's Notifications */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">Yesterday</h4>
                  <div className="space-y-2">
                    <div className="notification-item p-3 border-b">
                      <div className="flex justify-between items-start">
                        <div className="font-medium">Maintenance Request</div>
                        <span className="text-xs text-gray-500">3 hours ago</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Pool area needs cleaning - assigned to staff</p>
                    </div>

                    <div className="notification-item p-3 border-b">
                      <div className="flex justify-between items-start">
                        <div className="font-medium">Payment Received</div>
                        <span className="text-xs text-gray-500">Yesterday</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Payment of ₱864.08 received for Room 305</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button onClick={() => closeModal('allNotifications')} className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <div className="flex items-center space-x-4">
            {/* Notification Button */}
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="relative p-2 text-gray-600 hover:text-gray-800 focus:outline-none"
              >
                <i className="fas fa-bell text-xl"></i>
                <span className="notification-badge absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
              </button>

              {/* Notification Dropdown */}
              {notificationOpen && (
                <div className="notification-dropdown absolute right-0 top-14 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium text-gray-900">Notifications</h3>
                      <button className="text-blue-600 text-sm hover:text-blue-800">Mark all as read</button>
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-96">
                    <div className="notification-item unread p-3 bg-blue-50 border-b">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-blue-600">New Reservation</div>
                        <span className="text-xs text-gray-500">2 min ago</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Room 305 booked by Robert Chen for 3 nights</p>
                    </div>
                    <div className="notification-item unread p-3 bg-blue-50 border-b">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-blue-600">Check-out Reminder</div>
                        <span className="text-xs text-gray-500">1 hour ago</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Room 205 checking out today at 11 AM</p>
                    </div>
                    <div className="notification-item p-3 border-b">
                      <div className="flex justify-between items-start">
                        <div className="font-medium">Maintenance Request</div>
                        <span className="text-xs text-gray-500">3 hours ago</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Pool area needs cleaning - assigned to staff</p>
                    </div>
                  </div>
                  <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg text-center">
                    <button 
                      onClick={() => openModal('allNotifications')}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View All Notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button 
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center text-gray-600 hover:text-gray-800 focus:outline-none"
              >
                <img src="https://randomuser.me/api/portraits/women/44.jpg" alt="User" className="h-8 w-8 rounded-full mr-2" />
                <span className="hidden md:inline">Sarah</span>
                <i className="fas fa-chevron-down ml-1 text-sm"></i>
              </button>

              {/* Profile Dropdown Menu */}
              {profileOpen && (
                <div className="profile-dropdown absolute right-0 top-14 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="profile-dropdown-item p-3 flex items-center border-b">
                    <img src="https://randomuser.me/api/portraits/women/44.jpg" alt="User" className="h-10 w-10 rounded-full mr-3" />
                    <div>
                      <p className="font-medium">Sarah Johnson</p>
                      <p className="text-xs text-gray-500">Resort Owner</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => openModal('accountSettings')}
                    className="profile-dropdown-item p-3 flex items-center w-full text-left hover:bg-gray-50 border-b"
                  >
                    <i className="fas fa-user-cog mr-3 text-gray-500"></i>
                    <span>Account Settings</span>
                  </button>
                  <button 
                    onClick={confirmLogout}
                    className="profile-dropdown-item p-3 flex items-center w-full text-left text-red-500 hover:bg-gray-50"
                  >
                    <i className="fas fa-sign-out-alt mr-3"></i>
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
                <i className="fas fa-bed text-xl"></i>
              </div>
              <div>
                <p className="text-gray-500">Occupied Rooms/Cottages</p>
                <h3 className="text-2xl font-bold">42</h3>
                <p className="text-sm text-green-500">+3 from yesterday</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
                <i className="fas fa-calendar-check text-xl"></i>
              </div>
              <div>
                <p className="text-gray-500">Check-ins Today</p>
                <h3 className="text-2xl font-bold">15</h3>
                <p className="text-sm text-green-500">+2 from expected</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100 text-yellow-600 mr-4">
                <i className="fas fa-door-open text-xl"></i>
              </div>
              <div>
                <p className="text-gray-500">Check-outs Today</p>
                <h3 className="text-2xl font-bold">12</h3>
                <p className="text-sm text-red-500">-1 from expected</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
                <i className="fas fa-exchange-alt text-xl"></i>
              </div>
              <div>
                <p className="text-gray-500">Today's Guest Transactions</p>
                <h3 className="text-2xl font-bold">27</h3>
                <p className="text-sm text-green-500">+5 from yesterday</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts and Upcoming Check-ins */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Daily Occupancy</h2>
              <select className="border rounded px-3 py-1 text-sm">
                <option>This Week</option>
                <option>Last Week</option>
                <option>This Month</option>
              </select>
            </div>
            <div className="h-64">
              <canvas ref={chartRef}></canvas>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Upcoming Check-ins</h2>
            <div className="space-y-4">
              <div className="flex items-start border-b pb-3">
                <div className="bg-blue-100 text-blue-800 rounded-full h-8 w-8 flex items-center justify-center mr-3 mt-1">
                  <i className="fas fa-user text-sm"></i>
                </div>
                <div>
                  <p className="font-medium">Robert Chen</p>
                  <p className="text-sm text-gray-600">Room 305 - Deluxe Ocean View</p>
                  <p className="text-xs text-blue-600">Arriving at 2:00 PM</p>
                </div>
              </div>
              <div className="flex items-start border-b pb-3">
                <div className="bg-blue-100 text-blue-800 rounded-full h-8 w-8 flex items-center justify-center mr-3 mt-1">
                  <i className="fas fa-user text-sm"></i>
                </div>
                <div>
                  <p className="font-medium">Maria Garcia</p>
                  <p className="text-sm text-gray-600">Room 412 - Family Suite</p>
                  <p className="text-xs text-blue-600">Arriving at 3:30 PM</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="bg-blue-100 text-blue-800 rounded-full h-8 w-8 flex items-center justify-center mr-3 mt-1">
                  <i className="fas fa-user text-sm"></i>
                </div>
                <div>
                  <p className="font-medium">James Wilson</p>
                  <p className="text-sm text-gray-600">Room 208 - Standard Garden View</p>
                  <p className="text-xs text-blue-600">Arriving at 4:15 PM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Sidebar>
  );
};

export default Dashboard;