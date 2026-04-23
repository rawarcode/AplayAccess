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
import SignupModal from "../components/modals/SignupModal.jsx";
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

/* ------------------------------------------------------------------ */
/*  Scroll-triggered reveal                                           */
/* ------------------------------------------------------------------ */
// Callback-ref reveal — fires on element mount even when the parent
// section is conditionally rendered after an async fetch. See
// pages/Resort.jsx for the exact bug that motivated moving off
// useRef + useEffect-with-null-guard.
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToGrid() {
    setSelectedId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    <div className="pt-16 bg-slate-50 min-h-screen">
      <Helmet>
        <title>Rooms & Cottages — Aplaya Beach Resort</title>
        <meta name="description" content="Browse rooms, cottages, and pavilions at Aplaya Beach Resort. Book day visits, night stays, or 24-hour packages online." />
      </Helmet>
      <Toast message={toast} type={toastType} onClose={clearToast} action={toastAction} />

      {/* HERO — single-image bed, generous type, subtle gradient
          instead of a flat dark slab, so the photograph still reads. */}
      <section
        className="relative h-[56vh] md:h-[62vh] flex items-center justify-center text-center overflow-hidden"
        style={{
          backgroundImage:
            `linear-gradient(180deg, rgba(8,47,73,.35) 0%, rgba(8,47,73,.55) 70%, rgba(248,250,252,1) 100%), url('${roomsHero.background}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 text-white z-10">
          <p className="text-xs md:text-sm uppercase tracking-[0.3em] text-sky-100/80 mb-5 animate-hero-fade-in [animation-delay:0.1s] opacity-0">
            Stay With Us
          </p>
          <h1 className="text-4xl md:text-6xl font-serif font-light tracking-tight mb-5 animate-hero-fade-in [animation-delay:0.25s] opacity-0">
            {roomsHero.title}
          </h1>
          <div className="w-12 h-px bg-sky-200/70 mx-auto mb-5 animate-hero-fade-in [animation-delay:0.4s] opacity-0" />
          <p className="text-base md:text-lg text-white/85 max-w-2xl mx-auto animate-hero-fade-in [animation-delay:0.55s] opacity-0">
            {roomsHero.subtitle}
          </p>
        </div>

        {/* Wave transition — matches the page bg (slate-50) now, not sky-50 */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none pointer-events-none">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none"
            className="relative block w-[calc(100%+1.3px)] h-[70px]">
            <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"
              fill="#f8fafc" />
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
              <div className="text-center mb-10">
                <p className="text-xs uppercase tracking-[0.25em] text-sky-600/80 font-semibold mb-3">
                  Accommodations
                </p>
                <h2 className="text-3xl md:text-4xl font-serif font-light text-slate-900 mb-3">
                  Choose where to stay
                </h2>
                <p className="text-slate-500 text-sm md:text-base max-w-xl mx-auto">
                  Rooms, cottages, and pavilions for every pace of visit — day use, overnight, or a full 24 hours.
                </p>
              </div>

              {/* Category tabs */}
              <div className="flex flex-wrap justify-center gap-2 mb-10">
                {CATEGORY_TABS.map(tab => {
                  const count = tab.key === "all"
                    ? roomsApi.length
                    : roomsApi.filter(r => getRoomCategory(r) === tab.key).length;
                  if (count === 0 && tab.key !== "all") return null;
                  const active = activeTab === tab.key;
                  return (
                    <button key={tab.key}
                      onClick={() => { setActiveTab(tab.key); setSelectedId(null); }}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                        active
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <i className={`fas ${tab.icon} text-xs opacity-70`} />
                      {tab.label}
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${
                        active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
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
                    <article key={r.id ?? r.name}
                      className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300 flex flex-col border border-slate-200/70">
                      {/* Image — quiet overlay, capacity chip bottom-left,
                          badges removed from over the photo since the rate
                          row below already signals which types are offered. */}
                      <div className="relative overflow-hidden shrink-0">
                        <img src={r.img} alt={r.name}
                          className="w-full h-60 object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out"
                          loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
                        {r.capacity > 0 && (
                          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 bg-white/95 backdrop-blur text-slate-700 text-xs font-medium px-2.5 py-1 rounded-full shadow-sm">
                            <i className="fas fa-users text-[10px] text-slate-400" />
                            Up to {r.capacity}
                          </span>
                        )}
                      </div>

                      {/* Body */}
                      <div className="p-6 flex flex-col flex-1">
                        <h3 className="text-lg font-serif font-medium text-slate-900 mb-1.5 tracking-tight">{r.name}</h3>
                        <p className="text-slate-500 text-sm mb-5 line-clamp-2 flex-1 leading-relaxed">{r.description}</p>

                        {/* Pricing row — single unified surface, separated by
                            thin dividers. Type is communicated by the label,
                            not a color tint, so the eye reads price → price → price
                            instead of rainbow → rainbow → rainbow. */}
                        <div className="flex items-stretch rounded-xl bg-slate-50 border border-slate-100 mb-5 divide-x divide-slate-200/70">
                          {roomOffers(r, 'day') && (
                            <div className="flex-1 px-3 py-2.5 text-center">
                              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Day</p>
                              <p className="text-sm font-semibold text-slate-900 tabular-nums mt-0.5">{formatPHP(r.day_rate)}</p>
                            </div>
                          )}
                          {roomOffers(r, 'night') && (
                            <div className="flex-1 px-3 py-2.5 text-center">
                              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Night</p>
                              <p className="text-sm font-semibold text-slate-900 tabular-nums mt-0.5">{formatPHP(r.overnight_rate)}</p>
                            </div>
                          )}
                          {roomOffers(r, '24hr') && (
                            <div className="flex-1 px-3 py-2.5 text-center">
                              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">24 Hrs</p>
                              <p className="text-sm font-semibold text-slate-900 tabular-nums mt-0.5">{formatPHP(r.rate_24hr)}</p>
                            </div>
                          )}
                        </div>

                        {/* Actions — primary is dark/high-contrast, secondary
                            is ghost so the two don't compete for attention. */}
                        <div className="flex gap-2">
                          <button onClick={() => openDetails(r.id)}
                            className="flex-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors">
                            Details
                          </button>
                          <button onClick={() => requestBooking(r.name)}
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2.5 rounded-xl text-sm font-medium transition-colors">
                            Book Now
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="mt-14 text-center">
                <Link to="/resort" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors">
                  <i className="fas fa-arrow-left text-xs" /> Back to Resort
                </Link>
              </div>
            </div>
          ) : (
            /* ── DETAILS ── */
            <div className="mt-2 animate-hero-fade-in [animation-delay:0.1s] opacity-0">
              <button onClick={backToGrid}
                className="mb-6 inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors">
                <i className="fas fa-arrow-left text-xs" /> Back to all rooms
              </button>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200/70">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  <div className="relative overflow-hidden h-80 lg:h-auto">
                    <img src={detailRoom.img} alt={detailRoom.name}
                      className="w-full h-full object-cover" loading="lazy" />
                  </div>

                  <div className="p-8 lg:p-10 overflow-y-auto">
                    <p className="text-xs uppercase tracking-[0.2em] text-sky-600/80 font-semibold mb-2">
                      {getRoomCategory(detailRoom) === 'cottage'  ? 'Cottage'
                       : getRoomCategory(detailRoom) === 'pavilion' ? 'Pavilion'
                       : 'Room'}
                    </p>
                    <h2 className="text-3xl lg:text-4xl font-serif font-light text-slate-900 mb-5 tracking-tight">{detailRoom.name}</h2>

                    {/* Quick stats — unified neutral treatment, no color-coding */}
                    <div className="flex flex-wrap gap-x-5 gap-y-2 mb-6 text-sm text-slate-600">
                      {detailRoom.capacity > 0 && (
                        <span className="inline-flex items-center gap-2">
                          <i className="fas fa-users text-xs text-slate-400" /> Up to {detailRoom.capacity} guests
                        </span>
                      )}
                      {detailRoom.beds && (
                        <span className="inline-flex items-center gap-2">
                          <i className="fas fa-bed text-xs text-slate-400" /> {detailRoom.beds}
                        </span>
                      )}
                      {detailRoom.size && (
                        <span className="inline-flex items-center gap-2">
                          <i className="fas fa-expand-arrows-alt text-xs text-slate-400" /> {detailRoom.size}
                        </span>
                      )}
                    </div>

                    <p className="text-slate-600 mb-8 leading-relaxed">{detailRoom.description}</p>

                    {detailRoom.features?.length > 0 && (
                      <>
                        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-4">Amenities</h3>
                        <ul className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                          {detailRoom.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                              <i className={`fas ${f.icon || "fa-check"} text-sky-500 text-xs w-4 text-center`} />
                              <span>{f.text}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {/* Pricing — same unified surface as the card, scaled up */}
                    <div className="border-t border-slate-100 pt-6">
                      <div className="flex items-stretch rounded-xl bg-slate-50 border border-slate-100 mb-5 divide-x divide-slate-200/70">
                        {roomOffers(detailRoom, 'day') && (
                          <div className="flex-1 px-4 py-3.5 text-center">
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Day Use</p>
                            <p className="text-xl font-semibold text-slate-900 tabular-nums mt-1">{formatPHP(detailRoom.day_rate)}</p>
                          </div>
                        )}
                        {roomOffers(detailRoom, 'night') && (
                          <div className="flex-1 px-4 py-3.5 text-center">
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Overnight</p>
                            <p className="text-xl font-semibold text-slate-900 tabular-nums mt-1">{formatPHP(detailRoom.overnight_rate)}</p>
                          </div>
                        )}
                        {roomOffers(detailRoom, '24hr') && (
                          <div className="flex-1 px-4 py-3.5 text-center">
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">24 Hours</p>
                            <p className="text-xl font-semibold text-slate-900 tabular-nums mt-1">{formatPHP(detailRoom.rate_24hr)}</p>
                          </div>
                        )}
                      </div>
                      <button onClick={() => requestBooking(detailRoom.name)}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-medium transition-colors text-base">
                        Book this room
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
