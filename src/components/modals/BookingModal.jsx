import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { createBooking } from "../../lib/bookingApi.js";

// Available start times for an 8-hour slot
const TIME_SLOTS = [
  { label: "7:00 AM",  value: "07:00", end: "3:00 PM"  },
  { label: "8:00 AM",  value: "08:00", end: "4:00 PM"  },
  { label: "9:00 AM",  value: "09:00", end: "5:00 PM"  },
  { label: "10:00 AM", value: "10:00", end: "6:00 PM"  },
  { label: "11:00 AM", value: "11:00", end: "7:00 PM"  },
  { label: "12:00 PM", value: "12:00", end: "8:00 PM"  },
  { label: "1:00 PM",  value: "13:00", end: "9:00 PM"  },
  { label: "2:00 PM",  value: "14:00", end: "10:00 PM" },
];

const SLOT_RATE       = 1500; // full 8-hour rate
const RESERVATION_FEE = 150;  // due now (holds the slot)
const BALANCE_DUE     = SLOT_RATE - RESERVATION_FEE; // 1350 — due at check-in

function formatPHP(n) {
  return `₱${Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const MIN_GUESTS = 1;
const MAX_GUESTS = 20;

/** Returns today's date string as YYYY-MM-DD */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BookingModal({ open, onClose, selectedRoom, rooms, onBooked }) {
  const [visitDate, setVisitDate]   = useState("");
  const [visitTime, setVisitTime]   = useState("09:00");
  const [roomType, setRoomType]     = useState(selectedRoom || "");
  const [guests, setGuests]         = useState(2);
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [phone, setPhone]           = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [paymentMethod, setPaymentMethod]     = useState("GCash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");

  const selectedSlot = TIME_SLOTS.find((s) => s.value === visitTime) ?? TIME_SLOTS[2];

  useEffect(() => {
    if (open) {
      setRoomType(selectedRoom || "");
      setVisitDate("");
      setError("");
    }
  }, [open, selectedRoom]);

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (!visitDate) {
      setError("Please select a visit date.");
      return;
    }
    if (!roomType) {
      setError("Please select a room type.");
      return;
    }

    const room = rooms.find((r) => r.name === roomType);
    if (!room?.id) {
      setError("Could not determine room. Please try again.");
      return;
    }

    // Datetime string sent to backend: "YYYY-MM-DD HH:MM:00"
    const checkIn = `${visitDate} ${visitTime}:00`;

    setSubmitting(true);
    try {
      const result = await createBooking({
        room_id:          room.id,
        check_in:         checkIn,
        guests:           guests,
        payment_method:   paymentMethod,
        special_requests: specialRequests || null,
      });

      onClose();
      onBooked({
        checkIn:  `${visitDate} · ${selectedSlot.label}`,
        checkOut: `${visitDate} · ${selectedSlot.end}`,
        roomType,
        guests,
        paymentMethod,
        totals: {
          reservationFee: RESERVATION_FEE,
          balanceDue:     BALANCE_DUE,
        },
        bookingData: result.data,
      });
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
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-2xl font-bold text-gray-900">Book Your Visit at Aplaya</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            ✕
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={submit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Visit date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                min={todayStr()}
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Time slot */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(8-hr slot)</span>
              </label>
              <select
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIME_SLOTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} – {s.end}
                  </option>
                ))}
              </select>
            </div>

            {/* Room type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Type <span className="text-red-500">*</span></label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Room Type</option>
                {rooms.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
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
                >
                  −
                </button>
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
                >
                  +
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {guests === 1 ? "1 guest" : `${guests} guests`}
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your full name"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your email address"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your phone number"
              />
            </div>

            {/* Special requests */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
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
                  forfeiture of the ₱150.00 reservation fee.
                </p>
              </div>

              {/* Payment summary */}
              <div className="bg-blue-50 p-4 rounded-md mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Payment Summary</h4>
                <div className="flex justify-between mb-1 text-sm">
                  <span className="text-gray-600">8-Hour Slot Rate:</span>
                  <span className="font-medium">{formatPHP(SLOT_RATE)}</span>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-2 mt-2">
                  <span className="text-gray-900 font-bold">Reservation Fee (Due Now):</span>
                  <span className="text-blue-700 font-bold text-lg">{formatPHP(RESERVATION_FEE)}</span>
                </div>
                <div className="flex justify-between mt-1 text-sm">
                  <span className="text-gray-600">Balance Due at Check-in:</span>
                  <span className="text-gray-900 font-medium">{formatPHP(BALANCE_DUE)}</span>
                </div>
              </div>

              {/* Payment method */}
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Payment Method (Reservation Fee)
              </label>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="GCash"
                    checked={paymentMethod === "GCash"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <span className="text-sm text-gray-800">GCash</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="PayMaya"
                    checked={paymentMethod === "PayMaya"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <span className="text-sm text-gray-800">PayMaya</span>
                </label>
              </div>
            </div>
          </div>

          <button
            disabled={submitting}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-3 px-4 rounded-md"
          >
            {submitting ? "Processing..." : "Complete Booking"}
          </button>
        </form>
      </div>
    </Modal>
  );
}
