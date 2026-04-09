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

export default function Rooms() {
  const { user, login } = useAuth();

  const [roomsApi,     setRoomsApi]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedId,   setSelectedId]   = useState(null);

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

  const roomCards = useMemo(() => roomsApi, [roomsApi]);
  const bookingRooms = useMemo(() =>
    roomsApi
      .filter(r => !r.availability_status || r.availability_status === "available")
      .map(r => ({
        id:             r.id ?? null,
        name:           r.name,
        day_rate:       Number(r.day_rate ?? 0),
        overnight_rate: Number(r.overnight_rate ?? 0),
        capacity:       Number(r.capacity ?? 20),
      })), [roomsApi]);

  const detailRoom = selectedId != null ? roomCards.find(r => r.id === selectedId) : null;

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
        <div className="max-w-4xl mx-auto px-4 text-white">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">Our Luxurious Accommodations</h1>
          <p className="text-lg md:text-xl">Discover the perfect room for your stay at Aplaya Beach Resort.</p>
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
              <div className="text-center mb-12">
                <span className="text-4xl mb-3 block">🛏️</span>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">All Accommodations</h2>
                <div className="w-16 h-1.5 rounded-full bg-blue-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">{roomCards.length} room{roomCards.length !== 1 ? "s" : ""} available</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {roomCards.map((r) => (
                  <div key={r.id ?? r.name}
                    className="group bg-white rounded-2xl overflow-hidden shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
                    <div className="relative overflow-hidden">
                      <img src={r.img} alt={r.name} className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-blue-700 text-xs font-bold px-3 py-1 rounded-full shadow">
                        Day Use
                      </span>
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{r.name}</h3>
                      <p className="text-gray-500 text-sm mb-4 line-clamp-2">{r.description}</p>
                      <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                        <div>
                          <span className="text-xl font-bold text-blue-600">{formatPHP(r.day_rate)}</span>
                          <span className="text-gray-400 text-xs ml-1">/ day visit</span>
                        </div>
                        <button onClick={() => openDetails(r.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow hover:shadow-md transition-all">
                          View Details
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

                  <div className="p-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{detailRoom.name}</h2>
                    <div className="w-10 h-1 rounded-full bg-blue-400 mb-4" />
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

                    <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Starting from</p>
                        <span className="text-3xl font-bold text-blue-600">{formatPHP(detailRoom.day_rate)}</span>
                        <span className="text-gray-400 text-sm ml-1">/ day visit</span>
                      </div>
                      <button onClick={() => requestBooking(detailRoom.name)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all">
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
