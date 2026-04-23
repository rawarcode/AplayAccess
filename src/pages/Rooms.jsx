import { useEffect, useMemo, useState } from "react";
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
  const [activeTab,    setActiveTab]    = useState("all");

  const [bookingOpen,  setBookingOpen]  = useState(false);
  const [loginOpen,    setLoginOpen]    = useState(false);
  const [successOpen,  setSuccessOpen]  = useState(false);
  const [lastBooking,  setLastBooking]  = useState(null);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [pendingRoom,  setPendingRoom]  = useState(null);
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

  const anyOverlay = bookingOpen || loginOpen || successOpen;
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

  const roomCards = useMemo(() =>
    activeTab === "all" ? roomsApi : roomsApi.filter(r => getRoomCategory(r) === activeTab),
  [roomsApi, activeTab]);

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
      })), [roomsApi]);

  const detailRoom = useMemo(
    () => selectedId != null ? roomCards.find(r => r.id === selectedId) : null,
    [selectedId, roomCards]
  );

  function openDetails(id) {
    setSelectedId(id);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function backToGrid() {
    setSelectedId(null);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
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
      setPendingRoom(roomName);
      setLoginOpen(true);
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

  return (
    <div className="pt-16 bg-sky-50 min-h-screen">
      <Helmet>
        <title>Rooms & Cottages — Aplaya Beach Resort</title>
        <meta name="description" content="Browse rooms, cottages, and pavilions at Aplaya Beach Resort. Book day visits, night stays, or 24-hour packages online." />
      </Helmet>
      <Toast message={toast} type={toastType} onClose={clearToast} action={toastAction} />

      {/* HERO */}
      <section
        className="relative h-[60vh] flex items-center justify-center text-center overflow-hidden"
        style={{
          backgroundImage:
            `linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), url('${roomsHero.background}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 text-white z-10">
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
              <i className="fas fa-exclamation-triangle text-amber-500" />
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
                  category tabs below act as the implicit section anchor. */}

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
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold tabular-nums ${
                        active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                      }`}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Empty state */}
              {roomCards.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-bed text-3xl text-slate-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-500 mb-2">No {activeTab === "all" ? "rooms" : CATEGORY_TABS.find(t => t.key === activeTab)?.label.toLowerCase() || "rooms"} found</h3>
                  <p className="text-slate-400 text-sm mb-4">Try selecting a different category above.</p>
                  <button
                    onClick={() => setActiveTab("all")}
                    className="text-sky-600 hover:text-sky-800 text-sm font-medium transition"
                  >
                    View all accommodations →
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                  {roomCards.map((r) => (
                    <div key={r.id ?? r.name}
                      className="group relative bg-white rounded-2xl overflow-hidden shadow-sm duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col ring-1 ring-slate-200 hover:ring-sky-300 transition-[transform,box-shadow,--tw-ring-color]">
                      {/* Image — srcSet serves 400/800/1600 widths off
                          Unsplash so mobile doesn't pay desktop bandwidth. */}
                      <div className="relative overflow-hidden shrink-0">
                        <img src={r.img}
                          srcSet={unsplashSrcSet(r.img)}
                          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                          alt={r.name}
                          className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy" />
                        {/* Soft darken bottom-only so the capacity chip reads,
                            but the top badges sit on their own pills and stay
                            crisp against the photograph. */}
                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
                        {/* Badges — respect allowed_booking_types so a night-only
                            or 24hr-only room isn't merchandised as day-use. */}
                        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                          {roomOffers(r, 'day') && (
                            <span className="bg-white/95 text-sky-700 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
                              Day Use
                            </span>
                          )}
                          {roomOffers(r, 'night') && (
                            <span className="bg-indigo-600/95 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
                              Overnight
                            </span>
                          )}
                          {roomOffers(r, '24hr') && (
                            <span className="bg-amber-500/95 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
                              24 Hours
                            </span>
                          )}
                        </div>
                        {/* Capacity chip */}
                        {r.capacity > 0 && (
                          <span className="absolute bottom-3 right-3 bg-black/55 text-white text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
                            <i className="fas fa-users text-[10px]" aria-hidden="true" /> Up to {r.capacity}
                          </span>
                        )}
                      </div>

                      {/* Body */}
                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="text-lg font-bold text-slate-900 mb-1">{r.name}</h3>
                        <p className="text-slate-500 text-sm mb-4 line-clamp-2 flex-1">{r.description}</p>

                        {/* Pricing row — only types the room actually offers.
                            text-*-800 darker than 700 on the -50 background
                            to pass WCAG AA 4.5:1 contrast (amber-700 was
                            borderline). */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {roomOffers(r, 'day') && (
                            <div className="flex-1 min-w-[80px] bg-sky-50 rounded-xl px-3 py-2 text-center border border-sky-100">
                              <p className="text-[10px] text-sky-700 font-semibold uppercase tracking-wide">Day</p>
                              <p className="text-sm font-bold text-sky-800 tabular-nums">{formatPHP(r.day_rate)}</p>
                            </div>
                          )}
                          {roomOffers(r, 'night') && (
                            <div className="flex-1 min-w-[80px] bg-indigo-50 rounded-xl px-3 py-2 text-center border border-indigo-100">
                              <p className="text-[10px] text-indigo-700 font-semibold uppercase tracking-wide">Night</p>
                              <p className="text-sm font-bold text-indigo-800 tabular-nums">{formatPHP(r.overnight_rate)}</p>
                            </div>
                          )}
                          {roomOffers(r, '24hr') && (
                            <div className="flex-1 min-w-[80px] bg-amber-50 rounded-xl px-3 py-2 text-center border border-amber-100">
                              <p className="text-[10px] text-amber-700 font-semibold uppercase tracking-wide">24 Hrs</p>
                              <p className="text-sm font-bold text-amber-800 tabular-nums">{formatPHP(r.rate_24hr)}</p>
                            </div>
                          )}
                        </div>

                        {/* Actions — min-h-[44px] to meet WCAG 2.5.5 touch
                            target size on mobile. Scoped transitions to
                            colors/shadow only (cheaper than transition-all). */}
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
                  ))}
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
            <div className="mt-2 animate-hero-fade-in [animation-delay:0.1s] opacity-0">
              {/* Same treatment as the grid's back link — text-only,
                  not a prominent pill. */}
              <button onClick={backToGrid}
                className="mb-6 inline-flex items-center gap-2 text-sky-600 hover:text-sky-800 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 rounded">
                <i className="fas fa-arrow-left text-xs" aria-hidden="true" /> Back to all rooms
              </button>

              <div className="bg-white rounded-2xl shadow-xl overflow-hidden ring-1 ring-slate-200">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  <div className="relative overflow-hidden h-80 lg:h-auto">
                    <img src={detailRoom.img}
                      srcSet={unsplashSrcSet(detailRoom.img)}
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      alt={detailRoom.name}
                      className="w-full h-full object-cover" loading="lazy" />
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
                        bigger. AA contrast lifted to 800 on -50 background. */}
                    <div className="border-t border-slate-100 pt-6">
                      <div className="flex flex-wrap gap-3 mb-5">
                        {roomOffers(detailRoom, 'day') && (
                          <div className="flex-1 min-w-[100px] bg-sky-50 rounded-2xl p-4 text-center border border-sky-100">
                            <p className="text-[10px] text-sky-700 font-semibold uppercase tracking-wide mb-0.5">Day Use</p>
                            <p className="text-2xl font-bold text-sky-800 tabular-nums">{formatPHP(detailRoom.day_rate)}</p>
                          </div>
                        )}
                        {roomOffers(detailRoom, 'night') && (
                          <div className="flex-1 min-w-[100px] bg-indigo-50 rounded-2xl p-4 text-center border border-indigo-100">
                            <p className="text-[10px] text-indigo-700 font-semibold uppercase tracking-wide mb-0.5">Overnight</p>
                            <p className="text-2xl font-bold text-indigo-800 tabular-nums">{formatPHP(detailRoom.overnight_rate)}</p>
                          </div>
                        )}
                        {roomOffers(detailRoom, '24hr') && (
                          <div className="flex-1 min-w-[100px] bg-amber-50 rounded-2xl p-4 text-center border border-amber-100">
                            <p className="text-[10px] text-amber-700 font-semibold uppercase tracking-wide mb-0.5">24 Hours</p>
                            <p className="text-2xl font-bold text-amber-800 tabular-nums">{formatPHP(detailRoom.rate_24hr)}</p>
                          </div>
                        )}
                      </div>
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
        onClose={() => setBookingOpen(false)}
        rooms={bookingRooms}
        selectedRoom={selectedRoom}
        onBooked={(booking) => {
          setBookingOpen(false);
          setLastBooking(booking);
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

      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        booking={lastBooking}
      />
    </div>
  );
}
