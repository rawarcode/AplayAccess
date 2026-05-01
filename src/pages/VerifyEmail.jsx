import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../context/AuthContext.jsx";
import { verifyEmailRequest, resendVerificationRequest } from "../lib/authApi.js";

export default function VerifyEmail() {
  const { user, login, logout, booting } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // `verified` controls a big full-card celebration state that replaces
  // the form entirely when true — much more visible than the old small
  // green-text banner. Stays on screen for 2.5s before auto-navigating
  // to /dashboard, giving users time to actually see it succeeded.
  const [verified, setVerified] = useState(false);
  const inputsRef = useRef([]);

  // Redirect if already verified, OR if user logged out (no session)
  useEffect(() => {
    if (booting) return;
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    if (user.email_verified_at) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, booting, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function handleChange(i, val) {
    if (val.length > 1) {
      // Handle paste
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
      const data = await verifyEmailRequest(otp);
      if (data.user) login(data.user);
      // Show the big celebration card for 2.5s, then land on dashboard.
      // sessionStorage flag survives the navigate so GuestDashboard
      // can fire a follow-up success toast on arrival — belt + braces.
      sessionStorage.setItem("aplaya_just_verified", "1");
      setVerified(true);
      setTimeout(() => navigate("/dashboard", { replace: true }), 2500);
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
      await resendVerificationRequest();
      setSuccess("New code sent! Check your email.");
      setCooldown(60);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not resend code. Try again later.");
    } finally {
      setResending(false);
    }
  }

  // ─── Celebration screen ────────────────────────────────────────────
  // Shown for 2.5s after successful verification. Replaces the form
  // entirely so the user can't miss it.
  if (verified) {
    return (
      <div className="pt-16 min-h-screen bg-slate-50 flex flex-col">
        <Helmet><title>Email Verified — Aplaya Beach Resort</title></Helmet>
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-10 text-center" role="status" aria-live="polite">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5 animate-pulse">
              <i className="fas fa-check text-emerald-600 text-4xl" aria-hidden="true"></i>
            </div>
            <h2 className="text-3xl font-bold text-emerald-700 mb-2">Email Verified!</h2>
            <p className="text-sm text-slate-600 mb-6">
              You're all set, <strong className="text-slate-800">{user?.name?.split(' ')[0] || 'there'}</strong>. Redirecting you to your dashboard…
            </p>
            <i className="fas fa-spinner fa-spin text-sky-500 text-lg" aria-hidden="true"></i>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen bg-slate-50 flex flex-col">
      <Helmet><title>Verify Email — Aplaya Beach Resort</title></Helmet>
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-envelope-open-text text-sky-600 text-2xl"></i>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">Verify Your Email</h2>
          <p className="text-sm text-slate-600 mb-6">
            We sent a 6-digit code to <strong className="text-slate-800">{user?.email || "your email"}</strong>. Enter it below to continue.
          </p>

          {error && (
            <div id="verify-email-page-error" role="alert" aria-live="assertive" className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-lg text-sm border border-rose-200">
              <i className="fas fa-exclamation-circle mr-2" aria-hidden="true"></i>{error}
            </div>
          )}
          {success && (
            <div role="status" aria-live="polite" className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm border border-emerald-200">
              <i className="fas fa-check-circle mr-2" aria-hidden="true"></i>{success}
            </div>
          )}

          <form onSubmit={handleVerify}>
            {/* OTP inputs */}
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
                  className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition aria-[invalid=true]:border-rose-300"
                  aria-label={`Digit ${i + 1} of 6`}
                  aria-invalid={error ? "true" : undefined}
                  aria-describedby={error ? "verify-email-page-error" : undefined}
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || code.join("").length !== 6}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-medium rounded-lg transition inline-flex items-center justify-center gap-2"
            >
              {loading ? <><i className="fas fa-spinner fa-spin"></i> Verifying...</> : <><i className="fas fa-check-circle"></i> Verify Email</>}
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-600">
            Didn't receive the code?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              aria-label={cooldown > 0 ? `Resend code — available in ${cooldown} seconds` : 'Resend code'}
              className="font-medium text-sky-700 hover:text-sky-800 disabled:text-slate-400 disabled:cursor-not-allowed transition rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending..." : "Resend Code"}
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-600">Code expires in 15 minutes.</p>

          {/* Escape route — guests who used the wrong email or lost
              access to their inbox were previously stuck on this
              page with no way out except Resend. Sign-out lets them
              start fresh with a different account. */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { logout?.(); navigate("/", { replace: true }); }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-11 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <i className="fas fa-arrow-right-from-bracket" aria-hidden="true"></i>
              Sign out and use a different email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
