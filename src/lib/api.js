import axios from "axios";

export const TOKEN_KEY = "aplaya_token";

export const api = axios.create({
  baseURL: "http://localhost:8000",
  withCredentials: false,
  headers: { Accept: "application/json" },
});

// Attach Bearer token to every request if one is stored
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
