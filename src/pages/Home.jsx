import { useEffect, useRef, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { isVideoUrl } from "../lib/uploadApi.js";
import { useContent } from "../context/ContentContext.jsx";

// Defaults are deliberately specific, not aspirational. They describe
// what Aplaya actually offers (rates, location, booking model) so the
// site doesn't read as auto-generated marketing copy on first paint.
// The owner can rewrite any of this through Manage Website → Home;
// these are just the fallbacks visitors see if no override exists.
const HOME_DEFAULTS = {
  hero: {
    // 1600px is enough for full-bleed desktop given the 50% dark
    // overlay; previous 2073px was wasteful on every viewport.
    background: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
    title:    "Aplaya Beach Resort",
    subtitle: "Beachfront. Cottages, pavilions, rooms. Day, overnight, or 24-hour stays.",
    ctaText:  "See rooms & rates",
  },
  // Resort cards block. Shape is { sectionTitle, sectionSubtitle,
  // cards: [{...}] } so the section can scale from one resort today
  // to multiple later (Cavite + Cebu + Bohol, etc.) without code
  // changes — the owner adds cards through the CMS editor.
  //
  // Booking-side (rooms, /resort detail page, RESORT_ID config) is
  // still single-resort. The cards block is CMS scalability only —
  // when a second physical location actually opens, schema-level
  // multi-tenancy is a separate refactor.
  //
  // Backward-compatible: normalizeResortCards() (helper below)
  // accepts either the old singular shape (sectionTitle + name + desc
  // + image + badge + ctaText all at the top level) or the new
  // multi-card shape, returning a guaranteed cards array. CMS
  // overrides saved before this change keep rendering as a 1-card
  // section without any data migration.
  resort: {
    sectionTitle:    "About the resort",
    sectionSubtitle: "A small beachfront resort on the Cavite coast — built for day trips, family getaways, and overnight stays without the metro hotel markup.",
    cards: [
      {
        id:       "aplaya-cavite",
        name:     "Aplaya Beach Resort Cavite",
        location: "Naic, Cavite",
        desc:     "Private cottages, pavilions, and rooms a few steps from the water. Parking is included with every booking. Day rate, overnight, and 24-hour options — pick the window that fits the trip.",
        image:    "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1280&q=80",
        badge:    "Now Open",
        ctaText:  "Explore & Book Now",
        link:     "/resort",
      },
    ],
  },
  why: {
    sectionTitle:    "What you get",
    sectionSubtitle: "The basics, done right. No add-on fees for what should be included.",
    features: [
      { icon: "fa-umbrella-beach", title: "Beachfront cottages",   desc: "Private cottages and pavilions a few steps from the water — book the one that fits your group size." },
      { icon: "fa-clock",          title: "Three booking windows", desc: "Day visit (6 AM–6 PM), overnight (6 PM–7 AM), or full 24-hour. Pick the one that matches the trip." },
      { icon: "fa-mobile-screen",  title: "Online or at the gate", desc: "Reserve online with GCash, or pay cash on arrival. Same rates either way." },
      { icon: "fa-id-card",        title: "Entrance covered too",  desc: "Per-head entrance fee is built into the booking total. No surprises at the gate." },
    ],
  },
  cta: {
    title:      "Ready to book?",
    subtitle:   "Pick a date and a room — most slots can be reserved in under a minute.",
    buttonText: "Book a stay",
  },
};

/* ------------------------------------------------------------------ */
/*  #8 — Intersection Observer hook for scroll-triggered animations   */
/* ------------------------------------------------------------------ */
// Callback-ref reveal — handles conditionally-rendered sections whose
// DOM node doesn't exist on mount (see Resort.jsx for the exact bug
// this fixes on the reviews carousel).
function useReveal() {
  const [node, setNode] = useState(null);
  useEffect(() => {
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add("reveal-visible");
          io.unobserve(node);
        }
      },
      { threshold: 0.15 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node]);
  return setNode;
}

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Resort cards — normalize old singular shape → new cards array    */
/* ------------------------------------------------------------------ */
// CMS overrides saved before the multi-resort change had top-level
// name/desc/image/badge/ctaText. New shape moves all of that into a
// `cards` array so the section can hold 1..N resorts. This shim
// detects either shape and returns the canonical
// { sectionTitle, sectionSubtitle, cards: [{...}] } structure so
// the renderer never has to branch on "is this old or new content".
//
// If a future re-edit through the CMS saves the new shape, the shim
// is a no-op and the cards pass through unchanged.
function normalizeResortContent(c) {
  if (!c || typeof c !== 'object') {
    return { sectionTitle: '', sectionSubtitle: '', cards: [] };
  }
  if (Array.isArray(c.cards)) {
    return {
      sectionTitle:    c.sectionTitle    ?? '',
      sectionSubtitle: c.sectionSubtitle ?? '',
      cards:           c.cards.filter(Boolean),
    };
  }
  // Old shape — single resort embedded at the top level.
  return {
    sectionTitle:    c.sectionTitle    ?? '',
    sectionSubtitle: c.sectionSubtitle ?? '',
    cards: [{
      id:       'legacy-single',
      name:     c.name    ?? '',
      location: c.location ?? '',
      desc:     c.desc    ?? '',
      image:    c.image   ?? '',
      badge:    c.badge   ?? '',
      ctaText:  c.ctaText ?? 'Explore & Book Now',
      link:     c.link    ?? '/resort',
    }],
  };
}

