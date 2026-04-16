// src/components/modals/LoginModal.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { GoogleLogin } from "@react-oauth/google";

export default function LoginModal({ open, onClose, onLoginSuccess, onOpenSignup }) {
  const { loginWithEmail, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  async function handleGoogleSuccess(credentialResponse) {
    setError("");
    setSubmitting(true);
    try {
      const u = await loginWithGoogle(credentialResponse.credential);
      onLoginSuccess?.(u);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Google sign-in failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-[92vw] max-w-lg rounded-xl bg-white shadow-xl animate-hero-fade-in opacity-0">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold text-slate-900">Login to Your Account</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close login modal"
          >
            <i className="fas fa-times"></i>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                onClick={onClose}
                className="text-xs text-sky-600 hover:text-sky-700 hover:underline transition"
              >
                Forgot password?
              </Link>
            </div>

            <button
              disabled={submitting}
              className="w-full rounded-md bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-medium py-2.5 transition"
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

          {/* Google Sign-In */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google sign-in failed. Please try again.")}
              size="large"
              width="100%"
              text="signin_with"
              shape="pill"
              theme="outline"
            />
          </div>

          {/* Sign Up link */}
          {onOpenSignup && (
            <p className="text-center text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={onOpenSignup}
                className="font-semibold text-sky-600 hover:underline"
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
