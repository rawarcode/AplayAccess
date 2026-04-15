import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";
import { gallery as galleryFallback } from "../data/gallery.js";
import { getResortGallery } from "../lib/resortApi.js";
import { RESORT_ID } from "../lib/config.js";
import LightboxModal from "../components/modals/LightboxModal.jsx";
import { isVideoUrl } from "../lib/uploadApi.js";
import { Helmet } from "react-helmet-async";

const ALL_CATS = ["all", "beach", "rooms", "amenities", "dining", "events", "other"];

function catLabel(cat) {
  if (cat === "all") return "All";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

/* ------------------------------------------------------------------ */
/*  Floating hero particles                                           */
/* ------------------------------------------------------------------ */
function HeroParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
      <div className="absolute w-2 h-2 bg-white/20 rounded-full animate-float-slow" style={{ top: "20%", left: "10%" }} />
      <div className="absolute w-3 h-3 bg-white/15 rounded-full animate-float-slow" style={{ top: "60%", left: "80%", animationDelay: "2s" }} />
      <div className="absolute w-1.5 h-1.5 bg-white/25 rounded-full animate-float-slow" style={{ top: "80%", left: "25%", animationDelay: "4s" }} />
      <div className="absolute w-1 h-1 bg-white/30 rounded-full animate-float-fast" style={{ top: "30%", left: "55%", animationDelay: "1s" }} />
      <div className="absolute w-1.5 h-1.5 bg-white/20 rounded-full animate-float-fast" style={{ top: "70%", left: "40%", animationDelay: "3s" }} />
      <div className="absolute w-1 h-1 bg-white/30 rounded-full animate-float-fast" style={{ top: "15%", left: "70%", animationDelay: "5s" }} />
      <div className="absolute top-0 left-[-50%] w-[200%] h-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
    </div>
  );
}

