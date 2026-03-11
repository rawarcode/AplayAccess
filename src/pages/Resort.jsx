import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";
import { api } from "../lib/api.js";

// Local data for UI enrichment + offline fallback
import { rooms as roomsFallback } from "../data/rooms.js";
import { amenities as amenitiesFallback } from "../data/amenities.js";
import { gallery as galleryFallback } from "../data/gallery.js";
import { testimonials } from "../data/testimonials.js";

import LoginModal from "../components/modals/LoginModal.jsx";
import BookingModal from "../components/modals/BookingModal.jsx";
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
  const name = room?.name ?? "Room";
  const price = room?.price ?? 0;

  // Find matching local room card by name (to reuse nicer UI fields)
  const local = roomsFallback.find((r) => r?.name === name);

  const desc =
    local?.desc ??
    "Relax in comfort with a cozy space, clean linens, and a peaceful resort atmosphere.";

  const img = local?.img ?? FALLBACK_ROOM_IMG;

  // Optional badge (reuse local badge if exists)
  let badge = local?.badge ?? null;
  if (!badge) {
    const p = Number(price || 0);
    if (p >= 6000) badge = { text: "Premium", className: "bg-purple-600" };
    else if (p >= 4500) badge = { text: "Popular", className: "bg-green-600" };
    else if (p > 0) badge = { text: "Best Value", className: "bg-blue-600" };
  }

  return { ...room, name, price, img, desc, badge };
}

