import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useContent } from "../context/ContentContext.jsx";
import { getResortRooms } from "../lib/resortApi.js";
import { getBookings } from "../lib/bookingApi.js";
import { fmtDateTime } from "../lib/format.js";
import { RESORT_ID } from "../lib/config.js";
import { rooms as roomsFallback } from "../data/rooms.js";
import BookingModal from "../components/modals/BookingModal.jsx";
import LoginModal from "../components/modals/LoginModal.jsx";
import GuestWarningModal from "../components/modals/GuestWarningModal.jsx";
import SuccessModal from "../components/modals/SuccessModal.jsx";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";
import Toast, { useToast } from "../components/ui/Toast.jsx";
import { Helmet } from "react-helmet-async";

const ROOMS_HERO_DEFAULTS = {
  background: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80",
  title:    "Our Luxurious Accommodations",
  subtitle: "Discover the perfect room for your stay at Aplaya Beach Resort.",
};

const FALLBACK_IMG = "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80";

function formatPHP(n) {
  const v = Number(n || 0);
  return isNaN(v) ? "₱0" : `₱${v.toLocaleString()}`;
}

function enrichRoom(room) {
  const local = roomsFallback.find(r => r.name === room.name);
  const features = (room.features || []).map(f =>
    typeof f === "string" ? { text: f, icon: "fa-check" } : f
  );
  return {
    ...room,
    img: room.image || local?.img || FALLBACK_IMG,
    features,
  };
}

// Sum the per-room prices × qty of all package-attached add-ons on a
// room. These are bundled into the guest-facing rate — Blue Pavilion
// videoke, for example. Optional-relation entries don't contribute to
// the bundle (guest pays only if they opt in). Returns 0 when the room
// has no attachments (resort-wide or legacy rooms).
function packageTotalFor(room) {
  if (!Array.isArray(room?.attached_addons)) return 0;
  return room.attached_addons
    .filter(a => a.relation === 'package')
    .reduce((sum, a) => sum + (Number(a.price) || 0) * (Number(a.qty) || 1), 0);
}

// List of package add-ons as "Name" strings for "Includes X, Y" chip.
function packageNamesFor(room) {
  if (!Array.isArray(room?.attached_addons)) return [];
  return room.attached_addons.filter(a => a.relation === 'package').map(a => a.name);
}

// Unsplash URLs accept ?w= to return a pre-sized image. Generate a small
// srcSet so mobile doesn't pay the desktop bandwidth cost. For non-Unsplash
// sources (user-uploaded Cloudinary etc.) we skip srcSet and let the
// original URL serve — downside is no responsive sizing but at least no
// broken cache busts.
function unsplashSrcSet(url) {
  if (!url || !url.includes('images.unsplash.com')) return undefined;
  const base = url.split('?')[0];
  return `${base}?auto=format&fit=crop&w=400&q=75 400w, ${base}?auto=format&fit=crop&w=800&q=80 800w, ${base}?auto=format&fit=crop&w=1600&q=80 1600w`;
}

// Respect prefers-reduced-motion before triggering scroll animations —
// vestibular-disorder users find programmatic smooth scroll disorienting.
function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const CATEGORY_TABS = [
  { key: "all",      label: "All",       icon: "fa-th-large"       },
  { key: "room",     label: "Rooms",     icon: "fa-bed"            },
  { key: "cottage",  label: "Cottages",  icon: "fa-umbrella-beach" },
  { key: "pavilion", label: "Pavilions", icon: "fa-archway"        },
];

function getRoomCategory(r) {
  if (r.category) return r.category;
  const n = (r.name || "").toLowerCase();
  if (n.includes("cottage"))  return "cottage";
  if (n.includes("pavilion")) return "pavilion";
  return "room";
}

// Which booking types (day / night / 24hr) this room actually offers.
// A room can be restricted via `allowed_booking_types`:
//   null / undefined / empty → all types allowed (unrestricted)
//   array of strings         → only those types allowed
// We AND this with "rate exists" so a room with overnight_rate = 0
// doesn't advertise Night even if it's technically allowed.
function roomOffers(r, type) {
  const allowed = r.allowed_booking_types;
  const unrestricted = !allowed || allowed.length === 0;
  const typeAllowed  = unrestricted || allowed.includes(type);
  if (!typeAllowed) return false;
  if (type === 'night') return Number(r.overnight_rate) > 0;
  if (type === '24hr')  return Number(r.rate_24hr)      > 0;
  return Number(r.day_rate) > 0; // day
}

