import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";
import { api } from "../lib/api.js";
import { isVideoUrl } from "../lib/uploadApi.js";

// Local data for UI enrichment + offline fallback
import { rooms as roomsFallback } from "../data/rooms.js";
import { amenities as amenitiesFallback } from "../data/amenities.js";
import { gallery as galleryFallback } from "../data/gallery.js";

import LoginModal from "../components/modals/LoginModal.jsx";
import BookingModal from "../components/modals/BookingModal.jsx";
import GuestWarningModal from "../components/modals/GuestWarningModal.jsx";
import SuccessModal from "../components/modals/SuccessModal.jsx";
import AlertModal from "../components/modals/AlertModal.jsx";

const RESORT_ID = 1;

// Fallback image if DB has no images yet
const FALLBACK_ROOM_IMG =
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80";

function normalizeApiList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function formatPHP(amount) {
  const n = Number(amount || 0);
  if (Number.isNaN(n)) return "₱0";
  return `₱${n.toLocaleString()}`;
}

function amenityIcon(name = "") {
  const n = String(name).toLowerCase();
  if (n.includes("wifi")) return "📶";
  if (n.includes("pool")) return "🏊";
  if (n.includes("parking")) return "🅿️";
  if (n.includes("restaurant") || n.includes("dining") || n.includes("food")) return "🍽️";
  if (n.includes("spa") || n.includes("massage")) return "💆";
  if (n.includes("gym") || n.includes("fitness")) return "🏋️";
  if (n.includes("shuttle") || n.includes("transport")) return "🚐";
  if (n.includes("beach")) return "🏖️";
  return "✨";
}

function buildRoomCard(room) {
  const name     = room?.name ?? "Room";
  const dayRate  = Number(room?.day_rate  ?? 0);
  const nightRate = Number(room?.overnight_rate ?? 0);

  // Find matching local room card by name (to reuse nicer UI fields)
  const local = roomsFallback.find((r) => r?.name === name);

  const desc =
    local?.desc ??
    "Relax in comfort with a cozy space, clean linens, and a peaceful resort atmosphere.";

  const img = local?.img ?? FALLBACK_ROOM_IMG;

  return { ...room, name, day_rate: dayRate, overnight_rate: nightRate, img, desc };
}

