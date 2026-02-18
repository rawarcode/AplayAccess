import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal.jsx";

const PROMO_CODES = {
  SUMMER2024: { type: "percentage", value: 10 },
  WELCOME100: { type: "fixed", value: 100 },
};

const RESERVATION_FEE = 150;
const TAXES_AND_FEES = 500;

function formatPHP(n) {
  return `₱${Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function BookingModal({ open, onClose, selectedRoom, rooms, onBooked }) {
  const roomRates = useMemo(() => {
    const map = {};
    for (const r of rooms) map[r.name] = r.price;
    return map;
  }, [rooms]);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [roomType, setRoomType] = useState(selectedRoom || "");
  const [guests, setGuests] = useState("2");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState({ type: "info", text: "" });
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("GCash");

  useEffect(() => {
    if (open) {
      setRoomType(selectedRoom || "");
      setPromoCode("");
      setDiscountAmount(0);
      setPromoMessage({ type: "info", text: "" });
    }
  }, [open, selectedRoom]);

  const minDates = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    return { today: fmt(today), tomorrow: fmt(tomorrow) };
  }, []);

  const roomRate = roomRates[roomType] || 0;
  const subtotal = roomRate + TAXES_AND_FEES;
  const balanceDue = Math.max(0, subtotal - discountAmount);

  function applyPromo() {
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      setPromoMessage({ type: "error", text: "Please enter a promo code." });
      return;
    }
    const promo = PROMO_CODES[code];
    if (!promo) {
      setDiscountAmount(0);
      setPromoMessage({ type: "error", text: "Invalid promo code." });
      return;
    }

    let discount = 0;
    if (promo.type === "percentage") discount = subtotal * (promo.value / 100);
    if (promo.type === "fixed") discount = Math.min(promo.value, subtotal);

    setDiscountAmount(discount);
    setPromoMessage({ type: "success", text: `Promo "${code}" applied! You saved ${formatPHP(discount)}.` });
  }

  function submit(e) {
    e.preventDefault();
    onClose();
    onBooked({
      checkIn,
      checkOut,
      roomType,
      guests,
      name,
      email,
      phone,
      specialRequests,
      promoCode: promoCode.trim().toUpperCase(),
      paymentMethod,
      totals: {
        reservationFee: RESERVATION_FEE,
        roomRate,
        taxes: TAXES_AND_FEES,
        discount: discountAmount,
        dueNow: RESERVATION_FEE,
        balanceDue,
      },
    });
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-2xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-2xl font-bold text-gray-900">Book Your Stay at Aplaya</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date</label>
              <input
                type="date"
                min={minDates.today}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Date</label>
              <input
                type="date"
                min={minDates.tomorrow}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
              <select
                value={roomType}
                onChange={(e) => {
                  setRoomType(e.target.value);
                  setDiscountAmount(0);
                  setPromoCode("");
                  setPromoMessage({ type: "info", text: "" });
                }}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Guests</label>
              <select
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">1 Adult</option>
                <option value="2">2 Adults</option>
                <option value="3">3 Adults</option>
                <option value="4">4 Adults</option>
                <option value="family">Family (2 Adults + 2 Children)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests</label>
              <textarea
                rows={2}
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any special requests?"
              />
            </div>

            <div className="md:col-span-2">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <span className="font-medium">Cancellation Policy:</span> Cancellations or no-shows will result in the
                  forfeiture of the ₱150.00 reservation fee.
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-md mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Payment Summary</h4>
                <div className="flex justify-between mb-1 text-sm">
                  <span className="text-gray-600">Reservation Fee (Non-refundable):</span>
                  <span className="font-medium">{formatPHP(RESERVATION_FEE)}</span>
                </div>
                <div className="flex justify-between mb-1 text-sm">
                  <span className="text-gray-600">Room Rate:</span>
                  <span className="font-medium">{formatPHP(roomRate)}</span>
                </div>
                <div className="flex justify-between mb-1 text-sm">
                  <span className="text-gray-600">Taxes & Fees:</span>
                  <span className="font-medium">{formatPHP(TAXES_AND_FEES)}</span>
                </div>
                <div className="flex justify-between mb-1 text-sm">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-medium text-green-700">-{formatPHP(discountAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                  <span className="text-gray-900 font-bold">Total Due Now (Reservation Fee):</span>
                  <span className="text-blue-700 font-bold text-lg">{formatPHP(RESERVATION_FEE)}</span>
                </div>
                <div className="flex justify-between mt-1 text-sm">
                  <span className="text-gray-600">Balance Due at Check-in:</span>
                  <span className="text-gray-900 font-medium">{formatPHP(balanceDue)}</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
                <div className="flex">
                  <input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="flex-grow px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter promo code"
                  />
                  <button
                    type="button"
                    onClick={applyPromo}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-r-md text-sm font-medium"
                  >
                    Apply
                  </button>
                </div>
                {promoMessage.text ? (
                  <p className={`mt-1 text-sm ${promoMessage.type === "success" ? "text-green-700" : "text-red-600"}`}>
                    {promoMessage.text}
                  </p>
                ) : null}
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-3">Payment Method (Reservation Fee)</label>
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

          <button className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md">
            Complete Booking
          </button>
        </form>
      </div>
    </Modal>
  );
}
