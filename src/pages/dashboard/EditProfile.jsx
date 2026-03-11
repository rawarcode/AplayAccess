// src/pages/dashboard/EditProfile.jsx
import { useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { updateProfile } from "../../lib/profileApi.js";
import useLockBodyScroll from "../../hooks/useLockBodyScroll.js";

function Modal({ open, title, children, onClose }) {
  useLockBodyScroll(open);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="absolute inset-0 bg-gray-500/75" />
        <div className="relative bg-white w-full max-w-md rounded-lg shadow-xl">
          <div className="p-5 flex items-center justify-between border-b">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function EditProfile() {
  const { user, login } = useAuth();
  const fileRef = useRef(null);

  const initial = useMemo(() => {
    const name = user?.name || "John Doe";
    const [firstName, ...rest] = name.split(" ");
    const lastName = rest.join(" ") || "Doe";
    return {
      firstName,
      lastName,
      email: user?.email || "john.doe@example.com",
      phone: user?.phone || "+63 900 000 0000",
      dateOfBirth: "",
      country: "PH",
      gender: "",
      nonSmoking: true,
      highFloor: false,
      avatar: user?.avatar || "https://randomuser.me/api/portraits/men/45.jpg",
    };
  }, [user]);

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saveError, setSaveError] = useState("");

  function setField(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  function onPickImage() {
    fileRef.current?.click();
  }

  function onImageChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setField("avatar", ev.target.result);
    reader.readAsDataURL(f);
  }

  async function onSave(e) {
    e.preventDefault();
    setSaveError("");
    setSaving(true);

    try {
      const payload = {
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        phone: form.phone,
        avatar: form.avatar,
      };

      const data = await updateProfile(payload);
      // Update global user in AuthContext
      login(data.user || { ...(user || {}), ...payload });
      setSavedOpen(true);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Failed to save profile. Please try again.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
        <p className="text-gray-600">Update your personal information.</p>
      </div>

      <form onSubmit={onSave} className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Avatar */}
        <div className="lg:col-span-1">
          <div className="flex flex-col items-center">
            <div className="relative">
              <img
                src={form.avatar}
                alt="Profile"
                className="w-28 h-28 rounded-full object-cover border-4 border-gray-200"
              />
              <button
                type="button"
                onClick={onPickImage}
                className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center border-2 border-white hover:bg-blue-700"
                title="Change photo"
              >
                📷
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImageChange} />
            </div>
            <p className="text-sm text-gray-600 text-center mt-3">
              Click the camera to upload a new profile picture
            </p>
          </div>
        </div>

        {/* Form fields */}
        <div className="lg:col-span-2 space-y-6">
          {saveError ? (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {saveError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setField("dateOfBirth", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select
                value={form.country}
                onChange={(e) => setField("country", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="PH">Philippines</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="UK">United Kingdom</option>
                <option value="AU">Australia</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="gender"
                    checked={form.gender === "male"}
                    onChange={() => setField("gender", "male")}
                  />
                  Male
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="gender"
                    checked={form.gender === "female"}
                    onChange={() => setField("gender", "female")}
                  />
                  Female
                </label>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold text-gray-900 mb-3">Room Preferences</h3>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.nonSmoking}
                  onChange={(e) => setField("nonSmoking", e.target.checked)}
                />
                Non-smoking room
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.highFloor}
                  onChange={(e) => setField("highFloor", e.target.checked)}
                />
                High floor preferred
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-medium transition"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>

      <Modal open={savedOpen} title="Success" onClose={() => setSavedOpen(false)}>
        <p className="text-gray-700">Profile updated successfully!</p>
        <div className="mt-4 flex justify-end">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            onClick={() => setSavedOpen(false)}
          >
            OK
          </button>
        </div>
      </Modal>
    </div>
  );
}