/* ------------------------------------------------------------------ */
/*  #4 — Wavy SVG divider                                            */
/* ------------------------------------------------------------------ */
function WaveDivider({ flip = false, color = "#ffffff" }) {
  return (
    <div className={`w-full overflow-hidden leading-none ${flip ? "rotate-180" : ""}`} style={{ marginTop: "-1px" }}>
      <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className="w-full h-16 md:h-24">
        <path
          d="M0,40 C360,100 1080,0 1440,60 L1440,100 L0,100 Z"
          fill={color}
        />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  #6 — Why Choose Us features (now CMS-driven; see useMemo below)  */
/* ------------------------------------------------------------------ */

export default function Home() {
  const siteContent = useContent();

  // Derived synchronously — no useEffect, no painted frame of wrong defaults
  const { hero, resort, why, cta } = useMemo(() => {
    const d = siteContent ?? {};
    const homeHero   = d.page_home_hero   ?? {};
    const homeResort = d.page_home_resort ?? {};
    const homeWhy    = d.page_home_why    ?? {};
    const homeCta    = d.page_home_cta    ?? {};
    return {
      hero:   { ...HOME_DEFAULTS.hero,   ...homeHero },
      // resort: prefer the CMS override IF it contains usable data —
      // either the new shape (cards array) or the old singular shape
      // (top-level name/desc/etc). normalizeResortContent unifies
      // both into the canonical { sectionTitle, sectionSubtitle,
      // cards } structure the renderer expects.
      resort: normalizeResortContent(
        Object.keys(homeResort).length > 0 ? homeResort : HOME_DEFAULTS.resort
      ),
      why: {
        sectionTitle:    homeWhy.sectionTitle    ?? HOME_DEFAULTS.why.sectionTitle,
        sectionSubtitle: homeWhy.sectionSubtitle ?? HOME_DEFAULTS.why.sectionSubtitle,
        features:        Array.isArray(homeWhy.features) && homeWhy.features.length
                           ? homeWhy.features
                           : HOME_DEFAULTS.why.features,
      },
      cta: {
        title:      homeCta.title      ?? HOME_DEFAULTS.cta.title,
        subtitle:   homeCta.subtitle   ?? HOME_DEFAULTS.cta.subtitle,
        buttonText: homeCta.buttonText ?? HOME_DEFAULTS.cta.buttonText,
      },
    };
  }, [siteContent]);

  /* #8 — reveal refs */
  const resortRef = useReveal();
  const whyRef    = useReveal();
  const ctaRef    = useReveal();

  return (
    <div className="font-sans">
      <Helmet>
        <title>Aplaya Beach Resort — Book Your Stay</title>
        <meta name="description" content="Book rooms at Aplaya Beach Resort Cavite. Day visits, night stays, and 24-hour beach getaway packages." />
        {!isVideoUrl(hero.background) && (
          // Responsive preload. For Unsplash URLs (the default and most
          // owner overrides), advertise an imagesrcset so modern browsers
          // preload only the width that matches the viewport. Other URLs
          // fall back to the plain href.
          hero.background.includes('images.unsplash.com')
            ? <link
                rel="preload"
                as="image"
                href={hero.background}
                imageSrcSet={[640, 1024, 1600].map(w =>
                  `${hero.background.replace(/([?&])w=\d+/, `$1w=${w}`)} ${w}w`
                ).join(', ')}
                imageSizes="100vw"
              />
            : <link rel="preload" as="image" href={hero.background} />
        )}
      </Helmet>

      {/* ============================================================ */}
      {/*  HERO  (#1 fade-in, #2 particles)                           */}
      {/* ============================================================ */}
      <section
        className="min-h-screen flex items-center justify-center text-center relative overflow-hidden"
        style={isVideoUrl(hero.background) ? {} : {
          backgroundImage: `linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), url('${hero.background}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {isVideoUrl(hero.background) && (
          <>
            <video
              src={hero.background}
              autoPlay muted loop playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50" />
          </>
        )}

        {/* #1 — staggered fade-in */}
        <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-white z-10">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 animate-hero-fade-in [animation-delay:0.2s] opacity-0">
            {hero.title}
          </h1>
          <p className="text-xl md:text-2xl mb-8 animate-hero-fade-in [animation-delay:0.6s] opacity-0">
            {hero.subtitle}
          </p>
          <Link
            to="/resort"
            className="inline-block bg-sky-600 hover:bg-sky-700 text-white text-lg font-semibold px-8 py-3 rounded-lg transition shadow-lg hover:shadow-xl animate-hero-fade-in [animation-delay:1s] opacity-0"
          >
            {hero.ctaText}
          </Link>
        </div>

        {/* Scroll indicator */}
        <button
          onClick={() => document.getElementById("resorts-section")?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 h-11 w-11 flex items-center justify-center text-white/70 hover:text-white transition animate-pulse"
          aria-label="Scroll to next section"
        >
          <i className="fas fa-chevron-down text-2xl" aria-hidden="true"></i>
        </button>
      </section>

      {/* #4 — wave divider hero → resort */}
      <WaveDivider color="#ffffff" />

      {/* ============================================================ */}
      {/*  RESORT CARD  (#5 hover glow, #8 scroll reveal)             */}
      {/* ============================================================ */}
      <section id="resorts-section" className="pb-20 pt-8 bg-white">
        <div
          ref={resortRef}
          className="reveal-section max-w-5xl mx-auto px-4 sm:px-6 lg:px-8"
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">{resort.sectionTitle}</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">{resort.sectionSubtitle}</p>
          </div>

          {/* Layout switches by card count:
              - 1 card → full-width landscape (image left, text right)
              - 2 cards → 2-col responsive grid, portrait cards
              - 3+ cards → 3-col responsive grid, portrait cards
              Empty cards array → render nothing (CMS lets owner save
              an empty section to hide it). */}
          {resort.cards.length === 0 ? null : resort.cards.length === 1 ? (
            (() => {
              const c = resort.cards[0];
              const linkTo = c.link || '/resort';
              return (
                <div className="relative bg-white rounded-2xl overflow-hidden shadow-lg hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 md:flex ring-1 ring-slate-200 hover:ring-sky-400/50">
                  <img
                    src={c.image}
                    alt={c.name}
                    className="w-full md:w-1/2 h-72 md:h-auto object-cover"
                    loading="lazy"
                  />
                  <div className="p-8 md:p-10 flex flex-col justify-center">
                    {c.badge && (
                      <span className="inline-block bg-sky-100 text-sky-700 text-xs font-semibold px-3 py-1 rounded-full mb-4 w-fit">
                        {c.badge}
                      </span>
                    )}
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">{c.name}</h3>
                    {c.location && <p className="text-sm text-slate-500 mb-3"><i className="fas fa-location-dot mr-1.5 text-slate-400"></i>{c.location}</p>}
                    <p className="text-slate-600 mb-6 leading-relaxed">{c.desc}</p>
                    <Link
                      to={linkTo}
                      className="inline-block bg-sky-600 hover:bg-sky-700 text-white text-center px-6 py-3 rounded-lg font-medium transition w-fit"
                    >
                      {c.ctaText || 'Explore & Book Now'}
                    </Link>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className={`grid gap-6 ${resort.cards.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
              {resort.cards.map((c) => {
                const linkTo = c.link || '/resort';
                return (
                  <div key={c.id || c.name} className="relative bg-white rounded-2xl overflow-hidden shadow-lg hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 ring-1 ring-slate-200 hover:ring-sky-400/50 flex flex-col">
                    <img
                      src={c.image}
                      alt={c.name}
                      className="w-full h-48 object-cover"
                      loading="lazy"
                    />
                    <div className="p-6 flex flex-col flex-1">
                      {c.badge && (
                        <span className="inline-block bg-sky-100 text-sky-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full mb-3 w-fit">
                          {c.badge}
                        </span>
                      )}
                      <h3 className="text-xl font-bold text-slate-900 mb-1">{c.name}</h3>
                      {c.location && <p className="text-xs text-slate-500 mb-2"><i className="fas fa-location-dot mr-1 text-slate-400"></i>{c.location}</p>}
                      <p className="text-sm text-slate-600 mb-5 leading-relaxed flex-1 line-clamp-4">{c.desc}</p>
                      <Link
                        to={linkTo}
                        className="inline-block bg-sky-600 hover:bg-sky-700 text-white text-center px-5 py-2.5 rounded-lg font-medium text-sm transition w-fit mt-auto"
                      >
                        {c.ctaText || 'Explore & Book Now'}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/*  #6 — WHY CHOOSE US  (#8 scroll reveal)                     */}
      {/* ============================================================ */}
      <section className="py-20 bg-sky-50 relative overflow-hidden">
        <div
          ref={whyRef}
          className="reveal-section relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
        >
          <div className="text-center mb-14">
            <span className="inline-flex h-12 w-12 rounded-full bg-sky-100 text-sky-600 items-center justify-center mb-3" aria-hidden="true">
              <i className="fas fa-umbrella-beach text-xl" aria-hidden="true"></i>
            </span>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{why.sectionTitle}</h2>
            <div className="w-16 h-1.5 rounded-full bg-sky-400 mx-auto mb-4" />
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              {why.sectionSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {why.features.map((f, i) => (
              <div
                key={f.title}
                className="group bg-white rounded-2xl p-6 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-center border border-slate-100"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mx-auto mb-4 group-hover:bg-sky-600 group-hover:text-white transition-colors duration-300">
                  <i className={`fas ${f.icon.startsWith("fa-") ? f.icon : `fa-${f.icon}`} text-xl`} aria-hidden="true"></i>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  #7 — READY FOR PARADISE CTA  (#8 scroll reveal)            */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-sky-700">
        <div
          ref={ctaRef}
          className="reveal-section relative py-20 px-4 sm:px-6 lg:px-8 text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {cta.title}
          </h2>
          <p className="text-lg text-sky-100 max-w-xl mx-auto mb-8">
            {cta.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/resort"
              className="inline-block bg-white text-sky-700 hover:bg-sky-50 font-semibold px-8 py-3 rounded-lg transition shadow-lg hover:shadow-xl"
            >
              {cta.buttonText}
            </Link>
            <Link
              to="/resort#rooms"
              className="inline-block bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3 rounded-lg transition border border-white/20"
            >
              View Rooms
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
