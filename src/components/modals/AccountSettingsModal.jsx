import React, { useState } from 'react';
import ChangePasswordModal from './ChangePasswordModal';

const AccountSettingsModal = ({ isOpen, onClose }) => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [formData, setFormData] = useState({
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah@aplaya-resort.com',
    phone: '09653843524'
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Account settings updated:', formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal" style={{ display: 'block' }}>
        <div className="modal-content">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Account Settings</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture</label>
              <div className="flex items-center">
                <img 
                  src="https://randomuser.me/api/portraits/women/44.jpg" 
                  alt="Profile" 
                  className="h-16 w-16 rounded-full mr-4"
                />
                <div>
                  <button 
                    type="button"
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition"
                  >
                    <i className="fas fa-upload mr-1"></i> Change Photo
                  </button>
                  <p className="text-xs text-gray-500 mt-1">JPG, GIF or PNG. Max size 2MB</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input 
                  type="text" 
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full border border-gray-200 rounded px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input 
                  type="text" 
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full border border-gray-200 rounded px-3 py-2"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input 
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded px-3 py-2"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input 
                type="tel" 
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded px-3 py-2"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Position/Role</label>
              <div className="flex items-center p-2 bg-gray-100 rounded">
                <i className="fas fa-user-tie text-gray-600 mr-2"></i>
                <span className="text-gray-800 font-medium">Resort Owner</span>
                <span className="ml-auto bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Primary Account</span>
              </div>
            </div>
            
            <div className="flex justify-between -t pt-4">
              <button 
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                <i className="fas fa-key mr-1"></i> Change Password
              </button>
              <div>
                <button 
                  type="button"
                  onClick={onClose}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition mr-2"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <ChangePasswordModal 
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </>
  );
};

export default AccountSettingsModal;
