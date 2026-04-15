import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { getPaymentStatus } from "../lib/paymentApi.js";
import { getGuestPaymentStatus, downloadGuestReceipt } from "../lib/bookingApi.js";

/**
 * Handles the redirect back from PayMongo after checkout.
 *
 * Two modes:
 *  A) Popup mode  — opened by BookingModal; notifies parent via postMessage then closes.
 *  B) Full-page   — user somehow landed here directly; shows success/failed UI.
 *
 * Routes:
 *   /payment/success?booking=<id>           (logged-in)
 *   /payment/success?token=<uuid>&guest=1   (guest)
 *   /payment/failed?booking=<id>
 *   /payment/failed?token=<uuid>&guest=1
 */
export default function PaymentReturn({ outcome }) {
  const [searchParams] = useSearchParams();
  const isGuest        = searchParams.get("guest") === "1";
  const bookingId      = isGuest
    ? searchParams.get("token")
    : searchParams.get("booking");
  const isPopup        = Boolean(window.opener);

  const [status,       setStatus]       = useState("loading");
  const [downloading,  setDownloading]  = useState(false);
  const [dlError,      setDlError]      = useState("");

  const pageTitle = status === "confirmed" ? "Payment Confirmed"
    : status === "pending" ? "Payment Processing"
    : status === "failed" ? "Payment Failed"
    : "Verifying Payment";

  async function handleDownload() {
    if (!bookingId) return;
    setDownloading(true);
    setDlError("");
    try {
      const blob = await downloadGuestReceipt(bookingId);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `booking-receipt.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDlError("Could not download receipt. Please contact the resort.");
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    // ── POPUP MODE ────────────────────────────────────────────────────────────
    if (isPopup) {
      if (outcome === "failed") {
        try { window.opener.postMessage({ type: "paymongo_cancelled", bookingId }, "*"); } catch { /* ignore */ }
        setStatus("closing_failed");
        window.close();
      } else {
        try { window.opener.postMessage({ type: "paymongo_paid", bookingId }, "*"); } catch { /* ignore */ }
        setStatus("closing_success");
        window.close();
      }
      return;
    }

    // ── FULL-PAGE MODE ────────────────────────────────────────────────────────
    if (!bookingId) { setStatus("failed"); return; }

    if (outcome === "failed") {
      let tries = 0;
      async function pollAfterCancel() {
        try {
          const data = isGuest
            ? await getGuestPaymentStatus(bookingId)
            : await getPaymentStatus(bookingId);
          if (data.paid || data.status === "Confirmed") { setStatus("confirmed"); return; }
          tries++;
          if (tries < 8) setTimeout(pollAfterCancel, 2000);
          else setStatus("failed");
        } catch { setStatus("failed"); }
      }
      pollAfterCancel();
      return;
    }

    let tries = 0;
    async function poll() {
      try {
        const data = isGuest
          ? await getGuestPaymentStatus(bookingId)
          : await getPaymentStatus(bookingId);
        if (data.paid || data.status === "Confirmed") { setStatus("confirmed"); return; }
        tries++;
        if (tries < 6) setTimeout(poll, 2000);
        else           setStatus("pending");
      } catch { setStatus("failed"); }
    }
    poll();
  }, [bookingId, outcome, isPopup]);

  // ── Popup closing screen ──────────────────────────────────────────────────
  if (isPopup) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "radial-gradient(circle at 10% 30%, #d4e9f5, #f8ffff)" }}
      >
        <Helmet><title>{pageTitle} — Aplaya Beach Resort</title></Helmet>
        <div className="text-center p-8 animate-hero-fade-in opacity-0">
          {status === "closing_success" ? (
            <>
              <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <i className="fas fa-check text-green-600 text-2xl"></i>
              </div>
              <p className="text-lg font-semibold text-gray-800">Payment received!</p>
              <p className="text-sm text-gray-500 mt-1">Closing window…</p>
            </>
          ) : status === "verifying" ? (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
              <p className="text-lg font-semibold text-gray-800">Verifying payment…</p>
              <p className="text-sm text-gray-500 mt-1">Please wait a moment.</p>
            </>
          ) : (
            <>
              <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <i className="fas fa-times text-red-600 text-2xl"></i>
              </div>
              <p className="text-lg font-semibold text-gray-800">Payment cancelled.</p>
              <p className="text-sm text-gray-500 mt-1">Closing window…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Full-page screens ─────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "radial-gradient(circle at 10% 30%, #d4e9f5, #f8ffff)" }}
    >
      <Helmet><title>{pageTitle} — Aplaya Beach Resort</title></Helmet>

      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center animate-hero-fade-in opacity-0"
        style={{ boxShadow: "0 30px 50px -30px rgba(0,80,100,0.25), 0 6px 12px rgba(0,0,0,0.02)" }}
      >

        {status === "loading" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 border-4 border-[#cde3ec] border-t-[#1e3a8a] rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-light text-[#1e3a8a] mb-2">Verifying your payment…</h2>
            <p className="text-sm text-[#6b8cae]">Please wait. This only takes a few seconds.</p>
          </>
        )}

        {status === "confirmed" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <i className="fas fa-check text-green-600 text-3xl"></i>
              </div>
            </div>
            <h2 className="text-2xl font-light text-[#1e3a8a] mb-2">Payment Confirmed!</h2>
            <p className="text-[#4a6f8c] mb-1">Your reservation fee has been received.</p>
            {bookingId && (
              <p className="text-xs text-[#6b8cae] mb-1">
                <i className="fas fa-hashtag mr-1"></i>
                Booking ref: <span className="font-medium text-[#1e3a8a]">{bookingId}</span>
              </p>
            )}
            <p className="text-[#6b8cae] text-sm mb-5">
              Your booking is now <span className="font-semibold text-green-600">Confirmed</span>.
            </p>
            {isGuest ? (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4 text-xs text-amber-800 text-left flex items-start gap-2">
                  <i className="fas fa-info-circle mt-0.5 shrink-0 text-amber-500"></i>
                  <span>You booked as a guest. Download your receipt now — this is the only way to retrieve your booking details without contacting the resort.</span>
                </div>
                {dlError && <p className="text-xs text-red-600 mb-3"><i className="fas fa-exclamation-circle mr-1"></i>{dlError}</p>}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full flex items-center justify-center gap-2 bg-[#1e3a8a] hover:bg-[#152c6e] disabled:opacity-60 text-white font-medium py-3 rounded-xl transition"
                  >
                    {downloading
                      ? <><i className="fas fa-spinner fa-spin"></i> Downloading...</>
                      : <><i className="fas fa-file-pdf"></i> Download Receipt (PDF)</>}
                  </button>
                  <Link to="/resort" className="text-sm text-[#5f9db2] hover:text-[#1e3a8a] transition">
                    <i className="fas fa-arrow-left mr-1"></i>Back to Resort
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <Link to="/dashboard/bookings"
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#1e3a8a] hover:bg-[#152c6e] text-white font-medium py-3 rounded-xl transition">
                  <i className="fas fa-calendar-check"></i> View My Bookings
                </Link>
                <Link to="/resort" className="text-sm text-[#5f9db2] hover:text-[#1e3a8a] transition">
                  <i className="fas fa-arrow-left mr-1"></i>Back to Resort
                </Link>
              </div>
            )}
          </>
        )}

        {status === "pending" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <i className="fas fa-hourglass-half text-amber-600 text-3xl"></i>
              </div>
            </div>
            <h2 className="text-2xl font-light text-[#1e3a8a] mb-2">Payment Processing</h2>
            <p className="text-[#4a6f8c] mb-1">We received your payment but confirmation is still processing.</p>
            <p className="text-[#6b8cae] text-sm mb-2">
              Your booking will update to <span className="font-semibold text-green-600">Confirmed</span> within a few minutes.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-[#5f9db2] hover:text-[#1e3a8a] mb-5 transition"
            >
              <i className="fas fa-arrows-rotate mr-1"></i>Refresh to check again
            </button>
            <div className="flex flex-col gap-3">
              <Link to="/dashboard/bookings"
                className="w-full inline-flex items-center justify-center gap-2 bg-[#1e3a8a] hover:bg-[#152c6e] text-white font-medium py-3 rounded-xl transition">
                <i className="fas fa-calendar-check"></i> Go to My Bookings
              </Link>
              <Link to="/resort" className="text-sm text-[#5f9db2] hover:text-[#1e3a8a] transition">
                <i className="fas fa-arrow-left mr-1"></i>Back to Resort
              </Link>
            </div>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <i className="fas fa-times text-red-600 text-3xl"></i>
              </div>
            </div>
            <h2 className="text-2xl font-light text-[#1e3a8a] mb-2">Payment Failed</h2>
            <p className="text-[#4a6f8c] mb-6">
              Your payment was not completed. Please try again.
            </p>
            <div className="flex flex-col gap-3">
              <Link to="/resort?book=1"
                className="w-full inline-flex items-center justify-center gap-2 bg-[#1e3a8a] hover:bg-[#152c6e] text-white font-medium py-3 rounded-xl transition">
                <i className="fas fa-redo"></i> Try Again
              </Link>
              <Link to="/resort" className="text-sm text-[#5f9db2] hover:text-[#1e3a8a] transition">
                <i className="fas fa-arrow-left mr-1"></i>Back to Resort
              </Link>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
