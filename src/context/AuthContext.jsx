// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginRequest, staffLoginRequest, googleLoginRequest, meRequest, logoutRequest } from "../lib/authApi";
import { TOKEN_KEY, primeCsrf } from "../lib/api";

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
        // Prime Laravel's XSRF-TOKEN cookie on app start so any
        // mutating request later (register, password reset, etc.)
        // goes out with a valid X-XSRF-TOKEN header. Axios auto-
        // forwards the cookie → header once it's present. Fire
        // and forget — meRequest below runs regardless.
        primeCsrf();

        const data = await meRequest();
        if (!alive) return;

        const u = normalizeUser(data);
        setUser(u || null);
        if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
        else localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        if (!alive) return;
        // Only clear session on explicit 401 — network errors / aborted requests
        // (e.g. popup windows closing mid-flight) must NOT log the user out
        if (err?.response?.status === 401) {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(TOKEN_KEY);
        }
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

  // All three login paths start with primeCsrf() so Laravel sets the
  // XSRF-TOKEN cookie before we send a mutating request. The response
  // from the login endpoint now sets a Sanctum session cookie, which
  // is what actually carries the auth going forward.
  //
  // We still stash data.token in localStorage for now — Sanctum's
  // auth:sanctum guard falls back to Bearer if the session cookie
  // isn't present (e.g. cross-device, private browsing, third-party
  // cookies blocked). Once cookie-auth is confirmed stable across
  // all flows, a follow-up commit will drop the localStorage writes.
  async function loginWithEmail(email, password) {
    await primeCsrf();
    const data = await loginRequest(email, password);
    if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    const u = normalizeUser(data);
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    return u;
  }

  async function loginStaff(email, password) {
    await primeCsrf();
    const data = await staffLoginRequest(email, password);
    if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    const u = normalizeUser(data);
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    return u;
  }

  // Google sign-in uses OAuth2's implicit flow (access_token), not the
  // credential/JWT flow. This is why the login button we render is a
  // custom "Sign in with Google" pill driven by useGoogleLogin — the
  // generic UI is the whole point. The backend verifies the
  // access_token by calling Google's userinfo endpoint.
  async function loginWithGoogle(accessToken) {
    await primeCsrf();
    const data = await googleLoginRequest(accessToken);
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

  // Pull the canonical user payload from /api/me and store it. Used
  // after register/signup, where the endpoint's response shape can
  // drift from /api/me's shape (different serialization paths, subtle
  // cast differences on email_verified_at / role). A manual login(u)
  // with the register response may leave UnverifiedEmailBanner unable
  // to decide if the user is verified — this guarantees consistency
  // with the shape the rest of the app expects.
  async function refreshUser() {
    try {
      const data = await meRequest();
      const u = normalizeUser(data);
      if (u) {
        setUser(u);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      }
      return u;
    } catch {
      // Non-fatal: caller already set user via login(u). Swallow.
      return null;
    }
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
      loginStaff,
      loginWithGoogle,
      login, // existing usage
      refreshUser,
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
