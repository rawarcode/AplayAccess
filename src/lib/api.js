import axios from "axios";

export const TOKEN_KEY = "aplaya_token";

// withCredentials: true — sends the Sanctum session cookie cross-
// origin (www.aplayabeachresort.com → api.aplayabeachresort.com).
// Paired with the backend's supports_credentials=true CORS rule.
// Axios also auto-forwards the XSRF-TOKEN cookie as an
// X-XSRF-TOKEN header on mutating requests, which the Sanctum
// CSRF middleware validates. Same-site cross-origin + SameSite=Lax
// cookies cover the cookie-send requirement.
//
// Bearer token auth stays wired as a fallback during the P1.2
// rollout — if the session cookie isn't set yet (user logged in
// before the migration landed), the Authorization header keeps
// their session alive until they log in again.
// withXSRFToken: true — axios 1.x skips XSRF cookie→header mirroring
// on cross-origin requests unless this is explicitly set, even with
// withCredentials. www.aplayabeachresort.com → api.aplayabeachresort.com
// is cross-origin (same-site, different subdomain), so without this
// flag axios silently drops the X-XSRF-TOKEN header and Laravel's
// CSRF middleware 419s every mutating request.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: "application/json" },
});

// Attach Bearer token when one is stored. Session cookie is
// attached automatically by the browser. Sanctum's auth:sanctum
// guard tries the session first then falls back to the token, so
// sending both simultaneously is safe.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
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
