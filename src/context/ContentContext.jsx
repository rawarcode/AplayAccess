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

export function ContentProvider({ children }) {
  const [content, setContent] = useState(null);

  useEffect(() => {
    api.get("/api/content")
      .then(r => setContent(r.data?.data ?? {}))
      .catch(() => setContent({}));
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
