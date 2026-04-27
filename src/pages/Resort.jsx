import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useContent } from "../context/ContentContext.jsx";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";
import { api } from "../lib/api.js";
import { isVideoUrl } from "../lib/uploadApi.js";
import { getAnnouncements } from "../lib/resortApi.js";
import { getBookings } from "../lib/bookingApi.js";
import { fmtDateTime } from "../lib/format.js";
import { RESORT_ID } from "../lib/config.js";
import { Helmet } from "react-helmet-async";

// Local data for UI enrichment + offline fallback
import { rooms as roomsFallback } from "../data/rooms.js";
import { amenities as amenitiesFallback } from "../data/amenities.js";
import { gallery as galleryFallback } from "../data/gallery.js";

import Modal from "../components/modals/Modal.jsx";
import LoginModal from "../components/modals/LoginModal.jsx";
import SignupModal from "../components/modals/SignupModal.jsx";
import VerifyEmailModal from "../components/modals/VerifyEmailModal.jsx";
import BookingModal from "../components/modals/BookingModal.jsx";
import GuestWarningModal from "../components/modals/GuestWarningModal.jsx";
import SuccessModal from "../components/modals/SuccessModal.jsx";
import AlertModal from "../components/modals/AlertModal.jsx";
import Toast, { useToast } from "../components/ui/Toast.jsx";

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
  const name      = room?.name ?? "Room";
  const dayRate   = Number(room?.day_rate  ?? 0);
  const nightRate = Number(room?.overnight_rate ?? 0);
  const rate24hr  = Number(room?.rate_24hr ?? 0);

  // Find matching local room card by name (to reuse nicer UI fields)
  const local = roomsFallback.find((r) => r?.name === name);

  const desc =
    local?.desc ??
    "Relax in comfort with a cozy space, clean linens, and a peaceful resort atmosphere.";

  const img = local?.img ?? FALLBACK_ROOM_IMG;

  return { ...room, name, day_rate: dayRate, overnight_rate: nightRate, rate_24hr: rate24hr, img, desc };
}

// Does this room actually offer a given booking type? Respects the
// backend's allowed_booking_types restriction AND requires a non-zero
// rate, so rooms aren't merchandised publicly for a type they can't be
// booked at. Mirrors the Rooms page helper.
function roomOffers(r, type) {
  const allowed = r?.allowed_booking_types;
  const unrestricted = !allowed || allowed.length === 0;
  const typeAllowed  = unrestricted || allowed.includes(type);
  if (!typeAllowed) return false;
  if (type === 'night') return Number(r?.overnight_rate) > 0;
  if (type === '24hr')  return Number(r?.rate_24hr)      > 0;
  return Number(r?.day_rate) > 0;
}

/* ------------------------------------------------------------------ */
/*  Scroll-triggered reveal animation                                 */
/* ------------------------------------------------------------------ */
// Callback-ref based reveal. Previously used useRef + useEffect(..., []),
// which read ref.current ONCE on mount. For sections whose JSX is
// conditional on async data (e.g. the reviews carousel, which is wrapped
// in {testimonialsDisplay.length > 0 && ...}), the DOM node doesn't
// exist on first mount — the effect read null and returned, and no
// IntersectionObserver ever attached. The section then stuck at the
// opacity:0 / translateY(32px) from .reveal-section forever, rendering
// as a blank blue band with invisible cards inside.
//
// setNode is invoked by React whenever the element mounts (even async),
// which re-runs the effect with a live node and attaches the observer.
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
/*  Wavy SVG divider                                                  */
/* ------------------------------------------------------------------ */
function WaveDivider({ flip = false, color = "#ffffff" }) {
  return (
    <div className={`w-full overflow-hidden leading-none ${flip ? "rotate-180" : ""}`} style={{ marginTop: "-1px" }}>
      <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className="w-full h-16 md:h-24">
        <path d="M0,40 C360,100 1080,0 1440,60 L1440,100 L0,100 Z" fill={color} />
      </svg>
    </div>
  );
}

