// src/pages/ForgotPassword.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { forgotPasswordRequest } from "../lib/authApi.js";

export default function ForgotPassword() {
  const [email, setEmail]         = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [cooldown, setCooldown]   = useState(0);

  async function submit(e) {
    e.preventDefault();
    if (cooldown > 0) return;
    setError("");
    setLoading(true);
    try {
      await forgotPasswordRequest(email);
      setSubmitted(true);
      // 60s cooldown to prevent spam
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Something went wrong. Please try again.";
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
      <Helmet><title>Forgot Password — Aplaya Beach Resort</title></Helmet>

      <div
        className="w-full max-w-[440px] bg-white rounded-3xl shadow-2xl p-8 animate-hero-fade-in opacity-0"
        style={{ boxShadow: "0 30px 50px -30px rgba(0,80,100,0.25), 0 6px 12px rgba(0,0,0,0.02)" }}
      >
        {/* Logo */}
        <div className="flex justify-center items-center gap-2 mb-6">
          <i className="fas fa-umbrella-beach text-3xl text-[#1e3a8a]"></i>
          <span className="text-2xl font-light text-[#1e3a8a] tracking-tight">AplayAccess</span>
        </div>

        {!submitted ? (
          <>
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-full bg-[#e1f1f7] flex items-center justify-center">
                <i className="fas fa-key text-2xl text-[#1e3a8a]"></i>
              </div>
            </div>

            <h2 className="text-center text-2xl font-light text-[#1e3a8a] mb-2">Forgot Password?</h2>
            <p className="text-center text-sm text-[#4a6f8c] mb-6">
              Enter your email and we&apos;ll send you reset instructions.
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <i className="fas fa-exclamation-circle mr-2"></i>
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#4a6f8c] mb-1">Email Address</label>
                <div className="relative">
                  <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-[#5f9db2]"></i>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    autoComplete="email"
                    className="w-full py-3 pl-12 pr-4 bg-[#f3fafd] border border-[#cde3ec] rounded-2xl text-[#1e3a8a] outline-none focus:border-[#1e3a8a] focus:bg-white transition-all placeholder:text-[#9dbecb]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || cooldown > 0}
                className="w-full py-3 bg-[#1e3a8a] text-white rounded-full font-medium text-lg shadow-lg flex items-center justify-center gap-2 transition-all hover:bg-[#152c6e] hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:hover:translate-y-0"
                style={{ boxShadow: "0 8px 18px -6px #5f9db2" }}
              >
                <i className="fas fa-paper-plane"></i>
                {loading ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Send Reset Link"}
              </button>
            </form>

            <div className="mt-5 p-3 bg-[#f3fafd] rounded-xl text-sm text-[#4a6f8c] border border-[#e2edf2]">
              <p className="font-medium mb-1">
                <i className="fas fa-circle-info text-[#5f9db2] mr-1"></i>
                Need immediate help?
              </p>
              <p>Contact us at{" "}
                <a href="mailto:aplayabeachresortph@gmail.com" className="text-[#1e3a8a] underline">
                  aplayabeachresortph@gmail.com
                </a>
              </p>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <i className="fas fa-check text-green-600 text-2xl"></i>
            </div>
            <h2 className="text-2xl font-light text-[#1e3a8a] mb-2">Check Your Email</h2>
            <p className="text-[#4a6f8c] mb-2">
              If <span className="font-medium text-[#1e3a8a]">{email}</span> is registered, you&apos;ll receive
              reset instructions shortly.
            </p>
            <p className="text-sm text-[#6b8cae] mb-6">
              Didn&apos;t get an email? Check your spam folder or contact{" "}
              <a href="mailto:aplayabeachresortph@gmail.com" className="text-[#1e3a8a] underline">
                our support team
              </a>.
            </p>
            <button
              onClick={() => { setSubmitted(false); setEmail(""); setError(""); }}
              className="text-sm text-[#1e3a8a] hover:underline font-medium"
            >
              <i className="fas fa-arrow-left mr-1"></i>
              Try a different email
            </button>
          </div>
        )}

        <p className="text-center mt-6 text-sm text-[#6b8cae]">
          Remember your password?{" "}
          <Link to="/staff-login" className="font-semibold text-[#1e3a8a] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
