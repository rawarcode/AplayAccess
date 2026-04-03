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
  const dayRate = Number(room.day_rate ?? 0);
  let badge = local?.badge ?? null;
  if (!badge) {
    if (dayRate >= 6000)      badge = { text: "Premium",    className: "bg-purple-600" };
    else if (dayRate >= 4500) badge = { text: "Popular",    className: "bg-green-600"  };
    else if (dayRate > 0)     badge = { text: "Best Value", className: "bg-blue-600"   };
  }
  const features = (room.features || []).map(f =>
    typeof f === "string" ? { text: f, icon: "fa-check" } : f
  );
  return {
    ...room,
    img:     local?.img ?? FALLBACK_IMG,
    badge,
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
    <div className="pt-16 bg-gray-50 min-h-screen">
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

      <main className="py-12">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {roomCards.map((r) => (
                  <div key={r.id ?? r.name}
                    className="bg-white rounded-xl overflow-hidden shadow-md transition hover:-translate-y-2 hover:shadow-xl">
                    <div className="relative">
                      <img src={r.img} alt={r.name} className="w-full h-64 object-cover" loading="lazy" />
                      {r.badge && (
                        <div className={`absolute top-4 right-4 ${r.badge.className} text-white px-3 py-1 rounded-md text-sm font-medium`}>
                          {r.badge.text}
                        </div>
                      )}
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{r.name}</h3>
                      <p className="text-gray-600 mb-4 text-sm">{r.description}</p>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-xl font-bold text-blue-600">{formatPHP(r.day_rate)}</span>
                          <span className="text-gray-500 text-xs"> / day visit</span>
                        </div>
                        <button onClick={() => openDetails(r.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-medium">
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-10 text-center">
                <Link to="/resort" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium">
                  ← Back to Resort
                </Link>
              </div>
            </>
          ) : (
            /* ── DETAILS ── */
            <div className="mt-2 bg-white rounded-xl shadow-md p-6 md:p-8">
              <button onClick={backToGrid}
                className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium">
                <span>←</span> Back to All Rooms
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <img src={detailRoom.img} alt={detailRoom.name}
                    className="w-full h-[400px] object-cover rounded-lg" loading="lazy" />
                </div>

                <div>
                  {detailRoom.badge && (
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-2 ${detailRoom.badge.className} text-white`}>
                      {detailRoom.badge.text}
                    </span>
                  )}

                  <h2 className="text-3xl font-bold text-gray-900 mb-4">{detailRoom.name}</h2>
                  <p className="text-gray-600 mb-6">{detailRoom.description}</p>

                  {/* Room Features from API */}
                  {detailRoom.features?.length > 0 && (
                    <>
                      <h3 className="text-xl font-bold text-gray-900 mb-3">Room Amenities</h3>
                      <ul className="mb-6 space-y-2">
                        {detailRoom.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                              <i className={`fas ${f.icon || "fa-check"} text-blue-600 text-sm`}></i>
                            </div>
                            <span className="text-gray-600 self-center">{f.text}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-blue-50 rounded-lg">
                    <div>
                      <span className="text-2xl font-bold text-blue-600">{formatPHP(detailRoom.day_rate)}</span>
                      <span className="text-gray-500"> / day visit</span>
                    </div>
                    <button onClick={() => requestBooking(detailRoom.name)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium">
                      Book This Room
                    </button>
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
