// src/pages/dashboard/EditProfile.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { updateProfile, changePassword, exportAccountData, deleteAccount } from "../../lib/profileApi.js";
import PasswordRequirements, { checkPasswordStrength } from "../../components/ui/PasswordRequirements.jsx";
import { uploadFile } from "../../lib/uploadApi.js";
import { localDateStr } from "../../lib/format";
import Toast, { useToast } from "../../components/ui/Toast";
import Modal from "../../components/modals/Modal.jsx";
import { Helmet } from "react-helmet-async";

/* ── input class helpers ── */
const inputBase =
  "w-full pl-10 pr-10 py-2 border rounded-xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-300 transition";

export default function EditProfile() {
  const { user, login, logout } = useAuth();
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

  // Privacy & data state
  const [exporting, setExporting]     = useState(false);
  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  /* ── Item 5: unsaved-changes guard ── */
  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

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

    if (!checkPasswordStrength(pwForm.new)) {
      setPwError("New password does not meet all strength requirements.");
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

  async function onExportData() {
    setExporting(true);
    try {
      const blob = await exportAccountData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aplaya-my-data-${localDateStr()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Your data has been downloaded.", "success");
    } catch {
      showToast("Failed to export data. Please try again.", "error");
    } finally {
      setExporting(false);
    }
  }

  async function onDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
      logout();
    } catch {
      showToast("Failed to delete account. Please try again.", "error");
      setDeleting(false);
    }
  }

  const pwStrong = checkPasswordStrength(pwForm.new);
  const pwWeak   = pwForm.new.length > 0 && !pwStrong;

  /* ── Password modal guarded close ── */
  const hasPwDraft = !!(pwForm.current || pwForm.new || pwForm.confirm);
  function guardedPwClose() {
    if (hasPwDraft && !confirm("Discard unsaved changes?")) return;
    setPwOpen(false);
    setPwError("");
  }

  return (
    <div className="space-y-6">
      <Helmet><title>Edit Profile — Aplaya Beach Resort</title></Helmet>

      {/* Item 3: Toast at top */}
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* Profile section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b">
          {/* Item 6: icon-badge header */}
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center">
              <i className="fas fa-user-edit text-sky-600"></i>
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Edit Profile</h1>
              <p className="text-slate-500 text-sm">Update your personal information.</p>
            </div>
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
                  className="w-28 h-28 rounded-full object-cover border-4 border-slate-200"
                />
                <button
                  type="button"
                  onClick={onPickImage}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 bg-sky-600 text-white rounded-full w-10 h-10 flex items-center justify-center border-2 border-white hover:bg-sky-700 disabled:opacity-60"
                  title="Change photo"
                >
                  {uploading ? <i className="fas fa-spinner fa-spin text-sm"></i> : <i className="fas fa-camera text-sm"></i>}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImageChange} />
              </div>
              <p className="text-xs text-slate-400 text-center mt-3">
                Click the camera to upload a new photo
              </p>
            </div>
          </div>

          {/* Form fields */}
          <div className="lg:col-span-2 space-y-5">
            {saveError && (
              <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700 flex items-start gap-2">
                <i className="fas fa-exclamation-circle mt-0.5 shrink-0"></i>
                <span>{saveError}</span>
              </div>
            )}

            {/* Item 11: Personal Information card-section */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-sky-100 flex items-center justify-center">
                    <i className="fas fa-id-card text-sky-500 text-[10px]"></i>
                  </span>Personal Information
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                    <div className="relative">
                      <i className="fas fa-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      <input
                        value={form.firstName}
                        onChange={(e) => setField("firstName", e.target.value)}
                        placeholder="First name"
                        autoComplete="given-name"
                        className={inputBase}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                    <div className="relative">
                      <i className="fas fa-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      <input
                        value={form.lastName}
                        onChange={(e) => setField("lastName", e.target.value)}
                        placeholder="Last name"
                        autoComplete="family-name"
                        className={inputBase}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Item 11: Contact Information card-section */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-emerald-100 flex items-center justify-center">
                    <i className="fas fa-address-book text-emerald-500 text-[10px]"></i>
                  </span>Contact Information
                </h3>
              </div>
              <div className="p-4 space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <i className="fas fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      placeholder="you@email.com"
                      autoComplete="email"
                      className={inputBase}
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <div className="relative">
                    <i className="fas fa-phone absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                      placeholder="09XX XXX XXXX"
                      autoComplete="tel"
                      className={inputBase}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition"
              >
                <i className={`fas ${saving ? "fa-spinner fa-spin" : "fa-save"}`}></i>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Security section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Item 6: icon-badge security header */}
            <span className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <i className="fas fa-shield-alt text-amber-600"></i>
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Security</h2>
              <p className="text-slate-500 text-sm">Manage your account password.</p>
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

      {/* Privacy & Data section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <i className="fas fa-shield-halved text-emerald-600"></i>
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Privacy & Data</h2>
              <p className="text-slate-500 text-sm">Manage your personal data and account.</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Export */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
            <div>
              <p className="text-sm font-medium text-slate-800">Download My Data</p>
              <p className="text-xs text-slate-500 mt-0.5">Get a copy of your profile and booking history as a PDF file.</p>
            </div>
            <button
              onClick={onExportData}
              disabled={exporting}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition shrink-0"
            >
              <i className={`fas ${exporting ? "fa-spinner fa-spin" : "fa-download"}`}></i>
              {exporting ? "Exporting..." : "Export"}
            </button>
          </div>

          {/* Delete account */}
          <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50/50 p-4">
            <div>
              <p className="text-sm font-medium text-rose-800">Delete Account</p>
              <p className="text-xs text-rose-600/70 mt-0.5">Permanently anonymize your data and cancel active bookings. This cannot be undone.</p>
            </div>
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shrink-0"
            >
              <i className="fas fa-trash-alt"></i>
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Delete account confirmation modal */}
      <Modal open={deleteOpen} onClose={() => { setDeleteOpen(false); setDeleteConfirmText(""); }} maxWidth="max-w-md">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-rose-600"></i>
            </span>
            <h3 className="text-lg font-semibold text-slate-900">Delete Your Account?</h3>
          </div>

          <div className="text-sm text-slate-600 space-y-2">
            <p>This will:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Cancel all pending and confirmed bookings</li>
              <li>Remove your personal information (name, email, phone)</li>
              <li>Unsubscribe you from the newsletter</li>
              <li>Log you out permanently</li>
            </ul>
            <p className="font-medium text-rose-700">This action cannot be undone.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Type <span className="font-mono font-bold text-rose-600">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className={inputBase}
              autoComplete="off"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setDeleteOpen(false); setDeleteConfirmText(""); }}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={onDeleteAccount}
              disabled={deleteConfirmText !== "DELETE" || deleting}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <i className={`fas ${deleting ? "fa-spinner fa-spin" : "fa-trash-alt"}`}></i>
              {deleting ? "Deleting..." : "Delete My Account"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Item 4: Change Password modal using shared Modal */}
      <Modal open={pwOpen} onClose={guardedPwClose} maxWidth="max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold text-slate-900">
            <i className="fas fa-lock mr-2 text-amber-600"></i>Change Password
          </h3>
          <button onClick={guardedPwClose} className="text-slate-400 hover:text-slate-600">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={onChangePassword} className="p-5 space-y-4">
          {pwError && (
            <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700 flex items-start gap-2">
              <i className="fas fa-exclamation-circle mt-0.5 shrink-0"></i>
              <span>{pwError}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
            <div className="relative">
              <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                type={showCurrent ? "text" : "password"}
                value={pwForm.current}
                onChange={(e) => setPwField("current", e.target.value)}
                placeholder="Enter current password"
                required
                autoComplete="current-password"
                className={inputBase}
              />
              <button type="button" onClick={() => setShowCurrent((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showCurrent ? "Hide" : "Show"}>
                <i className={`fas ${showCurrent ? "fa-eye-slash" : "fa-eye"}`}></i>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <div className="relative">
              <i className="fas fa-key absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                type={showNew ? "text" : "password"}
                value={pwForm.new}
                onChange={(e) => setPwField("new", e.target.value)}
                placeholder="Enter new password"
                required
                autoComplete="new-password"
                className={`${inputBase} ${pwWeak ? "border-amber-400" : ""}`}
              />
              <button type="button" onClick={() => setShowNew((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showNew ? "Hide" : "Show"}>
                <i className={`fas ${showNew ? "fa-eye-slash" : "fa-eye"}`}></i>
              </button>
            </div>
            <PasswordRequirements value={pwForm.new} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <i className="fas fa-key absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                type={showConfirm ? "text" : "password"}
                value={pwForm.confirm}
                onChange={(e) => setPwField("confirm", e.target.value)}
                placeholder="Confirm new password"
                required
                autoComplete="new-password"
                className={`${inputBase} ${pwForm.confirm.length > 0 && pwForm.confirm !== pwForm.new ? "border-rose-400" : ""}`}
              />
              <button type="button" onClick={() => setShowConfirm((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showConfirm ? "Hide" : "Show"}>
                <i className={`fas ${showConfirm ? "fa-eye-slash" : "fa-eye"}`}></i>
              </button>
            </div>
            {pwForm.confirm.length > 0 && pwForm.confirm !== pwForm.new && (
              <p className="text-xs text-rose-500 mt-1"><i className="fas fa-exclamation-circle mr-1"></i>Passwords do not match</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={guardedPwClose} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700">Cancel</button>
            <button type="submit" disabled={pwSaving || !pwStrong || pwForm.new !== pwForm.confirm || !pwForm.current} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              <i className={`fas ${pwSaving ? "fa-spinner fa-spin" : "fa-lock"}`}></i>
              {pwSaving ? "Changing..." : "Change Password"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
