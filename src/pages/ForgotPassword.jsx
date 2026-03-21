// src/pages/ForgotPassword.jsx
import { useState } from "react";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const [email, setEmail]       = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submit(e) {
    e.preventDefault();
    // For the capstone MVP, we just show a success message.
    // A real implementation would call POST /api/forgot-password.
    setSubmitted(true);
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

          {!submitted ? (
            <>
              <h2 className="text-center text-2xl font-bold text-gray-900 mb-2">Forgot Password?</h2>
              <p className="text-center text-sm text-gray-500 mb-6">
                Enter your email and we&apos;ll send you reset instructions.
              </p>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md transition"
                >
                  Send Reset Link
                </button>
              </form>

              <div className="mt-4 p-3 bg-blue-50 rounded-md text-sm text-blue-700">
                <p className="font-medium mb-1">Need immediate help?</p>
                <p>Contact us at{" "}
                  <a href="mailto:reservations@aplayabeachresort.com" className="underline">
                    reservations@aplayabeachresort.com
                  </a>
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Success state */}
              <div className="text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <span className="text-green-600 text-3xl">✓</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
                <p className="text-gray-600 mb-2">
                  If <span className="font-medium">{email}</span> is registered, you&apos;ll receive reset instructions shortly.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Didn&apos;t get an email? Check your spam folder or contact{" "}
                  <a href="mailto:reservations@aplayabeachresort.com" className="text-blue-600 underline">
                    our support team
                  </a>
                  .
                </p>
                <button
                  onClick={() => { setSubmitted(false); setEmail(""); }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Try a different email
                </button>
              </div>
            </>
          )}

          <p className="text-center mt-6 text-sm text-gray-600">
            Remember your password?{" "}
            <Link to="/login" className="font-medium text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
