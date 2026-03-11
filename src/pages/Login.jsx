// src/pages/Login.jsx
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { loginWithEmail } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  // Support ?next=/dashboard/bookings redirect after login
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
    <div className="pt-16 min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px] bg-white rounded-lg shadow-lg p-8">

          {/* Logo */}
          <div className="flex justify-center items-center gap-2 mb-6">
            <span className="text-3xl">🏖️</span>
            <span className="text-2xl font-bold text-blue-600">Aplaya Beach Resort</span>
          </div>

          <h2 className="text-center text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
          <p className="text-center text-sm text-gray-500 mb-6">Sign in to manage your bookings</p>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-md transition"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="font-medium text-blue-600 hover:underline">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
