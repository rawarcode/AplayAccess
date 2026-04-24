import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

/**
 * Terms & Conditions — Aplaya Beach Resort.
 *
 * Booking rules drawn from what's already enforced in code:
 *   - 20% reservation fee (Setting::pricing()['reservation_fee_pct'])
 *   - Entrance fee per pax, collected at the gate, not online
 *   - No refund on downgrade (BookingController::transferRoom policy)
 *   - Receipts are "Booking Confirmations," not BIR Official Receipts
 *   - Auto-cancel of Pending bookings unpaid for 30 minutes
 *
 * Placeholders to fill before going live:
 *   [LAST UPDATED]   — revision date
 *
 * Cavite is hard-coded as the governing venue per the resort's
 * physical location. Owner should confirm.
 */
export default function Terms() {
  return (
    <div className="pt-16 bg-sky-50 min-h-screen">
      <Helmet>
        <title>Terms & Conditions — Aplaya Beach Resort</title>
        <meta name="description" content="Booking, payment, cancellation, and conduct rules for using the Aplaya Beach Resort booking system." />
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-10 space-y-6 text-slate-700 leading-relaxed">
          <header>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-600 font-semibold mb-2">Legal</p>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Terms &amp; Conditions</h1>
            <p className="text-sm text-slate-500">
              <strong>Last updated:</strong> [LAST UPDATED]
            </p>
          </header>

          <section className="space-y-3">
            <p>
              By using the Aplaya Beach Resort website or booking system ("the Service"), you
              agree to these Terms. If you do not agree, please do not use the Service.
            </p>
            <p>
              These Terms work alongside our <Link to="/privacy" className="text-sky-600 hover:underline font-medium">Privacy Policy</Link>,
              which explains how we handle your personal data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">1. Accounts</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You must be 18 years or older to create an account.</li>
              <li>Provide accurate contact information. You are responsible for keeping your login credentials private.</li>
              <li>One account per person. Sharing, selling, or transferring accounts is not allowed.</li>
              <li>We may suspend or delete accounts that abuse the service, send spam, or attempt to bypass security.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">2. Bookings</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Room and cottage rates are shown on the <Link to="/rooms" className="text-sky-600 hover:underline">Rooms</Link> page at the time of booking and apply to the booking type you select (Day, Night, or 24-hour).</li>
              <li>Rates shown include any add-ons attached to the room as a package. Optional add-ons (videoke, extra pillows, etc.) are charged separately.</li>
              <li>An <strong>entrance fee per guest</strong> is collected at the resort gate at check-in — it is <strong>not</strong> included in the online amount.</li>
              <li>Bookings are confirmed only after payment (or the required reservation deposit) is received.</li>
              <li>A guest may only hold <strong>one active pending booking</strong> at a time. Finish payment on the current one before starting another.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">3. Payment</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>We accept GCash, Maya, credit/debit cards (via PayMongo), and cash at the resort counter for walk-ins.</li>
              <li>You may pay in full online or pay a <strong>20% reservation fee</strong> to secure the booking; the balance is due at the resort counter on arrival.</li>
              <li>Pending bookings not paid within <strong>30 minutes</strong> are automatically cancelled to free up the room for other guests.</li>
              <li>Applicable promo codes are validated at checkout. Expired or invalid codes are silently ignored — the regular rate applies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">4. Cancellation and refunds</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You may cancel a Pending or Confirmed booking from the <em>My Bookings</em> page any time before check-in.</li>
              <li><strong>Reservation deposits are non-refundable</strong> — they secure the room against the opportunity cost of holding it for you.</li>
              <li>Payments already made for a room that was not yet occupied may be forfeited unless otherwise agreed at the resort's discretion.</li>
              <li><strong>No refund on room downgrade.</strong> If you transfer to a cheaper room after paying, the price difference is not refunded — the resort absorbs the credit internally.</li>
              <li><strong>Upgrade payment.</strong> If you transfer to a more expensive room, the price difference is collected at the resort counter.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">5. Check-in &amp; conduct</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Check-in times follow the booking type: Day (6 AM – 6 PM), Night (6 PM – 7 AM), 24-hour (start hour you picked, 24 hours later).</li>
              <li>Present a valid ID and the booking's reservation number at the gate. The resort may refuse entry for identification mismatches.</li>
              <li>Guest headcount may be verified at the gate. Additional entrance fees apply for any unregistered guests.</li>
              <li>Treat resort staff and other guests respectfully. We reserve the right to end a stay without refund for harassment, intoxication that threatens safety, property damage, or illegal activity on premises.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">6. Receipts</h2>
            <p>
              The PDF we generate (labeled <em>Booking Confirmation</em>) is a system-generated
              summary of your booking. It is <strong>not</strong> a BIR Official Receipt. Actual
              Official Receipts are issued manually at the resort counter from a BIR-registered
              booklet upon request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">7. Reviews &amp; messages</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Reviews you submit are visible to other guests and resort staff. Keep them honest and relevant to your stay.</li>
              <li>The in-app chat is monitored by resort staff during business hours. Do not share passwords, card numbers, or sensitive information through it.</li>
              <li>We may remove content that is abusive, misleading, contains personal data of other guests, or violates the law.</li>
              <li>Users who repeatedly send abusive or spam messages may have their messaging privileges restricted.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">8. Availability &amp; disclaimers</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>We aim to keep the booking system available but do not guarantee uninterrupted service. Maintenance windows and outages can happen.</li>
              <li>Prices, room photos, and amenities on the site are maintained to be accurate but may be updated at any time; the rate confirmed at the point of booking is the rate we honor.</li>
              <li>To the extent permitted by law, Aplaya Beach Resort is not liable for indirect, incidental, or consequential damages arising from use of the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">9. Governing law</h2>
            <p>
              These Terms are governed by the laws of the Republic of the Philippines. Any
              disputes will be resolved in the appropriate courts of Cavite, where the resort
              is located.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">10. Changes</h2>
            <p>
              We may update these Terms over time. Material changes will be announced. Continued
              use of the Service after a change means you accept the new Terms.
            </p>
          </section>

          <footer className="pt-6 mt-6 border-t border-slate-100 text-sm text-slate-500 flex flex-wrap items-center gap-3 justify-between">
            <span>See also our <Link to="/privacy" className="text-sky-600 hover:underline font-medium">Privacy Policy</Link>.</span>
            <Link to="/" className="text-sky-600 hover:underline font-medium">← Back to home</Link>
          </footer>
        </div>
      </div>
    </div>
  );
}
