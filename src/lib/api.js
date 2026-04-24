import axios from "axios";

export const TOKEN_KEY = "aplaya_token";

// withCredentials: true — sends the Sanctum session cookie cross-
// origin (www.aplayabeachresort.com → api.aplayabeachresort.com).
// Paired with the backend's supports_credentials=true CORS rule.
//
// withXSRFToken: true — axios 1.x skips XSRF cookie→header mirroring
// on cross-origin requests unless this is explicitly set, even with
// withCredentials. Without this flag axios silently drops the
// X-XSRF-TOKEN header and Laravel's CSRF middleware 419s every
// mutating request.
//
// Auth is now session-cookie only. We dropped the
// Authorization: Bearer fallback — any DOM-readable token in
// localStorage is an XSS-to-account-takeover vector, and cookie
// auth has been confirmed working end-to-end (refresh + token
// deletion both keep the session). TOKEN_KEY export stays so
// AuthContext can keep cleaning up any legacy tokens left on
// pre-P1.2 clients via removeItem on boot 401 and on logout.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: "application/json" },
});

// Prime Laravel's XSRF-TOKEN cookie before any mutating request
// that relies on session-cookie auth. Axios picks the cookie up
// automatically and mirrors it in an X-XSRF-TOKEN header; Sanctum's
// CSRF middleware then validates the pair. Call this once before
// login / register / password change / etc. Safe to call multiple
// times — Laravel refreshes the cookie each call.
export async function primeCsrf() {
  try {
    await api.get('/sanctum/csrf-cookie');
  } catch (err) {
    // Non-fatal: bearer-token auth still works without CSRF.
    // Log once so cookie-auth issues are diagnosable without
    // hiding bearer-mode success.
    // eslint-disable-next-line no-console
    console.warn('primeCsrf failed — bearer-token auth will still work', err?.message);
  }
}
