import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const ROOM_RATES = {
  "Deluxe Ocean View": 199,
  "Beachfront Suite": 299,
  "Presidential Suite": 499,
  "Garden View Room": 149,
  "Family Room": 249,
  "Single Room": 99,
};

const PROMO_CODES = {
  SUMMER2024: { type: "percentage", value: 10 }, // 10% off (room + taxes)
  WELCOME100: { type: "fixed", value: 100 }, // ₱100 off (room + taxes)
};

const RESERVATION_FEE = 150;
const TAXES_AND_FEES = 500;

function formatPHP(n) {
  return `₱${Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Modal({ open, onClose, maxWidth = "max-w-lg", children }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="absolute inset-0 bg-gray-500/75" />
        <div className={`relative w-full ${maxWidth} bg-white rounded-xl shadow-2xl overflow-hidden`}>
          {children}
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-lg">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <span className="text-green-700 text-xl">✓</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Booking Successful!</h3>
            <p className="text-sm text-gray-600 mt-1">
              Thank you for booking with Aplaya Beach Resort. We&apos;ve sent a confirmation to your email address.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

function LoginModal({ open, onClose, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function submit(e) {
    e.preventDefault();
    onLoginSuccess({
      name: "Guest",
      email,
      phone: "+63 9xx xxx xxxx",
    });
    onClose();
  }

  async function googleSignIn() {
    setGoogleLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    onLoginSuccess({
      name: "Google User",
      email: "google.user@example.com",
      phone: "+1 (555) 987-6543",
    });
    setGoogleLoading(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md">
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-2xl font-bold text-gray-900">Login to Your Account</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>

            <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              Forgot password?
            </Link>
          </div>

          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md">
            Login
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={googleSignIn}
            disabled={googleLoading}
            className="mt-6 w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {googleLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                Signing in...
              </span>
            ) : (
              <>
                <span className="text-lg">G</span>
                Sign in with Google
              </>
            )}
          </button>

          <p className="mt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </Modal>
  );
}

function BookingModal({ open, onClose, selectedRoom, onBooked }) {
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

  const roomRate = ROOM_RATES[roomType] || 0;
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

        <form onSubmit={submit} className="bg-white rounded-lg">
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
                {Object.keys(ROOM_RATES).map((k) => (
                  <option key={k} value={k}>
                    {k}
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

function AlertModal({ open, onClose, title = "Alert", type = "info", message }) {
  if (!open) return null;

  const styles = {
    info: { header: "bg-blue-100", iconBg: "bg-blue-200", icon: "ℹ️" },
    success: { header: "bg-green-100", iconBg: "bg-green-200", icon: "✅" },
    error: { header: "bg-red-100", iconBg: "bg-red-200", icon: "⛔" },
    warning: { header: "bg-yellow-100", iconBg: "bg-yellow-200", icon: "⚠️" },
  }[type] || { header: "bg-blue-100", iconBg: "bg-blue-200", icon: "ℹ️" };

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md">
      <div className={`p-5 ${styles.header}`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full ${styles.iconBg} flex items-center justify-center`}>
            <span className="text-lg">{styles.icon}</span>
          </div>
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        </div>
      </div>

      <div className="p-6">
        <p className="text-base text-gray-700 text-center">{message}</p>
        <button
          onClick={onClose}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
        >
          OK
        </button>
      </div>
    </Modal>
  );
}

