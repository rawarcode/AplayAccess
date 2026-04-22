// src/pages/dashboard/VerifyEmailChange.jsx
//
// OTP landing page for the password-gated email-change flow. Reached
// two ways:
//
//   (1) Direct redirect from EditProfile after a successful PATCH
//       /api/profile where `email_change_pending: true` came back.
//   (2) The persistent "email change pending" banner in the dashboard
//       shell — lets the user complete the swap at any time later.
//
// Mirrors the shape of the existing signup-verification page but
// hits a different endpoint so we don't conflate the two flows:
// signup verification uses `email_otp` and sets `email_verified_at`;
// this flow uses `pending_email_otp` and additionally swaps the
// `email` column.

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext.jsx";
import { verifyEmailChange, resendEmailChangeOtp, cancelEmailChange } from "../../lib/profileApi.js";

export default function VerifyEmailChange() {
  const { user, login, booting } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // Celebration state replaces the form entirely for 2.5s after a
  // successful swap — same pattern as VerifyEmail.jsx so users
  // actually see confirmation before we navigate.
  const [verified, setVerified] = useState(false);
  const inputsRef = useRef([]);

  // Redirect guards:
  //  - Not logged in → back to home.
  //  - No pending email change on file → back to edit profile (either
  //    the user never started one, or they completed/cancelled in
  //    another tab).
  useEffect(() => {
    if (booting) return;
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    if (!user.pending_email && !verified) {
      navigate("/dashboard/profile", { replace: true });
    }
  }, [user, booting, navigate, verified]);

  // Cooldown timer for the Resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function handleChange(i, val) {
    if (val.length > 1) {
      const digits = val.replace(/\D/g, "").slice(0, 6).split("");
      const next = [...code];
      digits.forEach((d, idx) => { if (i + idx < 6) next[i + idx] = d; });
      setCode(next);
      const focusIdx = Math.min(i + digits.length, 5);
      inputsRef.current[focusIdx]?.focus();
      return;
    }
    if (val && !/^\d$/.test(val)) return;
    const next = [...code];
    next[i] = val;
    setCode(next);
    if (val && i < 5) inputsRef.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    const otp = code.join("");
    if (otp.length !== 6) { setError("Please enter the full 6-digit code."); return; }
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const data = await verifyEmailChange(otp);
      if (data.user) login(data.user);
      setVerified(true);
      setTimeout(() => navigate("/dashboard/profile", { replace: true }), 2500);
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setSuccess("");
    setResending(true);
    try {
      const data = await resendEmailChangeOtp();
      setSuccess(data?.message || "New code sent! Check your email.");
      setCooldown(60);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not resend code. Try again later.");
    } finally {
      setResending(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel the pending email change? Your account email will stay as it is.")) return;
    setCancelling(true);
    try {
      const data = await cancelEmailChange();
      if (data.user) login(data.user);
      navigate("/dashboard/profile", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || "Could not cancel. Try again later.");
      setCancelling(false);
    }
  }

  // ─── Celebration screen ────────────────────────────────────────────
  if (verified) {
    return (
      <div className="pt-16 min-h-screen bg-slate-50 flex flex-col">
        <Helmet><title>Email Updated — Aplaya Beach Resort</title></Helmet>
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-10 text-center" role="status" aria-live="polite">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5 animate-pulse">
              <i className="fas fa-check text-emerald-600 text-4xl" aria-hidden="true"></i>
            </div>
            <h2 className="text-3xl font-bold text-emerald-700 mb-2">Email Updated!</h2>
            <p className="text-sm text-slate-500 mb-6">
              Your account email is now <strong className="text-slate-700">{user?.email}</strong>. Redirecting…
            </p>
            <i className="fas fa-spinner fa-spin text-sky-500 text-lg" aria-hidden="true"></i>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen bg-slate-50 flex flex-col">
      <Helmet><title>Confirm New Email — Aplaya Beach Resort</title></Helmet>
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-envelope-circle-check text-amber-600 text-2xl"></i>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">Confirm your new email</h2>
          <p className="text-sm text-slate-500 mb-1">
            We sent a 6-digit code to
          </p>
          <p className="text-sm font-semibold text-slate-900 mb-6 break-all">
            {user?.pending_email || "your new email"}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-lg text-sm border border-rose-200">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-emerald-50 text-emerald-600 rounded-lg text-sm border border-emerald-200">
              <i className="fas fa-check-circle mr-2"></i>{success}
            </div>
          )}

          <form onSubmit={handleVerify}>
            <div className="flex justify-center gap-2 mb-6">
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={el => inputsRef.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition"
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || code.join("").length !== 6}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-medium rounded-lg transition inline-flex items-center justify-center gap-2"
            >
              {loading
                ? <><i className="fas fa-spinner fa-spin"></i> Confirming...</>
                : <><i className="fas fa-check-circle"></i> Confirm Email Change</>}
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-500">
            Didn't receive the code?{" "}
            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="font-medium text-amber-600 hover:text-amber-700 disabled:text-slate-400 disabled:cursor-not-allowed transition"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending..." : "Resend Code"}
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-400">Code expires in 15 minutes.</p>

          {/* Cancel — kills the pending change without waiting for the
              15-minute OTP expiry. Useful if the user typo'd the new
              address and wants to retry immediately. */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-2">Changed your mind?</p>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs text-slate-500 hover:text-rose-600 disabled:opacity-60 font-medium"
            >
              {cancelling
                ? <><i className="fas fa-spinner fa-spin mr-1"></i>Cancelling...</>
                : "Cancel pending email change"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
