// src/components/modals/SignupModal.jsx
import { useState, useEffect, useCallback } from "react";
import { GoogleLogin } from "@react-oauth/google";
import Toast, { useToast } from "../ui/Toast.jsx";
import { registerRequest } from "../../lib/authApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { api, TOKEN_KEY } from "../../lib/api.js";

export default function SignupModal({ open, onClose, onSignedUp, onOpenLogin }) {
  const { loginWithGoogle } = useAuth();
  const [toast, showToast, clearToast, toastType] = useToast();

  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    terms: false,
    newsletter: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function setField(key, value) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  const resetForm = useCallback(() => {
    setForm({ name: "", email: "", phone: "", password: "", confirmPassword: "", terms: false, newsletter: false });
    setShowPassword(false);
    setShowConfirm(false);
    setError("");
  }, []);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }
    if (!form.terms) {
      setError("Please accept the Terms and Conditions to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await registerRequest({
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        password: form.password,
        password_confirmation: form.confirmPassword,
      });

      if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
      if (data.user) onSignedUp?.(data.user);

      // Subscribe to newsletter if opted in
      if (form.newsletter && form.email) {
        try { await api.post("/api/newsletter", { email: form.email }); } catch {}
      }

      showToast("Sign up successful! Welcome to Aplaya Beach Resort.", "success");
      onClose?.();
      resetForm();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Sign up failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError("");
    setSubmitting(true);
    try {
      const u = await loginWithGoogle(credentialResponse.credential);
      onSignedUp?.(u);
      showToast("Signed in with Google! Welcome.", "success");
      onClose?.();
      resetForm();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Google sign-up failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const passwordWeak = form.password.length > 0 && form.password.length < 8;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Sign up">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        <div className="relative w-[92vw] max-w-lg rounded-xl bg-white shadow-xl animate-hero-fade-in opacity-0 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-xl z-10">
            <div className="flex items-center gap-2">
              <i className="fas fa-umbrella-beach text-xl text-blue-600"></i>
              <h2 className="text-lg font-semibold text-gray-900">Create Your Account</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100"
              aria-label="Close signup modal"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="px-5 py-5 space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
                <i className="fas fa-exclamation-circle mt-0.5 shrink-0"></i>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                  <i className="fas fa-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input
                    className="w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your full name"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <div className="relative">
                  <i className="fas fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input
                    type="email"
                    className="w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <i className="fas fa-phone absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input
                    type="tel"
                    className="w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="09XX XXX XXXX"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`w-full rounded-md border pl-10 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${passwordWeak ? "border-amber-400" : "border-gray-300"}`}
                    placeholder="Create a password"
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                  </button>
                </div>
                {passwordWeak && (
                  <p className="text-xs text-amber-600 mt-1">
                    <i className="fas fa-info-circle mr-1"></i>
                    Minimum 8 characters required
                  </p>
                )}
                {form.password.length >= 8 && (
                  <p className="text-xs text-green-600 mt-1">
                    <i className="fas fa-check-circle mr-1"></i>
                    Password length is good
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input
                    type={showConfirm ? "text" : "password"}
                    className={`w-full rounded-md border pl-10 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${form.confirmPassword.length > 0 && form.confirmPassword !== form.password ? "border-red-400" : "border-gray-300"}`}
                    placeholder="Confirm your password"
                    value={form.confirmPassword}
                    onChange={(e) => setField("confirmPassword", e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    <i className={`fas ${showConfirm ? "fa-eye-slash" : "fa-eye"}`}></i>
                  </button>
                </div>
                {form.confirmPassword.length > 0 && form.confirmPassword !== form.password && (
                  <p className="text-xs text-red-500 mt-1">
                    <i className="fas fa-exclamation-circle mr-1"></i>
                    Passwords do not match
                  </p>
                )}
              </div>

              {/* Terms */}
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={form.terms}
                  onChange={(e) => setField("terms", e.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <button type="button" className="font-medium text-blue-600 hover:underline">Terms and Conditions</button>{" "}
                  and{" "}
                  <button type="button" className="font-medium text-blue-600 hover:underline">Privacy Policy</button>
                </span>
              </label>

              {/* Newsletter */}
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={form.newsletter}
                  onChange={(e) => setField("newsletter", e.target.checked)}
                />
                <span>Sign me up for the Aplaya Beach Resort newsletter <span className="text-gray-400">(optional)</span></span>
              </label>

              {/* Submit */}
              <button
                disabled={submitting}
                className="w-full rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 transition"
              >
                {submitting ? "Creating account..." : "Sign Up"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 uppercase tracking-wide">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Google Sign-Up */}
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError("Google sign-up failed. Please try again.")}
                size="large"
                width="100%"
                text="signup_with"
                shape="pill"
                theme="outline"
              />
            </div>

            {/* Already have account */}
            <p className="text-center text-sm text-gray-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { onOpenLogin ? onOpenLogin() : onClose?.(); }}
                className="font-semibold text-blue-600 hover:underline"
              >
                Login instead
              </button>
            </p>
          </div>
        </div>
      </div>

      <Toast message={toast} type={toastType} onClose={clearToast} />
    </>
  );
}