// Audit-flagged previously: "Welcome to Paradise" / "perfect blend
// of luxury, comfort, and breathtaking ocean views" was the most
// AI-template hero copy on the site. Replaced with honest, fact-led
// language. Aplaya is a small beachfront resort in Naic, Cavite —
// not a luxury resort, no pool, no swim-up bar. Marketing copy
// shouldn't promise things the property doesn't have.
//
// Defaults must stay in sync with src/pages/owner/Content.jsx
// DEFAULT_CONTENT.resort_* keys (the website-builder pre-fill).
// CLAUDE.md hazard note: editing one without the other creates a
// "live site shows X, builder pre-fills Y" mismatch.
const DEFAULT_PC = {
  hero:       { background: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80", title: "Aplaya Beach Resort", subtitle: "Beachfront. Cottages, pavilions, rooms. Day, overnight, or 24-hour stays.", ctaText: "See rooms & rates" },
  about:      { title: "About the resort", paragraph1: "Aplaya is a family-run beachfront resort in Naic, Cavite — about two hours south of Manila. We rent cottages, pavilions, and rooms by the day, the night, or the full 24 hours.", paragraph2: "Parking is included with every booking. Per-head entrance fees are folded into the room rate at booking, so the total you see is the total you pay.", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=80", rating: "4.9" },
  rooms:      { sectionTitle: "Rooms, cottages, and pavilions", sectionSubtitle: "Pick what fits your group size and the kind of trip you're planning." },
  contact:    { address: "Purok 7 Sitio Pobres Brgy Munting Mapino, Naic, Philippines, 4110", phone: "+63 908 191 4721", email: "aplayabeachresortph@gmail.com", facebook: "", instagram: "", twitter: "", tiktok: "", map_url: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d287.5320944376759!2d120.7697092276209!3d14.33236877346086!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x339629b5c29479cb%3A0xfcf314e028c916ae!2sAplaya%20Beach%20Resort!5e1!3m2!1sen!2sus!4v1775705477033!5m2!1sen!2sus", osm_url: "https://www.openstreetmap.org/export/embed.html?bbox=120.7687%2C14.3313%2C120.7707%2C14.3334&layer=mapnik&marker=14.33237%2C120.76971" },
  reviews:    { visible: true,  sectionTitle: "What Our Guests Say", sectionSubtitle: "Don't just take our word for it - hear from our satisfied guests." },
  newsletter: { visible: true,  title: "Subscribe to Our Newsletter", subtitle: "Stay updated with our latest offers, news, and events. Join our mailing list today!" },
};

/* ------------------------------------------------------------------ */
/*  TestimonialCard                                                   */
/*                                                                    */
/*  Two variants:                                                     */
/*   - default: used in the 2–3 column grid and in the 4+ carousel.   */
/*   - hero:    used when only ONE review is featured, so a single    */
/*              card doesn't float lonely against a wide empty band.  */
/*              Wider, bigger type, brighter quote glyph.             */
/*                                                                    */
/*  Design notes:                                                     */
/*   - Decorative left-quote mark is positioned as a watermark so it  */
/*     reads as texture, not content (aria-hidden).                   */
/*   - Stars use Font Awesome solid to avoid the rendering-difference */
/*     you get with a text "★" glyph across OSes.                     */
/*   - Date shows in a muted footer line with a calendar icon so      */
/*     guests can gauge freshness without scanning noise.             */
/* ------------------------------------------------------------------ */
function TestimonialCard({ t, variant = "default" }) {
  const isHero = variant === "hero";
  const rating = Math.min(5, Math.max(1, Number(t?.rating || 5)));

  return (
    <figure
      className={[
        "relative overflow-hidden",
        "bg-slate-900/40 ring-1 ring-white/20",
        "rounded-2xl text-white",
        "transition duration-300 hover:ring-white/35 hover:bg-slate-900/50",
        isHero ? "w-full max-w-2xl p-8 md:p-10" : "h-full p-6",
      ].join(" ")}
    >
      {/* Decorative watermark quote — purely visual, hidden from AT */}
      <span
        aria-hidden="true"
        className={[
          "absolute font-serif leading-none select-none pointer-events-none text-white/10",
          isHero ? "-top-4 -left-2 text-[180px]" : "-top-3 -left-1 text-[120px]",
        ].join(" ")}
      >
        &ldquo;
      </span>

      {/* Rating — drawn with FA icons so stars render the same everywhere */}
      <div className="relative flex items-center gap-0.5 mb-4 text-amber-300" aria-label={`${rating} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <i key={i} className={`fas fa-star ${i < rating ? "" : "opacity-25"} ${isHero ? "text-lg" : "text-sm"}`} aria-hidden="true" />
        ))}
      </div>

      {/* Quote */}
      <blockquote className="relative">
        <p className={`leading-relaxed text-sky-50 ${isHero ? "text-xl md:text-2xl" : "text-base"}`}>
          {t?.quote || "\u00A0"}
        </p>
      </blockquote>

      {/* Footer — avatar · name · date */}
      <figcaption className="relative mt-6 pt-5 border-t border-white/15 flex items-center gap-3">
        <div className={`rounded-full overflow-hidden ring-2 ring-white/25 shrink-0 ${isHero ? "w-14 h-14" : "w-11 h-11"}`}>
          <img src={t?.img} alt={t?.name ?? "Guest"} className="w-full h-full object-cover" loading="lazy" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-white truncate ${isHero ? "text-base" : "text-sm"}`}>{t?.name ?? "Guest"}</p>
          {t?.date && (
            <p className={`text-sky-200/80 flex items-center gap-1.5 ${isHero ? "text-xs" : "text-[11px]"}`}>
              <i className="far fa-calendar text-[10px]" aria-hidden="true" />
              {t.date}
            </p>
          )}
        </div>
      </figcaption>
    </figure>
  );
}

export default function Resort() {
  const { user, login } = useAuth();
  const isLoggedIn = !!user;
  const siteContent = useContent();
  const [toast, showToast, clearToast, toastType, toastAction] = useToast();

  const location = useLocation();
  const navigate = useNavigate();

  const [bookingOpen, setBookingOpen] = useState(false);
  // One-Pending-at-a-time — fetched on login so Book Now can funnel
  // an authed user with an existing Pending into the resume flow.
  const [resumingBooking, setResumingBooking] = useState(null);
  const [userPendingBooking, setUserPendingBooking] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  // Opened immediately after a fresh (unverified) email signup. Google
  // signups skip this since the backend marks them verified.
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [pendingWelcomeName, setPendingWelcomeName] = useState("");
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

  // Gallery lightbox
  const [lightboxIdx, setLightboxIdx] = useState(null);

  // Contact form validation
  const [contactErrors, setContactErrors] = useState({});

  // Page content — derived synchronously so there is never a painted frame
  // showing hardcoded defaults when the ContentContext cache is already populated.

  // API-backed lists (fallback if API is down)
  const [roomsApi, setRoomsApi] = useState([]);
  const [amenitiesApi, setAmenitiesApi] = useState([]);
  const [galleryApi, setGalleryApi] = useState(null); // null = not yet loaded
  const [reviewsApi, setReviewsApi] = useState([]);

  // Announcements
  const [announcements, setAnnouncements] = useState(null); // null = loading
  const [announcementModal, setAnnouncementModal] = useState(null); // selected item

  const anyOverlayOpen =
    bookingOpen || loginOpen || signupOpen || guestWarningOpen || successOpen || contactAlert.open || lightboxIdx !== null;
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
        day_rate:              Number(r?.day_rate       ?? 0),
        overnight_rate:        Number(r?.overnight_rate ?? 0),
        rate_24hr:             Number(r?.rate_24hr      ?? 0),
        capacity_label:        r?.capacity_label ?? "",
        quantity:              Number(r?.quantity ?? 1),
        capacity:              Number(r?.capacity ?? 20),
        allowed_booking_types: r?.allowed_booking_types ?? null,
        // Pass through so BookingModal can render package bundle +
        // Optional add-on picker. Stripped previously meant the picker
        // was invisible even when the owner had configured add-ons.
        attached_addons:       r?.attached_addons ?? [],
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
      rating: Math.min(5, Math.max(1, Number(r.rating || 5))),
      quote: r.comment ?? "",
      // Backend returns r.created_at pre-formatted as "MMM d, yyyy"
      // so we just pass it through. Card renders with a small calendar
      // icon + date so guests can gauge review freshness.
      date:  r.created_at ?? "",
    }));
  }, [reviewsApi]);

  // Refetch pending booking state when user logs in / changes.
  useEffect(() => {
    if (!user) { setUserPendingBooking(null); return; }
    let active = true;
    getBookings()
      .then(list => {
        if (!active) return;
        const pending = list.find(b => b.status === 'Pending') ?? null;
        setUserPendingBooking(pending);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [user]);

  // Map a booking-list row → BookingModal's resumeBooking prop shape.
  function toResumeBooking(b) {
    if (!b) return null;
    const typeLabels = {
      day: 'Day Visit (6 AM – 6 PM)', night: 'Night Stay (6 PM – 7 AM)',
      '24hr': '24 Hours', '24hr-pm': '24 Hours',
    };
    return {
      bookingId:        b.bookingId,
      resId:            b.id,
      roomName:         b.roomType,
      bookingType:      b.bookingType,
      bookingTypeLabel: typeLabels[b.bookingType] ?? null,
      checkIn:          b.checkIn ? fmtDateTime(b.checkIn) : null,
      checkOut:         b.checkOut ? fmtDateTime(b.checkOut) : null,
      guests:           b.guests ?? 1,
      total:            Number(b.total ?? 0),
      reservationFee:   Number(b.reservationFee ?? 0),
      payFull:          false,
      guestToken:       null,
    };
  }

  function requestBooking(roomName = "") {
    if (!isLoggedIn) {
      setPendingBookingRoom(roomName || "");
      setGuestWarningOpen(true); // show choice: log in, sign up, or continue as guest
      return;
    }
    // One-Pending rule — authed users with an existing Pending get
    // the resume flow instead of a duplicate booking.
    if (userPendingBooking) {
      setResumingBooking(toResumeBooking(userPendingBooking));
      return;
    }
    setGuestMode(false);
    setSelectedRoom(roomName || "");
    setBookingOpen(true);
  }

  function handleLoginSuccess(u) {
    login(u);
    setLoginOpen(false);
    showToast(`Welcome back, ${u?.name || ""}!`, "success");

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

  const pc = useMemo(() => {
    const d = siteContent ?? {};
    return {
      hero:       { ...DEFAULT_PC.hero,       ...(d.page_resort_hero       ?? {}) },
      about:      { ...DEFAULT_PC.about,      ...(d.page_resort_about      ?? {}) },
      rooms:      { ...DEFAULT_PC.rooms,      ...(d.page_resort_rooms      ?? {}) },
      contact:    { ...DEFAULT_PC.contact,    ...(d.page_resort_contact    ?? {}) },
      reviews:    { ...DEFAULT_PC.reviews,    ...(d.page_resort_reviews    ?? {}) },
      newsletter: { ...DEFAULT_PC.newsletter, ...(d.page_resort_newsletter ?? {}) },
    };
  }, [siteContent]);

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
        // Silent fallback — page uses local data if API is unreachable
        if (!alive) return;
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

  // Load announcements
  useEffect(() => {
    getAnnouncements()
      .then((data) => setAnnouncements(Array.isArray(data) ? data : []))
      .catch(() => setAnnouncements([]));
  }, []);

  // #6 — Escape key to close announcement modal + lightbox
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        if (lightboxIdx !== null) setLightboxIdx(null);
        else if (announcementModal) setAnnouncementModal(null);
      }
      // Lightbox arrow navigation
      if (lightboxIdx !== null && galleryDisplay?.length) {
        if (e.key === "ArrowRight") setLightboxIdx((i) => (i + 1) % galleryDisplay.length);
        if (e.key === "ArrowLeft")  setLightboxIdx((i) => (i - 1 + galleryDisplay.length) % galleryDisplay.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, announcementModal, galleryDisplay]);

  // Testimonials auto-scroll carousel
  const scrollRef = useRef(null);
  const [carouselPaused, setCarouselPaused] = useState(false);
  useEffect(() => {
    if (carouselPaused || !scrollRef.current || testimonialsDisplay.length <= 3) return;
    const iv = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
      el.scrollBy({ left: atEnd ? -el.scrollWidth : 320, behavior: "smooth" });
    }, 4000);
    return () => clearInterval(iv);
  }, [carouselPaused, testimonialsDisplay.length]);

  // Scroll reveal refs
  const aboutRef     = useReveal();
  const roomsRef     = useReveal();
  const amenitiesRef = useReveal();
  const reviewsRef   = useReveal();
  const galleryRef   = useReveal();
  const contactRef   = useReveal();

  // #5 — Contact form validation
  const validateContact = useCallback(() => {
    const errs = {};
    if (!contactForm.name.trim())    errs.name    = "Name is required.";
    if (!contactForm.email.trim())   errs.email   = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactForm.email)) errs.email = "Enter a valid email.";
    if (!contactForm.subject.trim()) errs.subject = "Subject is required.";
    if (!contactForm.message.trim()) errs.message = "Message is required.";
    setContactErrors(errs);
    return Object.keys(errs).length === 0;
  }, [contactForm]);

  async function submitContact(e) {
    e.preventDefault();
    if (!validateContact()) return;
    setContactSubmitting(true);
    try {
      await api.post("/api/contact", contactForm);
      showToast("Message sent! We'll get back to you within 24 hours.", "success");
      setContactForm({ name: "", email: "", subject: "", message: "" });
      setContactErrors({});
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Failed to send message. Please try again.";
      showToast(msg, "error");
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
      showToast(res.data.message || "Subscribed successfully!", "success");
      setNewsletter({ email: "", msg: "", type: "", submitting: false });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Something went wrong. Please try again.";
      showToast(msg, "error");
      setNewsletter((p) => ({ ...p, msg: "", type: "", submitting: false }));
    }
  }

  return (
    <div className="font-sans">
      <Helmet>
        <title>Aplaya Beach Resort Cavite — Rooms, Amenities & Reviews</title>
        <meta name="description" content="Explore rooms, amenities, gallery, and guest reviews at Aplaya Beach Resort in Cavite, Philippines." />
        {!isVideoUrl(pc.hero.background) && (
          <link rel="preload" as="image" href={pc.hero.background} />
        )}
      </Helmet>
      <Toast message={toast} type={toastType} onClose={clearToast} action={toastAction} />
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
            <h1 className="text-4xl md:text-6xl font-bold mb-6 animate-hero-fade-in [animation-delay:0.2s] opacity-0">{pc.hero.title}</h1>
            <p className="text-xl md:text-2xl mb-8 animate-hero-fade-in [animation-delay:0.6s] opacity-0">{pc.hero.subtitle}</p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 animate-hero-fade-in [animation-delay:1s] opacity-0">
              <button
                onClick={() => requestBooking("")}
                className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-xl text-lg font-medium transition shadow-lg hover:shadow-xl"
              >
                {pc.hero.ctaText}
              </button>

              {isLoggedIn ? (
                <Link
                  to="/dashboard"
                  className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-md text-lg font-medium transition"
                >
                  My Dashboard →
                </Link>
              ) : (
                <button
                  onClick={() => setLoginOpen(true)}
                  className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-md text-lg font-medium transition"
                >
                  Login
                </button>
              )}
            </div>

            {isLoggedIn ? (
              <p className="mt-4 text-sm text-white/80 animate-hero-fade-in [animation-delay:1.3s] opacity-0">
                Welcome back, <span className="font-semibold">{user?.name || user?.email || "Guest"}</span>!
              </p>
            ) : null}
          </div>

          {/* Scroll-down cue — section is now always rendered below, so
              the scroll target is unconditional. */}
          <button
            onClick={() => document.getElementById("announcements")?.scrollIntoView({ behavior: "smooth" })}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-white/70 hover:text-white transition animate-pulse"
            aria-label="Scroll down"
          >
            <i className="fas fa-chevron-down text-2xl" aria-hidden="true" />
          </button>
        </section>

        {/* Wave divider — matches the announcements section background */}
        <WaveDivider color="#f0f9ff" />

        {/* WHAT'S NEW — Announcements preview
             Always rendered now (previously hidden when empty, which made
             the page jump around depending on CMS content). Three states:
               - null:         loading skeleton (3 placeholder cards)
               - []:           empty state card ("No announcements yet")
               - [items...]:   real cards + "See All" link
             The section header + bg + wave transition stay consistent so
             the page feels the same whether or not there are posts. */}
        <section id="announcements" className="py-16 bg-sky-50 relative overflow-hidden">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-10">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-1">
                  📢 What's New
                </h2>
                <div className="w-12 h-1.5 rounded-full bg-sky-400 mb-2" />
                <p className="text-slate-500 text-sm">Latest updates, events & promos</p>
              </div>
              {/* See-all link only makes sense when there's something to browse */}
              {announcements?.length > 0 && (
                <Link
                  to="/announcements"
                  className="text-sm font-semibold text-sky-600 hover:text-sky-800 whitespace-nowrap transition"
                >
                  See All Announcements →
                </Link>
              )}
            </div>

            {/* ── LOADING STATE ── */}
            {announcements === null && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-busy="true" aria-label="Loading announcements">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-md animate-pulse">
                    <div className="h-40 bg-slate-200" />
                    <div className="p-5 space-y-3">
                      <div className="h-3 w-20 bg-slate-200 rounded-full" />
                      <div className="h-4 w-3/4 bg-slate-200 rounded" />
                      <div className="h-3 w-full bg-slate-200 rounded" />
                      <div className="h-3 w-2/3 bg-slate-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── EMPTY STATE ──
                Friendly, on-brand placeholder so the section doesn't feel
                broken when the CMS has no active posts. Pairs a soft
                illustration (large megaphone in a gradient ring) with a
                clear message and a subtle call to subscribe — turns dead
                air into a signup opportunity. */}
            {announcements !== null && announcements.length === 0 && (
              <div className="relative mx-auto max-w-2xl">
                {/* Decorative background circles — sit behind the card */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-96 h-96 rounded-full bg-sky-200/40 blur-3xl" />
                </div>

                <div className="relative bg-white rounded-3xl shadow-md border border-slate-100 px-8 py-12 md:px-12 md:py-14 text-center">
                  {/* Icon — solid ring + glyph */}
                  <div className="mx-auto w-20 h-20 rounded-full bg-sky-100 flex items-center justify-center mb-5 ring-8 ring-sky-50">
                    <i className="fas fa-bullhorn text-sky-500 text-2xl" aria-hidden="true"></i>
                  </div>

                  <h3 className="text-xl font-bold text-slate-800 mb-2">All caught up</h3>
                  <p className="text-slate-500 text-sm leading-relaxed max-w-md mx-auto">
                    No announcements right now. Promos, events, and new features show up here first —
                    check back soon, or subscribe below to get them in your inbox.
                  </p>

                  {/* Decorative dotted divider */}
                  <div className="my-6 mx-auto w-24 border-t border-dashed border-slate-200" aria-hidden="true" />

                  <a
                    href="#newsletter"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById("newsletter")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:text-sky-800 transition"
                  >
                    <i className="fas fa-envelope text-xs" aria-hidden="true"></i>
                    Subscribe for updates
                  </a>
                </div>
              </div>
            )}

            {/* ── POPULATED STATE ── */}
            {announcements !== null && announcements.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {announcements.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-md hover:-translate-y-1 transition-transform duration-300 flex flex-col"
                  >
                    {item.media_url && (
                      <div className="bg-slate-900 flex items-center justify-center rounded-t-2xl overflow-hidden min-h-52">
                        {isVideoUrl(item.media_url) ? (
                          <video src={item.media_url} controls playsInline className="w-full object-contain" />
                        ) : (
                          <img src={item.media_url} alt={item.title} className="w-full object-contain max-h-[420px]" loading="lazy" />
                        )}
                      </div>
                    )}
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {item.is_pinned && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">📌 Pinned</span>
                        )}
                        {item.published_at && (
                          <span className="text-xs text-slate-400">
                            {new Date(item.published_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-900 text-base leading-snug mb-2">{item.title}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 flex-1">{item.body}</p>
                      <button
                        onClick={() => setAnnouncementModal(item)}
                        className="mt-4 self-start text-sm font-semibold text-sky-600 hover:text-sky-800 transition"
                      >
                        Read More →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Announcement detail modal */}
        <Modal open={!!announcementModal} onClose={() => setAnnouncementModal(null)} maxWidth="max-w-xl">
          {announcementModal && (
            <>
              {announcementModal.media_url && (
                <div className="rounded-t-xl overflow-hidden bg-slate-900 flex items-center justify-center">
                  {isVideoUrl(announcementModal.media_url) ? (
                    <video
                      src={announcementModal.media_url}
                      controls
                      autoPlay
                      className="w-full object-contain"
                    />
                  ) : (
                    <img
                      src={announcementModal.media_url}
                      alt={announcementModal.title}
                      loading="lazy"
                      className="w-full object-contain"
                    />
                  )}
                </div>
              )}
              <div className="p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {announcementModal.is_pinned && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                          📌 Pinned
                        </span>
                      )}
                      {announcementModal.published_at && (
                        <span className="text-xs text-slate-400">
                          {new Date(announcementModal.published_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">{announcementModal.title}</h2>
                  </div>
                  <button
                    onClick={() => setAnnouncementModal(null)}
                    className="text-slate-400 hover:text-slate-700 transition flex-shrink-0"
                    aria-label="Close"
                  >
                    <i className="fas fa-times text-xl" aria-hidden="true" />
                  </button>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{announcementModal.body}</p>
                <div className="mt-5 text-right">
                  <Link
                    to="/announcements"
                    className="text-sm font-semibold text-sky-600 hover:text-sky-800 transition"
                  >
                    View all announcements →
                  </Link>
                </div>
              </div>
            </>
          )}
        </Modal>

        {/* ABOUT */}
        <section id="about" className="py-24 bg-white relative overflow-hidden">
          <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
               style={{ background: "radial-gradient(circle, #38bdf8, transparent 70%)" }} />
          <div className="pointer-events-none absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10"
               style={{ background: "radial-gradient(circle, #fbbf24, transparent 70%)" }} />
          <div ref={aboutRef} className="reveal-section relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:flex lg:items-center lg:justify-between gap-16">
              <div className="lg:w-1/2 mb-10 lg:mb-0">
                <h2 className="text-4xl font-bold text-slate-900 mb-3 leading-tight">{pc.about.title}</h2>
                <div className="w-12 h-1.5 rounded-full bg-sky-400 mb-6" />
                <p className="text-slate-600 mb-4 leading-relaxed">{pc.about.paragraph1}</p>
                <p className="text-slate-600 mb-8 leading-relaxed">{pc.about.paragraph2}</p>

                {amenityCards.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {amenityCards.slice(0, 4).map((a) => (
                      <span key={a.title} className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 text-sm px-3 py-1.5 rounded-full">
                        {a.icon} {a.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:w-1/2 relative">
                <div className="absolute -inset-4 bg-sky-100 rounded-3xl rotate-2 opacity-40" />
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
          <div ref={roomsRef} className="reveal-section max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="inline-flex h-12 w-12 rounded-full bg-sky-100 text-sky-600 items-center justify-center mb-3" aria-hidden="true">
                <i className="fas fa-bed text-xl" aria-hidden="true"></i>
              </span>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">{pc.rooms.sectionTitle}</h2>
              <div className="w-16 h-1.5 rounded-full bg-sky-400 mx-auto mb-4" />
              <p className="text-lg text-slate-500 max-w-2xl mx-auto">{pc.rooms.sectionSubtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {roomCards.slice(0, 3).map((r) => (
                <div
                  key={r.id ?? r.name}
                  className="group relative bg-white rounded-2xl overflow-hidden shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ring-1 ring-slate-200 hover:ring-sky-400/50"
                >
                  <div className="relative overflow-hidden">
                    <img src={r.img} alt={r.name} className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute top-3 left-3 flex gap-2">
                      {roomOffers(r, 'day') && (
                        <span className="bg-white/90 text-sky-700 text-xs font-bold px-3 py-1 rounded-full shadow">
                          Day Use
                        </span>
                      )}
                      {roomOffers(r, 'night') && (
                        <span className="bg-indigo-600/90 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                          Overnight
                        </span>
                      )}
                      {roomOffers(r, '24hr') && (
                        <span className="bg-amber-500/90 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                          24 Hours
                        </span>
                      )}
                    </div>
                    {r.capacity > 0 && (
                      <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                        <i className="fas fa-users text-[10px]" aria-hidden="true"></i> Up to {r.capacity} guests
                      </span>
                    )}
                  </div>

                  <div className="p-5">
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{r.name}</h3>
                    <p className="text-slate-500 text-sm mb-4 line-clamp-2">{r.desc}</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {roomOffers(r, 'day') && (
                        <div className="flex-1 min-w-[80px] bg-sky-50 rounded-xl px-3 py-2 text-center border border-sky-100">
                          <p className="text-[10px] text-sky-600 font-semibold uppercase tracking-wide">Day</p>
                          <p className="text-sm font-bold text-sky-700">{formatPHP(r.day_rate)}</p>
                        </div>
                      )}
                      {roomOffers(r, 'night') && (
                        <div className="flex-1 min-w-[80px] bg-indigo-50 rounded-xl px-3 py-2 text-center border border-indigo-100">
                          <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wide">Night</p>
                          <p className="text-sm font-bold text-indigo-700">{formatPHP(r.overnight_rate)}</p>
                        </div>
                      )}
                      {roomOffers(r, '24hr') && (
                        <div className="flex-1 min-w-[80px] bg-amber-50 rounded-xl px-3 py-2 text-center border border-amber-100">
                          <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">24 Hrs</p>
                          <p className="text-sm font-bold text-amber-700">{formatPHP(r.rate_24hr)}</p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => requestBooking(r.name)}
                      className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow hover:shadow-md transition-all"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link
                to="/rooms"
                className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all"
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

          <div ref={amenitiesRef} className="reveal-section relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="inline-flex h-12 w-12 rounded-full bg-sky-100 text-sky-600 items-center justify-center mb-3" aria-hidden="true">
                <i className="fas fa-umbrella-beach text-xl" aria-hidden="true"></i>
              </span>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Resort Amenities</h2>
              <div className="w-16 h-1.5 rounded-full bg-sky-400 mx-auto mb-4" />
              <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                Everything you need for a perfect vacation experience.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              {amenityCards.map((a, i) => {
                // Collapsed the former rainbow 2-stop gradients into
                // solid accents. Variety stays (6 colors still) but
                // each card reads as an intentional category rather
                // than an AI-picked palette sampler.
                const accents = [
                  "bg-sky-500",
                  "bg-amber-500",
                  "bg-emerald-500",
                  "bg-violet-500",
                  "bg-rose-500",
                  "bg-indigo-500",
                ];
                const accent = accents[i % accents.length];
                return (
                  <div
                    key={a.title}
                    className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col items-center text-center overflow-hidden"
                    style={{ width: "200px", minHeight: "180px" }}
                  >
                    <div className={`w-full h-2 ${accent}`} />
                    <div className="flex flex-col items-center px-5 py-6 flex-1">
                      <div className={`w-16 h-16 rounded-2xl ${accent} flex items-center justify-center mb-4 shadow-md text-3xl group-hover:scale-110 transition-transform duration-300`}>
                        {a.icon}
                      </div>
                      <h3 className="text-base font-bold text-slate-800 leading-tight mb-1">{a.title}</h3>
                      {a.desc && <p className="text-xs text-slate-500 leading-snug">{a.desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        )}

        {/* TESTIMONIALS
             Layout adapts to the review count so a single featured review
             doesn't float awkwardly against a sea of empty space:
               1 review  → one centered hero-card (max-w-2xl)
               2 reviews → side-by-side grid (max-w-5xl)
               3+        → 3-col grid; carousel + nav arrows when > 3
             Stats strip above the heading shows actual average rating
             and review count — real signal, not fake social proof. */}
        {pc.reviews.visible !== false && testimonialsDisplay.length > 0 && (() => {
          // Compute average rating + count from the reviews the public
          // endpoint returned (already filtered to featured 4+ star rows).
          const count  = testimonialsDisplay.length;
          const avg    = count > 0
            ? testimonialsDisplay.reduce((s, t) => s + (Number(t.rating) || 0), 0) / count
            : 0;
          const avgStr = avg.toFixed(1);

          return (
        <section className="relative py-24 overflow-hidden">
          {/* Layered background — sky-600 base + soft radial highlights
              for depth. Simple, not AI-slop. */}
          <div className="absolute inset-0 bg-sky-600" />
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 15% 0%, rgba(186,230,253,0.35) 0%, transparent 50%), radial-gradient(ellipse at 85% 100%, rgba(12,74,110,0.45) 0%, transparent 55%)",
            }}
          />
          {/* Top wave — softens the transition from the section above */}
          <svg
            aria-hidden="true"
            className="absolute top-0 left-0 w-full h-10 md:h-16 text-white/70"
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
          >
            <path fill="currentColor" d="M0 0L1440 0L1440 34C1200 64 960 80 720 64C480 48 240 12 0 34L0 0Z" />
          </svg>

          <div ref={reviewsRef} className="reveal-section relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 md:pt-12 text-white">
            <div className="text-center mb-14">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200/80">
                <span className="h-px w-8 bg-sky-200/40" />
                Guest voices
                <span className="h-px w-8 bg-sky-200/40" />
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mt-3">{pc.reviews.sectionTitle}</h2>
              <p className="text-lg text-sky-100 max-w-2xl mx-auto mt-3">{pc.reviews.sectionSubtitle}</p>

              {/* Rating stats — average across the featured reviews on
                  the page. Shows the same glyphs the cards use, so the
                  top-of-section summary and the per-card ratings feel
                  like one system. */}
              <div className="inline-flex items-center gap-5 mt-7 px-6 py-3 rounded-full bg-slate-900/40 ring-1 ring-white/20">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold leading-none">{avgStr}</span>
                  <div className="flex items-center gap-0.5 text-amber-300" aria-label={`${avgStr} out of 5`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <i
                        key={i}
                        className={`fas fa-star text-xs ${i < Math.round(avg) ? "" : "opacity-25"}`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </div>
                <span className="h-6 w-px bg-white/20" aria-hidden="true" />
                <span className="text-sm text-sky-100">
                  {count} featured {count === 1 ? "review" : "reviews"}
                </span>
              </div>
            </div>

            {testimonialsDisplay.length === 1 ? (
              // ── Single review — center as a hero card ─────────────────
              <div className="flex justify-center">
                <TestimonialCard t={testimonialsDisplay[0]} variant="hero" />
              </div>
            ) : testimonialsDisplay.length <= 3 ? (
              // ── 2–3 reviews — centered grid, no carousel needed ───────
              <div
                className={`grid gap-6 mx-auto ${
                  testimonialsDisplay.length === 2
                    ? "max-w-4xl md:grid-cols-2"
                    : "max-w-6xl md:grid-cols-3"
                }`}
              >
                {testimonialsDisplay.map((t, i) => (
                  <TestimonialCard key={`${t.name}-${i}`} t={t} />
                ))}
              </div>
            ) : (
              // ── 4+ reviews — scroll carousel with nav arrows ──────────
              <div className="relative">
                <button
                  onClick={() => scrollRef.current?.scrollBy({ left: -340, behavior: "smooth" })}
                  className="absolute -left-2 md:-left-6 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-slate-900/50 hover:bg-slate-900/70 ring-1 ring-white/20 flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-white/50"
                  aria-label="Previous review"
                >
                  <i className="fas fa-chevron-left text-sm" aria-hidden="true"></i>
                </button>
                <button
                  onClick={() => scrollRef.current?.scrollBy({ left: 340, behavior: "smooth" })}
                  className="absolute -right-2 md:-right-6 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-slate-900/50 hover:bg-slate-900/70 ring-1 ring-white/20 flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-white/50"
                  aria-label="Next review"
                >
                  <i className="fas fa-chevron-right text-sm" aria-hidden="true"></i>
                </button>
                <div
                  ref={scrollRef}
                  onMouseEnter={() => setCarouselPaused(true)}
                  onMouseLeave={() => setCarouselPaused(false)}
                  className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 scrollbar-hide"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {testimonialsDisplay.map((t, i) => (
                    <div key={`${t.name}-${i}`} className="flex-shrink-0 snap-start w-[300px] md:w-[calc(33.333%-16px)]">
                      <TestimonialCard t={t} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom wave — mirrors the top, transitions into the
              Gallery section's dark slate-900 band below cleanly. */}
          <svg
            aria-hidden="true"
            className="absolute bottom-0 left-0 w-full h-10 md:h-16 text-slate-900"
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
          >
            <path fill="currentColor" d="M0 80L1440 80L1440 46C1200 16 960 0 720 16C480 32 240 68 0 46L0 80Z" />
          </svg>
        </section>
          );
        })()}

        {/* GALLERY */}
        <section id="gallery" className="py-24 bg-slate-900">
          <div ref={galleryRef} className="reveal-section max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="text-4xl mb-3 block">📸</span>
              <h2 className="text-3xl font-bold text-white mb-2">Gallery</h2>
              <div className="w-16 h-1.5 rounded-full bg-sky-400 mx-auto mb-4" />
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">Take a visual journey through our beautiful resort.</p>
            </div>

            {galleryDisplay === null ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden bg-slate-700 animate-pulse h-64" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {galleryDisplay.map((g, i) => (
                  <div
                    key={`${g.alt}-${i}`}
                    role="button" tabIndex={0}
                    className="group relative rounded-2xl overflow-hidden shadow-lg cursor-pointer"
                    onClick={() => setLightboxIdx(i)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightboxIdx(i); }}}
                  >
                    <img
                      src={g.src}
                      alt={g.alt}
                      className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                      <div className="flex items-center justify-between w-full">
                        {g.caption && <p className="text-white text-sm font-medium">{g.caption}</p>}
                        <i className="fas fa-expand text-white/70 text-sm" aria-hidden="true"></i>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-center mt-12">
              <Link
                to="/gallery"
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                View More Photos →
              </Link>
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" className="py-16 bg-slate-50">
          <div ref={contactRef} className="reveal-section max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Compact header — tight spacing, no decorative emoji */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-1.5">Get in touch</h2>
              <p className="text-sm text-slate-500">Questions or help planning your stay? We'd love to hear from you.</p>
            </div>

            {/* Two columns: stacked on mobile, side-by-side on desktop.
                Gap tightened from 10 → 6 so the block reads as one thing. */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* Left column — compact info card. Three rows stacked
                  inside a single card instead of three separate cards,
                  halving the vertical footprint. */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 divide-y divide-slate-100">
                  {[
                    { icon: "fa-map-marker-alt", label: "Address", value: pc.contact.address },
                    { icon: "fa-phone",          label: "Phone",   value: pc.contact.phone   },
                    { icon: "fa-envelope",       label: "Email",   value: pc.contact.email   },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
                        <i className={`fas ${icon} text-xs`} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider">{label}</p>
                        <p className="text-sm text-slate-700 break-words">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Follow Us — compact icon row. No header, inline
                    muted caption to the left. */}
                {(pc.contact.facebook || pc.contact.instagram || pc.contact.twitter || pc.contact.tiktok) && (
                  <div className="flex items-center gap-3 text-slate-500 text-sm">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Follow</span>
                    <div className="flex items-center gap-3 text-lg">
                      {pc.contact.facebook  && <a href={pc.contact.facebook}  target="_blank" rel="noopener noreferrer" className="hover:text-sky-600 transition"  aria-label="Facebook"><i className="fab fa-facebook" aria-hidden="true"></i></a>}
                      {pc.contact.instagram && <a href={pc.contact.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-pink-500 transition" aria-label="Instagram"><i className="fab fa-instagram" aria-hidden="true"></i></a>}
                      {pc.contact.twitter   && <a href={pc.contact.twitter}   target="_blank" rel="noopener noreferrer" className="hover:text-sky-500 transition"  aria-label="Twitter"><i className="fab fa-twitter" aria-hidden="true"></i></a>}
                      {pc.contact.tiktok    && <a href={pc.contact.tiktok}    target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 transition" aria-label="TikTok"><i className="fab fa-tiktok" aria-hidden="true"></i></a>}
                    </div>
                  </div>
                )}
              </div>

              {/* Right column — compact contact form. Dropped p-8
                  accent border; uses lighter shadow + tighter vertical
                  rhythm (mb-3 not mb-4) to pull the form taller by less
                  without losing the field hierarchy. */}
              <form onSubmit={submitContact} className="lg:col-span-3 bg-white p-5 rounded-xl shadow-sm border border-slate-100" noValidate>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label htmlFor="contact-name" className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                    <input
                      id="contact-name"
                      type="text"
                      value={contactForm.name}
                      onChange={(e) => { setContactForm((p) => ({ ...p, name: e.target.value })); setContactErrors((p) => ({ ...p, name: undefined })); }}
                      className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 ${contactErrors.name ? "border-rose-400" : "border-slate-300"}`}
                      placeholder="Your name"
                      autoComplete="name"
                    />
                    {contactErrors.name && <p className="text-rose-500 text-xs mt-1">{contactErrors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                    <input
                      id="contact-email"
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => { setContactForm((p) => ({ ...p, email: e.target.value })); setContactErrors((p) => ({ ...p, email: undefined })); }}
                      className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 ${contactErrors.email ? "border-rose-400" : "border-slate-300"}`}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                    {contactErrors.email && <p className="text-rose-500 text-xs mt-1">{contactErrors.email}</p>}
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="contact-subject" className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                  <input
                    id="contact-subject"
                    type="text"
                    value={contactForm.subject}
                    onChange={(e) => { setContactForm((p) => ({ ...p, subject: e.target.value })); setContactErrors((p) => ({ ...p, subject: undefined })); }}
                    className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 ${contactErrors.subject ? "border-rose-400" : "border-slate-300"}`}
                    placeholder="What's this about?"
                  />
                  {contactErrors.subject && <p className="text-rose-500 text-xs mt-1">{contactErrors.subject}</p>}
                </div>

                <div className="mb-3">
                  <label htmlFor="contact-message" className="block text-xs font-medium text-slate-700 mb-1">Message</label>
                  <textarea
                    id="contact-message"
                    rows={3}
                    value={contactForm.message}
                    onChange={(e) => { setContactForm((p) => ({ ...p, message: e.target.value })); setContactErrors((p) => ({ ...p, message: undefined })); }}
                    className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 ${contactErrors.message ? "border-rose-400" : "border-slate-300"}`}
                    placeholder="Tell us how we can help…"
                  />
                  {contactErrors.message && <p className="text-rose-500 text-xs mt-1">{contactErrors.message}</p>}
                </div>

                <button
                  disabled={contactSubmitting}
                  className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 px-4 rounded-md transition"
                >
                  {contactSubmitting ? <><i className="fas fa-spinner fa-spin mr-2" aria-hidden="true"></i>Sending...</> : <><i className="fas fa-paper-plane mr-2" aria-hidden="true"></i>Send message</>}
                </button>
              </form>
            </div>

            {/* Map — height reduced from 380 → 240px. Keeps directions
                value without dominating the scroll. */}
            {(pc.contact.map_url || pc.contact.osm_url) && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <i className="fas fa-map-marker-alt text-sky-600 text-xs" aria-hidden="true" />
                    Find us
                  </h3>
                  {(pc.contact.directions_url || pc.contact.map_url) && (
                    <a
                      href={pc.contact.directions_url || "https://maps.app.goo.gl/cCa9LepoeaXXh6xm6"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 font-medium"
                    >
                      <i className="fas fa-directions" aria-hidden="true" />
                      Get directions
                    </a>
                  )}
                </div>
                <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 w-full" style={{ height: '240px' }}>
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
                <p className="mt-1 text-[10px] text-slate-400 text-right">
                  Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">OpenStreetMap</a> contributors
                </p>
              </div>
            )}

            {/* Inline newsletter strip — used to be its own py-16 section
                with a full-width sky-600 background. Merged here as a
                slim card so it's still functional without adding another
                scroll-length of dedicated real estate. Hidden when the
                owner turns off pc.newsletter.visible in the CMS. */}
            {pc.newsletter.visible !== false && (
              <div id="newsletter" className="mt-8 bg-white rounded-xl shadow-sm border border-slate-100 px-5 py-4">
                <form onSubmit={submitNewsletter} className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-bell text-sm" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{pc.newsletter.title || 'Stay in the loop'}</p>
                      <p className="text-xs text-slate-500">Occasional updates on offers &amp; events. Unsubscribe anytime.</p>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:flex-shrink-0">
                    <input
                      type="email"
                      aria-label="Email address for newsletter"
                      value={newsletter.email}
                      onChange={(e) => setNewsletter((p) => ({ ...p, email: e.target.value, msg: "" }))}
                      placeholder="your@email.com"
                      disabled={newsletter.submitting}
                      autoComplete="email"
                      className="flex-1 sm:w-56 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50"
                    />
                    <button
                      type="submit"
                      disabled={newsletter.submitting}
                      className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-md transition"
                    >
                      {newsletter.submitting
                        ? <><i className="fas fa-spinner fa-spin mr-1" aria-hidden="true"></i>Subscribing…</>
                        : 'Subscribe'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </section>

        {/* Newsletter section was here; merged into the Contact section
            above as an inline strip. The #newsletter anchor still works
            since the inline card inherits the id. */}
      </div>

      {/* Modals */}
      <LoginModal
        open={loginOpen}
        onClose={() => {
          setLoginOpen(false);
          setPendingBookingRoom(null);
        }}
        onLoginSuccess={handleLoginSuccess}
        onOpenSignup={() => { setLoginOpen(false); setSignupOpen(true); }}
      />

      <SignupModal
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
        onSignedUp={(u) => {
          login(u);
          setSignupOpen(false);
          // Verified signups (Google) go straight to a welcome toast.
          // Unverified (email+password) open the OTP modal right away;
          // the toast fires when they close it.
          if (u?.email_verified_at) {
            showToast(`Welcome, ${u?.name || ""}!`, "success");
          } else {
            setPendingWelcomeName(u?.name || "");
            setVerifyOpen(true);
          }
        }}
        onOpenLogin={() => { setSignupOpen(false); setLoginOpen(true); }}
      />

      <VerifyEmailModal
        open={verifyOpen}
        onClose={() => {
          setVerifyOpen(false);
          if (pendingWelcomeName) {
            showToast(`Welcome, ${pendingWelcomeName}!`, "success");
            setPendingWelcomeName("");
          }
        }}
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
      {/* Resume-payment mount — fires when an authed user with an
          existing Pending hits any Book Now button on this page. */}
      <BookingModal
        open={!!resumingBooking}
        onClose={() => setResumingBooking(null)}
        rooms={[]}
        resumeBooking={resumingBooking}
        onBooked={() => {
          setResumingBooking(null);
          if (user) {
            getBookings()
              .then(list => setUserPendingBooking(list.find(b => b.status === 'Pending') ?? null))
              .catch(() => {});
          }
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

      {/* Gallery Lightbox */}
      {lightboxIdx !== null && galleryDisplay?.[lightboxIdx] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setLightboxIdx(null); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLightboxIdx(null);
            if (e.key === 'ArrowLeft' && galleryDisplay.length > 1) setLightboxIdx((i) => (i - 1 + galleryDisplay.length) % galleryDisplay.length);
            if (e.key === 'ArrowRight' && galleryDisplay.length > 1) setLightboxIdx((i) => (i + 1) % galleryDisplay.length);
          }}
        >
          <button
            onClick={() => setLightboxIdx(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition z-10"
            aria-label="Close lightbox"
          >
            <i className="fas fa-times text-2xl" aria-hidden="true"></i>
          </button>

          {galleryDisplay.length > 1 && (
            <>
              <button
                onClick={() => setLightboxIdx((i) => (i - 1 + galleryDisplay.length) % galleryDisplay.length)}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                aria-label="Previous image"
              >
                <i className="fas fa-chevron-left" aria-hidden="true"></i>
              </button>
              <button
                onClick={() => setLightboxIdx((i) => (i + 1) % galleryDisplay.length)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                aria-label="Next image"
              >
                <i className="fas fa-chevron-right" aria-hidden="true"></i>
              </button>
            </>
          )}

          <div className="max-w-4xl w-full text-center">
            <img
              src={galleryDisplay[lightboxIdx].src}
              alt={galleryDisplay[lightboxIdx].alt}
              className="max-h-[80vh] w-auto mx-auto rounded-lg shadow-2xl object-contain"
              loading="eager"
              decoding="async"
            />
            {galleryDisplay[lightboxIdx].caption && (
              <p className="text-white/80 text-sm mt-4">{galleryDisplay[lightboxIdx].caption}</p>
            )}
            <p className="text-white/40 text-xs mt-2">
              {lightboxIdx + 1} / {galleryDisplay.length} — Use arrow keys or click to navigate
            </p>
          </div>
        </div>
      )}

    </div>
  );
}