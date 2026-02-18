import { useState } from "react";
import Modal from "./Modal.jsx";
import AlertModal from "./AlertModal.jsx";

export default function SignupModal({ open, onClose, onSignedUp }) {
  const [alert, setAlert] = useState({
    open: false,
    type: "info",
    title: "Information",
    message: "",
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    terms: false,
    newsletter: false,
  });

  function setField(key, value) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function closeAlert() {
    const wasSuccess = alert.type === "success";
    setAlert((s) => ({ ...s, open: false }));

    if (wasSuccess) {
      // close signup modal + notify parent (Navbar) so it can log user in
      onClose?.();
      onSignedUp?.({
        name: form.name,
        email: form.email,
        phone: form.phone,
      });

      // reset after success
      setForm({
        name: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
        terms: false,
        newsletter: false,
      });
    }
  }

  function submit(e) {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      setAlert({
        open: true,
        type: "error",
        title: "Error",
        message: "Passwords do not match!",
      });
      return;
    }

    if (!form.terms) {
      setAlert({
        open: true,
        type: "error",
        title: "Error",
        message: "Please accept the Terms and Conditions to continue.",
      });
      return;
    }

    let msg =
      "Sign Up Successful! Welcome to Aplaya Beach Resort. Please check your email to verify your account.";
    msg += form.newsletter
      ? " You have been subscribed to our newsletter."
      : " You can subscribe to our newsletter anytime in your account settings.";

    setAlert({
      open: true,
      type: "success",
      title: "Success",
      message: msg,
    });
  }

  return (
    <>
      <Modal open={open} onClose={onClose} maxWidth="max-w-[520px]">
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏖️</span>
              <span className="text-lg font-bold text-blue-600">Aplaya Beach Resort</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-800"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <h2 className="text-center text-2xl font-bold text-gray-900 mb-6">
            Create Your Account
          </h2>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your full name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your phone number"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
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

            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md">
              Sign Up
            </button>
          </form>

          <p className="text-center mt-5 text-sm text-gray-600">
            Already have an account?{" "}
            <span className="font-medium text-blue-600">
              Use the Login button.
            </span>
          </p>
        </div>
      </Modal>

      <AlertModal
        open={alert.open}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
    </>
  );
}