export default function Gallery() {
  const [galleryApi, setGalleryApi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [activeCat, setActiveCat] = useState("all");

  // Load gallery from API; fall back to static data silently
  useEffect(() => {
    getResortGallery(RESORT_ID)
      .then((data) => { if (Array.isArray(data) && data.length) setGalleryApi(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Normalize API items ({ image_url, caption, category }) or static items ({ src, alt, caption })
  const items = useMemo(() => {
    const base = galleryApi.length ? galleryApi : galleryFallback;
    return base.map((g) => ({
      src: g.image_url ?? g.src,
      alt: g.caption ?? g.alt ?? "Gallery image",
      caption: g.caption ?? g.alt ?? "",
      category: g.category ?? "other",
    }));
  }, [galleryApi]);

  // Derived filtered items
  const filteredItems = useMemo(() => {
    if (activeCat === "all") return items;
    return items.filter((g) => g.category === activeCat);
  }, [items, activeCat]);

  // Only show tabs for categories that have at least one item (plus "all")
  const visibleCats = useMemo(() => {
    const presentCats = new Set(items.map((g) => g.category));
    return ALL_CATS.filter((c) => c === "all" || presentCats.has(c));
  }, [items]);

  useLockBodyScroll(open);

  function openAt(i) {
    setIndex(i);
    setOpen(true);
  }

  const close = useCallback(() => setOpen(false), []);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const next = useCallback(() => {
    setIndex((i) => Math.min(filteredItems.length - 1, i + 1));
  }, [filteredItems.length]);

  // Reset index when filter changes
  useEffect(() => {
    setIndex(0);
  }, [activeCat]);

  // keyboard navigation
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, prev, next]);

  return (
    <div className="pt-16 bg-gray-900 min-h-screen">
      <Helmet>
        <title>Gallery — Aplaya Beach Resort</title>
        <meta name="description" content="View photos and videos of Aplaya Beach Resort — beach, rooms, amenities, dining, and events." />
      </Helmet>

      {/* HERO */}
      <section
        className="relative h-[60vh] flex items-center justify-center text-center overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <HeroParticles />

        <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-white z-10">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 animate-hero-fade-in [animation-delay:0.2s] opacity-0">
            Our Photo Gallery
          </h1>
          <p className="text-lg md:text-xl mb-6 animate-hero-fade-in [animation-delay:0.6s] opacity-0">
            A visual journey through the beauty and luxury of Aplaya Beach Resort.
          </p>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none"
            className="relative block w-[calc(100%+1.3px)] h-[100px]">
            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
              opacity=".25" fill="#111827" />
            <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
              opacity=".5" fill="#111827" />
            <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"
              fill="#111827" />
          </svg>
        </div>
      </section>

      {/* GRID */}
      <main className="flex-grow py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <div className="text-center mb-8 animate-hero-fade-in [animation-delay:0.1s] opacity-0">
            <span className="text-4xl mb-3 block">📸</span>
            <h2 className="text-3xl font-bold text-white mb-2">Browse the Gallery</h2>
            <div className="w-16 h-1.5 rounded-full bg-blue-400 mx-auto mb-4" />
            <span className="inline-block bg-white/10 text-gray-300 text-sm px-4 py-1 rounded-full">
              {loading ? "Loading..." : `${filteredItems.length} photo${filteredItems.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* Category filter tabs */}
          {!loading && visibleCats.length > 1 && (
            <div className="flex flex-wrap justify-center gap-2 mb-10 animate-hero-fade-in [animation-delay:0.2s] opacity-0">
              {visibleCats.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCat(cat)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200
                    ${activeCat === cat
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                      : "bg-white/10 text-gray-300 hover:bg-white/20"
                    }`}
                >
                  {catLabel(cat)}
                </button>
              ))}
            </div>
          )}

          {/* Loading skeleton */}
          {loading ? (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-gray-800 animate-pulse aspect-[4/3]" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            /* Empty state */
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-images text-3xl text-gray-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-400 mb-2">
                No {activeCat === "all" ? "photos" : catLabel(activeCat).toLowerCase() + " photos"} yet
              </h3>
              <p className="text-gray-500 text-sm mb-4">Check back soon — we're always adding new content.</p>
              {activeCat !== "all" && (
                <button
                  onClick={() => setActiveCat("all")}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium transition"
                >
                  View all photos →
                </button>
              )}
            </div>
          ) : (
            /* Gallery grid with stagger animation */
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
              {filteredItems.map((g, i) => (
                <button
                  key={`${g.alt}-${i}`}
                  type="button"
                  onClick={() => openAt(i)}
                  className="group relative overflow-hidden rounded-2xl shadow-lg aspect-[4/3] bg-gray-800 animate-hero-fade-in opacity-0"
                  style={{ animationDelay: `${Math.min(i * 0.08, 0.8)}s` }}
                  aria-label={`Open ${isVideoUrl(g.src) ? "video" : "image"}: ${g.caption || g.alt}`}
                >
                  {isVideoUrl(g.src) ? (
                    <>
                      <video
                        src={g.src}
                        muted playsInline
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/50 rounded-full w-14 h-14 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                          <i className="fas fa-play text-xl ml-1"></i>
                        </div>
                      </div>
                    </>
                  ) : (
                    <img
                      src={g.src}
                      alt={g.alt}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  )}
                  {/* Hover overlay with caption */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    {g.caption && <p className="text-white text-sm font-medium leading-snug">{g.caption}</p>}
                    <p className="text-white/60 text-xs mt-1">Click to enlarge</p>
                  </div>
                  {/* Number badge */}
                  <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    {i + 1} / {filteredItems.length}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-12 text-center">
            <Link
              to="/resort"
              className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              ← Back to Resort
            </Link>
          </div>
        </div>
      </main>

      {/* Lightbox */}
      <LightboxModal
        open={open}
        onClose={close}
        items={filteredItems}
        index={index}
        onPrev={prev}
        onNext={next}
      />
    </div>
  );
}
