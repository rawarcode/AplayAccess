import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile } from '../../lib/ownerApi';
import ChangePasswordModal from './ChangePasswordModal';

const AccountSettingsModal = ({ isOpen, onClose }) => {
  const { user, setUser } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    if (user) {
      setFormData({ name: user.name || '', email: user.email || '', phone: user.phone || '' });
    }
    setSaveError(null);
    setSaveSuccess(false);
  }, [user, isOpen]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await updateProfile(formData);
      setUser(updated);
      localStorage.setItem('aplaya_user_v1', JSON.stringify(updated));
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err?.response?.data?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const roleLabel = user?.role === 'owner'      ? 'Resort Owner'
    : user?.role === 'admin'                    ? 'Administrator'
    : user?.role === 'front_desk'               ? 'Front Desk'
    : user?.role || 'Staff';

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded px-3 py-2"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded px-3 py-2"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
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
                <span className="text-gray-800 font-medium">{roleLabel}</span>
                {user?.role === 'owner' && (
                  <span className="ml-auto bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Primary Account</span>
                )}
              </div>
            </div>

            {saveError && (
              <p className="text-sm text-red-600 mb-3">{saveError}</p>
            )}
            {saveSuccess && (
              <p className="text-sm text-green-600 mb-3">Changes saved successfully.</p>
            )}

            <div className="flex justify-between border-t pt-4">
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
                  disabled={saving}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
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
