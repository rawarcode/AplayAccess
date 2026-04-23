import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { createBooking, createGuestBooking, cancelBooking, cancelGuestBooking, createGuestPaymentLink, getGuestPaymentStatus, guestConfirmPayment } from "../../lib/bookingApi.js";
import { createPaymentLink, getPaymentStatus } from "../../lib/paymentApi.js";
import { api } from "../../lib/api.js";
import { validatePromo } from "../../lib/adminApi.js";
import { fmtDateTime } from "../../lib/format";
import HourGridPicker from "../ui/HourGridPicker.jsx";
import { savePendingPayment, clearPendingPayment } from "../../hooks/usePendingPayment.js";
import { useAuth } from "../../context/AuthContext.jsx";
import VerifyEmailModal from "./VerifyEmailModal.jsx";
import useFocusTrap from "../../hooks/useFocusTrap.js";

// Payment countdown length (seconds). Bumped from 5 to 15 min because
// GCash users often need to unlock their phone, open the app, and
// authorize — 5 min is tight. The backend's stale-Pending sweep uses
// the same 15-min threshold so a browser close / crash closes the
// booking at the same visible SLA.
const PAYMENT_WINDOW_SECONDS = 15 * 60;

// Threshold at which the "Keep booking" warning banner appears.
const PAYMENT_WARNING_SECONDS = 60;

