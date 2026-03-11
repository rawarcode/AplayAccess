// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginRequest, meRequest, logoutRequest } from "../lib/authApi";
import { TOKEN_KEY } from "../lib/api";

const AuthContext = createContext(null);

const STORAGE_KEY = "aplaya_user_v1";

function normalizeUser(payload) {
  // backend might return { user: {...} } or direct user object
  if (!payload) return null;
  if (payload.user) return payload.user;
  return payload;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [booting, setBooting] = useState(true);

  // Restore session from backend (cookie-based)
  useEffect(() => {
    let alive = true;

    async function boot() {
      try {
        const data = await meRequest();
        if (!alive) return;

        const u = normalizeUser(data);
        setUser(u || null);
        if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        if (!alive) return;
        // If not authenticated, backend will throw 401 → clear user and token
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        if (!alive) return;
        setBooting(false);
      }
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