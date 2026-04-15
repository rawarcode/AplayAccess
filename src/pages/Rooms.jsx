import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getResortRooms } from "../lib/resortApi.js";
import { rooms as roomsFallback } from "../data/rooms.js";
import BookingModal from "../components/modals/BookingModal.jsx";
import LoginModal from "../components/modals/LoginModal.jsx";
import SuccessModal from "../components/modals/SuccessModal.jsx";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";

const RESORT_ID = 1;

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

export default function Rooms() {
  const { user, login } = useAuth();

  const [roomsApi,     setRoomsApi]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedId,   setSelectedId]   = useState(null);
  const [activeTab,    setActiveTab]    = useState("all");

  const [bookingOpen,  setBookingOpen]  = useState(false);
  const [loginOpen,    setLoginOpen]    = useState(false);
  const [successOpen,  setSuccessOpen]  = useState(false);
  const [lastBooking,  setLastBooking]  = useState(null);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [pendingRoom,  setPendingRoom]  = useState(null);

  const anyOverlay = bookingOpen || loginOpen || successOpen;
  useLockBodyScroll(anyOverlay);

  useEffect(() => {
    getResortRooms(RESORT_ID)
      .then(data => setRoomsApi((data ?? []).map(enrichRoom)))
      .catch(() => setRoomsApi(roomsFallback.map(enrichRoom)))
      .finally(() => setLoading(false));
  }, []);

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

  function requestBooking(roomName = "") {
    if (!user) {
      setPendingRoom(roomName);
      setLoginOpen(true);
      return;
    }
    setSelectedRoom(roomName);
    setBookingOpen(true);
  }

  function handleLoginSuccess(u) {
    login(u);
    setLoginOpen(false);
    if (pendingRoom !== null) {
      setSelectedRoom(pendingRoom);
      setPendingRoom(null);
      setBookingOpen(true);
    }
  }

  return (
    <div className="pt-16 bg-sky-50 min-h-screen">
      {/* HERO */}
      <section
        className="relative h-[60vh] flex items-center justify-center text-center"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 text-white z-10">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">Our Luxurious Accommodations</h1>
          <p className="text-lg md:text-xl">Discover the perfect room for your stay at Aplaya Beach Resort.</p>
        </div>
        {/* Wave transition to sky-blue bg */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none"
            className="relative block w-[calc(100%+1.3px)] h-[80px]">
            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
              opacity=".25" fill="#e0f2fe" />
            <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
              opacity=".5" fill="#e0f2fe" />
            <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"
              fill="#e0f2fe" />
          </svg>
        </div>
      </section>

      <main className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl overflow-hidden shadow-md animate-pulse">
                  <div className="h-64 bg-gray-200" />
                  <div className="p-6 space-y-3">
                    <div className="h-5 bg-gray-200 rounded w-2/3" />
                    <div className="h-4 bg-gray-100 rounded w-full" />
                    <div className="h-4 bg-gray-100 rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : !detailRoom ? (
            /* ── GRID ── */
            <>
              <div className="text-center mb-8">
                <span className="text-4xl mb-3 block">🛏️</span>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Our Accommodations</h2>
                <div className="w-16 h-1.5 rounded-full bg-blue-400 mx-auto mb-4" />
              </div>

              {/* Category tabs */}
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                {CATEGORY_TABS.map(tab => {
                  const count = tab.key === "all"
                    ? roomsApi.length
                    : roomsApi.filter(r => getRoomCategory(r) === tab.key).length;
                  if (count === 0 && tab.key !== "all") return null;
                  return (
                    <button key={tab.key}
                      onClick={() => { setActiveTab(tab.key); setSelectedId(null); }}
                      className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold border transition-all ${
                        activeTab === tab.key
                          ? "bg-blue-600 text-white border-blue-600 shadow"
                          : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                      }`}
                    >
                      <i className={`fas ${tab.icon} text-xs`}></i>
                      {tab.label}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                        activeTab === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                      }`}>{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {roomCards.map((r) => (
                  <div key={r.id ?? r.name}
                    className="group bg-white rounded-2xl overflow-hidden shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl flex flex-col">
                    {/* Image */}
                    <div className="relative overflow-hidden shrink-0">
                      <img src={r.img} alt={r.name}
                        className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span className="bg-white/90 backdrop-blur-sm text-blue-700 text-xs font-bold px-3 py-1 rounded-full shadow">
                          Day Use
                        </span>
                        {r.overnight_rate > 0 && (
                          <span className="bg-indigo-600/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                            Overnight
                          </span>
                        )}
                      </div>
                      {/* Capacity chip */}
                      {r.capacity > 0 && (
                        <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                          <i className="fas fa-users text-[10px]"></i> Up to {r.capacity} guests
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{r.name}</h3>
                      <p className="text-gray-500 text-sm mb-4 line-clamp-2 flex-1">{r.description}</p>

                      {/* Pricing row */}
                      <div className="flex gap-3 mb-4">
                        <div className="flex-1 bg-sky-50 rounded-xl px-3 py-2 text-center border border-sky-100">
                          <p className="text-[10px] text-sky-600 font-semibold uppercase tracking-wide">Day Use</p>
                          <p className="text-base font-bold text-sky-700">{formatPHP(r.day_rate)}</p>
                        </div>
                        {r.overnight_rate > 0 && (
                          <div className="flex-1 bg-indigo-50 rounded-xl px-3 py-2 text-center border border-indigo-100">
                            <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wide">Overnight</p>
                            <p className="text-base font-bold text-indigo-700">{formatPHP(r.overnight_rate)}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button onClick={() => openDetails(r.id)}
                          className="flex-1 border border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50 px-3 py-2 rounded-xl text-sm font-semibold transition-all">
                          Details
                        </button>
                        <button onClick={() => requestBooking(r.name)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-semibold shadow hover:shadow-md transition-all">
                          Book Now
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-12 text-center">
                <Link to="/resort" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all">
                  ← Back to Resort
                </Link>
              </div>
            </>
          ) : (
            /* ── DETAILS ── */
            <div className="mt-2">
              <button onClick={backToGrid}
                className="mb-6 inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-blue-400 text-blue-600 hover:text-blue-800 font-medium px-4 py-2 rounded-xl shadow-sm transition-all">
                ← Back to All Rooms
              </button>

              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  <div className="relative overflow-hidden h-80 lg:h-auto">
                    <img src={detailRoom.img} alt={detailRoom.name}
                      className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <span className="bg-white/90 backdrop-blur-sm text-blue-700 text-xs font-bold px-3 py-1 rounded-full shadow">Day Use</span>
                    </div>
                  </div>

                  <div className="p-8 overflow-y-auto">
                    <h2 className="text-3xl font-bold text-gray-900 mb-1">{detailRoom.name}</h2>
                    <div className="w-10 h-1 rounded-full bg-blue-400 mb-4" />

                    {/* Quick stats chips */}
                    <div className="flex flex-wrap gap-2 mb-5">
                      {detailRoom.capacity > 0 && (
                        <span className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 text-sm px-3 py-1.5 rounded-full border border-sky-100">
                          <i className="fas fa-users text-xs"></i> Up to {detailRoom.capacity} guests
                        </span>
                      )}
                      {detailRoom.beds && (
                        <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-sm px-3 py-1.5 rounded-full border border-indigo-100">
                          <i className="fas fa-bed text-xs"></i> {detailRoom.beds}
                        </span>
                      )}
                      {detailRoom.size && (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-sm px-3 py-1.5 rounded-full border border-emerald-100">
                          <i className="fas fa-expand-arrows-alt text-xs"></i> {detailRoom.size}
                        </span>
                      )}
                    </div>

                    <p className="text-gray-600 mb-6 leading-relaxed">{detailRoom.description}</p>

                    {detailRoom.features?.length > 0 && (
                      <>
                        <h3 className="text-base font-bold text-gray-800 mb-3">Room Amenities</h3>
                        <ul className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {detailRoom.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                <i className={`fas ${f.icon || "fa-check"} text-blue-600 text-xs`}></i>
                              </div>
                              <span className="text-gray-600 text-sm">{f.text}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {/* Pricing */}
                    <div className="border-t border-gray-100 pt-6">
                      <div className="flex gap-3 mb-5">
                        <div className="flex-1 bg-sky-50 rounded-2xl p-4 text-center border border-sky-100">
                          <p className="text-[10px] text-sky-600 font-semibold uppercase tracking-wide mb-0.5">Day Use</p>
                          <p className="text-2xl font-bold text-sky-700">{formatPHP(detailRoom.day_rate)}</p>
                        </div>
                        {detailRoom.overnight_rate > 0 && (
                          <div className="flex-1 bg-indigo-50 rounded-2xl p-4 text-center border border-indigo-100">
                            <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wide mb-0.5">Overnight</p>
                            <p className="text-2xl font-bold text-indigo-700">{formatPHP(detailRoom.overnight_rate)}</p>
                          </div>
                        )}
                      </div>
                      <button onClick={() => requestBooking(detailRoom.name)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all text-base">
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
        initialRoom={selectedRoom}
        onBooked={(booking) => {
          setBookingOpen(false);
          setLastBooking(booking);
          setSuccessOpen(true);
        }}
      />

      <LoginModal
        open={loginOpen}
        onClose={() => { setLoginOpen(false); setPendingRoom(null); }}
        onSuccess={handleLoginSuccess}
      />

      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        booking={lastBooking}
      />
    </div>
  );
}
