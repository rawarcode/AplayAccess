// src/pages/dashboard/EditProfile.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const { user, login, logout, clearPersistedAuth } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [toast, showToast, clearToast, toastType] = useToast();
  // Password-gated email change — shown only when the email field
  // differs from the authenticated user's current email. Cleared on
  // successful save so a stale value can't leak into the next submit.
  const [emailChangePassword, setEmailChangePassword] = useState("");
  const [showEmailChangePassword, setShowEmailChangePassword] = useState(false);

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
  // True after a successful delete — shows a "Account Deleted"
  // celebration inside the same modal for 2.5s before the logout()
  // call redirects the user away.
  const [deleted, setDeleted]         = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  /* ── Item 5: unsaved-changes guard ── */
  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);

  // Detect whether the email field has been edited away from the
  // authenticated user's current email. Comparison is against
  // `user?.email` (not `initial.email`) so a pending verify from a
  // previous tab can't silently suppress the password gate.
  // Google-managed users never satisfy this — their email field is
  // rendered read-only, so form.email stays in lockstep with
  // user.email and isEmailChanging stays false.
  const isEmailChanging = !!(form.email && user?.email && form.email.trim().toLowerCase() !== user.email.toLowerCase());

  // Google-managed account: the user originally authenticated via
  // Google Sign-In (user.google_id is populated). We treat email +
  // password as "owned" by Google and hide the controls here so the
  // two systems can't desync. Users who want to change either are
  // directed to manage it on the Google side. Limitation: a hybrid
  // user who signed up with email/password and later linked Google
  // also has google_id set, so they'll see the same restriction —
  // acceptable trade-off for the capstone since Forgot Password is
  // still a valid escape hatch for those users.
  const isGoogleManaged = !!user?.google_id;
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

    // Short-circuit: don't even hit the backend if the user left the
    // password field blank while changing their email. Lets us show a
    // focused error next to the field instead of waiting on the 422.
    if (isEmailChanging && !emailChangePassword) {
      setSaveError("Confirm your current password to change your email.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name:   `${form.firstName} ${form.lastName}`.trim(),
        email:  form.email,
        phone:  form.phone,
        avatar: form.avatar || undefined,
      };
      if (isEmailChanging) {
        payload.current_password = emailChangePassword;
      }

      const data = await updateProfile(payload);

      // Email-change path: the backend has parked the new address in
      // `pending_email` and sent an OTP there. Keep the user logged in
      // with their ORIGINAL email (nothing actually changed yet), wipe
      // the password field from memory, and route to the verification
      // page with a clear prompt.
      if (data.email_change_pending) {
        // Update auth state so the dashboard banner can surface the
        // pending change. user.email stays the same; user.pending_email
        // is now populated.
        login(data.user);
        setEmailChangePassword("");
        setShowEmailChangePassword(false);
        showToast(`Verification code sent to ${data.pending_email}.`, "success");
        navigate("/dashboard/verify-email-change");
        return;
      }

      // Regular profile save — name / phone / avatar updated inline.
      login(data.user || { ...(user || {}), ...payload });
      showToast("Profile updated successfully!", "success");
    } catch (err) {
      const msg =
        err?.response?.data?.errors?.current_password?.[0] ||
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
      // Wipe persisted auth right now so a refresh during the
      // celebration window doesn't boot the dashboard from cached
      // localStorage with a deleted account.
      clearPersistedAuth();
      // Swap the modal body to a success celebration for 2.5s so the
      // user actually sees confirmation that their account was deleted
      // before logout() redirects them out of the dashboard.
      setDeleted(true);
      setTimeout(() => { logout(); }, 2500);
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
                  loading="lazy"
                  decoding="async"
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
                      readOnly={isGoogleManaged}
                      className={`${inputBase} ${isGoogleManaged ? "bg-slate-50 text-slate-500 cursor-not-allowed" : ""}`}
                    />
                  </div>
                  {/* Google-managed accounts: email is the identity
                      handed to us by Google, so changing it here would
                      desync from the authoritative record. Direct the
                      user to manage it on Google instead. */}
                  {isGoogleManaged && (
                    <p className="mt-2 text-xs text-slate-500 flex items-start gap-1.5">
                      <i className="fab fa-google mt-0.5 text-[13px]"></i>
                      <span>
                        Your email is managed by your Google account. Sign in to Google to change it.
                      </span>
                    </p>
                  )}
                  {/* Password gate — only surfaces when the email field
                      differs from the currently-authenticated email. The
                      backend enforces this too; this is just the nudge so
                      the user understands WHY a password is suddenly
                      required. Suppressed for Google-managed accounts —
                      they can't change email here at all. */}
                  {isEmailChanging && !isGoogleManaged && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs text-amber-800 mb-2 flex items-start gap-1.5">
                        <i className="fas fa-shield-halved mt-0.5"></i>
                        <span>
                          Changing your email is a sensitive action. Confirm your password — we'll
                          send a 6-digit code to <strong>{form.email}</strong> before anything actually
                          changes. Your current email stays active until you enter the code.
                        </span>
                      </p>
                      <label className="block text-xs font-medium text-amber-900 mb-1">
                        Current Password
                      </label>
                      <div className="relative">
                        <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 text-xs"></i>
                        <input
                          type={showEmailChangePassword ? "text" : "password"}
                          value={emailChangePassword}
                          onChange={(e) => setEmailChangePassword(e.target.value)}
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          className="w-full pl-9 pr-10 py-2 border rounded-lg border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-sm bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEmailChangePassword((s) => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 hover:text-amber-700"
                          tabIndex={-1}
                          aria-label={showEmailChangePassword ? "Hide password" : "Show password"}
                        >
                          <i className={`fas ${showEmailChangePassword ? "fa-eye-slash" : "fa-eye"} text-sm`}></i>
                        </button>
                      </div>
                    </div>
                  )}
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
        <div className="p-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {/* Item 6: icon-badge security header */}
            <span className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <i className="fas fa-shield-alt text-amber-600"></i>
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Security</h2>
              <p className="text-slate-500 text-sm">
                {isGoogleManaged
                  ? "Your password is managed by your Google account."
                  : "Manage your account password."}
              </p>
            </div>
          </div>
          {/* Google-managed: show a static badge where the button
              used to be. No password exists for us to change
              (user was created via Google with a random throwaway
              hash we never expose), so we don't offer the action. */}
          {isGoogleManaged ? (
            <span className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-xs font-medium">
              <i className="fab fa-google text-[13px]"></i>
              Signed in with Google
            </span>
          ) : (
            <button
              onClick={() => setPwOpen(true)}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
            >
              <i className="fas fa-lock"></i>
              Change Password
            </button>
          )}
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

      {/* Delete account confirmation modal.
          While `deleted` is true the body swaps to a success celebration
          held for 2.5s — a dialog-level success card, not a toast, so
          the user can't miss it. Modal's onClose is disabled during
          that window too (the logout redirect will close it). */}
      <Modal open={deleteOpen} onClose={() => { if (!deleted) { setDeleteOpen(false); setDeleteConfirmText(""); } }} maxWidth="max-w-md">
        {deleted ? (
          <div className="p-8 text-center" role="status" aria-live="polite">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5 animate-pulse">
              <i className="fas fa-check text-emerald-600 text-4xl" aria-hidden="true"></i>
            </div>
            <h3 className="text-2xl font-bold text-emerald-700 mb-2">Account Deleted</h3>
            <p className="text-sm text-slate-500 mb-5">
              Your account and personal information have been removed.
              Active bookings were cancelled and you've been unsubscribed
              from the newsletter.
            </p>
            <p className="text-xs text-slate-400">
              <i className="fas fa-spinner fa-spin mr-1" aria-hidden="true"></i>
              Logging you out…
            </p>
          </div>
        ) : (
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
        )}
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
