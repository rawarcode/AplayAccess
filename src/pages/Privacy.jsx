import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

/**
 * Privacy Policy — Aplaya Beach Resort.
 *
 * Compliance target: Republic Act 10173 (Data Privacy Act of 2012,
 * Philippines). Written as a plain-language notice satisfying
 * DPA § 16(b) (right to be informed). Not legal advice — owner
 * should review + fill the three placeholders below before going
 * live:
 *   [DPO NAME]       — name of the designated Data Protection Officer
 *   [DPO EMAIL]      — contact email, e.g. dpo@aplayabeachresort.com
 *   [LAST UPDATED]   — date this policy was last revised
 *
 * Retention window (7 years) matches the BIR audit / bookkeeping
 * requirement for financial records. Adjust if the resort's internal
 * policy differs.
 */
export default function Privacy() {
  return (
    <div className="pt-16 bg-sky-50 min-h-screen">
      <Helmet>
        <title>Privacy Policy — Aplaya Beach Resort</title>
        <meta name="description" content="How Aplaya Beach Resort collects, uses, shares, and protects your personal data — and the rights you have over it under Philippine law." />
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-10 space-y-6 text-slate-700 leading-relaxed">
          <header>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-600 font-semibold mb-2">Legal</p>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Privacy Policy</h1>
            <p className="text-sm text-slate-500">
              <strong>Last updated:</strong> [LAST UPDATED]
            </p>
          </header>

          <section className="space-y-3">
            <p>
              Aplaya Beach Resort ("we", "us", "Aplaya") respects your privacy and handles
              your personal data in accordance with Republic Act 10173, the Philippines'
              <em> Data Privacy Act of 2012</em>, its Implementing Rules and Regulations,
              and issuances of the National Privacy Commission (NPC).
            </p>
            <p>
              This notice explains what we collect when you use our website and booking
              system, why we collect it, who we share it with, how long we keep it, and
              the rights you have over your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">1. Data we collect</h2>
            <p className="mb-2">When you book with us or use our website, we collect the following:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Identity &amp; contact</strong> — name, email address, phone number, and (optionally) a profile photo you upload.</li>
              <li><strong>Booking data</strong> — check-in / check-out dates, room or cottage chosen, number of guests, add-ons, special requests, promo codes you applied.</li>
              <li><strong>Payment references</strong> — payment method (Cash / GCash / Online) and the PayMongo transaction ID. We do <strong>not</strong> store full card numbers, CVVs, or e-wallet credentials; those are handled directly by our payment processor.</li>
              <li><strong>Communication</strong> — messages you send our front desk via the in-app chat.</li>
              <li><strong>Technical data</strong> — IP address, browser type, and basic request logs captured by our hosting provider for security and debugging.</li>
              <li><strong>Account data</strong> — hashed password (never the plain text), Google account ID if you sign in with Google.</li>
            </ul>
            <p className="mt-2">
              We do <strong>not</strong> intentionally collect sensitive personal information
              (health records, government IDs, religion, etc.) through this system.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">2. Why we collect it</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To process your booking, collect payment, and deliver the service you paid for.</li>
              <li>To send booking confirmations, receipts, and reminders.</li>
              <li>To respond to your questions and requests via email or in-app messages.</li>
              <li>To comply with legal obligations — including Bureau of Internal Revenue (BIR) recordkeeping for financial transactions.</li>
              <li>To secure our site against fraud, abuse, and unauthorized access.</li>
              <li>To send newsletters, promotions, or marketing messages — <strong>only if you opt in</strong>. You can unsubscribe at any time from the email itself.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">3. Who we share it with</h2>
            <p className="mb-2">
              We share the minimum necessary personal data with the following processors so our
              website and booking system can function:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>PayMongo</strong> (payment processor) — name, email, booking amount, booking reference. PayMongo is regulated under Philippine law.</li>
              <li><strong>Cloudinary</strong> (image hosting) — any profile photos or receipt attachments you upload.</li>
              <li><strong>Railway</strong> (backend hosting) — all database records; stored with access controls and encryption at rest.</li>
              <li><strong>Vercel</strong> (frontend hosting) — basic request logs; no personal data is stored by Vercel.</li>
              <li><strong>Google</strong> (OAuth Sign-In) — your Google account ID, name, and email if you choose to sign in with Google.</li>
              <li><strong>Email delivery provider</strong> — email address and message content for confirmations, receipts, and notifications.</li>
            </ul>
            <p className="mt-2">
              We do <strong>not</strong> sell your personal data. We do not share it with third
              parties for advertising. We only disclose data to other parties when required by
              law (e.g. a subpoena, BIR audit, or valid NPC order).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">4. How long we keep it</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Active accounts</strong> — for as long as you keep your account.</li>
              <li><strong>Booking &amp; payment records</strong> — retained for <strong>7 years</strong> from the booking's check-out date, matching BIR's bookkeeping requirement for business records.</li>
              <li><strong>Messages</strong> — retained with the associated booking for the same period.</li>
              <li><strong>Deleted accounts</strong> — if you delete your account, we <strong>anonymize</strong> your profile (name → "Deleted User", email → internal placeholder) while keeping the booking rows for the retention period above, so financial history stays auditable without exposing your identity.</li>
              <li><strong>Server logs</strong> — automatically rotated and discarded by our hosting providers on their standard schedules.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">5. Your rights</h2>
            <p className="mb-2">Under the Data Privacy Act you have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Be informed</strong> of how your data is processed — this notice.</li>
              <li><strong>Access</strong> your data — download a PDF copy of your profile + booking history via <em>Edit Profile → Privacy &amp; Data → Download My Data</em>.</li>
              <li><strong>Correct</strong> inaccurate data — update your profile in <em>Edit Profile</em>, or email our DPO.</li>
              <li><strong>Erase</strong> your data — delete your account from <em>Edit Profile → Privacy &amp; Data → Delete Account</em>. We anonymize bookings (see Section 4).</li>
              <li><strong>Object</strong> to processing or <strong>withdraw consent</strong> — unsubscribe from marketing, or email the DPO to limit other processing.</li>
              <li><strong>Data portability</strong> — the download above includes your data in a structured format.</li>
              <li><strong>File a complaint</strong> with the National Privacy Commission if you believe your rights were violated.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">6. How we protect your data</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>All traffic is served over HTTPS.</li>
              <li>Passwords are hashed, never stored in clear text.</li>
              <li>Sensitive actions (password changes, email changes, account deletion) are password-gated and require a one-time verification code.</li>
              <li>Rate limits prevent automated abuse of message and authentication endpoints.</li>
              <li>Database access is restricted to the designated administrators.</li>
            </ul>
            <p className="mt-2">
              If a data breach ever occurs that may harm you, we will notify you and the NPC
              within 72 hours as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">7. Cookies</h2>
            <p>
              We use only <strong>essential cookies</strong> needed for login sessions and
              security. We do not use third-party tracking, advertising, or analytics cookies.
              You can disable cookies in your browser, but login sessions will stop working.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">8. Children</h2>
            <p>
              Our service is intended for adults 18 years or older. We do not knowingly collect
              data from minors. Guests under 18 are welcome at the resort when booked by a
              parent or guardian; the parent's account holds the booking record.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">9. Data Protection Officer</h2>
            <p>
              You may contact our Data Protection Officer to exercise any of your rights, ask
              questions about this policy, or raise concerns:
            </p>
            <div className="mt-3 rounded-xl bg-sky-50 border border-sky-100 p-4 text-sm">
              <p><strong>Name:</strong> [DPO NAME]</p>
              <p><strong>Email:</strong> [DPO EMAIL]</p>
              <p className="mt-2 text-slate-500">
                If your concern is not addressed, you may also file a complaint with the
                National Privacy Commission at{" "}
                <a href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                  privacy.gov.ph
                </a>.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">10. Changes to this policy</h2>
            <p>
              We may update this notice from time to time. The "Last updated" date above
              reflects the most recent revision. Material changes will be announced via email
              or an in-app notice. Continued use of the service after a change means you
              accept the new policy.
            </p>
          </section>

          <footer className="pt-6 mt-6 border-t border-slate-100 text-sm text-slate-500 flex flex-wrap items-center gap-3 justify-between">
            <span>See also our <Link to="/terms" className="text-sky-600 hover:underline font-medium">Terms &amp; Conditions</Link>.</span>
            <Link to="/" className="text-sky-600 hover:underline font-medium">← Back to home</Link>
          </footer>
        </div>
      </div>
    </div>
  );
}
