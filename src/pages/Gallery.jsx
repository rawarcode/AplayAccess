import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";
import { gallery as galleryFallback } from "../data/gallery.js";
import { getResortGallery } from "../lib/resortApi.js";
import LightboxModal from "../components/modals/LightboxModal.jsx";

const RESORT_ID = 1;

export default function Gallery() {
  const [galleryApi, setGalleryApi] = useState([]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  // Load gallery from API; fall back to static data silently
  useEffect(() => {
    getResortGallery(RESORT_ID)
      .then((data) => { if (Array.isArray(data) && data.length) setGalleryApi(data); })
      .catch(() => {});
  }, []);

  // Normalize API items ({ image_url, caption }) or static items ({ src, alt, caption })
  const items = useMemo(() => {
    const base = galleryApi.length ? galleryApi : galleryFallback;
    return base.map((g) => ({
      src: g.image_url ?? g.src,
      alt: g.caption ?? g.alt ?? "Gallery image",
      caption: g.caption ?? g.alt ?? "",
    }));
  }, [galleryApi]);

  useLockBodyScroll(open);

  function openAt(i) {
    setIndex(i);
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  function prev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  function next() {
    setIndex((i) => Math.min(items.length - 1, i + 1));
  }

  // keyboard navigation like your HTML
  useEffect(() => {
    if (!open) return;

    function onKey(e) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items.length]);

  return (
    <div className="pt-16 bg-gray-50 min-h-screen">
      {/* HERO */}
      <section
        className="relative h-[60vh] flex items-center justify-center text-center"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-white z-10">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">Our Photo Gallery</h1>
          <p className="text-lg md:text-xl mb-6">
            A visual journey through the beauty and luxury of Aplaya Beach Resort.
          </p>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="relative block w-[calc(100%+1.3px)] h-[100px]"
          >
            <path
              d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
              opacity=".25"
              fill="#FFFFFF"
            />
            <path
              d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
              opacity=".5"
              fill="#FFFFFF"
            />
            <path
              d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"
              fill="#FFFFFF"
            />
          </svg>
        </div>
      </section>

      {/* GRID */}
      <main className="flex-grow py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
            {items.map((g, i) => (
              <button
                key={`${g.alt}-${i}`}
                type="button"
                onClick={() => openAt(i)}
                className="group overflow-hidden rounded-lg shadow aspect-[4/3] bg-gray-200"
                aria-label={`Open image: ${g.caption || g.alt}`}
              >
                <img
                  src={g.src}
                  alt={g.alt}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              to="/resort"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
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
        items={items}
        index={index}
        onPrev={prev}
        onNext={next}
      />
    </div>
  );
}