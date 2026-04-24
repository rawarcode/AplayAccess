import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import AlertModal from "../components/modals/AlertModal.jsx";
import PasswordRequirements, { checkPasswordStrength } from "../components/ui/PasswordRequirements.jsx";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";
import { registerRequest } from "../lib/authApi.js";
import { useAuth } from "../context/AuthContext.jsx";
import { api, TOKEN_KEY } from "../lib/api.js";

export default function Signup() {
  const navigate = useNavigate();
  const { login, refreshUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [alert, setAlert] = useState({ open: false, type: "info", title: "Information", message: "" });
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    terms: false,
    newsletter: false,
  });

  useLockBodyScroll(alert.open);

  function setField(key, value) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function closeAlert() {
    const wasSuccess = alert.type === "success";
    setAlert((s) => ({ ...s, open: false }));
    // Land unverified guests on the dashboard. The persistent
    // UnverifiedEmailBanner there nudges them to verify, and the
    // booking flow blocks unverified users with a clear CTA — so
    // we don't need to pin them on a verify-only page while the OTP
    // email is in flight.
    if (wasSuccess) {
      navigate("/dashboard");
    }
  }

  async function submit(e) {
    e.preventDefault();

    // Match Laravel's Password::defaults() on the backend so a password
    // that passes here also passes the /api/register validator.
    // Prevents "looks fine client-side, server rejected" surprises.
    if (!checkPasswordStrength(form.password)) {
      setAlert({ open: true, type: "error", title: "Weak Password", message: "Your password must meet all the strength requirements shown below the password field." });
      return;
    }
    if (form.password !== form.confirmPassword) {
      setAlert({ open: true, type: "error", title: "Error", message: "Passwords do not match!" });
      return;
    }
    if (!form.terms) {
      setAlert({ open: true, type: "error", title: "Error", message: "Please accept the Terms and Conditions to continue." });
      return;
    }

    setSubmitting(true);
    try {
      const data = await registerRequest({
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        password: form.password,
        password_confirmation: form.confirmPassword,
      });

      // Store token first so refreshUser's /api/me call is authenticated.
      if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
      // Set user immediately for snappy UI, then re-fetch canonical data
      // from /api/me so UnverifiedEmailBanner and other hooks see the
      // exact shape the app relies on elsewhere (avoids subtle drift
      // between register-response shape and me-response shape).
      if (data.user) login(data.user);
      await refreshUser();

      // Subscribe to newsletter if opted in
      if (form.newsletter && form.email) {
        try { await api.post("/api/newsletter", { email: form.email }); } catch {}
      }

      setAlert({
        open: true,
        type: "success",
        title: "Success",
        message: "Sign Up Successful! Welcome to Aplaya Beach Resort.",
      });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Sign up failed. Please try again.";
      setAlert({ open: true, type: "error", title: "Error", message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pt-16 min-h-screen bg-slate-50 flex flex-col">
      <Helmet><title>Sign Up — Aplaya Beach Resort</title></Helmet>
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[450px] bg-white rounded-lg shadow-lg p-8">
          {/* Logo */}
          <div className="flex justify-center items-center gap-2 mb-6">
            <span className="text-3xl">🏖️</span>
            <span className="text-2xl font-bold text-sky-600">Aplaya Beach Resort</span>
          </div>

          <h1 className="sr-only">Create an account</h1>
          <h2 className="text-center text-2xl font-bold text-slate-900 mb-6">Create Your Account</h2>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="signup-name" className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                id="signup-name"
                className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Enter your full name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input
                id="signup-email"
                type="email"
                className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Enter your email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="signup-phone" className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                id="signup-phone"
                type="tel"
                className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Enter your phone number"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPass ? "text" : "password"}
                  className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Create a password"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  required
                  minLength={8}
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  aria-label={showPass ? "Hide password" : "Show password"}>
                  <i className={`fas ${showPass ? "fa-eye-slash" : "fa-eye"} text-sm`}></i>
                </button>
              </div>
              {/* Live strength checklist — rules mirror the backend's
                  Password::defaults() policy exactly. Submit button is
                  disabled below until every rule turns green. */}
              <PasswordRequirements value={form.password} />
            </div>

            <div>
              <label htmlFor="signup-confirm" className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  id="signup-confirm"
                  type={showConfirm ? "text" : "password"}
                  className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Confirm your password"
                  value={form.confirmPassword}
                  onChange={(e) => setField("confirmPassword", e.target.value)}
                  required
                  minLength={8}
                />
                <button type="button" onClick={() => setShowConfirm(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  aria-label={showConfirm ? "Hide password" : "Show password"}>
                  <i className={`fas ${showConfirm ? "fa-eye-slash" : "fa-eye"} text-sm`}></i>
                </button>
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={form.terms}
                onChange={(e) => setField("terms", e.target.checked)}
              />
              <span>
                I agree to the{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-sky-600 hover:text-sky-500">
                  Terms and Conditions
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-sky-600 hover:text-sky-500">
                  Privacy Policy
                </a>
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={form.newsletter}
                onChange={(e) => setField("newsletter", e.target.checked)}
              />
              <span>Sign me up for the Aplaya Beach Resort newsletter (optional)</span>
            </label>

            {/* Submit disabled until: all strength rules pass, passwords
                match, terms accepted. Tooltip spells out the reason so
                users aren't left staring at a greyed-out button. */}
            {(() => {
              const pwStrong      = checkPasswordStrength(form.password);
              const pwMatch       = form.password && form.password === form.confirmPassword;
              const canSubmit     = pwStrong && pwMatch && form.terms;
              const blockedReason = !pwStrong ? 'Password does not meet all strength requirements.'
                                  : !pwMatch  ? 'Passwords do not match.'
                                  : !form.terms ? 'Please accept the Terms and Conditions.'
                                  : undefined;
              return (
                <button
                  disabled={submitting || !canSubmit}
                  title={blockedReason}
                  className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-md"
                >
                  {submitting ? <><i className="fas fa-spinner fa-spin mr-2"></i>Creating account...</> : "Sign Up"}
                </button>
              );
            })()}
          </form>

          <div className="text-center mt-6 text-sm text-slate-600">
            Already have an account?{" "}
            <Link to="/resort" className="font-medium text-sky-600 hover:underline">
              Login here
            </Link>
          </div>
        </div>
      </div>

      {/* reuse Layout footer normally; no extra footer here */}

      <AlertModal
        open={alert.open}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
    </div>
  );
}