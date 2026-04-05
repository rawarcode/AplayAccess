import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { createBooking, createGuestBooking, cancelBooking, cancelGuestBooking, createGuestPaymentLink, getGuestPaymentStatus, guestConfirmPayment } from "../../lib/bookingApi.js";
import { createPaymentLink, getPaymentStatus } from "../../lib/paymentApi.js";
import { api } from "../../lib/api.js";
import { validatePromo } from "../../lib/adminApi.js";

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

export default function BookingModal({ open, onClose, selectedRoom, rooms, onBooked, guestMode = false }) {
  const modalRef        = useRef(null);
  const bookingResultRef = useRef(null); // stores API response after booking created
  const [bookingType, setBookingType] = useState("day"); // "day" | "overnight"
  const [visitDate, setVisitDate]     = useState("");
  const [visitTime, setVisitTime]     = useState("09:00");
  const [roomType, setRoomType]       = useState(selectedRoom || "");
  const [guests, setGuests]           = useState(2);
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState("");
  const [confirmOpen,  setConfirmOpen]  = useState(false);

  // Guest mode — contact info collected when booking without an account
  const [guestName,  setGuestName]  = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  // Payment popup state: { bookingId, checkoutUrl, popup } while waiting for payment
  // popup can be null when the user closed the window (we keep bookingId/checkoutUrl for reopen)
  const [paymentPopup, setPaymentPopup] = useState(null);
  // Countdown in seconds — starts at 5 min, auto-cancels at 0
  const [timeLeft, setTimeLeft] = useState(null);

  // Pricing fetched from /api/pricing (admin-configurable)
  const [pricing,    setPricing]    = useState(DEFAULTS);
  const [rawPricing, setRawPricing] = useState(null);

  // Payment option: "reservation" = pay reservation fee only | "full" = pay full amount now
  const [paymentOption, setPaymentOption] = useState("reservation");

  // Promo code
  const [promoInput,   setPromoInput]   = useState("");
  const [promoResult,  setPromoResult]  = useState(null);  // { discount_amount, message, type, value }
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError,   setPromoError]   = useState("");

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

  // Listen for postMessage from PaymentReturn page running inside the popup.
  // This fires immediately when PayMongo redirects to our /payment/success page.
  useEffect(() => {
    if (!paymentPopup?.bookingId) return;

    function handleMessage(event) {
      if (event.data?.type === "paymongo_paid") {
        const bId = paymentPopup?.bookingId;
        try { paymentPopup?.popup?.close(); } catch { /* ignore */ }
        setPaymentPopup(null);
        setTimeLeft(null);
        // Directly confirm via backend — PayMongo only redirects here on real payment
        const finish = () => { onBooked?.(bookingResultRef.current); onClose(); };
        if (bId) {
          const fullyPaid = paymentOption === "full";
          const confirmCall = guestMode
            ? guestConfirmPayment(bId, fullyPaid)
            : api.post(`/api/bookings/${bId}/confirm-payment`, { fully_paid: fullyPaid });
          confirmCall.then(finish).catch(finish);
        } else {
          finish();
        }
      }
      if (event.data?.type === "paymongo_cancelled") {
        // Don't destroy state — keep bookingId + checkoutUrl so the user can retry.
        // Just null out the popup reference so the "Reopen" UI appears.
        try { paymentPopup?.popup?.close(); } catch { /* ignore */ }
        setPaymentPopup(prev => prev ? { ...prev, popup: null } : null);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [paymentPopup, onBooked, onClose]);

  // Poll payment status as fallback (runs whether popup is open or closed)
  useEffect(() => {
    if (!paymentPopup?.bookingId) return;
    const { bookingId, popup } = paymentPopup;

    const interval = setInterval(async () => {
      // Popup just closed — keep state but show "Reopen" button
      if (popup && popup.closed) {
        setPaymentPopup(prev => prev ? { ...prev, popup: null } : null);
        return;
      }
      // Check if payment went through on PayMongo
      try {
        const status = guestMode
          ? await getGuestPaymentStatus(bookingId)
          : await getPaymentStatus(bookingId);
        if (status.paid) {
          clearInterval(interval);
          try { popup?.close(); } catch { /* ignore */ }
          setPaymentPopup(null);
          setTimeLeft(null);
          onBooked?.(bookingResultRef.current);
          onClose();
        }
      } catch {
        // ignore transient polling errors; keep trying
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [paymentPopup, onBooked, onClose]);

  // Countdown timer — decrements every second while payment is pending
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      // Time expired — cancel the booking automatically
      const bId = paymentPopup?.bookingId;
      try { paymentPopup?.popup?.close(); } catch { /* ignore */ }
      setPaymentPopup(null);
      setTimeLeft(null);
      if (bId) {
        (guestMode ? cancelGuestBooking(bId) : cancelBooking(bId)).catch(() => {});
      }
      setError("Payment timed out (5 minutes). Your booking was automatically cancelled.");
      return;
    }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, paymentPopup]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setRoomType(selectedRoom || "");
      setVisitDate("");
      setError("");
      setBookingType("day");
      setAvailability(null);
      setPaymentPopup(null);
      setTimeLeft(null);
      setPromoInput("");
      setPromoResult(null);
      setPromoError("");
      setPaymentOption("reservation");
      setConfirmOpen(false);
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
    }
  }, [open, selectedRoom]);

  // ── Max guests: use selected room's capacity, fall back to MAX_GUESTS ──────
  const maxGuests = useMemo(() => {
    const r = rooms.find(r => r.name === roomType);
    return r?.capacity || MAX_GUESTS;
  }, [rooms, roomType]);

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
  const isOvernight  = bookingType === "overnight";
  const baseRate     = isOvernight ? pricing.overnight_rate : pricing.day_rate;
  const extraGuests  = Math.max(0, guests - pricing.free_guest_limit);
  const extraCharge  = extraGuests * pricing.extra_guest_fee;
  const entranceFee  = guests * pricing.entrance_fee;
  const totalRate    = baseRate + extraCharge + entranceFee;
  const discount        = promoResult?.discount_amount ?? 0;
  const discountedTotal = Math.max(totalRate - discount, pricing.reservation_fee);
  const amountDue       = paymentOption === "full" ? discountedTotal : pricing.reservation_fee;
  const balanceDue      = discountedTotal - amountDue;

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setPromoLoading(true);
    setPromoError("");
    setPromoResult(null);
    try {
      const res = await validatePromo(code, totalRate);
      const d   = res.data;
      if (d.valid) {
        setPromoResult(d);
      } else {
        setPromoError(d.message || "Invalid promo code.");
      }
    } catch {
      setPromoError("Could not validate promo code. Please try again.");
    } finally {
      setPromoLoading(false);
    }
  }

  function removePromo() {
    setPromoResult(null);
    setPromoInput("");
    setPromoError("");
  }

  // ── Step 1: validate → show confirmation ──────────────────────────────────
  function submit(e) {
    e.preventDefault();
    setError("");
    // Guest mode: require contact info
    if (guestMode) {
      if (!guestName.trim())  { setError("Please enter your full name."); return; }
      if (!guestEmail.trim()) { setError("Please enter your email address."); return; }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(guestEmail.trim())) { setError("Please enter a valid email address."); return; }
    }
    if (!visitDate) { setError("Please select a visit date."); return; }
    if (!roomType)  { setError("Please select a room type."); return; }
    const room = rooms.find((r) => r.name === roomType);
    if (!room?.id)  { setError("Could not determine room. Please try again."); return; }
    setConfirmOpen(true);
  }

  // ── Step 2: confirmed → call API ───────────────────────────────────────────
  async function handleConfirm() {
    setError("");
    const room = rooms.find((r) => r.name === roomType);
    if (!room?.id) { setError("Could not determine room. Please try again."); return; }

    const checkIn = isOvernight
      ? `${visitDate} 18:00:00`
      : `${visitDate} ${visitTime}:00`;

    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const bookingPayload = {
        room_id:          room.id,
        check_in:         checkIn,
        guests:           guests,
        payment_method:   "Online",
        special_requests: specialRequests || null,
        overnight:        isOvernight,
        promo_code:       promoResult ? promoInput.trim().toUpperCase() : null,
        discount:         discount,
      };

      // Guest mode: add contact info + use public endpoint
      if (guestMode) {
        bookingPayload.guest_name  = guestName.trim();
        bookingPayload.guest_email = guestEmail.trim();
        bookingPayload.guest_phone = guestPhone.trim() || null;
      }

      const result = guestMode
        ? await createGuestBooking(bookingPayload)
        : await createBooking(bookingPayload);

      bookingResultRef.current = result.data?.data ?? result.data;
      const bookingId = result.data?.data?.id ?? result.data?.id;
      const { checkout_url } = guestMode
        ? await createGuestPaymentLink(bookingId, paymentOption === "full")
        : await createPaymentLink(bookingId, paymentOption === "full");

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

      setPaymentPopup({ bookingId, checkoutUrl: checkout_url, popup });
      setTimeLeft(5 * 60); // 5-minute window to complete payment
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
          <h3 className="text-2xl font-bold text-gray-900">
            Book Your Visit at Aplaya
            {guestMode && <span className="ml-2 text-sm font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Guest</span>}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Guest info — shown only in guest (no-account) mode */}
            {guestMode && (
              <div className="md:col-span-2">
                <div className="mb-4 rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 flex items-start gap-3">
                  <i className="fas fa-user-secret text-amber-500 mt-0.5 shrink-0"></i>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Booking as Guest</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      We need your contact details to send your booking confirmation. You won't be able to manage this booking online.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={guestName}
                      onChange={e => setGuestName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={guestEmail}
                      onChange={e => setGuestEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number <span className="text-gray-400 font-normal text-xs">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={e => setGuestPhone(e.target.value)}
                      placeholder="+63 9xx xxx xxxx"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <hr className="my-5 border-gray-200" />
              </div>
            )}

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
                {rooms
                  .filter(r => availability === null || availability?.[r.name] !== false)
                  .map((r) => (
                    <option key={r.name} value={r.name}>{r.name}</option>
                  ))}
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
                <span className="text-gray-400 font-normal ml-1">(max {maxGuests})</span>
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
                  max={maxGuests}
                  value={guests}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setGuests(Math.min(maxGuests, Math.max(MIN_GUESTS, val)));
                  }}
                  className="flex-1 text-center py-2 text-gray-900 font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setGuests((g) => Math.min(maxGuests, g + 1))}
                  disabled={guests >= maxGuests}
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

              {/* Promo code input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <i className="fas fa-tag mr-1 text-blue-500"></i>Promo Code <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                {promoResult ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-300 rounded-md">
                    <i className="fas fa-check-circle text-green-600"></i>
                    <span className="text-sm text-green-800 font-medium flex-1">{promoResult.message}</span>
                    <button type="button" onClick={removePromo} className="text-xs text-gray-500 hover:text-red-600 underline">Remove</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(""); }}
                      onKeyDown={e => e.key === "Enter" && (e.preventDefault(), applyPromo())}
                      placeholder="Enter promo code"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={applyPromo}
                      disabled={!promoInput.trim() || promoLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"
                    >
                      {promoLoading ? <i className="fas fa-spinner fa-spin"></i> : "Apply"}
                    </button>
                  </div>
                )}
                {promoError && <p className="mt-1 text-xs text-red-600"><i className="fas fa-times-circle mr-1"></i>{promoError}</p>}
              </div>

              {/* Payment option selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="fas fa-wallet mr-1 text-blue-500"></i>Payment Option
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentOption("reservation")}
                    className={`flex flex-col items-start p-3 border-2 rounded-xl transition-colors text-left ${
                      paymentOption === "reservation"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className={`text-xs font-semibold uppercase tracking-wide mb-1 ${paymentOption === "reservation" ? "text-blue-600" : "text-gray-500"}`}>
                      <i className="fas fa-bookmark mr-1"></i>Reserve Only
                    </span>
                    <span className={`text-base font-bold ${paymentOption === "reservation" ? "text-blue-700" : "text-gray-700"}`}>
                      {formatPHP(pricing.reservation_fee)} now
                    </span>
                    <span className="text-xs text-gray-500 mt-0.5">
                      Pay {formatPHP(Math.max(discountedTotal - pricing.reservation_fee, 0))} at check-in
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentOption("full")}
                    className={`flex flex-col items-start p-3 border-2 rounded-xl transition-colors text-left ${
                      paymentOption === "full"
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className={`text-xs font-semibold uppercase tracking-wide mb-1 ${paymentOption === "full" ? "text-emerald-600" : "text-gray-500"}`}>
                      <i className="fas fa-check-circle mr-1"></i>Pay in Full
                    </span>
                    <span className={`text-base font-bold ${paymentOption === "full" ? "text-emerald-700" : "text-gray-700"}`}>
                      {formatPHP(discountedTotal)} now
                    </span>
                    <span className="text-xs text-gray-500 mt-0.5">
                      ₱0 balance · fully paid
                    </span>
                  </button>
                </div>
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
                  <span className="text-gray-700">Subtotal:</span>
                  <span className={discount > 0 ? "line-through text-gray-400" : "text-gray-900"}>{formatPHP(totalRate)}</span>
                </div>
                {discount > 0 && (
                  <>
                    <div className="flex justify-between mb-1 text-sm text-green-700 font-medium">
                      <span><i className="fas fa-tag mr-1"></i>Promo ({promoInput}):</span>
                      <span>− {formatPHP(discount)}</span>
                    </div>
                    <div className="flex justify-between mb-1 text-sm font-semibold">
                      <span className="text-gray-800">Total Rate:</span>
                      <span className="text-gray-900">{formatPHP(discountedTotal)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-t border-blue-200 pt-2 mt-2">
                  <span className="text-gray-900 font-bold">
                    {paymentOption === "full" ? "Total Due Now:" : "Reservation Fee (Due Now):"}
                  </span>
                  <span className="text-blue-700 font-bold text-lg">{formatPHP(amountDue)}</span>
                </div>
                <div className="flex justify-between mt-1 text-sm">
                  <span className="text-gray-600">Balance Due at Check-in:</span>
                  <span className={`font-medium ${balanceDue === 0 ? "text-emerald-600" : "text-gray-900"}`}>
                    {balanceDue === 0 ? "₱0.00 — Fully Paid" : formatPHP(balanceDue)}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-2">
                <span className="text-blue-500 mt-0.5">🔒</span>
                <span>
                  A secure <span className="font-medium">PayMongo</span> checkout window will open for you to pay{" "}
                  <span className="font-medium">{formatPHP(amountDue)}</span> via{" "}
                  <span className="font-medium">GCash, Maya, or Credit/Debit Card</span>.
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
            paymentPopup.popup ? (
              /* Popup is open — show waiting state with countdown */
              <div className="flex flex-col items-center gap-3 py-4 bg-blue-50 border border-blue-200 rounded-md">
                <i className="fas fa-spinner fa-spin text-blue-600 text-2xl"></i>
                <p className="text-sm font-medium text-blue-800">Waiting for payment in the checkout window…</p>
                {timeLeft !== null && (
                  <p className={`text-xs font-semibold ${timeLeft <= 60 ? "text-red-600" : "text-blue-600"}`}>
                    <i className="fas fa-clock mr-1"></i>
                    Expires in {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { try { paymentPopup.popup?.focus(); } catch { /* ignore */ } }}
                    className="px-4 py-1.5 border border-blue-400 text-blue-700 rounded text-sm hover:bg-blue-100"
                  >
                    <i className="fas fa-external-link-alt mr-1"></i>Bring to front
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const bId = paymentPopup.bookingId;
                      try { paymentPopup.popup?.close(); } catch { /* ignore */ }
                      setPaymentPopup(null);
                      setTimeLeft(null);
                      if (bId) {
                        (guestMode ? cancelGuestBooking(bId) : cancelBooking(bId)).catch(() => {});
                      }
                      setError("Booking cancelled.");
                    }}
                    className="px-4 py-1.5 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Popup was closed — offer to reopen */
              <div className="flex flex-col items-center gap-3 py-4 bg-amber-50 border border-amber-200 rounded-md">
                <i className="fas fa-window-restore text-amber-500 text-2xl"></i>
                <p className="text-sm font-medium text-amber-800">Payment window was closed.</p>
                <p className="text-xs text-amber-700">Your booking is saved. Reopen the window to complete payment.</p>
                {timeLeft !== null && (
                  <p className={`text-xs font-semibold ${timeLeft <= 60 ? "text-red-600" : "text-amber-600"}`}>
                    <i className="fas fa-clock mr-1"></i>
                    Time remaining: {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const { checkoutUrl, bookingId } = paymentPopup;
                      const pw = 600, ph = 700;
                      const pl = Math.round(window.screen.width  / 2 - pw / 2);
                      const pt = Math.round(window.screen.height / 2 - ph / 2);
                      const newPopup = window.open(
                        checkoutUrl, "paymongo_checkout",
                        `width=${pw},height=${ph},left=${pl},top=${pt},resizable=yes,scrollbars=yes`
                      );
                      if (!newPopup || newPopup.closed) {
                        window.location.href = checkoutUrl;
                        return;
                      }
                      setPaymentPopup({ bookingId, checkoutUrl, popup: newPopup });
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-medium"
                  >
                    <i className="fas fa-redo mr-1"></i>Reopen Payment Window
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const bId = paymentPopup.bookingId;
                      setPaymentPopup(null);
                      setTimeLeft(null);
                      if (bId) {
                        (guestMode ? cancelGuestBooking(bId) : cancelBooking(bId)).catch(() => {});
                      }
                      setError("Booking cancelled.");
                    }}
                    className="px-4 py-1.5 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50"
                  >
                    Cancel Booking
                  </button>
                </div>
              </div>
            )
          ) : (
            <button
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-3 px-4 rounded-md flex items-center justify-center gap-2"
            >
              {submitting
                ? <><i className="fas fa-spinner fa-spin"></i> Opening checkout window...</>
                : <><i className="fas fa-eye"></i> Review Booking</>}
            </button>
          )}
        </form>

        {/* ── Booking Confirmation ── */}
        {confirmOpen && (
          <div className="fixed inset-0 z-[60] overflow-y-auto flex items-center justify-center px-4 py-10">
            <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmOpen(false)} />
            <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 text-white">
                  <i className="fas fa-clipboard-check text-xl"></i>
                  <div>
                    <h3 className="font-bold text-lg">Booking Summary</h3>
                    <p className="text-blue-100 text-xs">Please review before proceeding to payment</p>
                  </div>
                </div>
                <button onClick={() => setConfirmOpen(false)} className="text-white/70 hover:text-white text-lg">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                {/* Booking Type Badge */}
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                    isOvernight ? "bg-indigo-100 text-indigo-800" : "bg-blue-100 text-blue-800"
                  }`}>
                    <i className={`fas ${isOvernight ? "fa-moon" : "fa-sun"}`}></i>
                    {isOvernight ? "Overnight Stay" : "Day Visit"}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="px-4 py-2.5 text-gray-500 font-medium w-36">Room</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-900">{roomType}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-gray-500 font-medium">Date</td>
                        <td className="px-4 py-2.5 text-gray-900">
                          {visitDate ? new Date(visitDate + "T00:00:00").toLocaleDateString("en-PH", {
                            weekday: "long", year: "numeric", month: "long", day: "numeric"
                          }) : "—"}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-gray-500 font-medium">Check-in</td>
                        <td className="px-4 py-2.5 text-gray-900">
                          {isOvernight ? "6:00 PM" : DAY_TIME_SLOTS.find(s => s.value === visitTime)?.label}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-gray-500 font-medium">Check-out</td>
                        <td className="px-4 py-2.5 text-gray-900">
                          {isOvernight ? "6:00 AM (next day)" : DAY_TIME_SLOTS.find(s => s.value === visitTime)?.end}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-gray-500 font-medium">Guests</td>
                        <td className="px-4 py-2.5 text-gray-900">{guests} {guests === 1 ? "person" : "persons"}</td>
                      </tr>
                      {specialRequests && (
                        <tr>
                          <td className="px-4 py-2.5 text-gray-500 font-medium align-top">Requests</td>
                          <td className="px-4 py-2.5 text-gray-700 italic">"{specialRequests}"</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pricing Breakdown */}
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-2 text-sm">
                  <p className="font-semibold text-blue-900 mb-1">Payment Breakdown</p>
                  <div className="flex justify-between text-gray-700">
                    <span>{isOvernight ? "Overnight rate" : "Day visit rate"}</span>
                    <span>{formatPHP(baseRate)}</span>
                  </div>
                  {extraGuests > 0 && (
                    <div className="flex justify-between text-orange-700">
                      <span>Extra guests ({extraGuests} × {formatPHP(pricing.extra_guest_fee)})</span>
                      <span>+ {formatPHP(extraCharge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-700">
                    <span>Entrance fee ({guests} × {formatPHP(pricing.entrance_fee)})</span>
                    <span>{formatPHP(entranceFee)}</span>
                  </div>
                  {discount > 0 ? (
                    <>
                      <div className="flex justify-between text-gray-400 border-t border-blue-200 pt-2">
                        <span>Subtotal</span>
                        <span className="line-through">{formatPHP(totalRate)}</span>
                      </div>
                      <div className="flex justify-between text-green-700 font-medium">
                        <span><i className="fas fa-tag mr-1 text-xs"></i>Promo ({promoInput.toUpperCase()})</span>
                        <span>− {formatPHP(discount)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-gray-900">
                        <span>Total Rate</span>
                        <span>{formatPHP(discountedTotal)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between font-semibold text-gray-900 border-t border-blue-200 pt-2">
                      <span>Total Rate</span>
                      <span>{formatPHP(totalRate)}</span>
                    </div>
                  )}
                  <div className="border-t border-blue-300 pt-2 flex justify-between font-bold text-blue-800 text-base">
                    <span>{paymentOption === "full" ? "Total (Pay Now)" : "Reservation Fee (Pay Now)"}</span>
                    <span>{formatPHP(amountDue)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Balance at Check-in</span>
                    <span className={`font-medium ${balanceDue === 0 ? "text-emerald-600" : ""}`}>
                      {balanceDue === 0 ? "₱0.00 — Fully Paid" : formatPHP(balanceDue)}
                    </span>
                  </div>
                </div>

                {/* Payment option badge */}
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                  paymentOption === "full"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-blue-50 text-blue-800 border border-blue-200"
                }`}>
                  <i className={`fas ${paymentOption === "full" ? "fa-check-circle text-emerald-600" : "fa-bookmark text-blue-500"}`}></i>
                  {paymentOption === "full"
                    ? `Paying in full — ₱0 balance at check-in`
                    : `Reserve only — balance of ${formatPHP(balanceDue)} due at check-in`}
                </div>

                {/* Payment note */}
                <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-blue-500 mt-0.5">🔒</span>
                  <span>A <span className="font-medium">PayMongo</span> checkout window will open. You can pay via <span className="font-medium">GCash, Maya, or Credit/Debit Card</span>.</span>
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button onClick={() => setConfirmOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <i className="fas fa-arrow-left mr-2"></i>Back
                </button>
                <button onClick={handleConfirm}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                  <i className="fas fa-lock"></i>
                  Confirm &amp; Pay {formatPHP(amountDue)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
