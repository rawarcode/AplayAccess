import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../context/AuthContext.jsx";
import { verifyEmailRequest, resendVerificationRequest } from "../lib/authApi.js";

export default function VerifyEmail() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef([]);

  // Redirect if already verified
  useEffect(() => {
    if (user?.email_verified_at) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

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
      setSuccess("Email verified! Redirecting...");
      setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
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
          <p className="text-sm text-slate-500 mb-6">
            We sent a 6-digit code to <strong className="text-slate-700">{user?.email || "your email"}</strong>. Enter it below to continue.
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
                  className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition"
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

          <div className="mt-6 text-sm text-slate-500">
            Didn't receive the code?{" "}
            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="font-medium text-sky-600 hover:text-sky-700 disabled:text-slate-400 disabled:cursor-not-allowed transition"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending..." : "Resend Code"}
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-400">Code expires in 15 minutes.</p>
        </div>
      </div>
    </div>
  );
}
