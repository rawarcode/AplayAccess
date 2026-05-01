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
      className="min-h-screen flex items-center justify-center p-6 auth-surface"
    >
      <Helmet><title>Forgot Password — Aplaya Beach Resort</title></Helmet>

      <div
        className="w-full max-w-[440px] bg-white rounded-3xl shadow-2xl p-8 animate-hero-fade-in opacity-0"
        style={{ boxShadow: "0 30px 50px -30px rgba(0,80,100,0.25), 0 6px 12px rgba(0,0,0,0.02)" }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2">
            <i className="fas fa-umbrella-beach text-4xl text-brand"></i>
            <span className="text-3xl font-light text-brand tracking-tight">AplayAccess</span>
          </div>
        </div>

        {!submitted ? (
          <>
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-full bg-coastal-bg-accent flex items-center justify-center">
                <i className="fas fa-key text-2xl text-brand"></i>
              </div>
            </div>

            <h2 className="text-center text-2xl font-light text-brand mb-2">Forgot Password?</h2>
            <p className="text-center text-sm text-coastal-text mb-6">
              Enter your email and we&apos;ll send you reset instructions.
            </p>

            {error && (
              <div role="alert" aria-live="assertive" className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                <i className="fas fa-exclamation-circle mr-2" aria-hidden="true"></i>
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-coastal-text mb-1">Email Address</label>
                <div className="relative">
                  <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-coastal-accent"></i>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    autoComplete="email"
                    className="w-full py-3 pl-12 pr-4 bg-coastal-bg-alt border border-coastal-border rounded-2xl text-brand outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand focus:bg-white transition-all placeholder:text-coastal-placeholder"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || cooldown > 0}
                className="w-full py-3 bg-brand text-white rounded-full font-medium text-lg shadow-lg auth-cta-shadow flex items-center justify-center gap-2 transition-all hover:bg-brand-dark hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:hover:translate-y-0"
              >
                <i className="fas fa-paper-plane"></i>
                {loading ? <><i className="fas fa-spinner fa-spin text-sm"></i> Sending...</> : cooldown > 0 ? `Resend in ${cooldown}s` : "Send Reset Link"}
              </button>
            </form>

            <div className="mt-5 p-3 bg-coastal-bg-alt rounded-xl text-sm text-coastal-text border border-coastal-border-alt">
              <p className="font-medium mb-1">
                <i className="fas fa-circle-info text-coastal-accent mr-1"></i>
                Need immediate help?
              </p>
              <p>Contact us at{" "}
                <a href="mailto:aplayabeachresortph@gmail.com" className="text-brand underline">
                  aplayabeachresortph@gmail.com
                </a>
              </p>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <i className="fas fa-check text-emerald-600 text-2xl"></i>
            </div>
            <h2 className="text-2xl font-light text-brand mb-2">Check Your Email</h2>
            <p className="text-coastal-text mb-2">
              If <span className="font-medium text-brand">{email}</span> is registered, you&apos;ll receive
              reset instructions shortly.
            </p>
            <p className="text-sm text-coastal-text-muted mb-6">
              Didn&apos;t get an email? Check your spam folder or contact{" "}
              <a href="mailto:aplayabeachresortph@gmail.com" className="text-brand underline">
                our support team
              </a>.
            </p>
            <button
              onClick={() => { setSubmitted(false); setEmail(""); setError(""); }}
              type="button"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-11 text-sm text-brand hover:bg-coastal-bg-alt rounded-md font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <i className="fas fa-arrow-left" aria-hidden="true"></i>
              Try a different email
            </button>
          </div>
        )}

        <p className="text-center mt-6 text-sm text-coastal-text-muted">
          Remember your password?{" "}
          <Link to="/resort" className="font-semibold text-brand hover:underline">
            Back to Resort
          </Link>
        </p>
      </div>
    </div>
  );
}
