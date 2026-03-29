import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { createBooking } from "../../lib/bookingApi.js";
import { createPaymentLink, getPaymentStatus } from "../../lib/paymentApi.js";
import { api } from "../../lib/api.js";

// Day visit: check-in slots 7AM–4PM (check-out capped at 5PM)
const DAY_TIME_SLOTS = [
  { label: "7:00 AM",  value: "07:00", end: "3:00 PM"  },
  { label: "8:00 AM",  value: "08:00", end: "4:00 PM"  },
  { label: "9:00 AM",  value: "09:00", end: "5:00 PM"  },
  { label: "10:00 AM", value: "10:00", end: "5:00 PM"  },
  { label: "11:00 AM", value: "11:00", end: "5:00 PM"  },
  { label: "12:00 PM", value: "12:00", end: "5:00 PM"  },
  { label: "1:00 PM",  value: "13:00", end: "5:00 PM"  },
  { label: "2:00 PM",  value: "14:00", end: "5:00 PM"  },
  { label: "3:00 PM",  value: "15:00", end: "5:00 PM"  },
  { label: "4:00 PM",  value: "16:00", end: "5:00 PM"  },
];

// Fallback defaults — replaced immediately by /api/pricing on mount
const DEFAULTS = {
  day_rate:         1500,
  overnight_rate:   2000,
  reservation_fee:  150,
  free_guest_limit: 5,
  extra_guest_fee:  50,
  entrance_fee:     50,
};

const MAX_GUESTS = 20;
const MIN_GUESTS = 1;