export default function Resort() {
  const { user, login } = useAuth();
  const isLoggedIn = !!user;

  const location = useLocation();
  const navigate = useNavigate();

  const [bookingOpen, setBookingOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastBooking, setLastBooking] = useState(null); // details passed to SuccessModal

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

  // API-backed lists (fallback if API is down)
  const [roomsApi, setRoomsApi] = useState([]);
  const [amenitiesApi, setAmenitiesApi] = useState([]);
  const [galleryApi, setGalleryApi] = useState([]);
  const [reviewsApi, setReviewsApi] = useState([]);

  const anyOverlayOpen =
    bookingOpen || loginOpen || successOpen || contactAlert.open;
  useLockBodyScroll(anyOverlayOpen);

  // UI cards
  const roomCards = useMemo(() => {
    const base = roomsApi.length ? roomsApi : roomsFallback;
    return base.map(buildRoomCard);
  }, [roomsApi]);

  const bookingRooms = useMemo(() => {
    const base = roomsApi.length ? roomsApi : roomsFallback;
    return base.map((r) => ({
      id: r?.id ?? null,
      name: r?.name ?? "Room",
      price: r?.price ?? 0,
    }));
  }, [roomsApi]);

  const amenityCards = useMemo(() => {
    if (amenitiesApi.length) {
      return amenitiesApi.map((a) => ({
        title: a?.name ?? "Amenity",
        desc: a?.description ?? "",
        icon: amenityIcon(a?.name),
      }));
    }
    return amenitiesFallback;
  }, [amenitiesApi]);

  // Normalize gallery items to { src, alt, caption }
  const galleryDisplay = useMemo(() => {
    const base = galleryApi.length ? galleryApi : galleryFallback;
    return base.slice(0, 6).map((g) => ({
      src: g.image_url ?? g.src,
      alt: g.caption ?? g.alt ?? "Gallery image",
      caption: g.caption ?? "",
    }));
  }, [galleryApi]);

  // Normalize reviews / fallback testimonials to { name, img, stars, quote }
  const testimonialsDisplay = useMemo(() => {
    if (reviewsApi.length) {
      return reviewsApi.slice(0, 3).map((r) => ({
        name: r.user_name ?? "Guest",
        img:
          r.user_avatar ??
          `https://ui-avatars.com/api/?name=${encodeURIComponent(r.user_name ?? "Guest")}&background=3b82f6&color=fff`,
        stars: "★".repeat(Math.min(5, Math.max(1, Number(r.rating || 5)))),
        quote: r.comment ?? "",
      }));
    }
    return testimonials;
  }, [reviewsApi]);

  function requestBooking(roomName = "") {
    if (!isLoggedIn) {
      setPendingBookingRoom(roomName || "");
      setLoginOpen(true);
      return;
    }
    setSelectedRoom(roomName || "");
    setBookingOpen(true);
  }

  function handleLoginSuccess(u) {
    login(u);
    setLoginOpen(false);

    const params = new URLSearchParams(location.search);
    const next = params.get("next");

    if (next) {
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

  // Load rooms + amenities (public endpoints now)
  useEffect(() => {
    let alive = true;

    async function loadResortData() {
      try {
        const [roomsRes, amenitiesRes, galleryRes, reviewsRes] = await Promise.all([
          api.get(`/api/resorts/${RESORT_ID}/rooms`),
          api.get(`/api/resorts/${RESORT_ID}/amenities`),
          api.get(`/api/resorts/${RESORT_ID}/gallery`),
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
        setGalleryApi([]);
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
          className="min-h-screen flex items-center justify-center text-center relative"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-white z-10">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Welcome to Paradise</h1>
            <p className="text-xl md:text-2xl mb-8">
              Aplaya Beach Resort offers the perfect blend of luxury, comfort, and breathtaking ocean views.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => requestBooking("")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md text-lg font-medium"
              >
                Book Your Stay
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
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:flex lg:items-center lg:justify-between gap-10">
              <div className="lg:w-1/2 mb-10 lg:mb-0">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Discover Aplaya Beach Resort</h2>
                <p className="text-gray-600 mb-4">
                  Nestled along the pristine coastline, Aplaya Beach Resort is a tropical paradise offering luxurious
                  accommodations, world-class amenities, and unforgettable experiences.
                </p>
                <p className="text-gray-600 mb-6">
                  Our resort combines modern comfort with traditional charm, creating the perfect setting for your dream
                  vacation.
                </p>

                <div className="flex flex-wrap gap-4 text-gray-700">
                  <span className="inline-flex items-center gap-2">📶 Free WiFi</span>
                  <span className="inline-flex items-center gap-2">🏊 Infinity Pool</span>
                  <span className="inline-flex items-center gap-2">🍽️ Fine Dining</span>
                  <span className="inline-flex items-center gap-2">💆 Spa Services</span>
                </div>
              </div>

              <div className="lg:w-1/2 relative">
                <div className="relative rounded-xl overflow-hidden shadow-xl">
                  <img
                    src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=80"
                    alt="Resort View"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                  <div className="absolute -bottom-6 -right-6 bg-blue-600 text-white p-6 rounded-xl shadow-lg">
                    <div className="text-center">
                      <p className="text-2xl font-bold">4.9</p>
                      <p className="text-sm">Guest Rating</p>
                      <p className="text-sm mt-1">★★★★★</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ROOMS */}
        <section id="rooms" className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Accommodations</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Choose from our selection of luxurious rooms and suites, each designed to provide the ultimate comfort and
                relaxation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {roomCards.slice(0, 3).map((r) => (
                <div
                  key={r.id ?? r.name}
                  className="bg-white rounded-xl overflow-hidden shadow-md transition hover:-translate-y-2 hover:shadow-xl"
                >
                  <div className="relative">
                    <img src={r.img} alt={r.name} className="w-full h-64 object-cover" loading="lazy" />
                    {r.badge ? (
                      <div
                        className={`absolute top-4 right-4 ${r.badge.className} text-white px-3 py-1 rounded-md text-sm font-medium`}
                      >
                        {r.badge.text}
                      </div>
                    ) : null}
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{r.name}</h3>
                    <p className="text-gray-600 mb-4">{r.desc}</p>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-2xl font-bold text-blue-600">{formatPHP(r.price)}</span>
                        <span className="text-gray-500 text-sm">/ night</span>
                      </div>
                      <button
                        onClick={() => requestBooking(r.name)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
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
                className="inline-block bg-white hover:bg-gray-100 text-blue-600 font-medium px-6 py-3 rounded-md border border-blue-600 transition"
              >
                View All Rooms
              </Link>
            </div>
          </div>
        </section>

        {/* AMENITIES */}
        <section id="amenities" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Resort Amenities</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                We provide everything you need for a perfect vacation experience.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {amenityCards.map((a) => (
                <div key={a.title} className="text-center p-6 rounded-xl bg-gray-50 hover:bg-blue-50 transition">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                    {a.icon}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{a.title}</h3>
                  <p className="text-gray-600">{a.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="py-20 bg-blue-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">What Our Guests Say</h2>
              <p className="text-xl text-blue-100 max-w-3xl mx-auto">
                Don&apos;t just take our word for it - hear from our satisfied guests.
              </p>
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

        {/* GALLERY */}
        <section id="gallery" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Gallery</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">Take a visual journey through our beautiful resort.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {galleryDisplay.map((g, i) => (
                <div key={`${g.alt}-${i}`} className="rounded-xl overflow-hidden shadow-lg">
                  <img
                    src={g.src}
                    alt={g.alt}
                    className="w-full h-64 object-cover hover:scale-105 transition duration-500 cursor-pointer"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link
                to="/gallery"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium transition"
              >
                View More Photos
              </Link>
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:flex lg:items-center lg:justify-between gap-10">
              <div className="lg:w-1/2 mb-10 lg:mb-0">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Contact Us</h2>
                <p className="text-gray-600 mb-6">
                  Have questions or need assistance with your booking? Our team is here to help you plan your perfect getaway.
                </p>

                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-blue-600 mt-0.5">📍</span>
                    <div>
                      <p className="font-medium text-gray-900">Address</p>
                      <p className="text-gray-500">123 Beachfront Avenue, Coastal City, Paradise Island</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-blue-600 mt-0.5">📞</span>
                    <div>
                      <p className="font-medium text-gray-900">Phone</p>
                      <p className="text-gray-500">+1 (555) 123-4567</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-blue-600 mt-0.5">✉️</span>
                    <div>
                      <p className="font-medium text-gray-900">Email</p>
                      <p className="text-gray-500">reservations@aplayabeachresort.com</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Follow Us</h3>
                  <div className="flex space-x-4 text-xl">
                    <a href="#" className="text-gray-500 hover:text-blue-600">f</a>
                    <a href="#" className="text-gray-500 hover:text-blue-600">ig</a>
                    <a href="#" className="text-gray-500 hover:text-blue-600">x</a>
                    <a href="#" className="text-gray-500 hover:text-blue-600">ta</a>
                  </div>
                </div>
              </div>

              <div className="lg:w-1/2">
                <form onSubmit={submitContact} className="bg-white p-6 rounded-lg shadow-md">
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
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-md transition"
                  >
                    {contactSubmitting ? "Sending..." : "Send Message"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* NEWSLETTER */}
        <section className="py-16 bg-blue-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl shadow-lg px-8 py-10 max-w-2xl mx-auto text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Subscribe to Our Newsletter</h2>
              <p className="text-gray-600 mb-6">
                Stay updated with our latest offers, news, and events. Join our mailing list today!
              </p>

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

      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        selectedRoom={selectedRoom}
        rooms={bookingRooms}
        onBooked={(details) => {
          setLastBooking(details);
          setBookingOpen(false);
          setSuccessOpen(true);
        }}
      />

      <SuccessModal
        open={successOpen}
        onClose={() => { setSuccessOpen(false); setLastBooking(null); }}
        booking={lastBooking}
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