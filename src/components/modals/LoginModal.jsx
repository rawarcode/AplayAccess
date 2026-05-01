// src/components/modals/LoginModal.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useGoogleLogin } from "@react-oauth/google";
import useFocusTrap from "../../hooks/useFocusTrap.js";

export default function LoginModal({ open, onClose, onLoginSuccess, onOpenSignup }) {
  // Focus trap + initial-focus + return-focus on close. SignupModal
  // already had Escape; LoginModal didn't. Both now share the same
  // dialog mechanics as the Modal-based screens.
  const dialogRef = useFocusTrap(open);

  // Escape-to-close.
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  const { user, loginWithEmail, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Close the modal the instant the user becomes authenticated — covers
  // cross-tab logins that sync via localStorage events plus any path
  // that sets user outside this modal's own submit handlers.
  useEffect(() => {
    if (user && open) onClose?.();
  }, [user, open, onClose]);

  // useGoogleLogin MUST be called before any early return so the hook
  // count stays constant across renders (React error #310 otherwise).
  // Auth-code flow returns a short-lived authorization code → backend
  // exchanges it for tokens using the server-held client_secret. The
  // access_token never enters the browser (P2 hardening — upgraded
  // from the old implicit flow that surfaced access_token client-side).
  const googleLogin = useGoogleLogin({
    flow: "auth-code",
    onSuccess: async (codeResponse) => {
      setError("");
      setSubmitting(true);
      try {
        const u = await loginWithGoogle(codeResponse.code);
        onLoginSuccess?.(u);
      } catch (err) {
        const msg = err?.response?.data?.message || "Google sign-in failed. Please try again.";
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    onError: () => setError("Google sign-in failed. Please try again."),
  });

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const u = await loginWithEmail(email.trim(), password);
      onLoginSuccess?.(u);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        (err?.response?.status === 422 ? "Invalid email or password." : null) ||
        "Login failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        tabIndex={-1}
        className="relative w-[92vw] max-w-lg rounded-xl bg-white shadow-xl animate-hero-fade-in opacity-0 focus:outline-none"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 id="login-modal-title" className="text-lg font-semibold text-slate-900">Login to Your Account</h2>
          <button
            onClick={onClose}
            type="button"
            className="w-11 h-11 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label="Close login modal"
          >
            <i className="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {error ? (
            <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
              <i className="fas fa-exclamation-circle mr-2"></i>
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <i className="fas fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  className="w-full rounded-md border border-slate-300 pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  className="w-full rounded-md border border-slate-300 pl-10 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`} aria-hidden="true"></i>
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                onClick={onClose}
                className="text-xs text-sky-700 hover:text-sky-800 hover:underline transition rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                Forgot password?
              </Link>
            </div>

            <button
              disabled={submitting}
              className="w-full rounded-md bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-medium py-2.5 min-h-11 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              type="submit"
            >
              {submitting ? "Logging in..." : "Login"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Google Sign-In — custom button (always says "Sign in with Google",
              no personalized "Sign in as X" regardless of which Google accounts
              are signed into the browser). Uses OAuth2 implicit flow — the
              token goes to /api/auth/google where the backend verifies it via
              Google's userinfo endpoint. */}
          <button
            type="button"
            onClick={() => googleLogin()}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-3 py-2.5 min-h-11 px-4 rounded-md border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 hover:border-slate-300 transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.29 1.48-1.14 2.73-2.4 3.58v3h3.88c2.28-2.1 3.57-5.18 3.57-8.82z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.07.72-2.45 1.16-4.05 1.16-3.12 0-5.76-2.11-6.7-4.94H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
              <path fill="#FBBC04" d="M5.3 14.3c-.24-.72-.38-1.49-.38-2.3s.14-1.58.38-2.3V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l4.01-3.09z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l4.01 3.09C6.24 6.86 8.88 4.75 12 4.75z"/>
            </svg>
            {submitting ? "Signing in..." : "Sign in with Google"}
          </button>

          {/* Sign Up link */}
          {onOpenSignup && (
            <p className="text-center text-sm text-slate-600">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={onOpenSignup}
                className="font-semibold text-sky-700 hover:underline rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                Sign Up
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
