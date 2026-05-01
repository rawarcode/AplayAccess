import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../context/ContentContext.jsx";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";
import { gallery as galleryFallback } from "../data/gallery.js";
import { getResortGallery } from "../lib/resortApi.js";
import { RESORT_ID } from "../lib/config.js";
import LightboxModal from "../components/modals/LightboxModal.jsx";
import { isVideoUrl } from "../lib/uploadApi.js";
import { Helmet } from "react-helmet-async";
import { usePagination, PaginationBar } from "../lib/pagination.jsx";

const GALLERY_HERO_DEFAULTS = {
  background: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80",
  title:    "Our Photo Gallery",
  subtitle: "A visual journey through the beauty and luxury of Aplaya Beach Resort.",
};

// Icons for known categories — unknown ones get a generic icon
const CAT_ICONS = {
  beach:     "fa-umbrella-beach",
  rooms:     "fa-bed",
  amenities: "fa-swimming-pool",
  dining:    "fa-utensils",
  events:    "fa-calendar-star",
  other:     "fa-image",
};

function catLabel(cat) {
  if (cat === "all") return "All";
  return cat.replace(/\b\w/g, c => c.toUpperCase());
}

/* ------------------------------------------------------------------ */

export default function Gallery() {
  const siteContent = useContent();
  const galleryHero = useMemo(() => {
    const h = (siteContent ?? {}).page_gallery_hero ?? {};
    return { ...GALLERY_HERO_DEFAULTS, ...h };
  }, [siteContent]);

  const [galleryApi, setGalleryApi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [activeCat, setActiveCat] = useState("all");

  function load() {
    setLoading(true);
    setLoadError(false);
    getResortGallery(RESORT_ID)
      .then((data) => { if (Array.isArray(data) && data.length) setGalleryApi(data); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

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

  // Derive category tabs dynamically from actual data (case-insensitive)
  const visibleCats = useMemo(() => {
    const map = new Map();
    items.forEach(g => {
      const cat = (g.category || "").trim();
      if (!cat) return;
      const key = cat.toLowerCase();
      if (!map.has(key)) map.set(key, cat);
    });
    const cats = [...map.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    return ["all", ...cats];
  }, [items]);

  // Derived filtered items
  const filteredItems = useMemo(() => {
    if (activeCat === "all") return items;
    return items.filter((g) => (g.category || "").toLowerCase() === activeCat.toLowerCase());
  }, [items, activeCat]);

  // Pagination — 12 photos/page is dense enough to fill the
  // auto-fill grid on a typical desktop without overwhelming mobile.
  // Lightbox iterates over the CURRENT page's set, so prev/next stays
  // in the user's mental "this page" context; advancing past the
  // last image on a page closes the lightbox and the user paginates
  // explicitly to see more.
  const { setPage, paginated, totalPages, safePage, info } = usePagination(filteredItems, 12);

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
    setIndex((i) => Math.min(paginated.length - 1, i + 1));
  }, [paginated.length]);

  // Reset lightbox index AND pagination when the filter changes —
  // page 5 of "All" doesn't exist for "Beach" with fewer photos.
  useEffect(() => {
    setIndex(0);
    setPage(1);
  }, [activeCat, setPage]);

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
    <div className="pt-16 bg-slate-900 min-h-screen">
      <Helmet>
        <title>Gallery — Aplaya Beach Resort</title>
        <meta name="description" content="View photos and videos of Aplaya Beach Resort — beach, rooms, amenities, dining, and events." />
      </Helmet>

      {/* HERO — real <img> + srcSet so mobile doesn't pay the full
          desktop image weight. Same pattern Home/Resort use after
          their hero refactors. Dark overlay sits above the image. */}
      <section className="relative h-[60vh] flex items-center justify-center text-center overflow-hidden bg-slate-900">
        {(() => {
          const url = galleryHero.background;
          const isUnsplash = typeof url === "string" && url.includes("images.unsplash.com");
          const srcSet = isUnsplash
            ? [640, 1024, 1600].map(w =>
                `${url.replace(/([?&])w=\d+/, `$1w=${w}`)} ${w}w`
              ).join(", ")
            : undefined;
          return (
            <img
              src={url}
              srcSet={srcSet}
              sizes="100vw"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover"
              fetchPriority="high"
              loading="eager"
              decoding="async"
            />
          );
        })()}
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

        <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-white z-10">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 animate-hero-fade-in [animation-delay:0.2s] opacity-0">
            {galleryHero.title}
          </h1>
          <p className="text-lg md:text-xl mb-6 animate-hero-fade-in [animation-delay:0.6s] opacity-0">
            {galleryHero.subtitle}
          </p>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none"
            className="relative block w-[calc(100%+1.3px)] h-[100px]">
            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
              opacity=".25" fill="#0f172a" />
            <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
              opacity=".5" fill="#0f172a" />
            <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"
              fill="#0f172a" />
          </svg>
        </div>
      </section>

      {/* GRID */}
      <main className="flex-grow py-16 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Load error banner */}
          {loadError && !loading && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200/20 bg-amber-500/10 px-4 py-3 mb-8">
              <i className="fas fa-exclamation-triangle text-amber-400" aria-hidden="true" />
              <span className="text-sm text-amber-300 flex-1">Showing cached gallery — live data unavailable.</span>
              <button onClick={load} type="button" className="inline-flex items-center justify-center px-3 py-2 min-h-11 text-sm font-medium text-amber-200 hover:text-amber-100 hover:bg-amber-500/15 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"><i className="fas fa-redo mr-1.5 text-[10px]" aria-hidden="true"></i>Retry</button>
            </div>
          )}

          {/* Section header */}
          <div className="text-center mb-8 animate-hero-fade-in [animation-delay:0.1s] opacity-0">
            <span className="inline-flex h-12 w-12 rounded-full bg-white/10 text-sky-300 items-center justify-center mb-3" aria-hidden="true">
              <i className="fas fa-images text-xl" aria-hidden="true"></i>
            </span>
            <h2 className="text-3xl font-bold text-white mb-2">Browse the Gallery</h2>
            <div className="w-16 h-1.5 rounded-full bg-sky-400 mx-auto mb-4" />
            <span className="inline-block bg-white/10 text-slate-300 text-sm px-4 py-1 rounded-full">
              {loading ? "Loading..." : `${filteredItems.length} photo${filteredItems.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* Category filter tabs — dynamically derived from data */}
          {!loading && visibleCats.length > 2 && (
            <div className="flex flex-wrap justify-center gap-2 mb-10 animate-hero-fade-in [animation-delay:0.2s] opacity-0">
              {visibleCats.map((cat) => {
                const count = cat === "all" ? items.length : items.filter(g => g.category === cat).length;
                const icon = cat === "all" ? "fa-th-large" : (CAT_ICONS[cat] || "fa-folder");
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={activeCat === cat}
                    onClick={() => setActiveCat(cat)}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 min-h-11 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
                      ${activeCat === cat
                        ? "bg-sky-600 text-white shadow-lg shadow-sky-500/30"
                        : "bg-white/10 text-slate-200 hover:bg-white/20"
                      }`}
                  >
                    <i className={`fas ${icon} text-xs`} aria-hidden="true" />
                    {catLabel(cat)}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      activeCat === cat ? "bg-white/20 text-white" : "bg-white/10 text-slate-400"
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Loading skeleton */}
          {loading ? (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-slate-800 animate-pulse aspect-[4/3]" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            /* Empty state */
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-images text-3xl text-slate-600" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-slate-400 mb-2">
                No {activeCat === "all" ? "photos" : catLabel(activeCat).toLowerCase() + " photos"} yet
              </h3>
              <p className="text-slate-500 text-sm mb-4">Check back soon — we're always adding new content.</p>
              {activeCat !== "all" && (
                <button
                  onClick={() => setActiveCat("all")}
                  type="button"
                  className="text-sky-300 hover:text-sky-200 text-sm font-medium transition rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  View all photos →
                </button>
              )}
            </div>
          ) : (
            <>
            {/* Gallery grid with stagger animation */}
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
              {paginated.map((g, i) => (
                <button
                  key={`${g.alt}-${i}`}
                  type="button"
                  onClick={() => openAt(i)}
                  className="group relative overflow-hidden rounded-2xl shadow-lg aspect-[4/3] bg-slate-800 animate-hero-fade-in opacity-0"
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
                          <i className="fas fa-play text-xl ml-1" aria-hidden="true" />
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
                  {/* Persistent expand badge — top-right. Always
                      visible so touch users see the tile is tappable;
                      desktop users get the same affordance without
                      depending on hover. */}
                  <span className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/20" aria-hidden="true">
                    <i className="fas fa-expand text-xs"></i>
                  </span>
                  {/* Caption strip — also persistent on touch; on
                      desktop the gradient deepens on hover for the
                      "leans in" effect we had before. */}
                  {g.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3 transition-opacity duration-300 group-hover:from-black/85 group-hover:via-black/40">
                      <p className="text-white text-sm font-medium leading-snug">{g.caption}</p>
                    </div>
                  )}
                  {/* Page-position counter — small chip top-left, also
                      persistent so touch users can orient themselves
                      within the current page. */}
                  <span className="absolute top-3 left-3 bg-black/55 text-white text-xs px-2 py-0.5 rounded-full" aria-hidden="true">
                    {i + 1} / {paginated.length}
                  </span>
                </button>
              ))}
            </div>
            <PaginationBar
              safePage={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
              info={info}
            />
            </>
          )}

          <div className="mt-12 text-center">
            <Link
              to="/resort"
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all"
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
        items={paginated}
        index={index}
        onPrev={prev}
        onNext={next}
      />
    </div>
  );
}