// Fallback defaults — replaced immediately by /api/pricing on mount
const DEFAULTS = {
  day_rate:            1500,
  overnight_rate:      1500,
  rate_24hr:           2000,
  reservation_fee_pct: 20,   // % of room rate charged as online reservation fee
  // Gate entrance fees per pax. Pre-check-in these are ESTIMATES — the
  // actual amount is computed at check-in from the real arrival count.
  // Shown in the review + confirmation steps so guests aren't surprised
  // by a fee at the gate after they've already paid the room online.
  entrance_fee_day:   50,
  entrance_fee_night: 80,
  entrance_fee_24hr:  100,
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

// 12-hour label used in confirmation summary / receipts.
function formatHourLabel(h) {
  const suffix = h < 12 ? "AM" : "PM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${suffix}`;
}

export default function BookingModal({ open, onClose, selectedRoom, rooms, onBooked, guestMode = false, resumeBooking = null }) {
  // Resume mode: user clicked a Pending booking from MyBookings / Dashboard.
  // We skip the room/date/guests picker entirely — the booking exists
  // server-side with those values locked in. Only two actions are valid:
  // Continue Payment (reopen PayMongo via /resume-payment) or Cancel
  // Booking (so the user can start a fresh one — we enforce one-Pending-
  // at-a-time on the backend).
  const isResume = !!resumeBooking;
  // Unverified authenticated guests are blocked server-side
  // (BookingController::store returns 403) — surface that requirement
  // in the UI so they can verify inline instead of hitting a cryptic
  // error at the payment step. Guest-mode bookings skip this check
  // since they collect email on the form itself.
  const { user } = useAuth();
  const needsVerification = !guestMode && user && !user.email_verified_at;
  const [verifyOpen, setVerifyOpen] = useState(false);
  const modalRef        = useRef(null);
  const bookingResultRef = useRef(null); // stores API response after booking created
  const [bookingType, setBookingType] = useState("day"); // "day" | "night" | "24hr"
  // For 24hr bookings the guest picks any on-the-hour start time (0–23).
  // Defaults to a 6AM start; gets validated against the 12-hour lead rule.
  const [checkInHour, setCheckInHour] = useState(6);
  const [visitDate, setVisitDate]     = useState("");
  // Room selection is tracked by its primary-key id so duplicate names
  // can't collapse availability / metadata / submitted-id onto the wrong
  // record. The optional `selectedRoom` prop is a display name from
  // the Resort / Rooms pages — resolved to an id when the modal opens.
  const initialRoomId = selectedRoom
    ? (rooms.find(r => r.name === selectedRoom)?.id ?? "")
    : "";
  const [roomId,   setRoomId]   = useState(initialRoomId);
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState("");
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const confirmDialogRef = useFocusTrap(confirmOpen);

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

  // Wizard step (1 = Details, 2 = Payment)
  const [step, setStep] = useState(1);
  const [showRequests, setShowRequests] = useState(false);

  // Fetch admin-configured pricing on mount (reservation_fee_pct, entrance fees, etc.)
  useEffect(() => {
    api.get("/api/pricing")
      .then(r => setRawPricing(r.data?.data ?? null))
      .catch(() => {});
  }, []);

  // Derive rates from the selected room in the rooms prop (already fetched by parent)
  useEffect(() => {
    const r = rooms.find(rm => String(rm.id) === String(roomId));
    if (!r) return;
    setPricing({
      day_rate:            Number(r.day_rate        ?? DEFAULTS.day_rate),
      overnight_rate:      Number(r.overnight_rate  ?? DEFAULTS.overnight_rate),
      rate_24hr:           Number(r.rate_24hr       ?? DEFAULTS.rate_24hr),
      reservation_fee_pct: Number(rawPricing?.reservation_fee_pct ?? DEFAULTS.reservation_fee_pct),
      entrance_fee_day:    Number(rawPricing?.entrance_fee_day   ?? DEFAULTS.entrance_fee_day),
      entrance_fee_night:  Number(rawPricing?.entrance_fee_night ?? DEFAULTS.entrance_fee_night),
      entrance_fee_24hr:   Number(rawPricing?.entrance_fee_24hr  ?? DEFAULTS.entrance_fee_24hr),
    });
  }, [rooms, roomId, rawPricing]);

  // Check room availability whenever date, time, or booking type changes.
  // Debounced so keyboard-scrolling the hour dropdown doesn't fire one
  // request per value; settles on the final pick after ~300ms.
  useEffect(() => {
    if (!visitDate) { setAvailability(null); return; }
    const params = new URLSearchParams({
      date:         visitDate,
      booking_type: bookingType,
    });
    if (bookingType === "24hr") params.set("check_in_hour", String(checkInHour));

    setAvailChecking(true);
    const timer = setTimeout(() => {
      api.get(`/api/availability?${params}`)
        .then(r => {
          // Key by id, not name — duplicate names otherwise collapse to the
          // last entry in the list and mask one of the rooms as unavailable.
          const map = {};
          (r.data?.data ?? []).forEach(rm => { map[String(rm.id)] = rm.available; });
          setAvailability(map);
        })
        .catch(() => setAvailability(null)) // on error, show no indicators
        .finally(() => setAvailChecking(false));
    }, 300);

    return () => { clearTimeout(timer); };
  }, [visitDate, bookingType, checkInHour]);

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
      // Only accept messages from our own origin
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "paymongo_paid" || event.data?.type === "paymongo_cancelled") {
        try { paymentPopup?.popup?.close(); } catch { /* ignore */ }
        const bId = paymentPopup?.bookingId;

        // Close the popup but keep polling running (popup: null, no redirected flag).
        // ALSO start calling confirm-payment with retries as a parallel path.
        // Whichever succeeds first (polling or confirm) will close the modal.
        setPaymentPopup(prev => prev ? { ...prev, popup: null } : null);

        if (!bId) return;

        // Backend verifies with PayMongo before confirming.
        // GCash may take seconds to update payment_status — retry up to 10 times (20s).
        const confirmFn = guestMode
          ? () => guestConfirmPayment(bId, paymentOption === "full")
          : () => api.post(`/api/bookings/${bId}/confirm-payment`, { fully_paid: paymentOption === "full" });

        let attempts = 0;
        const tryConfirm = () => {
          confirmFn()
            .then(() => {
              // Confirmed! Close everything.
              setPaymentPopup(null);
              setTimeLeft(null);
              clearPendingPayment();
              onBooked?.(bookingResultRef.current);
              onClose();
            })
            .catch(err => {
              const status = err?.response?.status;
              attempts++;
              if ((status === 402 || status === 503) && attempts < 10) {
                setTimeout(tryConfirm, 2000);
              }
              // Don't show error — polling is also running as backup.
              // If both fail, the timer will expire and user sees the reopen UI.
            });
        };
        tryConfirm();
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [paymentPopup, onBooked, onClose]);

  // Poll payment status — runs while waiting for payment.
  // The status endpoint checks PayMongo server-side and confirms when paid.
  useEffect(() => {
    if (!paymentPopup?.bookingId) return;
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
          clearPendingPayment();
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
      clearPendingPayment();
      if (bId) {
        (guestMode ? cancelGuestBooking(bId) : cancelBooking(bId)).catch(() => {});
      }
      setError(`Payment timed out (${Math.floor(PAYMENT_WINDOW_SECONDS / 60)} minutes). Your booking was automatically cancelled.`);
      return;
    }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, paymentPopup]);

  // Escape key to close (only when no confirmation overlay or payment popup)
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape" && !confirmOpen && !paymentPopup) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, confirmOpen, paymentPopup, onClose]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setRoomId(selectedRoom ? (rooms.find(r => r.name === selectedRoom)?.id ?? "") : "");
      setVisitDate("");
      setError("");
      setBookingType("day");
      setCheckInHour(6);
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
      setStep(1);
      setShowRequests(false);
    }
  }, [open, selectedRoom]);

  // ── Selected room metadata ─────────────────────────────────────────────────
  const selectedRoomObj = useMemo(
    () => rooms.find(r => String(r.id) === String(roomId)) ?? null,
    [rooms, roomId]
  );
  const roomName = selectedRoomObj?.name ?? "";

  // null = unrestricted; array = only those types allowed for this room
  const allowedTypes = selectedRoomObj?.allowed_booking_types ?? null;
  const typeAllowed  = (type) => !allowedTypes || allowedTypes.includes(type);

  // Time-slot guard: disable booking types whose window already passed today
  const isToday     = visitDate === todayStr();
  const currentHour = new Date().getHours();
  const dayPassed   = isToday && currentHour >= 18;   // Day (6AM–6PM) window closed

  // Auto-switch away from Day if its window passed
  useEffect(() => {
    if (dayPassed && bookingType === "day") setBookingType("night");
  }, [dayPassed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-switch to first allowed type when room with restrictions is selected
  useEffect(() => {
    if (!allowedTypes) return;
    if (!allowedTypes.includes(bookingType)) setBookingType(allowedTypes[0]);
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the selected date is today, hours earlier than "now" are disabled
  // in the hour-grid picker. Pre-existing auto-switch from Day → Night at
  // 6 PM handles the Day slot; this handles the 24hr slot.
  const isTodaySelected = visitDate === todayStr();
  const minHourToday    = isTodaySelected ? new Date().getHours() : 0;

  // If the user picks today with a 24hr start that's already past, bump
  // the selection forward to the current hour so the value is always valid.
  useEffect(() => {
    if (!isTodaySelected) return;
    if (checkInHour < minHourToday) setCheckInHour(minHourToday);
    // Intentionally skip checkInHour in deps — we only re-clamp when the
    // date changes (otherwise the user's later upward edits would ping-pong).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitDate]);

  // ── Derived pricing — room rate only, 20% reservation fee ─────────────────
  const is24hr   = bookingType === "24hr";
  const baseRate = bookingType === "night"
    ? pricing.overnight_rate
    : is24hr
      ? pricing.rate_24hr
      : pricing.day_rate;
  const discount           = promoResult?.discount_amount ?? 0;
  // Package add-ons attached to the selected room (videoke on Blue
  // Pavilion, etc.). The backend auto-creates BookingAmenity rows for
  // each on booking creation and increments booking.total by the sum
  // — so the guest's visible total must include this up front.
  // `selectedRoomObj` is already memoized further up in the file.
  const packageAddons   = (selectedRoomObj?.attached_addons ?? [])
    .filter(a => a.relation === 'package');
  const packageTotal    = packageAddons.reduce(
    (sum, a) => sum + (Number(a.price) || 0) * (Number(a.qty) || 1), 0
  );
  const packageNames    = packageAddons.map(a => a.name);

  // Optional add-ons attached to this room (Patrice videoke at a
  // paid rate, for example). Guest picks qty per addon; the backend
  // looks up per-room price so we never need to trust a price field
  // from the client.
  const optionalAddons = useMemo(
    () => (selectedRoomObj?.attached_addons ?? []).filter(a => a.relation === 'optional'),
    [selectedRoomObj]
  );
  // Map of addon name → chosen qty. Resets when the room changes so
  // a half-selected videoke on Patrice doesn't leak into a Blue
  // Pavilion booking the guest switches to mid-flow.
  const [optionalQtys, setOptionalQtys] = useState({});
  useEffect(() => { setOptionalQtys({}); }, [roomId]);
  const optionalTotal = useMemo(
    () => optionalAddons.reduce((sum, a) => {
      const qty = Number(optionalQtys[a.name] || 0);
      return sum + qty * (Number(a.price) || 0);
    }, 0),
    [optionalAddons, optionalQtys]
  );
  // Name list for the summary line ("Optional: Videoke × 1").
  const optionalSummary = useMemo(
    () => optionalAddons
      .map(a => ({ name: a.name, qty: Number(optionalQtys[a.name] || 0) }))
      .filter(x => x.qty > 0),
    [optionalAddons, optionalQtys]
  );

  // Discounted room-only subtotal — matches backend `reservation_fee`
  // math which is `pct × (roomRate - discount)`, excluding package.
  const discountedRoom     = Math.max(baseRate - discount, 0);
  // What the guest actually pays for room + bundle: discounted room
  // + package add-ons + picked optional add-ons. The reservation fee
  // below stays based on discountedRoom only to match backend behavior.
  const discountedTotal    = discountedRoom + packageTotal + optionalTotal;
  const reservationFee     = Math.round(discountedRoom * (pricing.reservation_fee_pct / 100));
  const amountDue          = paymentOption === "full" ? discountedTotal : reservationFee;
  const balanceDue         = discountedTotal - amountDue;
  // Gate entrance fee — BookingModal doesn't collect guest count, so the
  // estimate assumes 1 pax (backend default). Real amount is computed at
  // check-in from actual arrivals. Surfacing it here prevents the
  // "fully paid online → surprise charge at gate" complaint.
  const entranceRate       = bookingType === "night"
    ? pricing.entrance_fee_night
    : is24hr
      ? pricing.entrance_fee_24hr
      : pricing.entrance_fee_day;
  const estimatedEntrance  = entranceRate; // 1 pax; scales at check-in
  const grandEstimate      = discountedTotal + estimatedEntrance;
  const resortBalance      = balanceDue + estimatedEntrance;

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
  function submit() {
    setError("");
    // Guest mode: require contact info
    if (guestMode) {
      if (!guestName.trim())  { setError("Please enter your full name."); return; }
      if (!guestEmail.trim()) { setError("Please enter your email address."); return; }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(guestEmail.trim())) { setError("Please enter a valid email address."); return; }
    }
    if (!visitDate) { setError("Please select a visit date."); return; }
    if (!roomId)    { setError("Please select a room/cottage."); return; }
    if (is24hr && isTodaySelected && checkInHour < minHourToday) {
      setError("The chosen start time is already past. Pick a later hour today or a future date.");
      return;
    }
    if (availability !== null && availability[String(roomId)] !== true) {
      setError("Selected room is not available for the chosen date. Please select another."); return;
    }
    if (!selectedRoomObj?.id) { setError("Could not determine room. Please try again."); return; }
    setConfirmOpen(true);
  }

  // ── Step 2: confirmed → call API ───────────────────────────────────────────
  // Resume flow: reopen PayMongo for an existing Pending booking.
  // Skips the createBooking step entirely — the row already exists.
  // Reuses the same paymentPopup state machine (polling + timer +
  // postMessage listener) as a fresh booking so the confirmed-payment
  // path is identical.
  async function handleResume() {
    if (!resumeBooking) return;
    setError("");
    setSubmitting(true);
    try {
      // Authed user → /api/bookings/{id}/resume-payment
      // Guest token → /api/guest-resume-payment (not used from MyBookings
      // since those are authed, but supported for completeness)
      const res = resumeBooking.guestToken
        ? await api.post('/api/guest-resume-payment', {
            guest_token: resumeBooking.guestToken,
            pay_full:    Boolean(resumeBooking.payFull),
          })
        : await api.post(`/api/bookings/${resumeBooking.bookingId}/resume-payment`, {
            pay_full: Boolean(resumeBooking.payFull),
          });

      const checkoutUrl = res?.data?.checkout_url;
      if (!checkoutUrl) throw new Error('No checkout URL returned');

      // Prep bookingResultRef so the onBooked callback fires with the
      // same shape a fresh booking would emit.
      bookingResultRef.current = {
        roomType:      resumeBooking.roomName ?? '',
        checkIn:       resumeBooking.checkIn ?? '',
        checkOut:      resumeBooking.checkOut ?? '',
        guests:        resumeBooking.guests ?? 1,
        paymentMethod: 'Online',
        totals: {
          reservationFee: resumeBooking.reservationFee ?? 0,
          balanceDue:     Math.max(0, (resumeBooking.total ?? 0) - (resumeBooking.reservationFee ?? 0)),
        },
        bookingData: resumeBooking,
        guestToken:  resumeBooking.guestToken ?? null,
      };

      const pw = 600, ph = 700;
      const pl = Math.round(window.screen.width  / 2 - pw / 2);
      const pt = Math.round(window.screen.height / 2 - ph / 2);
      const popup = window.open(
        checkoutUrl,
        "paymongo_checkout",
        `width=${pw},height=${ph},left=${pl},top=${pt},resizable=yes,scrollbars=yes`
      );

      savePendingPayment({
        bookingId:  resumeBooking.bookingId,
        resId:      resumeBooking.resId ?? null,
        roomName:   resumeBooking.roomName ?? null,
        guestToken: resumeBooking.guestToken ?? null,
        payFull:    Boolean(resumeBooking.payFull),
        expiresAt:  new Date(Date.now() + PAYMENT_WINDOW_SECONDS * 1000).toISOString(),
      });

      const bId = resumeBooking.guestToken ?? resumeBooking.bookingId;
      if (!popup || popup.closed) {
        const tab = window.open(checkoutUrl, '_blank');
        setPaymentPopup({ bookingId: bId, checkoutUrl, popup: tab });
        setTimeLeft(PAYMENT_WINDOW_SECONDS);
        return;
      }
      setPaymentPopup({ bookingId: bId, checkoutUrl, popup });
      setTimeLeft(PAYMENT_WINDOW_SECONDS);
    } catch (err) {
      const msg = err?.response?.data?.message
        ?? 'Could not reopen payment. The booking may have expired.';
      setError(msg);
      // 422 = no longer Pending on server — drop local reminder
      if (err?.response?.status === 422) clearPendingPayment();
    } finally {
      setSubmitting(false);
    }
  }

  // Cancel the Pending booking from resume mode so the user can start
  // a fresh one. Uses the same cancelBooking endpoint the normal cancel
  // button uses — backend marks status=Cancelled + releases the room
  // hold. After success we close the modal; the parent's polling will
  // show the Cancelled row.
  async function handleCancelResume() {
    if (!resumeBooking) return;
    setError("");
    setSubmitting(true);
    try {
      if (resumeBooking.guestToken) {
        await cancelGuestBooking(resumeBooking.guestToken);
      } else {
        await cancelBooking(resumeBooking.bookingId);
      }
      clearPendingPayment();
      onBooked?.(null); // signal parent to refresh
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Could not cancel booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    setError("");
    const room = selectedRoomObj;
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

      // Optional add-ons picked from the room's attached_addons.
      // Backend resolves price per-room so we only send {name, qty}
      // — never trust a client-supplied price.
      const pickedAmenities = Object.entries(optionalQtys)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([name, qty]) => ({ name, qty: Number(qty) }));
      if (pickedAmenities.length > 0) bookingPayload.amenities = pickedAmenities;

      // 24hr bookings pass a start hour; the server also 12-hour-lead-checks this.
      if (bookingType === "24hr") bookingPayload.check_in_hour = checkInHour;

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
      const fmtDT = fmtDateTime;
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
        guestToken: result.guest_token ?? null,
      };
      // For guest bookings, use the guest_token (UUID) for all subsequent API calls
      // to prevent ID enumeration. For logged-in users, use the numeric booking ID.
      const guestToken = result.guest_token;
      const bookingId = guestMode ? guestToken : raw.id;
      const { checkout_url } = guestMode
        ? await createGuestPaymentLink(guestToken, paymentOption === "full")
        : await createPaymentLink(raw.id, paymentOption === "full");

      // Open PayMongo in a small centered popup so the main page stays visible
      const pw = 600, ph = 700;
      const pl = Math.round(window.screen.width  / 2 - pw / 2);
      const pt = Math.round(window.screen.height / 2 - ph / 2);
      const popup = window.open(
        checkout_url,
        "paymongo_checkout",
        `width=${pw},height=${ph},left=${pl},top=${pt},resizable=yes,scrollbars=yes`
      );

      // Persist a pending-payment context so the floating banner can
      // offer a resume path if the guest closes this modal / tab while
      // the booking is still Pending. Cleared on successful payment,
      // explicit cancel, and timer expiry further down.
      savePendingPayment({
        bookingId:  raw.id,
        resId:      raw.res_id ?? null,
        roomName:   raw.room?.name ?? null,
        guestToken: guestMode ? guestToken : null,
        payFull:    paymentOption === 'full',
        // 15-min TTL matches the backend's stale-Pending sweep window.
        expiresAt:  new Date(Date.now() + PAYMENT_WINDOW_SECONDS * 1000).toISOString(),
      });

      if (!popup || popup.closed) {
        // Popup blocked — open in a new tab instead of redirecting away
        const tab = window.open(checkout_url, '_blank');
        setPaymentPopup({ bookingId, checkoutUrl: checkout_url, popup: tab });
        setTimeLeft(PAYMENT_WINDOW_SECONDS);
        return;
      }

      setPaymentPopup({ bookingId, checkoutUrl: checkout_url, popup });
      setTimeLeft(PAYMENT_WINDOW_SECONDS);
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
            {isResume ? 'Continue Pending Booking' : 'Book Your Visit at Aplaya'}
            {!isResume && guestMode && <span className="ml-2 text-sm font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Guest</span>}
          </h3>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-gray-600" aria-label="Close booking modal"><i className="fas fa-times"></i></button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
            <i className="fas fa-exclamation-circle mt-0.5 shrink-0"></i>
            <span>{error}</span>
          </div>
        )}

        <div>
          {/* Guest info — shown only in guest (no-account) mode, always visible outside steps */}
          {!isResume && guestMode && (
            <div className="mb-5">
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
                  <label htmlFor="bm-guest-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-600" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="bm-guest-name"
                    type="text"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    placeholder="Your full name"
                    autoComplete="name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="bm-guest-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email address <span className="text-gray-400 font-normal">— for your receipt and booking link</span>{' '}
                    <span className="text-red-600" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="bm-guest-email"
                    type="email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="bm-guest-phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-gray-400 font-normal text-xs">(optional)</span>
                  </label>
                  <input
                    id="bm-guest-phone"
                    type="tel"
                    value={guestPhone}
                    onChange={e => setGuestPhone(e.target.value)}
                    placeholder="+63 9xx xxx xxxx"
                    autoComplete="tel"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <hr className="mt-5 border-gray-200" />
            </div>
          )}

          {/* Step indicator — hidden in resume mode (no steps to show) */}
          {!isResume && <div className="flex items-center gap-2 mb-5">
            {[{ num: 1, label: 'Details' }, { num: 2, label: 'Payment' }].map((s, i) => (
              <React.Fragment key={s.num}>
                {i > 0 && <div className={`flex-1 h-px ${step >= s.num ? 'bg-blue-400' : 'bg-gray-200'}`} />}
                <button type="button" onClick={() => s.num < step && setStep(s.num)}
                  className={`flex items-center gap-1.5 text-sm font-medium ${
                    step === s.num ? 'text-blue-700' : step > s.num ? 'text-blue-500 cursor-pointer' : 'text-gray-400'
                  }`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step >= s.num ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>{step > s.num ? '\u2713' : s.num}</span>
                  {s.label}
                </button>
              </React.Fragment>
            ))}
          </div>}

          {/* ═══ Step 1 — Details ═══ */}
          {!isResume && step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Visit date */}
              <div className="md:col-span-2">
                <label htmlFor="bm-visit-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Date <span className="text-red-600" aria-hidden="true">*</span>
                </label>
                <input
                  id="bm-visit-date"
                  type="date"
                  min={todayStr()}
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Booking type — compact pills. Locked out until a date is
                  picked, so the user can't pick "Day" before noon on a
                  date that's already past 3pm, or select a 24-hour slot
                  without knowing which day we're checking availability
                  against. dayPassed + typeAllowed both depend on the
                  selected date + room, so their semantics aren't
                  meaningful until visitDate is set. */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2" id="booking-type-label">
                  Booking Type <span className="text-red-600" aria-hidden="true">*</span>
                  {!visitDate && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">Pick a date first</span>
                  )}
                </label>
                <div className="flex gap-2" role="group" aria-labelledby="booking-type-label">
                  {[
                    { key: "day",   icon: "fa-sun",   label: "Day",    time: "6AM\u20136PM",  disabled: !visitDate || dayPassed || !typeAllowed("day") },
                    { key: "night", icon: "fa-moon",  label: "Night",   time: "6PM\u20137AM",  disabled: !visitDate || !typeAllowed("night") },
                    { key: "24hr",  icon: "fa-clock", label: "24 Hrs", time: "Any start", disabled: !visitDate || !typeAllowed("24hr") },
                  ].map(opt => {
                    const active = bookingType === opt.key;
                    return (
                      <button key={opt.key} type="button" disabled={opt.disabled}
                        aria-pressed={active}
                        onClick={() => { if (!opt.disabled) { setBookingType(opt.key); setPromoResult(null); setPromoInput(""); } }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-3 md:py-2 border-2 rounded-lg text-sm font-medium transition-colors ${
                          active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        } ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <i className={`fas ${opt.icon} text-xs`} aria-hidden="true"></i>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {/* Rate shown below */}
                {roomId && <p className="mt-1 text-xs text-gray-500 text-center">{formatPHP(baseRate)} / {bookingType === "night" ? "night" : is24hr ? "24 hrs" : "day"}</p>}

                {/* 24hr: pick any on-the-hour start time */}
                {is24hr && (
                  <div className="mt-3">
                    <p id="booking-modal-checkin-hour-label" className="block text-xs font-medium text-gray-600 mb-2">
                      Start time <span className="text-red-600" aria-hidden="true">*</span>
                    </p>
                    <HourGridPicker
                      value={checkInHour}
                      onChange={setCheckInHour}
                      accent="blue"
                      labelId="booking-modal-checkin-hour-label"
                      minHour={minHourToday}
                    />
                  </div>
                )}
              </div>

              {/* Room / Cottage — locked until visitDate is chosen. The
                  availability list is filtered by the selected date, so
                  showing rooms before a date is picked would surface
                  rooms that could be unavailable for the slot the user
                  eventually chooses. */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room / Cottage <span className="text-red-600" aria-hidden="true">*</span>
                  {!visitDate ? (
                    <span className="ml-2 text-xs text-gray-400 font-normal">Pick a date first</span>
                  ) : availChecking && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">
                      <i className="fas fa-spinner fa-spin mr-1"></i>Checking…
                    </span>
                  )}
                </label>
                <select
                  value={roomId}
                  onChange={(e) => { setRoomId(e.target.value); setPromoResult(null); setPromoInput(""); }}
                  required
                  disabled={!visitDate}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  <option value="">Select Room / Cottage / Pavilion</option>
                  {(() => {
                    // Tent rooms are walk-in only (backend rejects tent
                    // bookings from this endpoint with "Tent pitching is
                    // available for walk-in only"), so filter them out of
                    // the public picker entirely.
                    //
                    // Unavailable rooms are NOT filtered out — they render
                    // at the bottom of the list in a dedicated optgroup
                    // with disabled=true. Users can see the room exists
                    // (useful context: "Rohan is booked for that night,
                    // try a different date") but can't pick it. Previous
                    // behavior of hiding them made the picker's length
                    // jump around unpredictably as availability loaded.
                    const nonTent = rooms.filter(r => r.category !== 'tent');
                    const isAvailable = r =>
                      availability === null || availability?.[String(r.id)] === true;

                    const available   = nonTent.filter(isAvailable);
                    const unavailable = nonTent.filter(r => !isAvailable(r));

                    const getCategory = r => {
                      if (r.category) return r.category;
                      const n = (r.name || "").toLowerCase();
                      if (n.includes("cottage"))  return "cottage";
                      if (n.includes("pavilion")) return "pavilion";
                      return "room";
                    };
                    // Rate label for the currently-selected booking type so
                    // the dropdown answers "how much does this cost me?"
                    // without the user leaving the select. bookingType is
                    // always set by the time this renders — it defaults to
                    // "day" on mount and the sub-toggle flips it to
                    // night/24hr/24hr-pm.
                    const rateFor = (r) => {
                      if (bookingType === '24hr' || bookingType === '24hr-pm') return r.rate_24hr;
                      if (bookingType === 'night') return r.overnight_rate;
                      return r.day_rate;
                    };
                    const fmtRate = (v) => `\u20B1${Number(v ?? 0).toLocaleString('en-PH')}`;
                    const groups = [
                      { key: "room",     label: "\uD83D\uDECF\uFE0F  Rooms"     },
                      { key: "cottage",  label: "\u26F1\uFE0F  Cottages"  },
                      { key: "pavilion", label: "\uD83C\uDFDB\uFE0F  Pavilions" },
                    ];
                    const availableNodes = groups.map(g => {
                      const items = available.filter(r => getCategory(r) === g.key);
                      if (!items.length) return null;
                      return (
                        <optgroup key={g.key} label={g.label}>
                          {items.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                              {r.capacity_label ? ` \u2014 ${r.capacity_label}` : ""}
                              {` \u2014 ${fmtRate(rateFor(r))}`}
                            </option>
                          ))}
                        </optgroup>
                      );
                    });
                    // Single unavailable group at the bottom — don't
                    // sub-group by category, because the point is
                    // "these are out" not "these are small-cottage
                    // variants of out." Each option is disabled so
                    // the user can see but not pick.
                    const unavailableNode = unavailable.length > 0 ? (
                      <optgroup key="unavailable" label={"\u26D4  Unavailable for this slot"}>
                        {unavailable.map(r => (
                          <option key={r.id} value={r.id} disabled>
                            {r.name}
                            {r.capacity_label ? ` \u2014 ${r.capacity_label}` : ""}
                            {" \u2014 booked"}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                    return <>{availableNodes}{unavailableNode}</>;
                  })()}
                </select>
                {/* Capacity label + availability badge */}
                {selectedRoomObj && (
                  <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                    <i className="fas fa-users text-[10px]"></i>
                    Recommended: {selectedRoomObj.capacity_label ?? `Up to ${selectedRoomObj.capacity} guests`}
                    {availability !== null && roomId && (
                      availability[String(roomId)] === false
                        ? <span className="ml-2 text-red-600"><i className="fas fa-times-circle mr-0.5"></i>Not available</span>
                        : availability[String(roomId)] === true
                          ? <span className="ml-2 text-green-600"><i className="fas fa-check-circle mr-0.5"></i>Available</span>
                          : null
                    )}
                  </p>
                )}
              </div>

              {/* Optional add-ons for this room — only renders when the
                  selected room actually has any. Backend verifies the
                  chosen names belong to this room + looks up per-room
                  price from room_addons on save. */}
              {optionalAddons.length > 0 && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <i className="fas fa-sparkles mr-1.5 text-amber-500"></i>
                    Add-ons for this room <span className="text-gray-400 font-normal text-xs">(optional)</span>
                  </label>
                  <div className="space-y-2">
                    {optionalAddons.map(a => {
                      const qty    = Number(optionalQtys[a.name] || 0);
                      const active = qty > 0;
                      const cap    = Math.max(1, Number(a.qty) || 1);
                      // per_booking addons toggle 0⇄1 like the walk-in
                      // picker does; others get a qty stepper.
                      if (a.per_booking) {
                        return (
                          <button
                            key={a.name}
                            type="button"
                            onClick={() => setOptionalQtys(q => ({ ...q, [a.name]: active ? 0 : 1 }))}
                            className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                              active
                                ? 'border-indigo-400 bg-indigo-50'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <i className={`fas ${a.icon || 'fa-tag'} ${active ? 'text-indigo-600' : 'text-slate-400'}`} aria-hidden="true" />
                            <span className={`text-sm font-medium ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{a.name}</span>
                            <span className="ml-auto text-sm font-semibold text-slate-700">₱{Number(a.price).toLocaleString()}</span>
                            {active && <i className="fas fa-check-circle text-indigo-600" aria-hidden="true" />}
                          </button>
                        );
                      }
                      return (
                        <div key={a.name} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                          <i className={`fas ${a.icon || 'fa-tag'} text-slate-500 w-5 text-center`} aria-hidden="true" />
                          <span className="text-sm font-medium text-slate-700 flex-1 min-w-0 truncate">{a.name}</span>
                          <span className="text-xs text-slate-500">₱{Number(a.price).toLocaleString()}/ea</span>
                          <div className="flex items-center gap-1">
                            <button type="button"
                              disabled={qty === 0}
                              onClick={() => setOptionalQtys(q => ({ ...q, [a.name]: Math.max(0, qty - 1) }))}
                              className="w-8 h-8 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm font-bold disabled:opacity-40">−</button>
                            <span className="w-8 text-center text-sm font-medium tabular-nums">{qty}</span>
                            <button type="button"
                              disabled={qty >= cap}
                              onClick={() => setOptionalQtys(q => ({ ...q, [a.name]: Math.min(cap, qty + 1) }))}
                              className="w-8 h-8 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm font-bold disabled:opacity-40">+</button>
                          </div>
                          {qty > 0 && (
                            <span className="text-xs font-semibold text-sky-700 tabular-nums">
                              ₱{(qty * Number(a.price)).toLocaleString()}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Special requests — collapsed */}
              <div className="md:col-span-2">
                {showRequests ? (
                  <div>
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
                ) : (
                  <button type="button" onClick={() => setShowRequests(true)} className="text-xs text-blue-600 hover:underline">
                    <i className="fas fa-plus mr-1"></i>Add special requests
                  </button>
                )}
              </div>

              {/* Next button */}
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    if (guestMode) {
                      if (!guestName.trim())  { setError("Please enter your full name."); return; }
                      if (!guestEmail.trim()) { setError("Please enter your email address."); return; }
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                      if (!emailRegex.test(guestEmail.trim())) { setError("Please enter a valid email address."); return; }
                    }
                    if (!visitDate) { setError("Please select a visit date."); return; }
                    if (!roomId)    { setError("Please select a room/cottage."); return; }
                    if (availability !== null && availability[String(roomId)] !== true) {
                      setError("Selected room is not available for the chosen date. Please select another."); return;
                    }
                    setStep(2);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md flex items-center justify-center gap-2"
                >
                  Next <i className="fas fa-arrow-right"></i>
                </button>
              </div>
            </div>
          )}

          {/* ═══ Step 2 — Payment ═══ */}
          {!isResume && step === 2 && (
            <div className="space-y-4">
              {/* Promo code input */}
              <div>
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
              <div>
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
              <div className="bg-blue-50 p-4 rounded-md">
                <h4 className="font-medium text-gray-900 mb-2">Payment Summary</h4>
                <div className="flex justify-between mb-1 text-sm">
                  <span className="text-gray-600">
                    Room rate ({bookingType === "night" ? "Night" : is24hr ? "24 Hours" : "Day"}):
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
                      <span className="text-gray-900">{formatPHP(discountedRoom)}</span>
                    </div>
                  </>
                )}
                {/* Package add-ons bundled into the room — e.g. videoke
                    included with Blue Pavilion. Auto-attached on booking
                    creation server-side at these per-room prices. */}
                {packageTotal > 0 && (
                  <div className="flex justify-between mb-1 text-sm text-emerald-800 border-t border-blue-200 pt-2 mt-2">
                    <span className="flex items-center gap-1.5">
                      <i className="fas fa-box text-[11px] text-emerald-500"></i>
                      Includes: {packageNames.join(', ')}
                    </span>
                    <span className="font-medium">+ {formatPHP(packageTotal)}</span>
                  </div>
                )}
                {/* Guest-picked optional add-ons (videoke on Patrice
                    etc.). Line itemizes them with qty so the guest sees
                    exactly what they're adding. */}
                {optionalTotal > 0 && (
                  <div className="flex justify-between mb-1 text-sm text-indigo-800 border-t border-blue-200 pt-2 mt-2">
                    <span className="flex items-center gap-1.5">
                      <i className="fas fa-sparkles text-[11px] text-indigo-500"></i>
                      Add-ons: {optionalSummary.map(x => `${x.name} × ${x.qty}`).join(', ')}
                    </span>
                    <span className="font-medium">+ {formatPHP(optionalTotal)}</span>
                  </div>
                )}
                {/* Entrance fee — first-class line, not fine print.
                    Displayed before the payment-schedule math so the
                    grand total estimate accurately reflects EVERYTHING
                    the guest will pay across the three collection
                    points (online / counter / gate). */}
                <div className="flex justify-between mb-1 text-sm text-amber-800 border-t border-blue-200 pt-2 mt-2">
                  <span className="flex items-center gap-1.5">
                    <i className="fas fa-ticket-alt text-[11px]"></i>
                    Entrance fee (₱{entranceRate}/pax · paid at gate):
                  </span>
                  <span>{formatPHP(estimatedEntrance)}<span className="text-[10px] text-amber-600 ml-1">est.</span></span>
                </div>
                <div className="flex justify-between mt-1 text-sm font-semibold">
                  <span className="text-gray-800">Estimated Grand Total:</span>
                  <span className="text-gray-900">{formatPHP(grandEstimate)}</span>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  Entrance fee scales with the actual number of guests at check-in.
                </p>

                {/* Payment schedule — breaks the cost across the three
                    collection points so guests know exactly what gets
                    charged where. Previously the entrance fee only
                    appeared as a single-line fine-print note. */}
                <div className="border-t border-blue-200 pt-2 mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">Payment Schedule</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {paymentOption === "full" ? "Pay Online Now (full room)" : `Pay Online Now (${pricing.reservation_fee_pct}% reservation)`}
                    </span>
                    <span className="text-blue-700 font-bold">{formatPHP(amountDue)}</span>
                  </div>
                  {balanceDue > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">Room balance at resort counter</span>
                      <span className="font-medium text-gray-800">{formatPHP(balanceDue)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-amber-700">Entrance fee at gate</span>
                    <span className="font-medium text-amber-700">{formatPHP(estimatedEntrance)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2 pt-2 border-t border-blue-100 font-semibold">
                    <span className="text-gray-800">Total to pay at resort</span>
                    <span className="text-gray-900">{formatPHP(resortBalance)}</span>
                  </div>
                </div>
              </div>

              {/* Cancellation policy (smaller) */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 px-3 py-2">
                <p className="text-xs text-yellow-800">
                  <span className="font-medium">Cancellation Policy:</span> Cancellations or no-shows will result in the
                  forfeiture of the {pricing.reservation_fee_pct}% reservation fee ({formatPHP(reservationFee)}).
                </p>
              </div>

              {/* PayMongo note */}
              <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-2">
                <i className="fas fa-lock text-blue-500 mt-0.5 shrink-0"></i>
                <span>
                  A secure <span className="font-medium">PayMongo</span> checkout window will open for you to pay{" "}
                  <span className="font-medium">{formatPHP(amountDue)}</span> via{" "}
                  <span className="font-medium">GCash</span>.
                  This page will stay open in the background.
                </span>
              </div>

              {/* Unverified-email gate — shown in place of the Review
                  button when the authenticated user hasn't verified.
                  Clicking "Verify Now" opens the OTP modal inline so
                  they can finish without leaving this flow. */}
              {!paymentPopup && needsVerification && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <i className="fas fa-exclamation-triangle text-amber-600 mt-0.5"></i>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900">Verify your email before booking</p>
                      <p className="text-xs text-amber-800 mt-1">
                        We need to confirm you own <strong className="break-all">{user?.email}</strong> before accepting a reservation. Takes 30 seconds.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 font-medium py-2.5 px-4 rounded-md text-sm"
                    >
                      <i className="fas fa-arrow-left mr-2"></i>Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setVerifyOpen(true)}
                      className="flex-[2] bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 px-4 rounded-md text-sm"
                    >
                      <i className="fas fa-envelope-open-text mr-2"></i>Verify Now
                    </button>
                  </div>
                </div>
              )}

              {/* Back + Review Booking buttons */}
              {!paymentPopup && !needsVerification && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-3 px-4 rounded-md flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-arrow-left"></i> Back
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-3 px-4 rounded-md flex items-center justify-center gap-2"
                  >
                    {submitting
                      ? <><i className="fas fa-spinner fa-spin"></i> Opening checkout window...</>
                      : <><i className="fas fa-eye"></i> Review Booking</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Resume-mode UI — streamlined review for an already-created
              Pending booking. Shown when the modal was opened from a
              "Continue Payment" action. Hidden once paymentPopup is set
              (the existing payment-in-progress UI below takes over). */}
          {isResume && !paymentPopup && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <i className="fas fa-hourglass-half text-amber-700 text-sm" aria-hidden="true" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900">Pending Booking</p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Complete payment to confirm this booking, or cancel it to start a new one.
                    You can only have one pending booking at a time.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 text-sm">
                {resumeBooking.resId && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Booking ID</span>
                    <span className="font-medium text-slate-800">{resumeBooking.resId}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Room</span>
                  <span className="font-medium text-slate-800">{resumeBooking.roomName ?? '—'}</span>
                </div>
                {resumeBooking.bookingTypeLabel && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Type</span>
                    <span className="font-medium text-slate-800">{resumeBooking.bookingTypeLabel}</span>
                  </div>
                )}
                {resumeBooking.checkIn && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Check-in</span>
                    <span className="font-medium text-slate-800 text-right">{resumeBooking.checkIn}</span>
                  </div>
                )}
                {resumeBooking.checkOut && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Check-out</span>
                    <span className="font-medium text-slate-800 text-right">{resumeBooking.checkOut}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4 pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Total</span>
                  <span className="font-bold text-slate-900">
                    ₱{Number(resumeBooking.total ?? 0).toLocaleString('en-PH')}
                  </span>
                </div>
                {resumeBooking.reservationFee > 0 && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Reservation fee due now</span>
                    <span className="font-semibold text-sky-700">
                      ₱{Number(resumeBooking.reservationFee ?? 0).toLocaleString('en-PH')}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancelResume}
                  disabled={submitting}
                  className="sm:flex-1 px-4 py-3 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium hover:bg-rose-50 disabled:opacity-60"
                >
                  <i className="fas fa-ban mr-1.5" aria-hidden="true" />
                  Cancel Booking
                </button>
                <button
                  type="button"
                  onClick={handleResume}
                  disabled={submitting}
                  className="sm:flex-[2] px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting
                    ? <><i className="fas fa-spinner fa-spin mr-1.5" aria-hidden="true" />Opening payment…</>
                    : <><i className="fas fa-arrow-right-to-bracket mr-1.5" aria-hidden="true" />Continue Payment</>}
                </button>
              </div>
            </div>
          )}

          {/* Payment popup states — show regardless of step */}
          {paymentPopup && (
            paymentPopup.popup ? (
              /* Popup is open — show waiting state with countdown */
              <div className="flex flex-col items-center gap-3 py-4 bg-blue-50 border border-blue-200 rounded-md mt-4">
                <i className="fas fa-spinner fa-spin text-blue-600 text-2xl"></i>
                <p className="text-sm font-medium text-blue-800">Waiting for payment in the checkout window…</p>
                {timeLeft !== null && timeLeft <= PAYMENT_WARNING_SECONDS ? (
                  <div className="w-full max-w-sm mx-4 bg-red-50 border border-red-300 rounded-md px-3 py-2 flex items-center gap-3">
                    <i className="fas fa-exclamation-triangle text-red-600"></i>
                    <div className="flex-1 text-xs text-red-800">
                      <p className="font-semibold">Cancelling in {timeLeft}s</p>
                      <p>Still paying? Keep this booking open.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTimeLeft(PAYMENT_WINDOW_SECONDS)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 shrink-0"
                    >
                      Keep
                    </button>
                  </div>
                ) : timeLeft !== null && (
                  <p className="text-xs font-semibold text-blue-600">
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
                      clearPendingPayment();
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
              <div className="flex flex-col items-center gap-3 py-4 bg-yellow-50 border border-yellow-200 rounded-md mt-4">
                <i className="fas fa-spinner fa-spin text-yellow-600 text-2xl"></i>
                <p className="text-sm font-medium text-yellow-800">Verifying payment with PayMongo…</p>
                <p className="text-xs text-gray-500">Please wait — do not close this window.</p>
              </div>
            ) : (
              /* Popup was closed — still verifying / offer to reopen */
              <div className="flex flex-col items-center gap-3 py-4 bg-amber-50 border border-amber-200 rounded-md mt-4">
                <i className="fas fa-spinner fa-spin text-amber-500 text-2xl"></i>
                <p className="text-sm font-medium text-amber-800">Verifying payment…</p>
                <p className="text-xs text-amber-700">If you completed payment, please wait. Otherwise, reopen the window.</p>
                {timeLeft !== null && timeLeft <= PAYMENT_WARNING_SECONDS ? (
                  <div className="w-full max-w-sm mx-4 bg-red-50 border border-red-300 rounded-md px-3 py-2 flex items-center gap-3">
                    <i className="fas fa-exclamation-triangle text-red-600"></i>
                    <div className="flex-1 text-xs text-red-800">
                      <p className="font-semibold">Cancelling in {timeLeft}s</p>
                      <p>Still paying? Keep this booking open.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTimeLeft(PAYMENT_WINDOW_SECONDS)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 shrink-0"
                    >
                      Keep
                    </button>
                  </div>
                ) : timeLeft !== null && (
                  <p className="text-xs font-semibold text-amber-600">
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
                        const tab = window.open(checkoutUrl, '_blank');
                        setPaymentPopup({ bookingId, checkoutUrl, popup: tab });
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
                      clearPendingPayment();
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
          )}
        </div>

        {/* ── Booking Confirmation ── */}
        {confirmOpen && (() => {
          const hourLabel = formatHourLabel(checkInHour);
          const typeInfo = {
            day:    { label: "Day Visit",  icon: "fa-sun",   color: "blue",   checkIn: "6:00 AM", checkOut: "6:00 PM (same day)" },
            night:  { label: "Night Stay",  icon: "fa-moon",  color: "indigo", checkIn: "6:00 PM", checkOut: "7:00 AM (next day)" },
            "24hr": { label: `24 Hours (${hourLabel})`, icon: "fa-clock", color: "purple", checkIn: hourLabel, checkOut: `${hourLabel} (next day)` },
          }[bookingType] ?? { label: "Day Visit", icon: "fa-sun", color: "blue", checkIn: "6:00 AM", checkOut: "6:00 PM (same day)" };
          const rateLabel = bookingType === "night" ? "Overnight rate" : is24hr ? "24-hour rate" : "Day visit rate";
          return (
          <div className="fixed inset-0 z-[60] overflow-y-auto flex items-center justify-center px-4 py-10"
            onKeyDown={(e) => { if (e.key === 'Escape') setConfirmOpen(false); }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmOpen(false)} />
            <div
              ref={confirmDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="booking-confirm-title"
              className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-4"
            >

              {/* Header */}
              <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 text-white">
                  <i className="fas fa-clipboard-check text-xl" aria-hidden="true"></i>
                  <div>
                    <h3 id="booking-confirm-title" className="font-bold text-lg">Booking Summary</h3>
                    <p className="text-blue-100 text-xs">Please review before proceeding to payment</p>
                  </div>
                </div>
                <button onClick={() => setConfirmOpen(false)} className="text-white/70 hover:text-white p-2 -mr-2 rounded-lg hover:bg-white/10" aria-label="Close">
                  <i className="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                {/* Booking Type Badge */}
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-${typeInfo.color}-100 text-${typeInfo.color}-800`}>
                    <i className={`fas ${typeInfo.icon}`}></i>
                    {typeInfo.label}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="px-4 py-2.5 text-gray-500 font-medium w-36">Room</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-900">{roomName}</td>
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
                        <td className="px-4 py-2.5 text-gray-900">{typeInfo.checkIn}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-gray-500 font-medium">Check-out</td>
                        <td className="px-4 py-2.5 text-gray-900">{typeInfo.checkOut}</td>
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
                    <span>{rateLabel}</span>
                    <span className={discount > 0 ? "line-through text-gray-400" : ""}>{formatPHP(baseRate)}</span>
                  </div>
                  {discount > 0 && (
                    <>
                      <div className="flex justify-between text-green-700 font-medium">
                        <span><i className="fas fa-tag mr-1 text-xs"></i>Promo ({promoInput.toUpperCase()})</span>
                        <span>− {formatPHP(discount)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-gray-900 border-t border-blue-200 pt-2">
                        <span>Discounted Rate</span>
                        <span>{formatPHP(discountedRoom)}</span>
                      </div>
                    </>
                  )}
                  {packageTotal > 0 && (
                    <div className="flex justify-between text-emerald-800 border-t border-blue-200 pt-2">
                      <span className="flex items-center gap-1.5">
                        <i className="fas fa-box text-[11px] text-emerald-500"></i>
                        Includes: {packageNames.join(', ')}
                      </span>
                      <span className="font-medium">+ {formatPHP(packageTotal)}</span>
                    </div>
                  )}
                  {optionalTotal > 0 && (
                    <div className="flex justify-between text-indigo-800 border-t border-blue-200 pt-2">
                      <span className="flex items-center gap-1.5">
                        <i className="fas fa-sparkles text-[11px] text-indigo-500"></i>
                        Add-ons: {optionalSummary.map(x => `${x.name} × ${x.qty}`).join(', ')}
                      </span>
                      <span className="font-medium">+ {formatPHP(optionalTotal)}</span>
                    </div>
                  )}
                  {/* Entrance fee line in the final confirmation.
                      Previously this just said "₱0.00 — Fully Paid" for
                      full-payment bookings, which was misleading — the
                      entrance fee is ALWAYS owed at the gate regardless
                      of how the room was paid. */}
                  <div className="flex justify-between text-amber-800">
                    <span className="flex items-center gap-1.5">
                      <i className="fas fa-ticket-alt text-[11px]"></i>
                      Entrance fee (₱{entranceRate}/pax · gate)
                    </span>
                    <span>{formatPHP(estimatedEntrance)}<span className="text-[10px] text-amber-600 ml-1">est.</span></span>
                  </div>
                  <div className="flex justify-between font-semibold text-gray-800 pt-1 border-t border-blue-100">
                    <span>Estimated Grand Total</span>
                    <span className="text-gray-900">{formatPHP(grandEstimate)}</span>
                  </div>
                  <div className="border-t border-blue-300 pt-2 flex justify-between font-bold text-blue-800 text-base">
                    <span>{paymentOption === "full" ? "Online Now (Room Only)" : "Reservation Fee (Pay Now)"}</span>
                    <span>{formatPHP(amountDue)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Still to pay at resort</span>
                    <span className="font-medium text-gray-900">{formatPHP(resortBalance)}</span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {balanceDue > 0
                      ? <>Includes {formatPHP(balanceDue)} room balance + {formatPHP(estimatedEntrance)} gate entrance.</>
                      : <>Room is fully settled online; only the entrance fee remains at the gate.</>}
                  </p>
                </div>

                {/* Payment option badge — the full-payment pill used to
                    claim "₱0 balance at check-in". That was wrong:
                    entrance is always owed at the gate. */}
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                  paymentOption === "full"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-blue-50 text-blue-800 border border-blue-200"
                }`}>
                  <i className={`fas ${paymentOption === "full" ? "fa-check-circle text-emerald-600" : "fa-bookmark text-blue-500"}`}></i>
                  {paymentOption === "full"
                    ? `Paying full room online — only the ₱${entranceRate}/pax entrance fee will be collected at the gate`
                    : `Reserve only — ${formatPHP(resortBalance)} balance (room + entrance) due at resort`}
                </div>

                {/* Payment note */}
                <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  <i className="fas fa-lock text-blue-500 mt-0.5 shrink-0"></i>
                  <span>A <span className="font-medium">PayMongo</span> checkout window will open. You can pay via <span className="font-medium">GCash</span>.</span>
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
          );
        })()}
      </div>

      {/* Verify-email modal — opens on top of the BookingModal when the
          authenticated guest hits the "Verify Now" CTA. Closes after
          success; the refreshed user state propagates and the
          needsVerification gate clears on the next render. */}
      <VerifyEmailModal open={verifyOpen} onClose={() => setVerifyOpen(false)} />
    </Modal>
  );
}
