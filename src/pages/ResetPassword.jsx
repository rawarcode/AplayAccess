// src/pages/ResetPassword.jsx
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { resetPasswordRequest } from "../lib/authApi.js";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();

  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword]               = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState("");
  const [done, setDone]                       = useState(false);

  const passwordWeak = password.length > 0 && password.length < 8;
  const mismatch     = passwordConfirm.length > 0 && passwordConfirm !== password;

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token || !email) {
      setError("Invalid or expired reset link. Please request a new one.");
      return;
    }

    setLoading(true);
    try {
      const data = await resetPasswordRequest({
        token,
        email,
        password,
        password_confirmation: passwordConfirm,
      });
      setDone(true);
      const role = data?.role;
      const dest = (role === "front_desk" || role === "owner") ? "/staff-login" : "/resort";
      setTimeout(() => navigate(dest), 3000);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Failed to reset password. The link may have expired.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "radial-gradient(circle at 10% 30%, #d4e9f5, #f8ffff)" }}
    >
      <Helmet><title>Reset Password — Aplaya Beach Resort</title></Helmet>

      <div
        className="w-full max-w-[440px] bg-white rounded-3xl shadow-2xl p-8 animate-hero-fade-in opacity-0"
        style={{ boxShadow: "0 30px 50px -30px rgba(0,80,100,0.25), 0 6px 12px rgba(0,0,0,0.02)" }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.jpg" alt="Aplaya Cottages & Rentals" className="h-20 w-auto" />
          <span className="text-lg font-semibold text-brand mt-2">Aplaya Cottages & Rentals</span>
        </div>

        {done ? (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <i className="fas fa-check text-emerald-600 text-2xl"></i>
            </div>
            <h2 className="text-2xl font-light text-brand mb-2">Password Reset!</h2>
            <p className="text-coastal-text mb-4">
              Your password has been updated successfully.
            </p>
            <p className="text-sm text-coastal-text-muted">
              <i className="fas fa-spinner fa-spin mr-1"></i>
              Redirecting you to login...
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-full bg-coastal-bg-accent flex items-center justify-center">
                <i className="fas fa-shield-halved text-2xl text-brand"></i>
              </div>
            </div>

            <h2 className="text-center text-2xl font-light text-brand mb-2">Set New Password</h2>
            <p className="text-center text-sm text-coastal-text mb-1">Resetting password for</p>
            <p className="text-center text-sm font-medium text-brand mb-6 truncate">{email}</p>

            {error && (
              <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                <i className="fas fa-exclamation-circle mr-2"></i>
                {error}{" "}
                {error.includes("expired") && (
                  <Link to="/forgot-password" className="font-medium underline">
                    Request a new link
                  </Link>
                )}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-coastal-text mb-1">New Password</label>
                <div className="relative">
                  <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-coastal-accent"></i>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className={`w-full py-3 pl-12 pr-12 bg-coastal-bg-alt border rounded-2xl text-brand outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand focus:bg-white transition-all placeholder:text-coastal-placeholder ${passwordWeak ? "border-amber-400" : "border-coastal-border"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-coastal-accent hover:text-brand transition"
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
                {password.length >= 8 && (
                  <p className="text-xs text-emerald-600 mt-1">
                    <i className="fas fa-check-circle mr-1"></i>
                    Password length is good
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-coastal-text mb-1">Confirm New Password</label>
                <div className="relative">
                  <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-coastal-accent"></i>
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Repeat your new password"
                    autoComplete="new-password"
                    className={`w-full py-3 pl-12 pr-12 bg-coastal-bg-alt border rounded-2xl text-brand outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand focus:bg-white transition-all placeholder:text-coastal-placeholder ${mismatch ? "border-rose-400" : "border-coastal-border"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-coastal-accent hover:text-brand transition"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    <i className={`fas ${showConfirm ? "fa-eye-slash" : "fa-eye"}`}></i>
                  </button>
                </div>
                {mismatch && (
                  <p className="text-xs text-rose-500 mt-1">
                    <i className="fas fa-exclamation-circle mr-1"></i>
                    Passwords do not match
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand text-white rounded-full font-medium text-lg shadow-lg flex items-center justify-center gap-2 transition-all hover:bg-brand-dark hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:hover:translate-y-0"
                style={{ boxShadow: "0 8px 18px -6px #5f9db2" }}
              >
                <i className="fas fa-shield-halved"></i>
                {loading ? <><i className="fas fa-spinner fa-spin text-sm"></i> Updating...</> : "Reset Password"}
              </button>
            </form>
          </>
        )}

        <p className="text-center mt-6 text-sm text-coastal-text-muted">
          <Link to="/resort" className="font-semibold text-brand hover:underline">
            <i className="fas fa-arrow-left mr-1"></i>
            Back to Resort
          </Link>
        </p>
      </div>
    </div>
  );
}
