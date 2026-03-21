import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AlertModal from "../components/modals/AlertModal.jsx";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";
import { registerRequest } from "../lib/authApi.js";
import { useAuth } from "../context/AuthContext.jsx";
import { TOKEN_KEY } from "../lib/api.js";

export default function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);

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
    if (wasSuccess) {
      navigate("/dashboard");
    }
  }

  async function submit(e) {
    e.preventDefault();

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

      // Store token and user in context
      if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
      if (data.user) login(data.user);

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
    <div className="pt-16 min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[450px] bg-white rounded-lg shadow-lg p-8">
          {/* Logo */}
          <div className="flex justify-center items-center gap-2 mb-6">
            <span className="text-3xl">🏖️</span>
            <span className="text-2xl font-bold text-blue-600">Aplaya Beach Resort</span>
          </div>

          <h2 className="text-center text-2xl font-bold text-gray-900 mb-6">Create Your Account</h2>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your full name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your phone number"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Create a password"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm your password"
                value={form.confirmPassword}
                onChange={(e) => setField("confirmPassword", e.target.value)}
                required
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={form.terms}
                onChange={(e) => setField("terms", e.target.checked)}
              />
              <span>
                I agree to the{" "}
                <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                  Terms and Conditions
                </a>{" "}
                and{" "}
                <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                  Privacy Policy
                </a>
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={form.newsletter}
                onChange={(e) => setField("newsletter", e.target.checked)}
              />
              <span>Sign me up for the Aplaya Beach Resort newsletter (optional)</span>
            </label>

            <button
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-md"
            >
              {submitting ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <div className="text-center mt-6 text-sm text-gray-600">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-blue-600 hover:underline">
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