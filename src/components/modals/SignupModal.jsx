// src/components/modals/SignupModal.jsx
import { useState, useEffect, useCallback } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import PasswordRequirements, { checkPasswordStrength } from "../ui/PasswordRequirements.jsx";
import Toast, { useToast } from "../ui/Toast.jsx";
import { registerRequest } from "../../lib/authApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { api, primeCsrf } from "../../lib/api.js";
import useFocusTrap from "../../hooks/useFocusTrap.js";

export default function SignupModal({ open, onClose, onSignedUp, onOpenLogin }) {
  // Focus trap matches LoginModal — both auth modals now share the
  // same dialog mechanics as Modal.jsx-based screens.
  const dialogRef = useFocusTrap(open);
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
      // Prime XSRF-TOKEN so the register POST carries a header that
      // matches the current session's _token. Without this, a stale
      // cookie from before the last session rotation (e.g. a previous
      // logout) causes "CSRF token mismatch". Mirrors the login paths.
      await primeCsrf();
      const data = await registerRequest({
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        password: form.password,
        password_confirmation: form.confirmPassword,
      });

      // Register sets a Sanctum session cookie (Auth::login + hasSession
      // guard on the backend), so refreshUser's /api/me call is
      // authenticated by cookie. No bearer token in localStorage — that
      // was the XSS-to-token-theft surface P1.2 closed.
      //
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

  // Same auth-code + PKCE flow as LoginModal — see there for the why.
  const googleLogin = useGoogleLogin({
    flow: "auth-code",
    onSuccess: async (codeResponse) => {
      setError("");
      setSubmitting(true);
      try {
        const u = await loginWithGoogle(codeResponse.code);
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
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="signup-modal-title"
          tabIndex={-1}
          className="relative w-[92vw] max-w-lg rounded-xl bg-white shadow-xl animate-hero-fade-in opacity-0 max-h-[90vh] overflow-y-auto focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-xl z-10">
            <div className="flex items-center gap-2">
              <i className="fas fa-umbrella-beach text-xl text-blue-600" aria-hidden="true"></i>
              <h2 id="signup-modal-title" className="text-lg font-semibold text-gray-900">Create Your Account</h2>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="w-11 h-11 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Close signup modal"
            >
              <i className="fas fa-times" aria-hidden="true"></i>
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
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`} aria-hidden="true"></i>
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
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    <i className={`fas ${showConfirm ? "fa-eye-slash" : "fa-eye"}`} aria-hidden="true"></i>
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
                  missing for the password; if Terms is the ONLY thing
                  outstanding, surface a hint right under the button so
                  the user isn't staring at a dead button wondering
                  why. */}
              <button
                disabled={submitting || !passwordStrong || form.password !== form.confirmPassword || !form.terms}
                className="w-full rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 min-h-11 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                {submitting ? "Creating account..." : "Sign Up"}
              </button>
              {!submitting && passwordStrong && form.password === form.confirmPassword && form.password.length > 0 && !form.terms && (
                <p className="text-xs text-amber-700 -mt-1 flex items-center gap-1.5">
                  <i className="fas fa-info-circle" aria-hidden="true"></i>
                  Tick the Terms &amp; Conditions checkbox above to enable Sign Up.
                </p>
              )}
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
              className="w-full inline-flex items-center justify-center gap-3 py-2.5 min-h-11 px-4 rounded-md border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 hover:border-slate-300 transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
            <p className="text-center text-sm text-gray-600">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { onOpenLogin ? onOpenLogin() : onClose?.(); }}
                className="font-semibold text-blue-700 hover:underline rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
