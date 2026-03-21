// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginRequest, meRequest, logoutRequest } from "../lib/authApi";
import { TOKEN_KEY } from "../lib/api";

const AuthContext = createContext(null);

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

    boot();
    return () => {
      alive = false;
    };
  }, []);

  async function loginWithEmail(email, password) {
    const data = await loginRequest(email, password);
    // data = { user, token }
    if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    const u = normalizeUser(data);
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    return u;
  }

  // Backward compatibility (your Resort.jsx calls login(u))
  // Keep this so you don’t break existing code, but it’s “manual set”.
  function login(u) {
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  }

  async function logout() {
    try {
      await logoutRequest();
    } catch {
      // even if backend fails, clear locally
    }
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  const value = useMemo(
    () => ({
      user,
      isLoggedIn: !!user,
      booting,
      loginWithEmail,
      login, // existing usage
      logout,
      setUser, // optional
    }),
    [user, booting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider />");
  return ctx;
}