// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useGoogleOneTapLogin } from "@react-oauth/google";
import { loginRequest, staffLoginRequest, googleLoginRequest, meRequest, logoutRequest } from "../lib/authApi";
import { TOKEN_KEY } from "../lib/api";

const AuthContext = createContext(null);

const STORAGE_KEY = "aplaya_user_v1";
// After the user explicitly logs out we suppress One Tap for this many
// minutes. Otherwise Google's prompt fires the instant the logout
// redirect lands — an infinite log-out → re-log-in loop.
const SUPPRESS_ONETAP_KEY = "aplaya_suppress_onetap_until";
const SUPPRESS_ONETAP_MIN = 5;
// Staff routes must never trigger guest One Tap — a frontdesk staff who
// happens to have a Google session would get silently auto-authed as a
// guest, clobbering their staff login flow.
const STAFF_ROUTE_PREFIXES = ["/staff-login", "/owner", "/admin", "/frontdesk"];

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
  const location = useLocation();

  // One Tap auto-login — fires once per mount when the visitor already
  // has a Google session. Suppressed if: (1) we're mid-boot, (2) they're
  // already authed, (3) they just logged out, or (4) they're on a
  // staff-only route. onSuccess swaps the Google credential for an
  // Aplaya session via the existing backend /api/auth/google endpoint.
  const isStaffRoute = STAFF_ROUTE_PREFIXES.some(p => location.pathname.startsWith(p));
  const suppressUntil = (() => {
    try {
      const raw = localStorage.getItem(SUPPRESS_ONETAP_KEY);
      return raw ? Number(raw) : 0;
    } catch { return 0; }
  })();
  const onetapDisabled = booting || !!user || isStaffRoute || Date.now() < suppressUntil;

  useGoogleOneTapLogin({
    disabled: onetapDisabled,
    // cancel_on_tap_outside lets the user dismiss the prompt by clicking
    // anywhere else — less intrusive than Google's default behaviour.
    cancel_on_tap_outside: true,
    // Chrome 117+ requires FedCM (Federated Credential Management) for
    // One Tap prompts to actually render. Without this flag the whole
    // hook silently no-ops in modern browsers — no prompt, no bubble,
    // no error. Safari + Firefox ignore it gracefully.
    use_fedcm_for_prompt: true,
    // auto_select stays false so the user still confirms once (option B
    // from the plan — respects consent, not silent login).
    onSuccess: async ({ credential }) => {
      if (!credential) return;
      try {
        const data = await googleLoginRequest(credential);
        if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
        const u = normalizeUser(data);
        if (u) {
          setUser(u);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
        }
      } catch {
        // Fail silently — user can fall back to the Login modal.
        // We don't show a toast here because the prompt was unprompted
        // (the user didn't ask to log in, so don't yell at them if it
        // doesn't work).
      }
    },
    onError: () => { /* silent */ },
  });

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

  async function loginStaff(email, password) {
    const data = await staffLoginRequest(email, password);
    if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    const u = normalizeUser(data);
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    return u;
  }

  async function loginWithGoogle(credential) {
    const data = await googleLoginRequest(credential);
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
    // Suppress One Tap for N minutes so logout doesn't immediately
    // re-authenticate the same Google user on the next page render.
    // Also tell Google's widget directly — belt-and-braces in case
    // the library caches its prompt state.
    try {
      localStorage.setItem(SUPPRESS_ONETAP_KEY, String(Date.now() + SUPPRESS_ONETAP_MIN * 60 * 1000));
      window.google?.accounts?.id?.disableAutoSelect?.();
    } catch { /* ignore */ }
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