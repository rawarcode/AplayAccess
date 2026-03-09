import axios from "axios";

export const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  withCredentials: true, // important for Sanctum cookie auth
  headers: { Accept: "application/json" },
});

// Laravel Sanctum defaults:
api.defaults.xsrfCookieName = "XSRF-TOKEN";
api.defaults.xsrfHeaderName = "X-XSRF-TOKEN";