function formatPHP(n) {
  return `₱${Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BookingModal({ open, onClose, selectedRoom, rooms, onBooked }) {
  const modalRef = useRef(null);
  const [bookingType, setBookingType] = useState("day"); // "day" | "overnight"
  const [visitDate, setVisitDate]     = useState("");
  const [visitTime, setVisitTime]     = useState("09:00");
  const [roomType, setRoomType]       = useState(selectedRoom || "");
  const [guests, setGuests]           = useState(2);
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");
  // Payment popup state: { bookingId, popup } while waiting for payment
  const [paymentPopup, setPaymentPopup] = useState(null);

  // Pricing fetched from /api/pricing (admin-configurable)
  const [pricing,    setPricing]    = useState(DEFAULTS);
  const [rawPricing, setRawPricing] = useState(null);

  // Room availability: { [roomName]: true|false } — null means not yet checked
  const [availability,     setAvailability]     = useState(null);
  const [availChecking,    setAvailChecking]    = useState(false);

  // Fetch pricing once on mount
  useEffect(() => {
    api.get("/api/pricing")
      .then(r => {
        const d = r.data?.data ?? {};
        setRawPricing(d);
      })
      .catch(() => { /* keep defaults on network error */ });
  }, []);

  // Re-derive rates whenever raw data or selected room changes
  useEffect(() => {
    if (!rawPricing) return;
    const roomList    = rawPricing.rooms ?? [];
    const matchedRoom = roomList.find(rm => rm.name === roomType) ?? roomList[0];
    setPricing({
      day_rate:         Number(matchedRoom?.day_rate        ?? DEFAULTS.day_rate),
      overnight_rate:   Number(matchedRoom?.overnight_rate  ?? DEFAULTS.overnight_rate),
      reservation_fee:  Number(rawPricing.reservation_fee   ?? DEFAULTS.reservation_fee),
      free_guest_limit: Number(rawPricing.free_guest_limit  ?? DEFAULTS.free_guest_limit),
      extra_guest_fee:  Number(rawPricing.extra_guest_fee   ?? DEFAULTS.extra_guest_fee),
      entrance_fee:     Number(rawPricing.entrance_fee      ?? DEFAULTS.entrance_fee),
    });
  }, [rawPricing, roomType]);

  // Check room availability whenever date, time, or booking type changes
  useEffect(() => {
    if (!visitDate) { setAvailability(null); return; }
    // For overnight we only need the date; for day visits we also need a time
    const params = new URLSearchParams({
      date:      visitDate,
      time:      visitTime,
      overnight: bookingType === "overnight" ? "1" : "0",
    });
    setAvailChecking(true);
    api.get(`/api/availability?${params}`)
      .then(r => {
        const map = {};
        (r.data?.data ?? []).forEach(rm => { map[rm.name] = rm.available; });
        setAvailability(map);
      })
      .catch(() => setAvailability(null)) // on error, show no indicators
      .finally(() => setAvailChecking(false));
  }, [visitDate, visitTime, bookingType]);

  // Scroll modal to top whenever an error appears so it's always visible
  useEffect(() => {
    if (error && modalRef.current) {
      const scrollParent = modalRef.current.closest(".overflow-y-auto");
      if (scrollParent) scrollParent.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [error]);

  // Poll payment status while the PayMongo popup is open
  useEffect(() => {
    if (!paymentPopup) return;
    const { bookingId, popup } = paymentPopup;

    const interval = setInterval(async () => {
      // User closed the popup manually without completing payment
      if (popup.closed) {
        clearInterval(interval);
        setPaymentPopup(null);
        setError("Payment window was closed. Your booking is saved — you can reopen the payment window by trying again.");
        return;
      }
      // Check if payment went through
      try {
        const status = await getPaymentStatus(bookingId);
        if (status.paid) {
          clearInterval(interval);
          try { popup.close(); } catch { /* ignore cross-origin close errors */ }
          setPaymentPopup(null);
          onBooked?.();
          onClose();
        }
      } catch {
        // ignore transient polling errors; keep trying
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [paymentPopup, onBooked, onClose]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setRoomType(selectedRoom || "");
      setVisitDate("");
      setError("");
      setBookingType("day");
      setAvailability(null);
      setPaymentPopup(null);
    }
  }, [open, selectedRoom]);

  // ── Available time slots (hide past slots when date is today) ─────────────
  const availableSlots = useMemo(() => {
    if (visitDate !== todayStr()) return DAY_TIME_SLOTS;
    const now     = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return DAY_TIME_SLOTS.filter(s => {
      const [hh, mm] = s.value.split(":").map(Number);
      return hh * 60 + mm > nowMins;
    });
  }, [visitDate]);

  // Auto-advance to earliest valid slot whenever the available list changes
  useEffect(() => {
    if (availableSlots.length === 0) return;
    const stillValid = availableSlots.some(s => s.value === visitTime);
    if (!stillValid) setVisitTime(availableSlots[0].value);
  }, [availableSlots]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived pricing ────────────────────────────────────────────────────────
  const isOvernight = bookingType === "overnight";
  const baseRate    = isOvernight ? pricing.overnight_rate : pricing.day_rate;
  const extraGuests = Math.max(0, guests - pricing.free_guest_limit);
  const extraCharge = extraGuests * pricing.extra_guest_fee;
  const entranceFee = guests * pricing.entrance_fee;

  const totalRate  = baseRate + extraCharge + entranceFee;
  const balanceDue = totalRate - pricing.reservation_fee;

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function submit(e) {
    e.preventDefault();
    setError("");

    if (!visitDate) { setError("Please select a visit date."); return; }
    if (!roomType)  { setError("Please select a room type."); return; }

    const room = rooms.find((r) => r.name === roomType);
    if (!room?.id) { setError("Could not determine room. Please try again."); return; }

    const checkIn = isOvernight
      ? `${visitDate} 18:00:00`
      : `${visitDate} ${visitTime}:00`;

    setSubmitting(true);
    try {
      const result = await createBooking({
        room_id:          room.id,
        check_in:         checkIn,
        guests:           guests,
        payment_method:   "Online",
        special_requests: specialRequests || null,
        overnight:        isOvernight,
      });

      const bookingId = result.data?.id;
      const { checkout_url } = await createPaymentLink(bookingId);

      // Open PayMongo in a small centered popup so the main page stays visible
      const pw = 600, ph = 700;
      const pl = Math.round(window.screen.width  / 2 - pw / 2);
      const pt = Math.round(window.screen.height / 2 - ph / 2);
      const popup = window.open(
        checkout_url,
        "paymongo_checkout",
        `width=${pw},height=${ph},left=${pl},top=${pt},resizable=yes,scrollbars=yes`
      );

      if (!popup || popup.closed) {
        // Popup blocked by browser — fall back to full redirect
        window.location.href = checkout_url;
        return;
      }

      setPaymentPopup({ bookingId, popup });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Booking failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-2xl">
      <div className="p-6" ref={modalRef}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-2xl font-bold text-gray-900">Book Your Visit at Aplaya</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Booking type */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Booking Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBookingType("day")}
                  className={`flex items-center gap-3 p-4 border-2 rounded-xl transition-colors ${
                    !isOvernight ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <i className={`fas fa-sun text-2xl ${!isOvernight ? "text-blue-500" : "text-gray-300"}`}></i>
                  <div className="text-left">
                    <p className={`font-semibold ${!isOvernight ? "text-blue-700" : "text-gray-700"}`}>Day Visit</p>
                    <p className="text-xs text-gray-500">7:00 AM – 5:00 PM · {formatPHP(pricing.day_rate)}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setBookingType("overnight")}
                  className={`flex items-center gap-3 p-4 border-2 rounded-xl transition-colors ${
                    isOvernight ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <i className={`fas fa-moon text-2xl ${isOvernight ? "text-indigo-500" : "text-gray-300"}`}></i>
                  <div className="text-left">
                    <p className={`font-semibold ${isOvernight ? "text-indigo-700" : "text-gray-700"}`}>Overnight</p>
                    <p className="text-xs text-gray-500">6:00 PM – 6:00 AM · {formatPHP(pricing.overnight_rate)}</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Visit date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isOvernight ? "Night" : "Visit Date"} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                min={todayStr()}
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Time slot — day only */}
            {!isOvernight ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal ml-1">(up to 8 hrs, ends by 5PM)</span>
                </label>
                {availableSlots.length === 0 ? (
                  <div className="w-full px-4 py-2 border border-red-200 bg-red-50 rounded-md text-red-700 text-sm flex items-center gap-2">
                    <i className="fas fa-clock"></i>
                    No day visit slots available for today. Please select a future date or choose Overnight.
                  </div>
                ) : (
                  <select
                    value={visitTime}
                    onChange={(e) => setVisitTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableSlots.map((s) => (
                      <option key={s.value} value={s.value}>{s.label} – {s.end}</option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-in / Check-out</label>
                <div className="w-full px-4 py-2 border border-indigo-200 bg-indigo-50 rounded-md text-indigo-700 font-medium flex items-center gap-2">
                  <i className="fas fa-moon"></i> 6:00 PM → 6:00 AM (next day)
                </div>
              </div>
            )}

            {/* Room type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room Type <span className="text-red-500">*</span>
                {availChecking && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    <i className="fas fa-spinner fa-spin mr-1"></i>Checking availability…
                  </span>
                )}
              </label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Room Type</option>
                {rooms.map((r) => {
                  const avail = availability?.[r.name];
                  const label = availability === null
                    ? r.name
                    : avail === false
                    ? `${r.name} — Not Available`
                    : `${r.name} — Available`;
                  return (
                    <option key={r.name} value={r.name} disabled={avail === false}>
                      {label}
                    </option>
                  );
                })}
              </select>
              {/* Availability badge for selected room */}
              {availability !== null && roomType && (
                availability[roomType] === false ? (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <i className="fas fa-times-circle"></i>
                    This room is already booked for the selected date and time. Please choose another.
                  </p>
                ) : availability[roomType] === true ? (
                  <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                    <i className="fas fa-check-circle"></i>
                    Available for the selected slot.
                  </p>
                ) : null
              )}
            </div>

            {/* Guests */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Guests <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1">(max {MAX_GUESTS})</span>
              </label>
              <div className="flex items-center border border-gray-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                <button
                  type="button"
                  onClick={() => setGuests((g) => Math.max(MIN_GUESTS, g - 1))}
                  disabled={guests <= MIN_GUESTS}
                  className="px-4 py-2 text-xl font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed select-none"
                >−</button>
                <input
                  type="number"
                  min={MIN_GUESTS}
                  max={MAX_GUESTS}
                  value={guests}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setGuests(Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, val)));
                  }}
                  className="flex-1 text-center py-2 text-gray-900 font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setGuests((g) => Math.min(MAX_GUESTS, g + 1))}
                  disabled={guests >= MAX_GUESTS}
                  className="px-4 py-2 text-xl font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed select-none"
                >+</button>
              </div>
            </div>

            {/* Special requests */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Requests <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any special requests?"
              />
            </div>

            {/* Full-width bottom section */}
            <div className="md:col-span-2">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <span className="font-medium">Cancellation Policy:</span> Cancellations or no-shows will result in the
                  forfeiture of the {formatPHP(pricing.reservation_fee)} reservation fee.
                </p>
              </div>

              {/* Payment summary */}
              <div className="bg-blue-50 p-4 rounded-md mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Payment Summary</h4>
                <div className="flex justify-between mb-1 text-sm">
                  <span className="text-gray-600">
                    {isOvernight
                      ? "Overnight rate:"
                      : `Day visit rate (up to ${pricing.free_guest_limit} guests):`}
                  </span>
                  <span className="font-medium">{formatPHP(baseRate)}</span>
                </div>
                {extraGuests > 0 && (
                  <div className="flex justify-between mb-1 text-sm">
                    <span className="text-orange-600">
                      Extra guests ({extraGuests} × {formatPHP(pricing.extra_guest_fee)}):
                    </span>
                    <span className="text-orange-600 font-medium">+ {formatPHP(extraCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between mb-1 text-sm">
                  <span className="text-gray-600">
                    <i className="fas fa-ticket-alt mr-1 text-xs"></i>
                    Entrance fee ({guests} × {formatPHP(pricing.entrance_fee)} · children 3 &amp; below free):
                  </span>
                  <span className="font-medium">{formatPHP(entranceFee)}</span>
                </div>

                <div className="flex justify-between mb-1 text-sm font-medium border-t border-blue-200 pt-2 mt-1">
                  <span className="text-gray-700">Total Rate:</span>
                  <span className="text-gray-900">{formatPHP(totalRate)}</span>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-2 mt-2">
                  <span className="text-gray-900 font-bold">Reservation Fee (Due Now):</span>
                  <span className="text-blue-700 font-bold text-lg">{formatPHP(pricing.reservation_fee)}</span>
                </div>
                <div className="flex justify-between mt-1 text-sm">
                  <span className="text-gray-600">Balance Due at Check-in:</span>
                  <span className="text-gray-900 font-medium">{formatPHP(balanceDue)}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-2">
                <span className="text-blue-500 mt-0.5">🔒</span>
                <span>
                  A secure <span className="font-medium">PayMongo</span> checkout window will open for you to pay the
                  reservation fee via <span className="font-medium">GCash, Maya, or Credit/Debit Card</span>.
                  This page will stay open in the background.
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <i className="fas fa-exclamation-circle mt-0.5 shrink-0"></i>
              <span>{error}</span>
            </div>
          )}

          {paymentPopup ? (
            <div className="flex flex-col items-center gap-3 py-4 bg-blue-50 rounded-md">
              <i className="fas fa-spinner fa-spin text-blue-600 text-2xl"></i>
              <p className="text-sm font-medium text-blue-800">Waiting for payment in the checkout window…</p>
              <p className="text-xs text-blue-600">Complete payment there, or close this modal to cancel.</p>
              <button
                type="button"
                onClick={() => {
                  try { paymentPopup.popup?.focus(); } catch { /* ignore */ }
                }}
                className="px-4 py-1.5 border border-blue-400 text-blue-700 rounded text-sm hover:bg-blue-100"
              >
                <i className="fas fa-external-link-alt mr-1"></i>Bring payment window to front
              </button>
            </div>
          ) : (
            <button
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-3 px-4 rounded-md"
            >
              {submitting ? "Opening checkout window..." : `Pay ${formatPHP(pricing.reservation_fee)} Online →`}
            </button>
          )}
        </form>
      </div>
    </Modal>
  );
}
