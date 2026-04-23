// src/pages/Login.jsx
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { loginWithEmail } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  const next = new URLSearchParams(location.search).get("next") || "/dashboard";

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Invalid email or password. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative auth-surface"
    >
      <Helmet><title>Sign In — Aplaya Beach Resort</title></Helmet>

      {/* Background accents */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-20">
        <i className="fas fa-umbrella-beach absolute text-7xl bottom-5 right-8 text-coastal-decor rotate-6"></i>
        <i className="fas fa-circle absolute text-5xl left-5 top-8 text-coastal-decor-light -rotate-12"></i>
      </div>

      {/* Card */}
      <div
        className="relative z-20 bg-white rounded-[48px] shadow-2xl max-w-4xl w-full flex flex-wrap overflow-hidden border border-coastal-border-alt animate-hero-fade-in [animation-delay:0.1s] opacity-0"
        style={{ boxShadow: "0 30px 50px -30px rgba(0,80,100,0.25), 0 6px 12px rgba(0,0,0,0.02)" }}
      >
        {/* Left — Branding */}
        <div className="flex-1 min-w-[280px] bg-coastal-bg p-12 flex flex-col justify-between border-r border-coastal-border-alt">
          <div>
            <div className="flex items-center gap-2">
              <i className="fas fa-umbrella-beach text-4xl text-brand"></i>
              <span className="text-3xl font-light text-brand tracking-tight">AplayAccess</span>
            </div>
            <div className="mt-10 mb-4">
              <h2 className="font-light text-3xl text-brand leading-tight">
                welcome back,<br />team
              </h2>
              <p className="text-coastal-text font-light mt-3">
                <i className="fas fa-shield-halved text-coastal-accent mr-2"></i>
                staff portal — sign in to access your dashboard
              </p>
            </div>

            {/* Features */}
            <div className="mt-6 space-y-2 text-sm text-coastal-text">
              <div className="flex items-center gap-2">
                <i className="fas fa-circle-dot text-coastal-accent text-xs"></i>
                <span>Manage bookings & check-ins</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-circle-dot text-coastal-accent text-xs"></i>
                <span>Monitor resort operations</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-circle-dot text-coastal-accent text-xs"></i>
                <span>View reports & analytics</span>
              </div>
            </div>
          </div>

          <div className="text-coastal-text-muted font-light text-sm border-t border-dashed border-coastal-border pt-6">
            <i className="fas fa-map-pin text-coastal-accent mr-2"></i>
            Aplaya Beach Resort · Cavite
          </div>
        </div>

        {/* Right — Login form */}
        <div className="flex-1 min-w-[340px] bg-white p-12">
          <div className="flex items-center gap-2 mb-10">
            <i className="fas fa-lock-open text-2xl text-brand bg-coastal-bg-accent p-3 rounded-full"></i>
            <h1 className="sr-only">Sign in to AplayAccess</h1>
            <h2 className="font-light text-3xl text-brand">Sign In</h2>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">
              <i className="fas fa-exclamation-circle mr-2"></i>
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div className="relative mb-6">
              <i className="fas fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-coastal-accent text-xl"></i>
              <label htmlFor="login-email" className="sr-only">Email address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Email address"
                className="w-full py-4 pl-14 pr-6 bg-coastal-bg-alt border border-coastal-border rounded-[34px] text-brand outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand focus:bg-white transition-all placeholder:text-coastal-placeholder"
              />
            </div>

            <div className="relative mb-3">
              <i className="fas fa-lock absolute left-5 top-1/2 -translate-y-1/2 text-coastal-accent text-xl"></i>
              <label htmlFor="login-password" className="sr-only">Password</label>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-label="Password"
                className="w-full py-4 pl-14 pr-14 bg-coastal-bg-alt border border-coastal-border rounded-[34px] text-brand outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand focus:bg-white transition-all placeholder:text-coastal-placeholder"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-coastal-accent hover:text-brand transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
              </button>
            </div>

            <div className="flex justify-end mb-6">
              <Link to="/forgot-password" className="text-xs text-coastal-accent hover:text-brand transition">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-brand text-white rounded-[60px] font-medium text-xl shadow-lg flex items-center justify-center gap-3 transition-all hover:bg-brand-dark hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60"
              style={{ boxShadow: "0 8px 18px -6px #5f9db2" }}
            >
              <i className="fas fa-arrow-right-to-bracket"></i>
              {loading ? "signing in..." : "log in"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/resort"
              className="text-xs text-coastal-accent hover:text-brand transition"
            >
              <i className="fas fa-arrow-left mr-1"></i>
              Back to resort
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
