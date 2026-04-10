import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const ContentContext = createContext(null);

const DEFAULT_NAVBAR  = { siteName: "Aplaya Cottages & Rentals", logoImage: "/logo.jpg" };
const DEFAULT_FOOTER  = {
  tagline:   "Your perfect tropical getaway offering luxury accommodations and unforgettable experiences.",
  address:   "Purok 7 Sitio Pobres Brgy Munting Mapino, Naic, Philippines, 4110",
  phone:     "+63 908 191 4721",
  email:     "aplayabeachresortph@gmail.com",
  hours:     [{ day: "Monday - Sunday", time: "7:00 AM - 9:00 PM" }],
  facebook:  "https://www.facebook.com/aplayabeach",
  instagram: "",
  twitter:   "",
  tiktok:    "",
  copyright: "© 2026 Aplaya Cottages & Rentals. All rights reserved.",
};

// ContentContext caches the last successful API response in localStorage.
// This means after the first page load the content is always available
// instantly on refresh — no flash of hardcoded defaults.
const CACHE_KEY = "aplaya_content_cache_v1";

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

export function ContentProvider({ children }) {
  // Seed from our own cache so the page never flashes hardcoded defaults
  const [content, setContent] = useState(() => readCache());

  useEffect(() => {
    api.get("/api/content")
      .then(r => {
        const data = r.data?.data ?? {};
        writeCache(data);   // keep cache fresh for next visit
        setContent(data);
      })
      // If the API is down, keep the cached data; don't fall back to null
      .catch(() => setContent(prev => prev ?? {}));
  }, []);

  return (
    <ContentContext.Provider value={content}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  return useContext(ContentContext);
}

export { DEFAULT_NAVBAR, DEFAULT_FOOTER };
