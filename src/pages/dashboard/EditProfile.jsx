// src/pages/dashboard/EditProfile.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { updateProfile, changePassword } from "../../lib/profileApi.js";
import { uploadFile } from "../../lib/uploadApi.js";
import Toast, { useToast } from "../../components/ui/Toast";
import { Helmet } from "react-helmet-async";

function PasswordModal({ pwForm, setPwField, pwError, pwSaving, pwWeak, showCurrent, setShowCurrent, showNew, setShowNew, showConfirm, setShowConfirm, onSubmit, onClose }) {
  const hasDraft = !!(pwForm.current || pwForm.new || pwForm.confirm);
  function guardedClose() { if (hasDraft && !confirm("Discard unsaved changes?")) return; onClose?.(); }

  useEffect(() => {
    function handleKey(e) { if (e.key === "Escape") guardedClose(); }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, hasDraft]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={guardedClose} />
      <div className="relative bg-white w-full max-w-md rounded-xl shadow-xl animate-hero-fade-in opacity-0">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            <i className="fas fa-lock mr-2 text-amber-600"></i>Change Password
          </h3>
          <button onClick={guardedClose} className="text-gray-400 hover:text-gray-600">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {pwError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <i className="fas fa-exclamation-circle mt-0.5 shrink-0"></i>
              <span>{pwError}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <div className="relative">
              <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type={showCurrent ? "text" : "password"}
                value={pwForm.current}
                onChange={(e) => setPwField("current", e.target.value)}
                placeholder="Enter current password"
                required
                autoComplete="current-password"
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => setShowCurrent((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={showCurrent ? "Hide" : "Show"}>
                <i className={`fas ${showCurrent ? "fa-eye-slash" : "fa-eye"}`}></i>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <i className="fas fa-key absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type={showNew ? "text" : "password"}
                value={pwForm.new}
                onChange={(e) => setPwField("new", e.target.value)}
                placeholder="Enter new password"
                required
                autoComplete="new-password"
                className={`w-full pl-10 pr-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${pwWeak ? "border-amber-400" : "border-gray-300"}`}
              />
              <button type="button" onClick={() => setShowNew((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={showNew ? "Hide" : "Show"}>
                <i className={`fas ${showNew ? "fa-eye-slash" : "fa-eye"}`}></i>
              </button>
            </div>
            {pwWeak && <p className="text-xs text-amber-600 mt-1"><i className="fas fa-info-circle mr-1"></i>Minimum 8 characters required</p>}
            {pwForm.new.length >= 8 && <p className="text-xs text-green-600 mt-1"><i className="fas fa-check-circle mr-1"></i>Password length is good</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <i className="fas fa-key absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type={showConfirm ? "text" : "password"}
                value={pwForm.confirm}
                onChange={(e) => setPwField("confirm", e.target.value)}
                placeholder="Confirm new password"
                required
                autoComplete="new-password"
                className={`w-full pl-10 pr-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${pwForm.confirm.length > 0 && pwForm.confirm !== pwForm.new ? "border-red-400" : "border-gray-300"}`}
              />
              <button type="button" onClick={() => setShowConfirm((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={showConfirm ? "Hide" : "Show"}>
                <i className={`fas ${showConfirm ? "fa-eye-slash" : "fa-eye"}`}></i>
              </button>
            </div>
            {pwForm.confirm.length > 0 && pwForm.confirm !== pwForm.new && (
              <p className="text-xs text-red-500 mt-1"><i className="fas fa-exclamation-circle mr-1"></i>Passwords do not match</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={guardedClose} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700">Cancel</button>
            <button type="submit" disabled={pwSaving} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              <i className={`fas ${pwSaving ? "fa-spinner fa-spin" : "fa-lock"}`}></i>
              {pwSaving ? "Changing..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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

  const [form, setForm]           = useState(initial);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploading, setUploading] = useState(false);

  // Change password state
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", new: "", confirm: "" });
  const [pwSaving, setPwSaving]   = useState(false);
  const [pwError, setPwError]     = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function setField(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  function setPwField(name, value) {
    setPwForm((p) => ({ ...p, [name]: value }));
  }

  function onPickImage() {
    fileRef.current?.click();
  }

  async function onImageChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadFile(f, 'avatars');
      setField("avatar", url);
    } catch {
      setSaveError("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
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

  async function onChangePassword(e) {
    e.preventDefault();
    setPwError("");

    if (pwForm.new.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (pwForm.new !== pwForm.confirm) {
      setPwError("Passwords do not match.");
      return;
    }

    setPwSaving(true);
    try {
      await changePassword(pwForm.current, pwForm.new);
      showToast("Password changed successfully!", "success");
      setPwForm({ current: "", new: "", confirm: "" });
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setPwOpen(false);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Failed to change password.";
      setPwError(msg);
    } finally {
      setPwSaving(false);
    }
  }

  const pwWeak = pwForm.new.length > 0 && pwForm.new.length < 8;

  return (
    <div className="space-y-6">
      <Helmet><title>Edit Profile — Aplaya Beach Resort</title></Helmet>

      {/* Profile section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b flex items-center gap-3">
          <i className="fas fa-user-edit text-blue-600"></i>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
            <p className="text-gray-500 text-sm">Update your personal information.</p>
          </div>
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
                  disabled={uploading}
                  className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center border-2 border-white hover:bg-blue-700 disabled:opacity-60"
                  title="Change photo"
                >
                  {uploading ? <i className="fas fa-spinner fa-spin text-sm"></i> : <i className="fas fa-camera text-sm"></i>}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImageChange} />
              </div>
              <p className="text-xs text-gray-400 text-center mt-3">
                Click the camera to upload a new photo
              </p>
            </div>
          </div>

          {/* Form fields */}
          <div className="lg:col-span-2 space-y-5">
            {saveError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
                <i className="fas fa-exclamation-circle mt-0.5 shrink-0"></i>
                <span>{saveError}</span>
              </div>
            )}

            {/* Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <div className="relative">
                  <i className="fas fa-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                    placeholder="First name"
                    autoComplete="given-name"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <div className="relative">
                  <i className="fas fa-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input
                    value={form.lastName}
                    onChange={(e) => setField("lastName", e.target.value)}
                    placeholder="Last name"
                    autoComplete="family-name"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <i className="fas fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <div className="relative">
                <i className="fas fa-phone absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="09XX XXX XXXX"
                  autoComplete="tel"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition"
              >
                <i className={`fas ${saving ? "fa-spinner fa-spin" : "fa-save"}`}></i>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Security section — change password button */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="fas fa-shield-alt text-amber-600"></i>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Security</h2>
              <p className="text-gray-500 text-sm">Manage your account password.</p>
            </div>
          </div>
          <button
            onClick={() => setPwOpen(true)}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
          >
            <i className="fas fa-lock"></i>
            Change Password
          </button>
        </div>
      </div>

      {/* Change Password modal */}
      {pwOpen && (
        <PasswordModal
          pwForm={pwForm}
          setPwField={setPwField}
          pwError={pwError}
          pwSaving={pwSaving}
          pwWeak={pwWeak}
          showCurrent={showCurrent}
          setShowCurrent={setShowCurrent}
          showNew={showNew}
          setShowNew={setShowNew}
          showConfirm={showConfirm}
          setShowConfirm={setShowConfirm}
          onSubmit={onChangePassword}
          onClose={() => { setPwOpen(false); setPwError(""); }}
        />
      )}

      <Toast message={toast} type={toastType} onClose={clearToast} />
    </div>
  );
}
