import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";
import { useContent, DEFAULT_NAVBAR } from "../context/ContentContext.jsx";

import LoginModal from "./modals/LoginModal.jsx";
import SignupModal from "./modals/SignupModal.jsx";
import VerifyEmailModal from "./modals/VerifyEmailModal.jsx";
import Toast, { useToast } from "./ui/Toast.jsx";

export default function Navbar() {
  const { user, login, logout } = useAuth();
  const [toast, showToast, clearToast, toastType] = useToast();

  const [loginOpen,  setLoginOpen]  = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [menuOpen,   setMenuOpen]   = useState(false);
  // Opened immediately after a fresh (unverified) signup. Google
  // signups skip this — backend marks them verified since Google
  // confirmed the email.
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [pendingWelcomeName, setPendingWelcomeName] = useState("");

  const siteContent = useContent();
  const brand = siteContent?.page_navbar
    ? { ...DEFAULT_NAVBAR, ...siteContent.page_navbar }
    : DEFAULT_NAVBAR;

  useLockBodyScroll(loginOpen || signupOpen || menuOpen);

  function handleLoginSuccess(u) {
    login(u);
    setLoginOpen(false);
    showToast(`Welcome back, ${u?.name || ""}!`, "success");
  }

  function handleSignupSuccess(u) {
    login(u);
    setSignupOpen(false);
    // Verified signups (Google) go straight to a welcome toast.
    // Unverified signups (email+password) see the OTP modal right
    // away — the welcome toast fires when they close it.
    if (u?.email_verified_at) {
      showToast(`Welcome, ${u?.name || ""}!`, "success");
    } else {
      setPendingWelcomeName(u?.name || "");
      setVerifyOpen(true);
    }
  }

  return (
    <nav className="fixed w-full z-40 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
        {/* Logo — routes to / (Home). Convention is that the brand
            lockup always takes users back to the site root; previously
            this pointed at /resort, which made clicking the logo a
            no-op when the user was already on the resort page and
            hid the Home route entirely. */}
        <Link to="/" className="flex items-center gap-2">
          {brand.logoImage
            ? <img src={brand.logoImage} alt={brand.siteName} className="h-8 w-auto object-contain" loading="eager" decoding="async" />
            : <span className="text-2xl">🏖️</span>
          }
          <span className="text-xl font-bold text-blue-600">{brand.siteName}</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-4">
          <Link to="/" className="text-gray-700 hover:text-blue-600 text-sm font-medium">Home</Link>
          <Link to="/resort" className="text-gray-700 hover:text-blue-600 text-sm font-medium">Resort</Link>
          <Link to="/rooms" className="text-gray-700 hover:text-blue-600 text-sm font-medium">Rooms</Link>
          <Link to="/gallery" className="text-gray-700 hover:text-blue-600 text-sm font-medium">Gallery</Link>

          {user ? (
            <>
              <Link to="/dashboard" className="text-gray-700 hover:text-blue-600 text-sm font-medium">My Account</Link>
              <button onClick={logout} className="text-sm font-medium text-red-600 hover:text-red-800" type="button">Logout</button>
            </>
          ) : (
            <button onClick={() => setLoginOpen(true)} className="text-gray-700 hover:text-blue-600 text-sm font-medium" type="button">Login</button>
          )}

          <Link
            to={user ? "/dashboard?book=1" : "/resort?book=1"}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Book Now
          </Link>
        </div>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          <Link
            to={user ? "/dashboard?book=1" : "/resort?book=1"}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium"
          >
            Book Now
          </Link>
          <button
            onClick={() => setMenuOpen((s) => !s)}
            className="p-2 text-gray-600 hover:text-blue-600"
            aria-label="Toggle menu"
          >
            <i className={`fas ${menuOpen ? "fa-times" : "fa-bars"} text-xl`}></i>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t shadow-lg">
          <div className="px-4 py-3 space-y-1" onClick={() => setMenuOpen(false)}>
            <Link to="/" className="block px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium">
              <i className="fas fa-home w-5 text-center mr-2 text-gray-400"></i>Home
            </Link>
            <Link to="/resort" className="block px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium">
              <i className="fas fa-umbrella-beach w-5 text-center mr-2 text-gray-400"></i>Resort
            </Link>
            <Link to="/rooms" className="block px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium">
              <i className="fas fa-bed w-5 text-center mr-2 text-gray-400"></i>Rooms
            </Link>
            <Link to="/gallery" className="block px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium">
              <i className="fas fa-images w-5 text-center mr-2 text-gray-400"></i>Gallery
            </Link>

            <div className="border-t border-gray-100 my-2"></div>

            {user ? (
              <>
                <Link to="/dashboard" className="block px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium">
                  <i className="fas fa-user w-5 text-center mr-2 text-gray-400"></i>My Account
                </Link>
                <button
                  onClick={logout}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 text-sm font-medium"
                  type="button"
                >
                  <i className="fas fa-sign-out-alt w-5 text-center mr-2"></i>Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => { setMenuOpen(false); setLoginOpen(true); }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium"
                type="button"
              >
                <i className="fas fa-sign-in-alt w-5 text-center mr-2 text-gray-400"></i>Login
              </button>
            )}
          </div>
        </div>
      )}


      {/* Modals */}
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onOpenSignup={() => { setLoginOpen(false); setSignupOpen(true); }}
      />

      <SignupModal
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
        onSignedUp={handleSignupSuccess}
        onOpenLogin={() => { setSignupOpen(false); setLoginOpen(true); }}
      />

      <VerifyEmailModal
        open={verifyOpen}
        onClose={() => {
          setVerifyOpen(false);
          if (pendingWelcomeName) {
            showToast(`Welcome, ${pendingWelcomeName}!`, "success");
            setPendingWelcomeName("");
          }
        }}
      />

      <Toast message={toast} type={toastType} onClose={clearToast} />
    </nav>
  );
}