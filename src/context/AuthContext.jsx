import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "aplayaccess_user_v1";

// ✅ Default admin user for demo
const DEFAULT_ADMIN = {
  id: 1,
  name: "Sarah Johnson",
  email: "admin@aplay.com",
  role: "admin",
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // ✅ Load saved session on first mount, or auto-login as admin
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setUser(parsed);
          return;
        }
      }
      // ✅ Auto-login as admin if no saved session
      setUser(DEFAULT_ADMIN);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ADMIN));
    } catch {
      // If storage is corrupted, auto-login as admin
      setUser(DEFAULT_ADMIN);
    }
  }, []);

  function login(userData) {
    setUser(userData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    } catch {
      // ignore storage errors
    }
  }

  function logout() {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }

  const value = useMemo(() => ({ user, login, logout }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}