export default function Resort() {
  const { user, login } = useAuth();
  const isLoggedIn = !!user;

  const location = useLocation();
  const navigate = useNavigate();

  const [bookingOpen, setBookingOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [guestWarningOpen, setGuestWarningOpen] = useState(false);
  const [guestMode, setGuestMode] = useState(false); // true = booking without account
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastBooking, setLastBooking] = useState(null); // details passed to SuccessModal
  const [successIsGuest, setSuccessIsGuest] = useState(false); // was the completed booking a guest booking?

  const [selectedRoom, setSelectedRoom] = useState("");
  const [pendingBookingRoom, setPendingBookingRoom] = useState(null); // string|null

  const [contactAlert, setContactAlert] = useState({
    open: false,
    type: "success",
    title: "Success",
    message: "",
  });

  // Contact form state
  const [contactForm, setContactForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [contactSubmitting, setContactSubmitting] = useState(false);

  // Newsletter inline feedback (no modal needed)
  const [newsletter, setNewsletter] = useState({ email: "", msg: "", type: "", submitting: false });

  // Page content — fetched from /api/content, falls back to hardcoded defaults
  const [pc, setPc] = useState(() => ({
    hero:       { background: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80", title: "Welcome to Paradise", subtitle: "Aplaya Beach Resort offers the perfect blend of luxury, comfort, and breathtaking ocean views.", ctaText: "Book Your Stay" },
    about:      { title: "Discover Aplaya Beach Resort", paragraph1: "Nestled along the pristine coastline, Aplaya Beach Resort is a tropical paradise offering luxurious accommodations, world-class amenities, and unforgettable experiences.", paragraph2: "Our resort combines modern comfort with traditional charm, creating the perfect setting for your dream vacation.", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=80", rating: "4.9" },
    rooms:      { sectionTitle: "Our Accommodations", sectionSubtitle: "Choose from our selection of luxurious rooms and suites, each designed to provide the ultimate comfort and relaxation." },
    contact:    { address: "Purok 7 Sitio Pobres Brgy Munting Mapino, Naic, Philippines, 4110", phone: "+63 908 191 4721", email: "aplayabeachresortph@gmail.com", facebook: "", instagram: "", twitter: "", tiktok: "", map_url: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d287.5320944376759!2d120.7697092276209!3d14.33236877346086!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x339629b5c29479cb%3A0xfcf314e028c916ae!2sAplaya%20Beach%20Resort!5e1!3m2!1sen!2sus!4v1775705477033!5m2!1sen!2sus", osm_url: "https://www.openstreetmap.org/export/embed.html?bbox=120.7687%2C14.3313%2C120.7707%2C14.3334&layer=mapnik&marker=14.33237%2C120.76971" },
    reviews:    { visible: true,  sectionTitle: "What Our Guests Say", sectionSubtitle: "Don't just take our word for it - hear from our satisfied guests." },
    newsletter: { visible: true,  title: "Subscribe to Our Newsletter", subtitle: "Stay updated with our latest offers, news, and events. Join our mailing list today!" },
  }));

  // API-backed lists (fallback if API is down)
  const [roomsApi, setRoomsApi] = useState([]);
  const [amenitiesApi, setAmenitiesApi] = useState([]);
  const [galleryApi, setGalleryApi] = useState(null); // null = not yet loaded
  const [reviewsApi, setReviewsApi] = useState([]);

  const anyOverlayOpen =
    bookingOpen || loginOpen || guestWarningOpen || successOpen || contactAlert.open;
  useLockBodyScroll(anyOverlayOpen);

  // UI cards
  const roomCards = useMemo(() => {
    const base = roomsApi.length ? roomsApi : roomsFallback;
    return base.map(buildRoomCard);
  }, [roomsApi]);

  const bookingRooms = useMemo(() => {
    const base = roomsApi.length ? roomsApi : roomsFallback;
    return base
      .filter(r => !r?.availability_status || r?.availability_status === "available")
      .map((r) => ({
        id:             r?.id             ?? null,
        name:           r?.name           ?? "Room",
        day_rate:       Number(r?.day_rate       ?? 0),
        overnight_rate: Number(r?.overnight_rate  ?? 0),
        capacity:       Number(r?.capacity        ?? 20),
      }));
  }, [roomsApi]);

  const amenityCards = useMemo(() => {
    return amenitiesApi.map((a) => ({
      title: a?.name ?? "Amenity",
      desc:  a?.description ?? "",
      icon:  a?.icon || amenityIcon(a?.name),
    }));
  }, [amenitiesApi]);

  // Normalize gallery items to { src, alt, caption }
  // null  = API not yet responded — show nothing (avoids fallback flash)
  // []    = API responded with empty or failed — show fallback
  // [...] = API responded with featured images — show those
  const galleryDisplay = useMemo(() => {
    if (galleryApi === null) return null; // still loading
    if (galleryApi.length) {
      return galleryApi.map((g) => ({
        src: g.image_url ?? g.src,
        alt: g.caption ?? g.alt ?? "Gallery image",
        caption: g.caption ?? "",
      }));
    }
    // API returned empty or failed — fall back to local data
    return galleryFallback.slice(0, 6).map((g) => ({
      src: g.image_url ?? g.src,
      alt: g.caption ?? g.alt ?? "Gallery image",
      caption: g.caption ?? "",
    }));
  }, [galleryApi]);

  // Map API reviews to display format — no static fallback
  const testimonialsDisplay = useMemo(() => {
    return reviewsApi.map((r) => ({
      name:  r.user_name ?? "Guest",
      img:   r.user_avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(r.user_name ?? "Guest")}&background=3b82f6&color=fff`,
      stars: "★".repeat(Math.min(5, Math.max(1, Number(r.rating || 5)))),
      quote: r.comment ?? "",
    }));
  }, [reviewsApi]);

  function requestBooking(roomName = "") {
    if (!isLoggedIn) {
      setPendingBookingRoom(roomName || "");
      setGuestWarningOpen(true); // show choice: log in, sign up, or continue as guest
      return;
    }
    setGuestMode(false);
    setSelectedRoom(roomName || "");
    setBookingOpen(true);
  }

  function handleLoginSuccess(u) {
    login(u);
    setLoginOpen(false);

    const params = new URLSearchParams(location.search);
    const next = params.get("next");

    // Allowlist: only navigate to known internal paths (prevent open redirect)
    const ALLOWED_PREFIXES = ["/dashboard", "/resort", "/rooms", "/gallery", "/owner", "/admin", "/frontdesk"];
    const isSafeNext = next && next.startsWith("/") && ALLOWED_PREFIXES.some(p => next.startsWith(p));

    if (isSafeNext) {
      params.delete("login");
      params.delete("next");
      navigate(next, { replace: true });
      return;
    }

    if (pendingBookingRoom !== null) {
      const roomName = pendingBookingRoom;
      setPendingBookingRoom(null);
      setSelectedRoom(roomName || "");
      setBookingOpen(true);
    }
  }

  // Auto-open login modal when redirected here: /resort?login=1&next=/dashboard
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldLogin = params.get("login") === "1";
    if (shouldLogin) setLoginOpen(true);
  }, [location.search]);

  // Handle navbar Book Now: /resort?book=1 (& optional room)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldBook = params.get("book") === "1";
    if (!shouldBook) return;

    const roomFromUrl = params.get("room") || "";

    params.delete("book");
    params.delete("room");
    navigate({ search: params.toString() }, { replace: true });

    requestBooking(roomFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Fetch page content from API (overrides defaults)
  useEffect(() => {
    api.get("/api/content")
      .then(r => {
        const d = r.data?.data ?? {};
        setPc(prev => ({
          hero:       { ...prev.hero,       ...(d.page_resort_hero       ?? {}) },
          about:      { ...prev.about,      ...(d.page_resort_about      ?? {}) },
          rooms:      { ...prev.rooms,      ...(d.page_resort_rooms      ?? {}) },
          contact:    { ...prev.contact,    ...(d.page_resort_contact    ?? {}) },
          reviews:    { ...prev.reviews,    ...(d.page_resort_reviews    ?? {}) },
          newsletter: { ...prev.newsletter, ...(d.page_resort_newsletter ?? {}) },
        }));
      })
      .catch(() => {}); // keep defaults silently
  }, []);

  // Load rooms + amenities (public endpoints now)
  useEffect(() => {
    let alive = true;

    async function loadResortData() {
      try {
        const [roomsRes, amenitiesRes, galleryRes, reviewsRes] = await Promise.all([
          api.get(`/api/resorts/${RESORT_ID}/rooms`),
          api.get(`/api/resorts/${RESORT_ID}/amenities`),
          api.get(`/api/resorts/${RESORT_ID}/gallery?featured=1`),
          api.get(`/api/resorts/${RESORT_ID}/reviews`),
        ]);

        if (!alive) return;

        setRoomsApi(normalizeApiList(roomsRes.data));
        setAmenitiesApi(normalizeApiList(amenitiesRes.data));
        setGalleryApi(normalizeApiList(galleryRes.data));
        setReviewsApi(normalizeApiList(reviewsRes.data));
      } catch (e) {
        // Silent fallback only (no banner)
        if (!alive) return;
        console.warn("Resort API load failed, using local fallback:", e?.message || e);
        setRoomsApi([]);
        setAmenitiesApi([]);
        setGalleryApi([]); // empty array triggers fallback
        setReviewsApi([]);
      }
    }

    loadResortData();
    return () => {
      alive = false;
    };
  }, []);

  async function submitContact(e) {
    e.preventDefault();
    setContactSubmitting(true);
    try {
      await api.post("/api/contact", contactForm);
      setContactAlert({
        open: true,
        type: "success",
        title: "Message Sent!",
        message: "Thank you for reaching out! We'll get back to you within 24 hours.",
      });
      setContactForm({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Failed to send message. Please try again.";
      setContactAlert({
        open: true,
        type: "error",
        title: "Error",
        message: msg,
      });
    } finally {
      setContactSubmitting(false);
    }
  }

  async function submitNewsletter(e) {
    e.preventDefault();
    const email = newsletter.email.trim();

    if (!email) {
      setNewsletter((p) => ({ ...p, msg: "Please enter your email address.", type: "error" }));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setNewsletter((p) => ({ ...p, msg: "Please enter a valid email address.", type: "error" }));
      return;
    }

    setNewsletter((p) => ({ ...p, submitting: true, msg: "", type: "" }));
    try {
      const res = await api.post("/api/newsletter", { email });
      setNewsletter({ email: "", msg: `🎉 ${res.data.message}`, type: "success", submitting: false });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Something went wrong. Please try again.";
      setNewsletter((p) => ({ ...p, msg, type: "error", submitting: false }));
    }
  }

  return (
    <div className="font-sans">
      <div className="pt-16">
        {/* HERO */}
        <section
          id="home"
          className="min-h-screen flex items-center justify-center text-center relative overflow-hidden"
          style={isVideoUrl(pc.hero.background) ? {} : {
            backgroundImage: `linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), url('${pc.hero.background}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Video background */}
          {isVideoUrl(pc.hero.background) && (
            <>
              <video
                src={pc.hero.background}
                autoPlay muted loop playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50" />
            </>
          )}
          <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-white z-10">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">{pc.hero.title}</h1>
            <p className="text-xl md:text-2xl mb-8">{pc.hero.subtitle}</p>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => requestBooking("")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md text-lg font-medium"
              >
                {pc.hero.ctaText}
              </button>

              {isLoggedIn ? (
                <Link
                  to="/dashboard"
                  className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-md text-lg font-medium backdrop-blur-sm"
                >
                  My Dashboard →
                </Link>
              ) : (
                <button
                  onClick={() => setLoginOpen(true)}
                  className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-md text-lg font-medium backdrop-blur-sm"
                >
                  Login
                </button>
              )}
            </div>

            {isLoggedIn ? (
              <p className="mt-4 text-sm text-white/80">
                Welcome back, <span className="font-semibold">{user?.name || user?.email || "Guest"}</span>!
              </p>
            ) : null}
          </div>
        </section>

        {/* ABOUT */}
        <section className="py-24 bg-white relative overflow-hidden">
          <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
               style={{ background: "radial-gradient(circle, #38bdf8, transparent 70%)" }} />
          <div className="pointer-events-none absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10"
               style={{ background: "radial-gradient(circle, #fbbf24, transparent 70%)" }} />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:flex lg:items-center lg:justify-between gap-16">
              <div className="lg:w-1/2 mb-10 lg:mb-0">
                <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-sm font-semibold px-4 py-1.5 rounded-full mb-5">
                  🌊 About the Resort
                </div>
                <h2 className="text-4xl font-bold text-gray-900 mb-3 leading-tight">{pc.about.title}</h2>
                <div className="w-12 h-1.5 rounded-full bg-blue-400 mb-6" />
                <p className="text-gray-600 mb-4 leading-relaxed">{pc.about.paragraph1}</p>
                <p className="text-gray-600 mb-8 leading-relaxed">{pc.about.paragraph2}</p>

                {amenityCards.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {amenityCards.slice(0, 4).map((a) => (
                      <span key={a.title} className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-1.5 rounded-full">
                        {a.icon} {a.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:w-1/2 relative">
                <div className="absolute -inset-4 bg-blue-100 rounded-3xl rotate-2 opacity-40" />
                <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                  {isVideoUrl(pc.about.image) ? (
                    <video
                      src={pc.about.image}
                      autoPlay muted loop playsInline
                      className="w-full h-auto"
                    />
                  ) : (
                    <img
                      src={pc.about.image}
                      alt="Resort View"
                      className="w-full h-auto"
                      loading="lazy"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ROOMS */}
        <section id="rooms" className="py-24 bg-sky-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="text-4xl mb-3 block">🛏️</span>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{pc.rooms.sectionTitle}</h2>
              <div className="w-16 h-1.5 rounded-full bg-blue-400 mx-auto mb-4" />
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">{pc.rooms.sectionSubtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {roomCards.slice(0, 3).map((r) => (
                <div
                  key={r.id ?? r.name}
                  className="group bg-white rounded-2xl overflow-hidden shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
                >
                  <div className="relative overflow-hidden">
                    <img src={r.img} alt={r.name} className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-blue-700 text-xs font-bold px-3 py-1 rounded-full shadow">
                      Day Use
                    </span>
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{r.name}</h3>
                    <p className="text-gray-500 text-sm mb-4 line-clamp-2">{r.desc}</p>
                    <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                      <div>
                        <span className="text-2xl font-bold text-blue-600">{formatPHP(r.day_rate)}</span>
                        <span className="text-gray-400 text-xs ml-1">/ day visit</span>
                      </div>
                      <button
                        onClick={() => requestBooking(r.name)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow hover:shadow-md transition-all"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link
                to="/rooms"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                View All Rooms →
              </Link>
            </div>
          </div>
        </section>

        {/* AMENITIES */}
        {amenityCards.length > 0 && (
        <section id="amenities" className="py-24 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 45%, #fef9ec 100%)" }}>
          <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20"
               style={{ background: "radial-gradient(circle, #38bdf8, transparent 70%)" }} />
          <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full opacity-20"
               style={{ background: "radial-gradient(circle, #fbbf24, transparent 70%)" }} />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="text-4xl mb-3 block">🌴</span>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Resort Amenities</h2>
              <div className="w-16 h-1.5 rounded-full bg-blue-400 mx-auto mb-4" />
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                Everything you need for a perfect vacation experience.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              {amenityCards.map((a, i) => {
                const accents = [
                  "from-blue-400 to-cyan-400",
                  "from-amber-400 to-orange-400",
                  "from-emerald-400 to-teal-400",
                  "from-violet-400 to-purple-400",
                  "from-pink-400 to-rose-400",
                  "from-sky-400 to-indigo-400",
                ];
                const accent = accents[i % accents.length];
                return (
                  <div
                    key={a.title}
                    className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col items-center text-center overflow-hidden"
                    style={{ width: "200px", minHeight: "180px" }}
                  >
                    <div className={`w-full h-2 bg-gradient-to-r ${accent}`} />
                    <div className="flex flex-col items-center px-5 py-6 flex-1">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${accent} flex items-center justify-center mb-4 shadow-md text-3xl group-hover:scale-110 transition-transform duration-300`}>
                        {a.icon}
                      </div>
                      <h3 className="text-base font-bold text-gray-800 leading-tight mb-1">{a.title}</h3>
                      {a.desc && <p className="text-xs text-gray-500 leading-snug">{a.desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        )}

        {/* TESTIMONIALS */}
        {pc.reviews.visible !== false && testimonialsDisplay.length > 0 && (
        <section className="py-20 bg-blue-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">{pc.reviews.sectionTitle}</h2>
              <p className="text-xl text-blue-100 max-w-3xl mx-auto">{pc.reviews.sectionSubtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonialsDisplay.map((t, i) => (
                <div
                  key={`${t.name}-${i}`}
                  className="bg-white/10 p-6 rounded-xl backdrop-blur-sm hover:scale-[1.03] transition"
                >
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden mr-4">
                      <img src={t.img} alt={t.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div>
                      <h4 className="font-bold">{t.name}</h4>
                      <div className="text-yellow-300">{t.stars}</div>
                    </div>
                  </div>
                  <p className="text-blue-100">&ldquo;{t.quote}&rdquo;</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        )}

        {/* GALLERY */}
        <section id="gallery" className="py-24 bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="text-4xl mb-3 block">📸</span>
              <h2 className="text-3xl font-bold text-white mb-2">Gallery</h2>
              <div className="w-16 h-1.5 rounded-full bg-blue-400 mx-auto mb-4" />
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">Take a visual journey through our beautiful resort.</p>
            </div>

            {galleryDisplay === null ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden bg-gray-700 animate-pulse h-64" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {galleryDisplay.map((g, i) => (
                  <div key={`${g.alt}-${i}`} className="group relative rounded-2xl overflow-hidden shadow-lg cursor-pointer">
                    <img
                      src={g.src}
                      alt={g.alt}
                      className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                      {g.caption && <p className="text-white text-sm font-medium">{g.caption}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-center mt-12">
              <Link
                to="/gallery"
                className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                View More Photos →
              </Link>
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" className="py-24 bg-gradient-to-br from-sky-50 via-white to-blue-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="text-4xl mb-3 block">✉️</span>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Get In Touch</h2>
              <div className="w-16 h-1.5 rounded-full bg-blue-400 mx-auto mb-4" />
              <p className="text-lg text-gray-500 max-w-xl mx-auto">Have questions or need help planning your stay? We'd love to hear from you.</p>
            </div>
            <div className="lg:flex lg:items-start lg:justify-between gap-10">
              <div className="lg:w-1/2 mb-10 lg:mb-0">

                <div className="space-y-4">
                  {[
                    { icon: "📍", label: "Address", value: pc.contact.address },
                    { icon: "📞", label: "Phone",   value: pc.contact.phone   },
                    { icon: "✉️", label: "Email",   value: pc.contact.email   },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex items-start gap-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">
                        {icon}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0.5">{label}</p>
                        <p className="text-gray-700 text-sm">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {(pc.contact.facebook || pc.contact.instagram || pc.contact.twitter || pc.contact.tiktok) && (
                  <div className="mt-8">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Follow Us</h3>
                    <div className="flex space-x-4 text-xl">
                      {pc.contact.facebook  && <a href={pc.contact.facebook}  target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-600"><i className="fab fa-facebook"></i></a>}
                      {pc.contact.instagram && <a href={pc.contact.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-pink-500"><i className="fab fa-instagram"></i></a>}
                      {pc.contact.twitter   && <a href={pc.contact.twitter}   target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-sky-500"><i className="fab fa-twitter"></i></a>}
                      {pc.contact.tiktok    && <a href={pc.contact.tiktok}    target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-900"><i className="fab fa-tiktok"></i></a>}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:w-1/2">
                <form onSubmit={submitContact} className="bg-white p-8 rounded-2xl shadow-lg border-t-4 border-blue-500" noValidate>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={contactForm.name}
                      onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Your name"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Your email"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <input
                      type="text"
                      value={contactForm.subject}
                      onChange={(e) => setContactForm((p) => ({ ...p, subject: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Subject"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <textarea
                      rows={4}
                      value={contactForm.message}
                      onChange={(e) => setContactForm((p) => ({ ...p, message: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Your message"
                      required
                    />
                  </div>

                  <button
                    disabled={contactSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-xl shadow hover:shadow-md transition-all"
                  >
                    {contactSubmitting ? "Sending..." : "Send Message ✉️"}
                  </button>
                </form>
              </div>
            </div>

            {/* Map — full width below contact columns */}
            {(pc.contact.map_url || pc.contact.osm_url) && (
              <div className="mt-12">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span>📍</span> Find Us
                  </h3>
                  {pc.contact.map_url && (
                    <a
                      href={pc.contact.map_url.replace('/embed', '').replace('maps/embed?pb=', 'maps/place/?q=')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <i className="fas fa-directions text-xs"></i>
                      Get Directions
                    </a>
                  )}
                </div>
                <div className="rounded-2xl overflow-hidden shadow-md border border-gray-200 w-full" style={{ height: "380px" }}>
                  <iframe
                    src={pc.contact.osm_url || `https://www.openstreetmap.org/export/embed.html?bbox=120.7687%2C14.3313%2C120.7707%2C14.3334&layer=mapnik&marker=14.33237%2C120.76971`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    title="Aplaya Beach Resort location"
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-400 text-right">
                  Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">OpenStreetMap</a> contributors
                </p>
              </div>
            )}
          </div>
        </section>

        {/* NEWSLETTER */}
        {pc.newsletter.visible !== false && (
        <section className="py-16 bg-blue-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl shadow-lg px-8 py-10 max-w-2xl mx-auto text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">{pc.newsletter.title}</h2>
              <p className="text-gray-600 mb-6">{pc.newsletter.subtitle}</p>

              <form onSubmit={submitNewsletter}>
                <div className="flex">
                  <input
                    type="email"
                    value={newsletter.email}
                    onChange={(e) => setNewsletter((p) => ({ ...p, email: e.target.value, msg: "" }))}
                    placeholder="Your email address"
                    disabled={newsletter.submitting}
                    className="flex-grow px-4 py-3 rounded-l-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:bg-gray-50"
                  />
                  <button
                    type="submit"
                    disabled={newsletter.submitting}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium px-6 py-3 rounded-r-md transition shrink-0"
                  >
                    {newsletter.submitting ? "Subscribing..." : "Subscribe"}
                  </button>
                </div>

                {newsletter.msg && (
                  <p className={`mt-3 text-sm font-medium ${newsletter.type === "success" ? "text-green-600" : "text-red-600"}`}>
                    {newsletter.msg}
                  </p>
                )}
              </form>

              <p className="text-xs text-gray-400 mt-4">We respect your privacy. Unsubscribe at any time.</p>
            </div>
          </div>
        </section>
        )}
      </div>

      {/* Modals */}
      <LoginModal
        open={loginOpen}
        onClose={() => {
          setLoginOpen(false);
          setPendingBookingRoom(null);
        }}
        onLoginSuccess={handleLoginSuccess}
      />

      <GuestWarningModal
        open={guestWarningOpen}
        onClose={() => { setGuestWarningOpen(false); setPendingBookingRoom(null); }}
        onLoginSignup={() => {
          setGuestWarningOpen(false);
          setLoginOpen(true);
        }}
        onContinueAsGuest={() => {
          setGuestWarningOpen(false);
          setGuestMode(true);
          setSelectedRoom(pendingBookingRoom || "");
          setPendingBookingRoom(null);
          setBookingOpen(true);
        }}
      />

      <BookingModal
        open={bookingOpen}
        onClose={() => { setBookingOpen(false); setGuestMode(false); }}
        selectedRoom={selectedRoom}
        rooms={bookingRooms}
        guestMode={guestMode}
        onBooked={(details) => {
          setLastBooking(details);
          setSuccessIsGuest(guestMode);
          setBookingOpen(false);
          setGuestMode(false);
          setSuccessOpen(true);
        }}
      />

      <SuccessModal
        open={successOpen}
        onClose={() => { setSuccessOpen(false); setLastBooking(null); setSuccessIsGuest(false); }}
        booking={lastBooking}
        guestMode={successIsGuest}
      />

      <AlertModal
        open={contactAlert.open}
        onClose={() => setContactAlert((s) => ({ ...s, open: false }))}
        type={contactAlert.type}
        title={contactAlert.title}
        message={contactAlert.message}
      />

    </div>
  );
}