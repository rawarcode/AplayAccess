import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

import useLockBodyScroll from "../hooks/useLockBodyScroll.js";
import LoginModal from "./modals/LoginModal.jsx";

export default function AuthButtons({ className = "" }) {
  const { user, login, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  useLockBodyScroll(loginOpen);

  function handleLoginSuccess(u) {
    login(u);            // ✅ global login
    setLoginOpen(false); // ✅ stay on current page
  }

  return (
    <div className={className}>
      {user ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">👤 {user.name || "Guest"}</span>
          <button
            type="button"
            onClick={logout}
            className="text-sm font-medium text-red-600 hover:text-red-800"
          >
            Logout
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium"
        >
          Login
        </button>
      )}

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}