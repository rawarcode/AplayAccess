import { useEffect, useRef, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { isVideoUrl } from "../lib/uploadApi.js";
import { useContent } from "../context/ContentContext.jsx";

const HOME_DEFAULTS = {
  hero: {
    background: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80",
    title:    "Welcome to Paradise",
    subtitle: "Experience luxury and breathtaking ocean views at Aplaya Beach Resort.",
    ctaText:  "Book Now",
  },
  resort: {
    sectionTitle:    "Our Beach Resort",
    sectionSubtitle: "Your perfect beach getaway awaits — day visits, overnight stays, and 24-hour packages.",
    name:  "Aplaya Beach Resort Cavite",
    desc:  "Experience luxury and breathtaking ocean views at our flagship resort. Enjoy pristine white sand beaches, world-class amenities, and unforgettable sunsets.",
    image: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=2070&q=80",
  },
  why: {
    sectionTitle:    "Why Choose Aplaya?",
    sectionSubtitle: "Everything you need for the perfect beach getaway — all in one place.",
    features: [
      { icon: "fa-umbrella-beach", title: "Beachfront Location",  desc: "Steps away from pristine white sand and crystal-clear waters." },
      { icon: "fa-tags",           title: "Affordable Rates",     desc: "Premium resort experience without the premium price tag." },
      { icon: "fa-moon",           title: "Day & Night Packages", desc: "Flexible booking — day use, overnight, or full 24-hour stays." },
      { icon: "fa-laptop",         title: "Easy Online Booking",  desc: "Reserve in minutes with our hassle-free online system." },
    ],
  },
  cta: {
    title:      "Ready for Paradise?",
    subtitle:   "Book your beach getaway today and create memories that last a lifetime.",
    buttonText: "Book Your Stay",
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
      resort: { ...HOME_DEFAULTS.resort, ...homeResort },
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
          <link rel="preload" as="image" href={hero.background} />
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
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-white/70 hover:text-white transition animate-pulse"
          aria-label="Scroll down"
        >
          <i className="fas fa-chevron-down text-2xl"></i>
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

          <div className="relative bg-white rounded-2xl overflow-hidden shadow-lg hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 md:flex ring-1 ring-slate-200 hover:ring-sky-400/50">

            <img
              src={resort.image}
              alt={resort.name}
              className="w-full md:w-1/2 h-72 md:h-auto object-cover"
              loading="lazy"
            />
            <div className="p-8 md:p-10 flex flex-col justify-center">
              <span className="inline-block bg-sky-100 text-sky-700 text-xs font-semibold px-3 py-1 rounded-full mb-4 w-fit">
                Now Open
              </span>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{resort.name}</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">{resort.desc}</p>
              <Link
                to="/resort"
                className="inline-block bg-sky-600 hover:bg-sky-700 text-white text-center px-6 py-3 rounded-lg font-medium transition w-fit"
              >
                Explore &amp; Book Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  #6 — WHY CHOOSE US  (#8 scroll reveal)                     */}
      {/* ============================================================ */}
      <section className="py-20 bg-gradient-to-br from-sky-50 via-white to-sky-50 relative overflow-hidden">
        <div
          ref={whyRef}
          className="reveal-section relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
        >
          <div className="text-center mb-14">
            <span className="text-4xl mb-3 block">✨</span>
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
                <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-sky-600 group-hover:text-white transition-all duration-300">
                  <i className={`fas ${f.icon.startsWith("fa-") ? f.icon : `fa-${f.icon}`} text-xl`}></i>
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
      <section className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-700" />
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

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