function GuestDashboard({ open, user, onClose, onLogout }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-100 overflow-y-auto">
      <div className="min-h-screen flex flex-col">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏖️</span>
              <span className="text-xl font-bold text-blue-600">Aplaya Beach Resort</span>
            </div>
            <button onClick={onLogout} className="text-gray-700 hover:text-blue-600 text-sm font-medium">
              Logout
            </button>
          </div>
        </header>

        <main className="flex-grow">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome Back, <span className="text-blue-700">{user?.name || "Guest"}</span>!
              </h1>
              <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900">
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
              <div className="bg-blue-100 p-4 rounded-lg shadow-sm text-center">
                <p className="text-sm font-medium text-gray-700">Upcoming Bookings</p>
                <p className="text-2xl font-bold text-blue-700">1</p>
              </div>
              <div className="bg-green-100 p-4 rounded-lg shadow-sm text-center">
                <p className="text-sm font-medium text-gray-700">Past Bookings</p>
                <p className="text-2xl font-bold text-green-700">1</p>
              </div>
              <div className="bg-yellow-100 p-4 rounded-lg shadow-sm text-center">
                <p className="text-sm font-medium text-gray-700">Pending Actions</p>
                <p className="text-2xl font-bold text-yellow-700">0</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Bookings</h2>
                <div className="border rounded-lg p-4 shadow-sm">
                  <p className="font-bold text-gray-800">Deluxe Ocean View</p>
                  <p className="text-sm text-gray-600">Dec 15 - Dec 20</p>
                  <p className="text-sm text-gray-600">2 Guests</p>
                  <p className="text-sm text-gray-600">Booking ID: RES-2023-001</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Past Bookings</h2>
                <div className="border rounded-lg p-4 shadow-sm">
                  <p className="font-bold text-gray-800">Beachfront Suite</p>
                  <p className="text-sm text-gray-600">Aug 10 - Aug 15</p>
                  <p className="text-sm text-gray-600">2 Guests</p>
                  <p className="text-sm text-gray-600">Booking ID: RES-2023-000</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Account Details</h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Full Name</p>
                    <p className="text-gray-900">{user?.name || "Guest"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Email</p>
                    <p className="text-gray-900">{user?.email || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Phone</p>
                    <p className="text-gray-900">{user?.phone || "-"}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md lg:col-span-3">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Booking Calendar</h2>
                <p className="text-gray-500 text-center">Calendar view coming soon...</p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Local Weather</h2>
                <div className="text-center">
                  <p className="text-4xl font-bold text-gray-800">32°C</p>
                  <p className="text-gray-600">Sunny</p>
                  <p className="text-sm text-gray-500 mt-2">Aplaya Beach, Today</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Account Security</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-700">Two-Factor Authentication</p>
                    <span className="text-green-600 text-sm">Enabled</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-700">Last Login</p>
                    <span className="text-gray-600 text-sm">2 hours ago</span>
                  </div>
                  <a href="#" className="text-sm text-blue-600 hover:underline">
                    Manage Security
                  </a>
                </div>
              </div>
            </div>

            <footer className="bg-gray-100 py-6 mt-8">
              <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
                <p className="text-sm text-gray-600">© 2025 Aplaya Beach Resort. All rights reserved.</p>
                <div className="mt-4 md:mt-0 flex space-x-6 text-sm">
                  <a href="#" className="text-gray-500 hover:text-blue-600">
                    Help Center
                  </a>
                  <a href="#" className="text-gray-500 hover:text-blue-600">
                    Contact Us
                  </a>
                  <a href="#" className="text-gray-500 hover:text-blue-600">
                    FAQs
                  </a>
                  <a href="#" className="text-gray-500 hover:text-blue-600">
                    Privacy Policy
                  </a>
                </div>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Resort() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState("");
  const [user, setUser] = useState(null);

  const [contactAlert, setContactAlert] = useState({ open: false, type: "success", title: "Success", message: "" });
  const [newsletterAlert, setNewsletterAlert] = useState({
    open: false,
    type: "success",
    title: "Success",
    message: "",
  });

  const isLoggedIn = !!user;

  function openBooking(room = "") {
    setSelectedRoom(room);
    setBookingOpen(true);
  }

  function handleLoginSuccess(u) {
    setUser(u);
    setDashboardOpen(true);
  }

  function handleBooked() {
    setSuccessOpen(true);
  }

  function logout() {
    setDashboardOpen(false);
    setUser(null);
  }

  // ✅ Scroll lock ONLY when modal/dashboard is open (prevents your “can’t scroll” bug)
  useEffect(() => {
    const lock = bookingOpen || loginOpen || successOpen || dashboardOpen;
    document.body.style.overflow = lock ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [bookingOpen, loginOpen, successOpen, dashboardOpen]);

  function submitContact(e) {
    e.preventDefault();
    setContactAlert({
      open: true,
      type: "success",
      title: "Success",
      message: "Your message has been sent successfully!",
    });
    e.currentTarget.reset();
  }

  function submitNewsletter(e) {
    e.preventDefault();
    const emailInput = e.currentTarget.querySelector('input[type="email"]');
    const email = (emailInput?.value || "").trim();
    if (!email) {
      setNewsletterAlert({
        open: true,
        type: "error",
        title: "Error",
        message: "Please enter your email address.",
      });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setNewsletterAlert({
        open: true,
        type: "error",
        title: "Error",
        message: "Please enter a valid email address.",
      });
      return;
    }
    setNewsletterAlert({
      open: true,
      type: "success",
      title: "Success",
      message: "Thank you for subscribing to our newsletter!",
    });
    e.currentTarget.reset();
  }

  return (
    <div className="font-sans">
      {/* NAV */}
      <nav className="fixed w-full z-40 bg-white/90 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <a href="#home" className="flex items-center gap-2">
                <span className="text-2xl">🏖️</span>
                <span className="text-xl font-bold text-blue-600">Aplaya Beach Resort</span>
              </a>
            </div>

            <div className="hidden md:flex md:items-center md:space-x-4">
              <a href="#home" className="text-blue-600 hover:text-blue-800 px-3 py-2 text-sm font-medium">
                Home
              </a>
              <a href="#rooms" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                Rooms
              </a>
              <a href="#amenities" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                Amenities
              </a>
              <a href="#gallery" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                Gallery
              </a>
              <a href="#contact" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                Contact
              </a>

              <button
                onClick={() => (isLoggedIn ? setDashboardOpen(true) : setLoginOpen(true))}
                className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium"
              >
                {isLoggedIn ? "My Account" : "Login"}
              </button>

              <button
                onClick={() => openBooking("")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Book Now
              </button>
            </div>

            <div className="-mr-2 flex items-center md:hidden">
              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100"
                aria-label="Open menu"
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="md:hidden bg-white shadow-lg">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <a href="#home" className="block px-3 py-2 text-base font-medium text-blue-600">
                Home
              </a>
              <a href="#rooms" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600">
                Rooms
              </a>
              <a href="#amenities" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600">
                Amenities
              </a>
              <a href="#gallery" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600">
                Gallery
              </a>
              <a href="#contact" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600">
                Contact
              </a>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openBooking("");
                }}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Book Now
              </button>
            </div>
          </div>
        ) : null}
      </nav>

      {/* HERO */}
      <section
        id="home"
        className="min-h-screen flex items-center justify-center text-center relative"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-white z-10">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Welcome to Paradise</h1>
          <p className="text-xl md:text-2xl mb-8">
            Aplaya Beach Resort offers the perfect blend of luxury, comfort, and breathtaking ocean views.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => openBooking("")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md text-lg font-medium"
            >
              Book Your Stay
            </button>
            <a
              href="#rooms"
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-md text-lg font-medium backdrop-blur-sm"
            >
              Explore Rooms
            </a>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:flex lg:items-center lg:justify-between gap-10">
            <div className="lg:w-1/2 mb-10 lg:mb-0">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Discover Aplaya Beach Resort</h2>
              <p className="text-gray-600 mb-4">
                Nestled along the pristine coastline, Aplaya Beach Resort is a tropical paradise offering luxurious
                accommodations, world-class amenities, and unforgettable experiences.
              </p>
              <p className="text-gray-600 mb-6">
                Our resort combines modern comfort with traditional charm, creating the perfect setting for your dream
                vacation.
              </p>
              <div className="flex flex-wrap gap-4 text-gray-700">
                <span className="inline-flex items-center gap-2">📶 Free WiFi</span>
                <span className="inline-flex items-center gap-2">🏊 Infinity Pool</span>
                <span className="inline-flex items-center gap-2">🍽️ Fine Dining</span>
                <span className="inline-flex items-center gap-2">💆 Spa Services</span>
              </div>
            </div>

            <div className="lg:w-1/2 relative">
              <div className="relative rounded-xl overflow-hidden shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=80"
                  alt="Resort View"
                  className="w-full h-auto"
                  loading="lazy"
                />
                <div className="absolute -bottom-6 -right-6 bg-blue-600 text-white p-6 rounded-xl shadow-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold">4.9</p>
                    <p className="text-sm">Guest Rating</p>
                    <p className="text-sm mt-1">★★★★★</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROOMS */}
      <section id="rooms" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Accommodations</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Choose from our selection of luxurious rooms and suites, each designed to provide the ultimate comfort and
              relaxation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                name: "Deluxe Ocean View",
                desc: "Wake up to breathtaking ocean views from your private balcony in our spacious deluxe rooms.",
                badge: { text: "Popular", className: "bg-blue-600" },
                img: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=2070&q=80",
                price: 199,
              },
              {
                name: "Beachfront Suite",
                desc: "Direct beach access from your private terrace in our luxurious beachfront suites.",
                img: "https://plus.unsplash.com/premium_photo-1661962346904-8a489ef9b9e7?auto=format&fit=crop&w=1974&q=80",
                price: 299,
              },
              {
                name: "Presidential Suite",
                desc: "The ultimate in luxury with separate living area, dining room, and panoramic ocean views.",
                badge: { text: "Luxury", className: "bg-yellow-500" },
                img: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=2000&q=80",
                price: 499,
              },
            ].map((r) => (
              <div key={r.name} className="bg-white rounded-xl overflow-hidden shadow-md transition hover:-translate-y-2 hover:shadow-xl">
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
                  <p className="text-gray-600 mb-4">{r.desc}</p>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-2xl font-bold text-blue-600">₱{r.price}</span>
                      <span className="text-gray-500 text-sm">/ night</span>
                    </div>
                    <button
                      onClick={() => openBooking(r.name)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              to="/rooms"
              className="inline-block bg-white hover:bg-gray-100 text-blue-600 font-medium px-6 py-3 rounded-md border border-blue-600 transition"
            >
              View All Rooms
            </Link>
          </div>
        </div>
      </section>

      {/* AMENITIES */}
      <section id="amenities" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Resort Amenities</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We provide everything you need for a perfect vacation experience.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: "Infinity Pool", desc: "Stunning infinity pool overlooking the ocean with swim-up bar.", icon: "🏊" },
              { title: "Gourmet Dining", desc: "Three restaurants serving local and international cuisine.", icon: "🍽️" },
              { title: "Spa & Wellness", desc: "Full-service spa with traditional treatments and massage.", icon: "💆" },
              { title: "Water Sports", desc: "Snorkeling, kayaking, and paddleboarding equipment available.", icon: "🌊" },
            ].map((a) => (
              <div key={a.title} className="text-center p-6 rounded-xl bg-gray-50 hover:bg-blue-50 transition">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                  {a.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{a.title}</h3>
                <p className="text-gray-600">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">What Our Guests Say</h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Don&apos;t just take our word for it - hear from our satisfied guests.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Sarah Johnson",
                img: "https://randomuser.me/api/portraits/women/32.jpg",
                stars: "★★★★★",
                quote:
                  "Absolutely stunning resort! The beachfront suite was beyond our expectations with direct access to the beach. The staff went above and beyond to make our anniversary special.",
              },
              {
                name: "Michael Chen",
                img: "https://randomuser.me/api/portraits/men/45.jpg",
                stars: "★★★★★",
                quote:
                  "The infinity pool is breathtaking at sunset. Food was excellent at all restaurants. We'll definitely be returning next year!",
              },
              {
                name: "Emma Rodriguez",
                img: "https://randomuser.me/api/portraits/women/68.jpg",
                stars: "★★★★☆",
                quote:
                  "Perfect family vacation spot! Kids loved the water sports and kids club. The spa treatments were divine. Highly recommend the beachfront massage.",
              },
            ].map((t) => (
              <div key={t.name} className="bg-white/10 p-6 rounded-xl backdrop-blur-sm hover:scale-[1.03] transition">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden mr-4">
                    <img src={t.img} alt={t.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div>
                    <h4 className="font-bold">{t.name}</h4>
                    <div className="text-yellow-300">{t.stars}</div>
                  </div>
                </div>
                <p className="text-blue-100">&ldquo;{t.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section id="gallery" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Gallery</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">Take a visual journey through our beautiful resort.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { alt: "Resort Pool", src: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=2070&q=80" },
              { alt: "Beach View", src: "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?auto=format&fit=crop&w=2071&q=80" },
              { alt: "Restaurant", src: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=2089&q=80" },
              { alt: "Spa", src: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=80" },
              { alt: "Beach Bar", src: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=2089&q=80" },
              { alt: "Sunset", src: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=80" },
            ].map((g) => (
              <div key={g.alt} className="rounded-xl overflow-hidden shadow-lg">
                <img
                  src={g.src}
                  alt={g.alt}
                  className="w-full h-64 object-cover hover:scale-105 transition duration-500 cursor-pointer"
                  loading="lazy"
                />
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              to="/gallery"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium transition"
            >
              View More Photos
            </Link>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:flex lg:items-center lg:justify-between gap-10">
            <div className="lg:w-1/2 mb-10 lg:mb-0">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Contact Us</h2>
              <p className="text-gray-600 mb-6">
                Have questions or need assistance with your booking? Our team is here to help you plan your perfect getaway.
              </p>

              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 mt-0.5">📍</span>
                  <div>
                    <p className="font-medium text-gray-900">Address</p>
                    <p className="text-gray-500">123 Beachfront Avenue, Coastal City, Paradise Island</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-blue-600 mt-0.5">📞</span>
                  <div>
                    <p className="font-medium text-gray-900">Phone</p>
                    <p className="text-gray-500">+1 (555) 123-4567</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-blue-600 mt-0.5">✉️</span>
                  <div>
                    <p className="font-medium text-gray-900">Email</p>
                    <p className="text-gray-500">reservations@aplayabeachresort.com</p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Follow Us</h3>
                <div className="flex space-x-4 text-xl">
                  <a href="#" className="text-gray-500 hover:text-blue-600">f</a>
                  <a href="#" className="text-gray-500 hover:text-blue-600">ig</a>
                  <a href="#" className="text-gray-500 hover:text-blue-600">x</a>
                  <a href="#" className="text-gray-500 hover:text-blue-600">ta</a>
                </div>
              </div>
            </div>

            <div className="lg:w-1/2">
              <form onSubmit={submitContact} className="bg-white p-6 rounded-lg shadow-md">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your name"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your email"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Subject"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your message"
                    required
                  />
                </div>

                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition">
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Subscribe to Our Newsletter</h2>
          <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
            Stay updated with our latest offers, news, and events. Join our mailing list today!
          </p>

          <form onSubmit={submitNewsletter} className="max-w-md mx-auto flex">
            <input
              type="email"
              placeholder="Your email address"
              className="flex-grow px-4 py-3 rounded-l-md focus:outline-none text-gray-900"
            />
            <button
              type="submit"
              className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-medium px-6 py-3 rounded-r-md transition"
            >
              Subscribe
            </button>
          </form>

          <p className="text-xs text-blue-200 mt-4">We respect your privacy. Unsubscribe at any time.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4">Aplaya Beach Resort</h3>
              <p className="text-gray-400 text-sm">
                Your perfect tropical getaway offering luxury accommodations, world-class amenities, and unforgettable experiences.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#home" className="text-gray-400 hover:text-white">Home</a></li>
                <li><a href="#rooms" className="text-gray-400 hover:text-white">Rooms & Suites</a></li>
                <li><a href="#amenities" className="text-gray-400 hover:text-white">Amenities</a></li>
                <li><a href="#gallery" className="text-gray-400 hover:text-white">Gallery</a></li>
                <li><a href="#contact" className="text-gray-400 hover:text-white">Contact Us</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Contact Info</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li className="flex items-start gap-2"><span className="text-blue-500">📍</span>123 Beachfront Avenue, Coastal City</li>
                <li className="flex items-center gap-2"><span className="text-blue-500">📞</span>+1 (555) 123-4567</li>
                <li className="flex items-center gap-2"><span className="text-blue-500">✉️</span>reservations@aplayabeachresort.com</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Opening Hours</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li className="flex justify-between"><span>Monday - Friday</span><span>9:00 AM - 6:00 PM</span></li>
                <li className="flex justify-between"><span>Saturday</span><span>10:00 AM - 4:00 PM</span></li>
                <li className="flex justify-between"><span>Sunday</span><span>Closed</span></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm mb-4 md:mb-0">© 2023 Aplaya Beach Resort. All rights reserved.</p>
            <div className="flex space-x-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white">Facebook</a>
              <a href="#" className="hover:text-white">Twitter</a>
              <a href="#" className="hover:text-white">Instagram</a>
              <a href="#" className="hover:text-white">Tripadvisor</a>
            </div>
          </div>
        </div>
      </footer>

      {/* MODALS (same page) */}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLoginSuccess={handleLoginSuccess} />
      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        selectedRoom={selectedRoom}
        onBooked={() => handleBooked()}
      />
      <SuccessModal open={successOpen} onClose={() => setSuccessOpen(false)} />
      <GuestDashboard
        open={dashboardOpen}
        user={user}
        onClose={() => setDashboardOpen(false)}
        onLogout={logout}
      />

      <AlertModal
        open={contactAlert.open}
        onClose={() => setContactAlert((s) => ({ ...s, open: false }))}
        type={contactAlert.type}
        title={contactAlert.title}
        message={contactAlert.message}
      />

      <AlertModal
        open={newsletterAlert.open}
        onClose={() => setNewsletterAlert((s) => ({ ...s, open: false }))}
        type={newsletterAlert.type}
        title={newsletterAlert.title}
        message={newsletterAlert.message}
      />
    </div>
  );
}