export default function Rooms() {
  const { user, login } = useAuth();
  const siteContent = useContent();
  const [toast, showToast, clearToast, toastType, toastAction] = useToast();

  const roomsHero = useMemo(() => {
    const h = (siteContent ?? {}).page_rooms_hero ?? {};
    return { ...ROOMS_HERO_DEFAULTS, ...h };
  }, [siteContent]);

  const [roomsApi,     setRoomsApi]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(false);
  const [selectedId,   setSelectedId]   = useState(null);
  // Where the user was scrolled when they opened a detail view —
  // restored on back so they land on the card they clicked instead
  // of the top of the page.
  const returnScrollY = useRef(0);
  // Top of the detail view, scrolled into view on open so the user
  // actually sees the room they clicked (the detail content is
  // shorter than the grid, so without this the preserved scroll
  // position lands past the page bottom).
  const detailTopRef = useRef(null);
  const [activeTab,    setActiveTab]    = useState("all");

  const [bookingOpen,  setBookingOpen]  = useState(false);
  const [loginOpen,    setLoginOpen]    = useState(false);
  const [successOpen,  setSuccessOpen]  = useState(false);
  const [lastBooking,  setLastBooking]  = useState(null);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [pendingRoom,  setPendingRoom]  = useState(null);
  // Guest-booking flow state — mirrors Resort.jsx. Non-logged-in users
  // first see the GuestWarningModal explaining what they lose without an
  // account, then branch: either open login, or continue as guest with
  // guestMode=true threaded into BookingModal + SuccessModal.
  const [guestWarningOpen, setGuestWarningOpen] = useState(false);
  const [guestMode,        setGuestMode]        = useState(false);
  const [successIsGuest,   setSuccessIsGuest]   = useState(false);
  // One-Pending-at-a-time: fetched on login so Book Now knows whether
  // to funnel into a resume flow instead of creating a duplicate row.
  // Refetched after a resume completes / cancels so the rule self-heals
  // if the user finishes payment elsewhere.
  const [resumingBooking, setResumingBooking] = useState(null);
  const [userPendingBooking, setUserPendingBooking] = useState(null);

  // Fetch the logged-in user's bookings once on mount (or when user
  // becomes set via login) so we can spot an existing Pending. Skipped
  // for anonymous visitors — server-side 409 still catches duplicates
  // for authed users who slip past this check.
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

  const anyOverlay = bookingOpen || loginOpen || guestWarningOpen || successOpen;
  useLockBodyScroll(anyOverlay);

  function load() {
    setLoading(true);
    setLoadError(false);
    getResortRooms(RESORT_ID)
      .then(data => setRoomsApi((data ?? []).map(enrichRoom)))
      .catch(() => { setRoomsApi(roomsFallback.map(enrichRoom)); setLoadError(true); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Filter + sort for the current tab. Capacity-ascending within every
  // category — hotel-site convention, and it matches the Small → Medium
  // → Large Cottage naming users already expect.
  const roomCards = useMemo(() => {
    const list = activeTab === "all"
      ? roomsApi
      : roomsApi.filter(r => getRoomCategory(r) === activeTab);
    return [...list].sort((a, b) => Number(a.capacity ?? 0) - Number(b.capacity ?? 0));
  }, [roomsApi, activeTab]);

  // For the "All" view — group the sorted cards by category so we can
  // render a section header above each type's grid. Excludes categories
  // with zero cards so we don't render empty headers.
  const groupedByCategory = useMemo(() => {
    const groups = { room: [], cottage: [], pavilion: [] };
    for (const r of roomCards) {
      const c = getRoomCategory(r);
      if (groups[c]) groups[c].push(r);
    }
    return groups;
  }, [roomCards]);

  const bookingRooms = useMemo(() =>
    roomsApi
      .filter(r => !r.availability_status || r.availability_status === "available")
      .map(r => ({
        id:                    r.id ?? null,
        name:                  r.name,
        category:              getRoomCategory(r),
        day_rate:              Number(r.day_rate       ?? 0),
        overnight_rate:        Number(r.overnight_rate ?? 0),
        rate_24hr:             Number(r.rate_24hr      ?? 0),
        capacity_label:        r.capacity_label ?? "",
        quantity:              Number(r.quantity ?? 1),
        capacity:              Number(r.capacity ?? 20),
        allowed_booking_types: r.allowed_booking_types ?? null,
        // Pass through so BookingModal can build the Optional add-on
        // picker + bundled-rate display. Stripped previously — caused
        // optionalAddons to always be empty and the picker to never
        // render, even when the owner had configured optionals.
        attached_addons:       r.attached_addons ?? [],
      })), [roomsApi]);

  const detailRoom = useMemo(
    () => selectedId != null ? roomCards.find(r => r.id === selectedId) : null,
    [selectedId, roomCards]
  );

  function openDetails(id) {
    returnScrollY.current = window.scrollY;
    setSelectedId(id);
    requestAnimationFrame(() => {
      const el = detailTopRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 16;
      window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
  }

  function backToGrid() {
    const y = returnScrollY.current;
    setSelectedId(null);
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
  }

  // Map a booking-list row → BookingModal's resumeBooking prop shape.
  // Kept in-file instead of a shared util since only 3 pages need it
  // and the mapping is trivial (6 lines).
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
    if (!user) {
      // Show the guest-warning modal first — user can pick Log In / Sign
      // Up, Continue as Guest, or Cancel. Matches /resort's flow so the
      // booking entry points feel consistent across the marketing site.
      setPendingRoom(roomName);
      setGuestWarningOpen(true);
      return;
    }
    // One-Pending rule: funnel authed users with an existing Pending
    // into the resume flow instead of creating a duplicate. The
    // selected-room hint is ignored in resume mode — the existing
    // booking's room is locked.
    if (userPendingBooking) {
      setResumingBooking(toResumeBooking(userPendingBooking));
      return;
    }
    setGuestMode(false);
    setSelectedRoom(roomName);
    setBookingOpen(true);
  }

  function handleLoginSuccess(u) {
    login(u);
    setLoginOpen(false);
    showToast(`Welcome back, ${u?.name || ""}!`, "success");
    if (pendingRoom !== null) {
      const room = pendingRoom;
      setPendingRoom(null);
      // useEffect will repopulate userPendingBooking from the fetch.
      // Call requestBooking which will branch correctly once the state
      // settles — small race window but acceptable for the edge case
      // where the user has a Pending they forgot about.
      setTimeout(() => requestBooking(room), 0);
    }
  }

  // Shared card renderer — called once per room either from a single flat
  // grid (specific-tab view) or from the per-category grids (All view).
  // Closure captures openDetails / requestBooking so we don't need prop
  // plumbing for a one-file helper.
  const renderRoomCard = (r) => (
    <div key={r.id ?? r.name}
      className="group relative bg-white rounded-2xl overflow-hidden shadow-sm duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col ring-1 ring-slate-200 hover:ring-sky-300 transition-[transform,box-shadow,--tw-ring-color]">
      <div className="relative overflow-hidden shrink-0">
        <img src={r.img}
          srcSet={unsplashSrcSet(r.img)}
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          width="800" height="600"
          alt={r.name}
          className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {roomOffers(r, 'day') && (
            <span className="bg-white/95 text-sky-700 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">Day Use</span>
          )}
          {roomOffers(r, 'night') && (
            <span className="bg-indigo-600/95 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">Overnight</span>
          )}
          {roomOffers(r, '24hr') && (
            <span className="bg-amber-500/95 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">24 Hours</span>
          )}
        </div>
        {r.capacity > 0 && (
          <span className="absolute bottom-3 right-3 bg-black/55 text-white text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
            <i className="fas fa-users text-[10px]" aria-hidden="true" /> Up to {r.capacity}
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-lg font-bold text-slate-900 mb-1">{r.name}</h3>
        <p className="text-slate-500 text-sm mb-4 line-clamp-2 flex-1">{r.description}</p>
        {/* Pricing row. Package add-ons (videoke bundled with the room
            etc.) are folded into the displayed price so the guest sees
            one clean "all-inclusive" total — no option to remove per
            business rule. An "Includes X" chip below signals what's
            in the bundle. */}
        {(() => {
          const pkgTotal = packageTotalFor(r);
          const pkgNames = packageNamesFor(r);
          const bundle   = (base) => Number(base || 0) + pkgTotal;
          return (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                {roomOffers(r, 'day') && (
                  <div className="flex-1 min-w-[80px] bg-sky-50 rounded-xl px-3 py-2 text-center border border-sky-100">
                    <p className="text-[10px] text-sky-700 font-semibold uppercase tracking-wide">Day</p>
                    <p className="text-sm font-bold text-sky-800 tabular-nums">{formatPHP(bundle(r.day_rate))}</p>
                  </div>
                )}
                {roomOffers(r, 'night') && (
                  <div className="flex-1 min-w-[80px] bg-indigo-50 rounded-xl px-3 py-2 text-center border border-indigo-100">
                    <p className="text-[10px] text-indigo-700 font-semibold uppercase tracking-wide">Night</p>
                    <p className="text-sm font-bold text-indigo-800 tabular-nums">{formatPHP(bundle(r.overnight_rate))}</p>
                  </div>
                )}
                {roomOffers(r, '24hr') && (
                  <div className="flex-1 min-w-[80px] bg-amber-50 rounded-xl px-3 py-2 text-center border border-amber-100">
                    <p className="text-[10px] text-amber-700 font-semibold uppercase tracking-wide">24 Hrs</p>
                    <p className="text-sm font-bold text-amber-800 tabular-nums">{formatPHP(bundle(r.rate_24hr))}</p>
                  </div>
                )}
              </div>
              {pkgNames.length > 0 && (
                <p className="text-[11px] text-emerald-700 font-medium mb-4 flex items-center gap-1.5">
                  <i className="fas fa-box text-emerald-500 text-[10px]" aria-hidden="true"></i>
                  Includes {pkgNames.join(', ')}
                </p>
              )}
            </>
          );
        })()}
        <div className="flex gap-2">
          <button onClick={() => openDetails(r.id)}
            className="flex-1 border border-sky-200 text-sky-600 hover:border-sky-400 hover:bg-sky-50 px-3 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1">
            Details
          </button>
          <button onClick={() => requestBooking(r.name)}
            className="flex-1 bg-sky-600 hover:bg-sky-700 text-white px-3 py-2.5 rounded-xl text-sm font-semibold shadow hover:shadow-md min-h-[44px] transition-[background-color,box-shadow] focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1">
            Book Now
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="pt-16 bg-sky-50 min-h-screen">
      <Helmet>
        <title>Rooms & Cottages — Aplaya Beach Resort</title>
        <meta name="description" content="Browse rooms, cottages, and pavilions at Aplaya Beach Resort. Book day visits, night stays, or 24-hour packages online." />
      </Helmet>
      <Toast message={toast} type={toastType} onClose={clearToast} action={toastAction} />

      {/* HERO — background is a real <img> (not CSS) so it can carry
          srcSet + sizes. Previously the CSS background-image served the
          full 2073w Unsplash asset to every viewport, costing mobile
          ~400KB of unnecessary bandwidth. */}
      <section className="relative h-[60vh] flex items-center justify-center text-center overflow-hidden">
        <img
          src={roomsHero.background}
          srcSet={unsplashSrcSet(roomsHero.background)}
          sizes="100vw"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Darkening overlay — separated from the image so the gradient
            doesn't depend on `background-image` shorthand order. */}
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

        <div className="relative max-w-4xl mx-auto px-4 text-white z-10">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 animate-hero-fade-in [animation-delay:0.2s] opacity-0">
            {roomsHero.title}
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto text-balance animate-hero-fade-in [animation-delay:0.6s] opacity-0">
            {roomsHero.subtitle}
          </p>
        </div>

        {/* Wave transition — fill=currentColor so the SVG picks up the page
            bg token via the wrapper's text-sky-50. If the bg ever moves, the
            wave follows without a hex edit. */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none text-sky-50" aria-hidden="true">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none"
            className="relative block w-[calc(100%+1.3px)] h-[80px]">
            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
              opacity=".25" fill="currentColor" />
            <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
              opacity=".5" fill="currentColor" />
            <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"
              fill="currentColor" />
          </svg>
        </div>
      </section>

      <main className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Load error banner */}
          {loadError && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-8">
              <i className="fas fa-exclamation-triangle text-amber-500" aria-hidden="true" />
              <span className="text-sm text-amber-700 flex-1">Showing cached room data — live data unavailable.</span>
              <button onClick={load} className="text-sm font-medium text-amber-700 hover:text-amber-800 underline">Retry</button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl overflow-hidden shadow-md animate-pulse">
                  <div className="h-64 bg-slate-200" />
                  <div className="p-6 space-y-3">
                    <div className="h-5 bg-slate-200 rounded w-2/3" />
                    <div className="h-4 bg-slate-100 rounded w-full" />
                    <div className="h-4 bg-slate-100 rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : !detailRoom ? (
            /* ── GRID ── */
            <div className="animate-hero-fade-in [animation-delay:0.1s] opacity-0">
              {/* Section header removed — the hero already introduces the
                  page ("Our Luxurious Accommodations"), so a second
                  "Our Accommodations" h2 + decorative bar + icon-in-circle
                  was template chrome that repeated the same message. The
                  category tabs below act as the implicit section anchor.
                  An sr-only h2 keeps the heading tree valid for screen
                  readers (otherwise we jump h1 → h3 on the card titles). */}
              <h2 className="sr-only">Rooms, cottages, and pavilions</h2>


              {/* Category tabs — 44px min-height to pass WCAG 2.5.5 mobile
                  target size. aria-pressed gives screen-reader users the
                  active state that "button" alone wouldn't convey. */}
              <div className="flex flex-wrap justify-center gap-2 mb-8" role="group" aria-label="Filter accommodations by category">
                {CATEGORY_TABS.map(tab => {
                  const count = tab.key === "all"
                    ? roomsApi.length
                    : roomsApi.filter(r => getRoomCategory(r) === tab.key).length;
                  if (count === 0 && tab.key !== "all") return null;
                  const active = activeTab === tab.key;
                  return (
                    <button key={tab.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => { setActiveTab(tab.key); setSelectedId(null); }}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 ${
                        active
                          ? "bg-sky-600 text-white border-sky-600 shadow"
                          : "bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-600"
                      }`}
                    >
                      <i className={`fas ${tab.icon} text-xs`} aria-hidden="true" />
                      {tab.label}
                      {/* Count badge — text-slate-600 clears AA 4.5:1 on
                          slate-100 (slate-500 was ~4.3:1, borderline). */}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold tabular-nums ${
                        active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                      }`}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Empty state */}
              {roomCards.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-bed text-3xl text-slate-300" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-500 mb-2">No {activeTab === "all" ? "rooms" : CATEGORY_TABS.find(t => t.key === activeTab)?.label.toLowerCase() || "rooms"} found</h3>
                  <p className="text-slate-400 text-sm mb-4">Try selecting a different category above.</p>
                  <button
                    onClick={() => setActiveTab("all")}
                    className="text-sky-600 hover:text-sky-800 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 rounded"
                  >
                    View all accommodations →
                  </button>
                </div>
              ) : activeTab === "all" ? (
                /* "All" view — one section per category (Rooms, Cottages,
                    Pavilions), each with its own header + grid. Empty
                    categories are skipped so we don't render naked headers.
                    Cards within each section stay capacity-ascending (the
                    roomCards sort is preserved through groupedByCategory). */
                <div className="space-y-12">
                  {CATEGORY_TABS.filter(t => t.key !== "all").map(tab => {
                    const cards = groupedByCategory[tab.key] ?? [];
                    if (cards.length === 0) return null;
                    return (
                      <section key={tab.key} aria-labelledby={`section-${tab.key}`}>
                        <h3 id={`section-${tab.key}`}
                          className="flex items-center gap-2.5 text-lg font-bold text-slate-800 mb-5">
                          <i className={`fas ${tab.icon} text-sky-500 text-base`} aria-hidden="true" />
                          {tab.label}
                          <span className="text-xs font-medium text-slate-400 tabular-nums ml-1">
                            ({cards.length})
                          </span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                          {cards.map(renderRoomCard)}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                  {roomCards.map(renderRoomCard)}
                </div>
              )}

              {/* Back link demoted from primary pill to a text link —
                  "retreat" actions shouldn't compete with Book Now for
                  attention. */}
              <div className="mt-12 text-center">
                <Link to="/resort" className="inline-flex items-center gap-2 text-sky-600 hover:text-sky-800 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 rounded">
                  <i className="fas fa-arrow-left text-xs" aria-hidden="true" /> Back to Resort
                </Link>
              </div>
            </div>
          ) : (
            /* ── DETAILS ── */
            <div ref={detailTopRef} className="mt-2 animate-hero-fade-in [animation-delay:0.1s] opacity-0">
              {/* Same treatment as the grid's back link — text-only,
                  not a prominent pill. */}
              <button onClick={backToGrid}
                className="mb-6 inline-flex items-center gap-2 text-sky-600 hover:text-sky-800 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 rounded">
                <i className="fas fa-arrow-left text-xs" aria-hidden="true" /> Back to all rooms
              </button>

              <div className="bg-white rounded-2xl shadow-xl overflow-hidden ring-1 ring-slate-200">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  <div className="relative overflow-hidden bg-slate-100 aspect-[4/3] lg:aspect-auto lg:h-full lg:min-h-[24rem]">
                    <img src={detailRoom.img}
                      srcSet={unsplashSrcSet(detailRoom.img)}
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      width="1200" height="900"
                      alt={detailRoom.name}
                      className="w-full h-full object-contain" loading="lazy" />
                    {/* Bottom-only darken so badges sit on pills against the
                        photograph rather than fighting a full-frame overlay. */}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent" />
                    <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                      {roomOffers(detailRoom, 'day') && (
                        <span className="bg-white/95 text-sky-700 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">Day Use</span>
                      )}
                      {roomOffers(detailRoom, 'night') && (
                        <span className="bg-indigo-600/95 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm">Overnight</span>
                      )}
                      {roomOffers(detailRoom, '24hr') && (
                        <span className="bg-amber-500/95 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm">24 Hours</span>
                      )}
                    </div>
                  </div>

                  <div className="p-8 overflow-y-auto">
                    {/* Decorative bar removed — h2 weight alone carries
                        hierarchy; the bar was template chrome. */}
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">{detailRoom.name}</h2>

                    {/* Quick stats chips — AA contrast lifted to text-*-800 */}
                    <div className="flex flex-wrap gap-2 mb-5">
                      {detailRoom.capacity > 0 && (
                        <span className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-800 text-sm px-3 py-1.5 rounded-full border border-sky-100">
                          <i className="fas fa-users text-xs" aria-hidden="true" /> Up to {detailRoom.capacity} guests
                        </span>
                      )}
                      {detailRoom.beds && (
                        <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-800 text-sm px-3 py-1.5 rounded-full border border-indigo-100">
                          <i className="fas fa-bed text-xs" aria-hidden="true" /> {detailRoom.beds}
                        </span>
                      )}
                      {detailRoom.size && (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-sm px-3 py-1.5 rounded-full border border-emerald-100">
                          <i className="fas fa-expand-arrows-alt text-xs" aria-hidden="true" /> {detailRoom.size}
                        </span>
                      )}
                    </div>

                    <p className="text-slate-600 mb-6 leading-relaxed">{detailRoom.description}</p>

                    {detailRoom.features?.length > 0 && (
                      <>
                        <h3 className="text-base font-bold text-slate-800 mb-3">Room Amenities</h3>
                        <ul className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {detailRoom.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2">
                              <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center shrink-0">
                                <i className={`fas ${f.icon || "fa-check"} text-sky-700 text-xs`} aria-hidden="true" />
                              </div>
                              <span className="text-slate-600 text-sm">{f.text}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {/* Pricing — same color-coded tiles as the card, just
                        bigger. AA contrast lifted to 800 on -50 background.
                        Package add-on cost folded into each displayed rate;
                        an "Includes: X" line below spells out what's
                        bundled so the guest understands the total. */}
                    <div className="border-t border-slate-100 pt-6">
                      {(() => {
                        const pkgTotal = packageTotalFor(detailRoom);
                        const pkgNames = packageNamesFor(detailRoom);
                        const bundle   = (base) => Number(base || 0) + pkgTotal;
                        return (
                          <>
                            <div className="flex flex-wrap gap-3 mb-3">
                              {roomOffers(detailRoom, 'day') && (
                                <div className="flex-1 min-w-[100px] bg-sky-50 rounded-2xl p-4 text-center border border-sky-100">
                                  <p className="text-[10px] text-sky-700 font-semibold uppercase tracking-wide mb-0.5">Day Use</p>
                                  <p className="text-2xl font-bold text-sky-800 tabular-nums">{formatPHP(bundle(detailRoom.day_rate))}</p>
                                </div>
                              )}
                              {roomOffers(detailRoom, 'night') && (
                                <div className="flex-1 min-w-[100px] bg-indigo-50 rounded-2xl p-4 text-center border border-indigo-100">
                                  <p className="text-[10px] text-indigo-700 font-semibold uppercase tracking-wide mb-0.5">Overnight</p>
                                  <p className="text-2xl font-bold text-indigo-800 tabular-nums">{formatPHP(bundle(detailRoom.overnight_rate))}</p>
                                </div>
                              )}
                              {roomOffers(detailRoom, '24hr') && (
                                <div className="flex-1 min-w-[100px] bg-amber-50 rounded-2xl p-4 text-center border border-amber-100">
                                  <p className="text-[10px] text-amber-700 font-semibold uppercase tracking-wide mb-0.5">24 Hours</p>
                                  <p className="text-2xl font-bold text-amber-800 tabular-nums">{formatPHP(bundle(detailRoom.rate_24hr))}</p>
                                </div>
                              )}
                            </div>
                            {pkgNames.length > 0 && (
                              <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm flex items-center gap-2">
                                <i className="fas fa-box text-emerald-500" aria-hidden="true"></i>
                                <span className="text-emerald-800">
                                  <strong className="font-semibold">Includes:</strong> {pkgNames.join(', ')}
                                </span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <button onClick={() => requestBooking(detailRoom.name)}
                        className="w-full bg-sky-600 hover:bg-sky-700 text-white py-3.5 rounded-xl font-semibold shadow-md hover:shadow-lg transition-[background-color,box-shadow] text-base focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1">
                        Book This Room
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <BookingModal
        open={bookingOpen}
        onClose={() => { setBookingOpen(false); setGuestMode(false); }}
        rooms={bookingRooms}
        selectedRoom={selectedRoom}
        guestMode={guestMode}
        onBooked={(booking) => {
          setBookingOpen(false);
          setLastBooking(booking);
          setSuccessIsGuest(guestMode);
          setGuestMode(false);
          setSuccessOpen(true);
        }}
      />
      {/* Resume-payment mount — driven by userPendingBooking. Refetches
          the user's bookings on close so the rule self-heals after a
          successful payment or cancel. */}
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

      <LoginModal
        open={loginOpen}
        onClose={() => { setLoginOpen(false); setPendingRoom(null); }}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Guest-warning gate for non-logged-in Book Now clicks. Lets the
          user pick Log In / Sign Up, Continue as Guest, or Cancel —
          matches the /resort page's flow. */}
      <GuestWarningModal
        open={guestWarningOpen}
        onClose={() => { setGuestWarningOpen(false); setPendingRoom(null); }}
        onLoginSignup={() => {
          setGuestWarningOpen(false);
          setLoginOpen(true);
        }}
        onContinueAsGuest={() => {
          setGuestWarningOpen(false);
          setGuestMode(true);
          setSelectedRoom(pendingRoom || "");
          setPendingRoom(null);
          setBookingOpen(true);
        }}
      />

      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        booking={lastBooking}
        guestMode={successIsGuest}
      />
    </div>
  );
}
