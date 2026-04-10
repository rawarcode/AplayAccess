import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
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
 *   /payment/success?booking=<id>
 *   /payment/failed?booking=<id>
 */
export default function PaymentReturn({ outcome }) {
  const [searchParams] = useSearchParams();
  const bookingId      = searchParams.get("booking");
  const isGuest        = searchParams.get("guest") === "1";
  const isPopup        = Boolean(window.opener);

  const [status,       setStatus]       = useState("loading");
  const [downloading,  setDownloading]  = useState(false);
  const [dlError,      setDlError]      = useState("");

  async function handleDownload() {
    if (!bookingId) return;
    setDownloading(true);
    setDlError("");
    try {
      const blob = await downloadGuestReceipt(bookingId);
      const ref  = "APL-" + String(bookingId);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${ref}-receipt.pdf`;
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
        // Send cancelled — BookingModal will attempt to verify the payment on its side
        // using guestConfirmPayment (which has an API-unreachable fallback to confirm).
        try { window.opener.postMessage({ type: "paymongo_cancelled", bookingId }, "*"); } catch { /* ignore */ }
        setStatus("closing_failed");
        window.close();
      } else {
        // Success URL — PayMongo only redirects here after confirmed payment.
        try { window.opener.postMessage({ type: "paymongo_paid", bookingId }, "*"); } catch { /* ignore */ }
        setStatus("closing_success");
        window.close();
      }
      return;
    }

    // ── FULL-PAGE MODE ────────────────────────────────────────────────────────
    if (!bookingId) { setStatus("failed"); return; }

    // Cancel URL: don't fail immediately — PayMongo test mode's "Return to Merchant"
    // lands here even after a successful payment. Poll to see if it went through.
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          {status === "closing_success" ? (
            <>
              <div className="text-5xl mb-4">✅</div>
              <p className="text-lg font-semibold text-gray-800">Payment received!</p>
              <p className="text-sm text-gray-500 mt-1">Closing window…</p>
            </>
          ) : status === "verifying" ? (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
              <p className="text-lg font-semibold text-gray-800">Verifying payment…</p>
              <p className="text-sm text-gray-500 mt-1">Please wait a moment.</p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4">❌</div>
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">

        {status === "loading" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Verifying your payment…</h2>
            <p className="text-sm text-gray-500">Please wait. This only takes a few seconds.</p>
          </>
        )}

        {status === "confirmed" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-4xl">✅</div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Confirmed!</h2>
            <p className="text-gray-600 mb-1">Your reservation fee has been received.</p>
            <p className="text-gray-500 text-sm mb-5">
              Your booking is now <span className="font-semibold text-green-600">Confirmed</span>.
            </p>
            {isGuest ? (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-4 text-xs text-amber-800 text-left flex items-start gap-2">
                  <i className="fas fa-info-circle mt-0.5 shrink-0 text-amber-500"></i>
                  <span>You booked as a guest. Download your receipt now — this is the only way to retrieve your booking details without contacting the resort.</span>
                </div>
                {dlError && <p className="text-xs text-red-600 mb-3">{dlError}</p>}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-3 rounded-lg"
                  >
                    {downloading
                      ? <><i className="fas fa-spinner fa-spin"></i> Downloading...</>
                      : <><i className="fas fa-file-pdf"></i> Download Receipt (PDF)</>}
                  </button>
                  <Link to="/resort" className="text-sm text-gray-500 hover:text-gray-700">Back to Resort</Link>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <Link to="/dashboard/bookings"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg">
                  View My Bookings
                </Link>
                <Link to="/resort" className="text-sm text-gray-500 hover:text-gray-700">Back to Resort</Link>
              </div>
            )}
          </>
        )}

        {status === "pending" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center text-4xl">⏳</div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Processing</h2>
            <p className="text-gray-600 mb-1">We received your payment but confirmation is still processing.</p>
            <p className="text-gray-500 text-sm mb-6">
              Your booking will update to <span className="font-semibold">Confirmed</span> within a few minutes.
            </p>
            <div className="flex flex-col gap-3">
              <Link to="/dashboard/bookings"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg">
                Go to My Bookings
              </Link>
              <Link to="/resort" className="text-sm text-gray-500 hover:text-gray-700">Back to Resort</Link>
            </div>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-4xl">❌</div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h2>
            <p className="text-gray-600 mb-6">
              Your payment was not completed. Please try again.
            </p>
            <div className="flex flex-col gap-3">
              <Link to="/resort?book=1"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg">
                Try Again
              </Link>
              <Link to="/resort" className="text-sm text-gray-500 hover:text-gray-700">Back to Resort</Link>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
