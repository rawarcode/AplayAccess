import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";
import { useAuth } from "../context/AuthContext.jsx";
import { rooms } from "../data/rooms.js";

export default function Rooms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState(null);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.key === selectedKey) || null,
    [selectedKey]
  );

  useLockBodyScroll(false);

  function openDetails(key) {
    setSelectedKey(key);
    // nice UX: scroll into view
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToGrid() {
    setSelectedKey(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openBooking(roomName = "") {
    if (!user) {
      // Not logged in — go to resort page to handle login then booking
      navigate(`/resort?login=1&next=/rooms`);
      return;
    }
    // Redirect to Resort which loads rooms from API (with proper IDs) and opens BookingModal
    navigate(`/resort?book=1&room=${encodeURIComponent(roomName)}`);
  }

  return (
    <div className="pt-16 bg-gray-50 min-h-screen">
      {/* HERO (shorter like your rooms.html) */}
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
          <p className="text-lg md:text-xl">
            Discover the perfect room for your stay at Aplaya Beach Resort.
          </p>
        </div>
      </section>

      <main className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* GRID */}
          {!selectedRoom ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {rooms.map((r) => (
                <div
                  key={r.key}
                  className="bg-white rounded-xl overflow-hidden shadow-md transition hover:-translate-y-2 hover:shadow-xl"
                >
                  <div className="relative">
                    <img src={r.img} alt={r.name} className="w-full h-64 object-cover" loading="lazy" />
                    {r.badge ? (
                      <div className={`absolute top-4 right-4 ${r.badge.className} text-white px-3 py-1 rounded-md text-sm font-medium`}>
                        {r.badge.text}
                      </div>
                    ) : null}
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{r.name}</h3>
                    <p className="text-gray-600 mb-4 text-sm">{r.desc}</p>

                    <ul className="mb-4 text-sm text-gray-600 space-y-1">
                      {(r.highlights || []).slice(0, 3).map((h) => (
                        <li key={h} className="flex items-center gap-2">
                          <span className="text-blue-600">✓</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-xl font-bold text-blue-600">₱{r.price}</span>
                        <span className="text-gray-500 text-xs">/ night</span>
                      </div>
                      <button
                        onClick={() => openDetails(r.key)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-medium"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                to="/resort"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Back to Resort
              </Link>
            </div>
            </>
          ) : (
            /* DETAILS */
            <div className="mt-2 bg-white rounded-xl shadow-md p-6 md:p-8">
              <button
                onClick={backToGrid}
                className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
              >
                <span>←</span> Back to All Rooms
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <img
                    src={selectedRoom.img}
                    alt={selectedRoom.name}
                    className="w-full h-[400px] object-cover rounded-lg"
                    loading="lazy"
                  />
                </div>

                <div>
                  {selectedRoom.badge ? (
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-2 ${selectedRoom.badge.className} text-white`}>
                      {selectedRoom.badge.text}
                    </span>
                  ) : null}

                  <h2 className="text-3xl font-bold text-gray-900 mb-4">{selectedRoom.name}</h2>
                  <p className="text-gray-600 mb-6">{selectedRoom.detailsDescription || selectedRoom.desc}</p>

                  <h3 className="text-xl font-bold text-gray-900 mb-3">Room Amenities</h3>
                  <ul className="mb-6 space-y-2">
                    {(selectedRoom.amenities || []).map((a) => (
                      <li key={a} className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-blue-600">✓</span>
                        </div>
                        <span className="text-gray-600">{a}</span>
                      </li>
                    ))}
                  </ul>

                  <h3 className="text-xl font-bold text-gray-900 mb-3">Room Details</h3>
                  <div className="grid grid-cols-2 gap-4 mb-6 text-gray-700">
                    <div className="space-y-2">
                      <p><span className="text-blue-600">📐</span> {selectedRoom.size}</p>
                      <p><span className="text-blue-600">🛏️</span> {selectedRoom.beds}</p>
                    </div>
                    <div className="space-y-2">
                      <p><span className="text-blue-600">👤</span> {selectedRoom.occupancy}</p>
                      <p><span className="text-blue-600">🏝️</span> {selectedRoom.view}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-blue-50 rounded-lg">
                    <div>
                      <span className="text-2xl font-bold text-blue-600">₱{selectedRoom.price}</span>
                      <span className="text-gray-500"> / night</span>
                    </div>
                    <button
                      onClick={() => openBooking(selectedRoom.name)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium"
                    >
                      Book This Room
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}