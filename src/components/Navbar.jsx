import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";

import LoginModal from "./modals/LoginModal.jsx";
import SignupModal from "./modals/SignupModal.jsx";

export default function Navbar() {
  const { user, login, logout } = useAuth();

  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

  useLockBodyScroll(loginOpen || signupOpen);

  function handleLoginSuccess(u) {
    login(u);
    setLoginOpen(false);
  }

  function handleSignupSuccess(u) {
    login(u);
    setSignupOpen(false);
  }

  return (
    <nav className="fixed w-full z-40 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">🏖️</span>
          <span className="text-xl font-bold text-blue-600">
            Aplaya Beach Resort
          </span>
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-4">
          <Link
            to="/resort"
            className="text-gray-700 hover:text-blue-600 text-sm font-medium"
          >
            Resort
          </Link>

          <Link
            to="/rooms"
            className="text-gray-700 hover:text-blue-600 text-sm font-medium"
          >
            Rooms
          </Link>

          <Link
            to="/gallery"
            className="text-gray-700 hover:text-blue-600 text-sm font-medium"
          >
            Gallery
          </Link>

          {/* Auth Area */}
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="text-gray-700 hover:text-blue-600 text-sm font-medium"
              >
                My Account
              </Link>

              <button
                onClick={logout}
                className="text-sm font-medium text-red-600 hover:text-red-800"
                type="button"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setLoginOpen(true)}
                className="text-gray-700 hover:text-blue-600 text-sm font-medium"
                type="button"
              >
                Login
              </button>

              <button
                onClick={() => setSignupOpen(true)}
                className="text-gray-700 hover:text-blue-600 text-sm font-medium"
                type="button"
              >
                Sign Up
              </button>
            </>
          )}

          {/* Book Now */}
          <Link
            to={user ? "/dashboard?book=1" : "/resort?book=1"}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Book Now
          </Link>
        </div>
      </div>

      {/* Modals */}
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <SignupModal
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
        onSignedUp={handleSignupSuccess}
      />
    </nav>
  );
}