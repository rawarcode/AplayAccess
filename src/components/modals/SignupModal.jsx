// src/components/modals/SignupModal.jsx
import { useState, useEffect, useCallback } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import PasswordRequirements, { checkPasswordStrength } from "../ui/PasswordRequirements.jsx";
import Toast, { useToast } from "../ui/Toast.jsx";
import { registerRequest } from "../../lib/authApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { api, TOKEN_KEY } from "../../lib/api.js";

export default function SignupModal({ open, onClose, onSignedUp, onOpenLogin }) {
  const { user, loginWithGoogle, refreshUser } = useAuth();
  const [toast, showToast, clearToast, toastType] = useToast();

  // Close the modal when the user becomes authenticated elsewhere —
  // One Tap prompt, another tab logging in, Google sign-in completing
  // in a race with the signup form. Mirrors the same guard in LoginModal.
  useEffect(() => {
    if (user && open) onClose?.();
  }, [user, open, onClose]);

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

    if (!checkPasswordStrength(form.password)) {
      setError("Password does not meet all strength requirements.");
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

      // Persist token first so refreshUser's /api/me call can authenticate.
      if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
      // Parent handler (Navbar / Resort) sets AuthContext user via login(u)
      // and takes care of welcome toast + navigation.
      if (data.user) onSignedUp?.(data.user);
      // Re-fetch canonical user so UnverifiedEmailBanner sees a shape
      // matching the rest of the app. Without this the banner could
      // fail to render until the user refreshes the page (register
      // response shape drifts from /api/me response shape subtly).
      await refreshUser();

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

  // Same implicit-flow pattern as LoginModal — see there for the why.
  const googleLogin = useGoogleLogin({
    flow: "implicit",
    onSuccess: async (tokenResponse) => {
      setError("");
      setSubmitting(true);
      try {
        const u = await loginWithGoogle(tokenResponse.access_token);
        onSignedUp?.(u);
        showToast("Signed in with Google! Welcome.", "success");
        onClose?.();
        resetForm();
      } catch (err) {
        const msg = err?.response?.data?.message || "Google sign-up failed. Please try again.";
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    onError: () => setError("Google sign-up failed. Please try again."),
  });

  if (!open) return null;

  // Password is "weak" = not empty but missing any of the 5 rules.
  // Drives the amber border on the input and gates the submit button.
  const passwordStrong = checkPasswordStrength(form.password);
  const passwordWeak   = form.password.length > 0 && !passwordStrong;

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
                <PasswordRequirements value={form.password} />
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
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">Terms and Conditions</a>{" "}
                  and{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">Privacy Policy</a>
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

              {/* Submit — disabled until the password passes all five
                  strength rules AND matches the confirm field. The
                  checklist above the button tells the user exactly what's
                  missing. */}
              <button
                disabled={submitting || !passwordStrong || form.password !== form.confirmPassword || !form.terms}
                className="w-full rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 transition"
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

            {/* Google Sign-Up — custom button (generic "Sign up with Google",
                never personalized). See LoginModal for flow details. */}
            <button
              type="button"
              onClick={() => googleLogin()}
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-3 py-2.5 px-4 rounded-md border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 hover:border-slate-300 transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.29 1.48-1.14 2.73-2.4 3.58v3h3.88c2.28-2.1 3.57-5.18 3.57-8.82z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.07.72-2.45 1.16-4.05 1.16-3.12 0-5.76-2.11-6.7-4.94H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
                <path fill="#FBBC04" d="M5.3 14.3c-.24-.72-.38-1.49-.38-2.3s.14-1.58.38-2.3V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l4.01-3.09z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l4.01 3.09C6.24 6.86 8.88 4.75 12 4.75z"/>
              </svg>
              {submitting ? "Signing up..." : "Sign up with Google"}
            </button>

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
