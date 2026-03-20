import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Layout/Sidebar';
import Chart from 'chart.js/auto';
import { clearSession, getDashboardMetrics, getSession, setSession } from '../utils/appData';

const DASHBOARD_PROFILE_KEY = 'fd_dashboard_profile_v1';
const DASHBOARD_NOTIFICATIONS_KEY = 'fd_dashboard_notifications_v1';

const DEFAULT_NOTIFICATIONS = [
  {
    id: 'n1',
    title: 'New Reservation',
    message: 'Room 305 booked by Robert Chen for 3 nights',
    time: '2 min ago',
    tag: 'New',
    read: false
  },
  {
    id: 'n2',
    title: 'Check-out Reminder',
    message: 'Room 205 checking out today at 11 AM',
    time: '1 hour ago',
    tag: 'Pending',
    read: false
  },
  {
    id: 'n3',
    title: 'Maintenance Request',
    message: 'Pool area needs cleaning - assigned to staff',
    time: '3 hours ago',
    tag: 'Info',
    read: true
  },
  {
    id: 'n4',
    title: 'Payment Received',
    message: 'Payment of P864.08 received for Room 305',
    time: 'Yesterday',
    tag: 'Paid',
    read: true
  }
];

function readLocalJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const Dashboard = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState({
    accountSettings: false,
    allNotifications: false
  });
  
  // User profile state
  const [userProfile, setUserProfile] = useState(() => {
    const stored = readLocalJson(DASHBOARD_PROFILE_KEY, null);
    if (stored) return stored;

    return {
      firstName: session?.firstName || 'Staff',
      lastName: session?.role || 'User',
      email: session?.email || 'staff@aplayaccess.com',
      phone: '+639123456789',
      position: session?.role ? `${session.role.toUpperCase()} User` : 'Front Desk',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg'
    };
  });
  const [notifications, setNotifications] = useState(() => readLocalJson(DASHBOARD_NOTIFICATIONS_KEY, DEFAULT_NOTIFICATIONS));
  const [metrics, setMetrics] = useState(() => getDashboardMetrics());

  // Password change state
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editProfile, setEditProfile] = useState({ ...userProfile });
  
  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
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
    setMetrics(getDashboardMetrics());
  }, []);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_PROFILE_KEY, JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }, [notifications]);

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
    setNotificationOpen(false);
    if (modalName === 'accountSettings') {
      setEditProfile({ ...userProfile });
      setIsEditing(false);
      setPasswordData({ current: '', new: '', confirm: '' });
    }
  };

  const closeModal = (modalName) => {
    setModalOpen({ ...modalOpen, [modalName]: false });
    setIsEditing(false);
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markNotificationRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleEditToggle = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditProfile({ ...userProfile });
    setIsEditing(false);
    setPasswordData({ current: '', new: '', confirm: '' });
  };

  const handleProfileChange = (e) => {
    const { id, value } = e.target;
    setEditProfile(prev => ({
      ...prev,
      [id.replace('edit', '').toLowerCase()]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { id, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePhone = (phone) => {
    return /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(phone);
  };

  const saveAccountSettings = () => {
    // Validate profile information
    if (!editProfile.firstName || !editProfile.lastName || !editProfile.email) {
      alert('Please fill in all required fields');
      return;
    }

    if (!validateEmail(editProfile.email)) {
      alert('Please enter a valid email address');
      return;
    }

    if (editProfile.phone && !validatePhone(editProfile.phone)) {
      alert('Please enter a valid phone number');
      return;
    }

    // Validate password if any password field is filled
    if (passwordData.current || passwordData.new || passwordData.confirm) {
      if (!passwordData.current) {
        alert('Please enter your current password');
        return;
      }
      if (!passwordData.new) {
        alert('Please enter a new password');
        return;
      }
      if (!passwordData.confirm) {
        alert('Please confirm your new password');
        return;
      }
      if (passwordData.new.length < 6) {
        alert('New password must be at least 6 characters long');
        return;
      }
      if (passwordData.new !== passwordData.confirm) {
        alert('New passwords do not match');
        return;
      }
      // In a real app, you would verify the current password with your backend
      if (passwordData.current !== 'password123') { // Demo password check
        alert('Current password is incorrect');
        return;
      }
      alert('Password changed successfully!');
    }

    // Update user profile and keep global session in sync.
    setUserProfile({ ...editProfile });
    setSession(
      {
        ...(session || {}),
        firstName: editProfile.firstName,
        name: `${editProfile.firstName} ${editProfile.lastName}`,
        email: editProfile.email
      },
      Boolean(session?.keepSignedIn)
    );

    alert('Account settings saved successfully!');
    setIsEditing(false);
    setPasswordData({ current: '', new: '', confirm: '' });
    setProfileOpen(false);
    closeModal('accountSettings');
  };

  const confirmLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      clearSession();
      navigate('/login');
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

            {/* Profile Header with Avatar */}
            <div className="flex items-center mb-6 p-4 bg-gray-50 rounded-lg">
              <img 
                src={userProfile.avatar} 
                alt={userProfile.firstName} 
                className="h-16 w-16 rounded-full mr-4 border-2 border-blue-500"
              />
              <div>
                <h4 className="font-bold text-lg">{userProfile.firstName} {userProfile.lastName}</h4>
                <p className="text-sm text-gray-600">{userProfile.position}</p>
                <p className="text-xs text-gray-500">{userProfile.email}</p>
              </div>
              {!isEditing && (
                <button 
                  onClick={handleEditToggle}
                  className="ml-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  <i className="fas fa-edit mr-2"></i>Edit Profile
                </button>
              )}
            </div>

            {isEditing ? (
              // Edit Mode
              <>
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-gray-700">Profile Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                      <input 
                        type="text" 
                        id="editFirstName" 
                        value={editProfile.firstName}
                        onChange={handleProfileChange}
                        className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                      <input 
                        type="text" 
                        id="editLastName" 
                        value={editProfile.lastName}
                        onChange={handleProfileChange}
                        className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" 
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input 
                      type="email" 
                      id="editEmail" 
                      value={editProfile.email}
                      onChange={handleProfileChange}
                      className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" 
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input 
                      type="tel" 
                      id="editPhone" 
                      value={editProfile.phone}
                      onChange={handleProfileChange}
                      className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" 
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                    <input 
                      type="text" 
                      id="editPosition" 
                      value={editProfile.position}
                      className="border rounded px-3 py-2 w-full bg-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      readOnly 
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-gray-700">Change Password</h4>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                    <input 
                      type="password" 
                      id="current" 
                      value={passwordData.current}
                      onChange={handlePasswordChange}
                      className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" 
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <input 
                      type="password" 
                      id="new" 
                      value={passwordData.new}
                      onChange={handlePasswordChange}
                      className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" 
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                    <input 
                      type="password" 
                      id="confirm" 
                      value={passwordData.confirm}
                      onChange={handlePasswordChange}
                      className="border rounded px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500" 
                    />
                  </div>
                </div>
              </>
            ) : (
              // View Mode
              <>
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-gray-700">Profile Information</h4>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                    <div>
                      <p className="text-xs text-gray-500">First Name</p>
                      <p className="font-medium">{userProfile.firstName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Last Name</p>
                      <p className="font-medium">{userProfile.lastName}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium">{userProfile.email}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="font-medium">{userProfile.phone}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Position</p>
                      <p className="font-medium">{userProfile.position}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-gray-700">Account Statistics</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded">
                      <p className="text-xs text-gray-500">Member Since</p>
                      <p className="font-medium">January 2024</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded">
                      <p className="text-xs text-gray-500">Last Login</p>
                      <p className="font-medium">Today, 8:30 AM</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end space-x-3">
              {isEditing ? (
                <>
                  <button 
                    onClick={handleCancelEdit} 
                    className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={saveAccountSettings} 
                    className="px-4 py-2 border rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => closeModal('accountSettings')} 
                  className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Close
                </button>
              )}
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
              <div className="space-y-2">
                {notifications.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => markNotificationRead(item.id)}
                    className={`notification-item w-full text-left p-3 border-b rounded ${item.read ? 'bg-white' : 'bg-blue-50'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className={`font-medium ${item.read ? 'text-gray-900' : 'text-blue-600'}`}>{item.title}</div>
                      <span className="text-xs text-gray-500">{item.time}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{item.message}</p>
                    <div className="mt-2">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">{item.tag}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between mt-4">
              <button onClick={markAllNotificationsRead} className="px-4 py-2 border rounded text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100">
                Mark All as Read
              </button>
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
                {unreadCount > 0 && (
                  <span className="notification-badge absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">{unreadCount}</span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notificationOpen && (
                <div className="notification-dropdown absolute right-0 top-14 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium text-gray-900">Notifications</h3>
                      <button onClick={markAllNotificationsRead} className="text-blue-600 text-sm hover:text-blue-800">Mark all as read</button>
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-96">
                    {notifications.slice(0, 3).map((item) => (
                      <button
                        type="button"
                        key={`dropdown-${item.id}`}
                        onClick={() => markNotificationRead(item.id)}
                        className={`notification-item w-full text-left p-3 border-b ${item.read ? 'bg-white' : 'bg-blue-50'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className={`font-medium ${item.read ? 'text-gray-900' : 'text-blue-600'}`}>{item.title}</div>
                          <span className="text-xs text-gray-500">{item.time}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{item.message}</p>
                      </button>
                    ))}
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
                <img src={userProfile.avatar} alt={userProfile.firstName} className="h-8 w-8 rounded-full mr-2" />
                <span className="hidden md:inline">{userProfile.firstName}</span>
                <i className="fas fa-chevron-down ml-1 text-sm"></i>
              </button>

              {/* Profile Dropdown Menu */}
              {profileOpen && (
                <div className="profile-dropdown absolute right-0 top-14 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="profile-dropdown-item p-3 flex items-center border-b">
                    <img src={userProfile.avatar} alt={userProfile.firstName} className="h-10 w-10 rounded-full mr-3" />
                    <div>
                      <p className="font-medium">{userProfile.firstName} {userProfile.lastName}</p>
                      <p className="text-xs text-gray-500">{userProfile.position}</p>
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
                <h3 className="text-2xl font-bold">{metrics.occupied}</h3>
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
                <h3 className="text-2xl font-bold">{metrics.checkins}</h3>
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
                <h3 className="text-2xl font-bold">{metrics.checkouts}</h3>
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
                <h3 className="text-2xl font-bold">{metrics.transactions}</h3>
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