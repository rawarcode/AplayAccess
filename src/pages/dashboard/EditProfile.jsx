// src/pages/dashboard/EditProfile.jsx
import { useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { updateProfile } from "../../lib/profileApi.js";
import Toast, { useToast } from "../../components/ui/Toast";

export default function EditProfile() {
  const { user, login } = useAuth();
  const fileRef = useRef(null);
  const [toast, showToast, clearToast, toastType] = useToast();

  const initial = useMemo(() => {
    const name = user?.name || "";
    const [firstName, ...rest] = name.split(" ");
    const lastName = rest.join(" ") || "";
    return {
      firstName,
      lastName,
      email:  user?.email  || "",
      phone:  user?.phone  || "",
      avatar: user?.avatar || "",
    };
  }, [user]);

  const [form, setForm]         = useState(initial);
  const [saving, setSaving]     = useState(false);
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
        name:   `${form.firstName} ${form.lastName}`.trim(),
        email:  form.email,
        phone:  form.phone,
        avatar: form.avatar || undefined,
      };

      const data = await updateProfile(payload);
      login(data.user || { ...(user || {}), ...payload });
      showToast("Profile updated successfully!", "success");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Failed to save profile.";
      setSaveError(msg);
      showToast(msg, "error");
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
                src={form.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent((form.firstName + " " + form.lastName).trim() || "Guest")}&background=0ea5e9&color=fff&size=128`}
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

          {/* Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
                placeholder="First name"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
                placeholder="Last name"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="you@email.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="+63 9XX XXX XXXX"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
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

      <Toast message={toast} type={toastType} onClose={clearToast} />
    </div>
  );
}
