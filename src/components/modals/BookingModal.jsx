import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { createBooking, createGuestBooking, cancelBooking, cancelGuestBooking, createGuestPaymentLink, getGuestPaymentStatus, guestConfirmPayment } from "../../lib/bookingApi.js";
import { createPaymentLink, getPaymentStatus } from "../../lib/paymentApi.js";
import { api } from "../../lib/api.js";
import { validatePromo } from "../../lib/adminApi.js";

// Fallback defaults — replaced immediately by /api/pricing on mount
const DEFAULTS = {
  day_rate:            1500,
  overnight_rate:      1500,
  rate_24hr:           2000,
  reservation_fee_pct: 20,   // % of room rate charged as online reservation fee
};

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
  const [bookingType, setBookingType] = useState("day"); // "day" | "night" | "24hr"
  const [visitDate, setVisitDate]     = useState("");
  const [roomType, setRoomType]       = useState(selectedRoom || "");
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

  // Derive rates from the selected room in the rooms prop (already fetched by parent)
  useEffect(() => {
    const r = rooms.find(rm => rm.name === roomType);
    if (!r) return;
    setPricing({
      day_rate:            Number(r.day_rate        ?? DEFAULTS.day_rate),
      overnight_rate:      Number(r.overnight_rate  ?? DEFAULTS.overnight_rate),
      rate_24hr:           Number(r.rate_24hr       ?? DEFAULTS.rate_24hr),
      reservation_fee_pct: DEFAULTS.reservation_fee_pct,
    });
  }, [rooms, roomType]);

  // Check room availability whenever date, time, or booking type changes
  useEffect(() => {
    if (!visitDate) { setAvailability(null); return; }
    // For overnight we only need the date; for day visits we also need a time
    const params = new URLSearchParams({
      date:         visitDate,
      booking_type: bookingType,
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
  }, [visitDate, bookingType]);

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
        try { paymentPopup?.popup?.close(); } catch { /* ignore */ }
        const bId = paymentPopup?.bookingId;
        setTimeLeft(null);

        const finish = () => { onBooked?.(bookingResultRef.current); onClose(); };

        if (!bId) { finish(); return; }

        if (!guestMode) {
          // Logged-in user: backend trusts the redirect and always succeeds
          setPaymentPopup(prev => prev ? { ...prev, popup: null, redirected: true } : null);
          api.post(`/api/bookings/${bId}/confirm-payment`, { fully_paid: paymentOption === "full" })
            .then(finish).catch(finish);
          return;
        }

        // Guest: call guestConfirmPayment — backend now always confirms when
        // paymongo_link_id exists (trusts the success_url redirect).
        // The 422 check was removed because GCash uses Sources API internally and
        // payment_status never shows 'paid' on localhost without a webhook tunnel.
        setPaymentPopup(prev => prev ? { ...prev, popup: null, redirected: true } : null);
        guestConfirmPayment(bId, paymentOption === "full")
          .then(finish)
          .catch(finish); // backend confirmed — close regardless
      }
      if (event.data?.type === "paymongo_cancelled") {
        try { paymentPopup?.popup?.close(); } catch { /* ignore */ }
        const bId = paymentPopup?.bookingId;
        setTimeLeft(null);

        if (bId && guestMode) {
          // GCash sometimes routes to cancel_url even after successful authorization.
          // guestConfirmPayment now always confirms (trusts redirect, no PayMongo re-check).
          setPaymentPopup(prev => prev ? { ...prev, popup: null, redirected: true } : null);
          const finish = () => { onBooked?.(bookingResultRef.current); onClose(); };
          guestConfirmPayment(bId, paymentOption === "full")
            .then(finish)
            .catch(() => {
              // Confirm failed (booking already cancelled or error) — show reopen UI
              setPaymentPopup(prev => prev ? { ...prev, redirected: false } : null);
            });
        } else {
          setPaymentPopup(prev => prev ? { ...prev, popup: null } : null);
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [paymentPopup, onBooked, onClose]);

  // Poll payment status — runs while waiting for payment (popup open or closed but not yet redirected).
  // Once redirected (postMessage received), the postMessage handler takes over with retry logic.
  useEffect(() => {
    if (!paymentPopup?.bookingId) return;
    if (paymentPopup?.redirected) return; // postMessage handler owns confirmation from here
    const { bookingId, popup } = paymentPopup;

    const interval = setInterval(async () => {
      // Popup just closed by user — keep state but show "Reopen" button
      if (popup && popup.closed) {
        setPaymentPopup(prev => prev ? { ...prev, popup: null } : null);
        return;
      }
      // Check if payment went through (e.g. webhook already confirmed it)
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
        // ignore transient errors; keep polling
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
      setPricing(DEFAULTS);
    }
  }, [open, selectedRoom]);

  // ── Selected room metadata ─────────────────────────────────────────────────
  const selectedRoomObj = useMemo(() => rooms.find(r => r.name === roomType) ?? null, [rooms, roomType]);

  // ── Day unavailable: past 3PM today ───────────────────────────────────────
  const dayUnavailable = useMemo(() => {
    if (visitDate !== todayStr()) return false;
    return new Date().getHours() >= 15; // 3PM cutoff for day booking
  }, [visitDate]);

  // ── Night unavailable: past 6PM today with no available rooms ─────────────
  const nightUnavailable = useMemo(() => {
    if (bookingType !== "night") return false;
    if (visitDate === todayStr() && new Date().getHours() >= 18) return true;
    if (availability !== null) return !Object.values(availability).some(v => v === true);
    return false;
  }, [bookingType, visitDate, availability]);

  // Auto-switch away from Day if it becomes unavailable
  useEffect(() => {
    if (dayUnavailable && bookingType === "day") setBookingType("night");
  }, [dayUnavailable]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived pricing — room rate only, 20% reservation fee ─────────────────
  const baseRate = bookingType === "night"
    ? pricing.overnight_rate
    : bookingType === "24hr"
      ? pricing.rate_24hr
      : pricing.day_rate;
  const discount           = promoResult?.discount_amount ?? 0;
  const discountedTotal    = Math.max(baseRate - discount, 0);
  const reservationFee     = Math.round(discountedTotal * (pricing.reservation_fee_pct / 100));
  const amountDue          = paymentOption === "full" ? discountedTotal : reservationFee;
  const balanceDue         = discountedTotal - amountDue;

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setPromoLoading(true);
    setPromoError("");
    setPromoResult(null);
    try {
      const res = await validatePromo(code, baseRate);
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
    if (nightUnavailable) {
      setError("No rooms available for tonight. Please select a future date."); return;
    }
    if (!roomType)  { setError("Please select a room/cottage."); return; }
    if (availability !== null && availability[roomType] !== true) {
      setError("Selected room is not available for the chosen date. Please select another."); return;
    }
    const room = rooms.find((r) => r.name === roomType);
    if (!room?.id)  { setError("Could not determine room. Please try again."); return; }
    setConfirmOpen(true);
  }

  // ── Step 2: confirmed → call API ───────────────────────────────────────────
  async function handleConfirm() {
    setError("");
    const room = rooms.find((r) => r.name === roomType);
    if (!room?.id) { setError("Could not determine room. Please try again."); return; }

    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const bookingPayload = {
        room_id:          room.id,
        check_in:         visitDate,
        payment_method:   "Online",
        special_requests: specialRequests || null,
        booking_type:     bookingType,
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

      const raw = result.data?.data ?? result.data;
      const fmtDT = (dt) => dt
        ? new Date(dt.replace(' ', 'T')).toLocaleString('en-PH', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
          })
        : '—';
      bookingResultRef.current = {
        roomType:      raw.room?.name ?? '',
        checkIn:       fmtDT(raw.check_in),
        checkOut:      fmtDT(raw.check_out),
        guests:        raw.guests,
        paymentMethod: raw.payment_method,
        totals: {
          reservationFee: raw.reservation_fee ?? 0,
          balanceDue:     Math.max(0, (raw.total ?? 0) - (raw.reservation_fee ?? 0)),
        },
        bookingData: raw,
      };
      const bookingId = raw.id;
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

            {/* Booking type — 3 options */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Booking Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "day",   icon: "fa-sun",   label: "Day Visit",  time: "6:00 AM – 6:00 PM",  color: "blue",   rate: pricing.day_rate,       disabled: dayUnavailable },
                  { key: "night", icon: "fa-moon",  label: "Night",       time: "6:00 PM – 7:00 AM",  color: "indigo", rate: pricing.overnight_rate, disabled: false },
                  { key: "24hr",  icon: "fa-clock", label: "24 Hours",   time: "6:00 AM – 6:00 AM",  color: "purple", rate: pricing.rate_24hr,      disabled: false },
                ].map(({ key, icon, label, time, color, rate, disabled }) => {
                  const active = bookingType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      onClick={() => { if (!disabled) { setBookingType(key); setPromoResult(null); setPromoInput(""); } }}
                      className={`flex flex-col items-center gap-1.5 p-3 border-2 rounded-xl transition-colors text-center ${
                        disabled
                          ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                          : active
                            ? `border-${color}-500 bg-${color}-50`
                            : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <i className={`fas ${icon} text-xl ${active && !disabled ? `text-${color}-500` : "text-gray-300"}`}></i>
                      <p className={`text-sm font-semibold ${active && !disabled ? `text-${color}-700` : "text-gray-700"}`}>{label}</p>
                      <p className="text-xs text-gray-400">{time}</p>
                      <p className={`text-sm font-bold ${active && !disabled ? `text-${color}-700` : "text-gray-500"}`}>
                        {roomType ? formatPHP(rate) : "—"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visit date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                min={todayStr()}
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {nightUnavailable && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <i className="fas fa-moon"></i>
                  No rooms available for tonight. Please select a future date.
                </p>
              )}
            </div>

            {/* Room / Cottage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room / Cottage <span className="text-red-500">*</span>
                {availChecking && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    <i className="fas fa-spinner fa-spin mr-1"></i>Checking…
                  </span>
                )}
              </label>
              <select
                value={roomType}
                onChange={(e) => { setRoomType(e.target.value); setPromoResult(null); setPromoInput(""); }}
                required
                disabled={nightUnavailable}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">{nightUnavailable ? "No rooms available" : "Select Room / Cottage"}</option>
                {rooms
                  .filter(r => availability === null || availability?.[r.name] === true)
                  .map((r) => (
                    <option key={r.name} value={r.name}>{r.name}</option>
                  ))}
              </select>
              {/* Capacity label + availability badge */}
              {selectedRoomObj && (
                <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                  <i className="fas fa-users text-[10px]"></i>
                  Recommended: {selectedRoomObj.capacity_label ?? selectedRoomObj.occupancy ?? `Up to ${selectedRoomObj.capacity} guests`}
                  {availability !== null && roomType && (
                    availability[roomType] === false
                      ? <span className="ml-2 text-red-600"><i className="fas fa-times-circle mr-0.5"></i>Not available</span>
                      : availability[roomType] === true
                        ? <span className="ml-2 text-green-600"><i className="fas fa-check-circle mr-0.5"></i>Available</span>
                        : null
                  )}
                </p>
              )}
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
                  forfeiture of the {pricing.reservation_fee_pct}% reservation fee ({formatPHP(reservationFee)}).
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
                      {formatPHP(reservationFee)} now
                    </span>
                    <span className="text-xs text-gray-500 mt-0.5">
                      Pay {formatPHP(Math.max(discountedTotal - reservationFee, 0))} at check-in
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
                    Room rate ({bookingType === "night" ? "Night" : bookingType === "24hr" ? "24 Hours" : "Day"}):
                  </span>
                  <span className={`font-medium ${discount > 0 ? "line-through text-gray-400" : ""}`}>{formatPHP(baseRate)}</span>
                </div>
                {discount > 0 && (
                  <>
                    <div className="flex justify-between mb-1 text-sm text-green-700 font-medium">
                      <span><i className="fas fa-tag mr-1"></i>Promo ({promoInput}):</span>
                      <span>− {formatPHP(discount)}</span>
                    </div>
                    <div className="flex justify-between mb-1 text-sm font-semibold">
                      <span className="text-gray-800">Discounted Rate:</span>
                      <span className="text-gray-900">{formatPHP(discountedTotal)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between mb-1 text-sm text-gray-500 border-t border-blue-200 pt-2 mt-1">
                  <span>Reservation fee ({pricing.reservation_fee_pct}% — due online):</span>
                  <span>{formatPHP(reservationFee)}</span>
                </div>
                <div className="flex justify-between mt-1 text-sm text-gray-500">
                  <span>Balance due at resort:</span>
                  <span>{formatPHP(discountedTotal - reservationFee)}</span>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-2 mt-2">
                  <span className="text-gray-900 font-bold">
                    {paymentOption === "full" ? "Total Due Now:" : "Pay Online Now:"}
                  </span>
                  <span className="text-blue-700 font-bold text-lg">{formatPHP(amountDue)}</span>
                </div>
                {balanceDue > 0 && (
                  <div className="flex justify-between mt-1 text-sm">
                    <span className="text-gray-600">Balance Due at Check-in:</span>
                    <span className="font-medium text-gray-900">{formatPHP(balanceDue)}</span>
                  </div>
                )}
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                  <i className="fas fa-info-circle mr-1"></i>
                  Entrance fees are collected at the gate upon arrival.
                </p>
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
            paymentPopup.redirected ? (
              /* Payment redirect received — polling is verifying with PayMongo */
              <div className="flex flex-col items-center gap-3 py-4 bg-green-50 border border-green-200 rounded-md">
                <i className="fas fa-spinner fa-spin text-green-600 text-2xl"></i>
                <p className="text-sm font-medium text-green-800">Payment received! Confirming your booking…</p>
                <p className="text-xs text-gray-500">Please wait, this only takes a moment.</p>
              </div>
            ) : paymentPopup.popup ? (
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
            ) : paymentPopup.verifying ? (
              /* Cancel URL received — verifying with PayMongo before giving up */
              <div className="flex flex-col items-center gap-3 py-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <i className="fas fa-spinner fa-spin text-yellow-600 text-2xl"></i>
                <p className="text-sm font-medium text-yellow-800">Verifying payment with PayMongo…</p>
                <p className="text-xs text-gray-500">Please wait — do not close this window.</p>
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
