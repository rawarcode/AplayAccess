import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const Resort = lazy(() => import("./pages/Resort.jsx"));
const Rooms = lazy(() => import("./pages/Rooms.jsx"));
const Gallery = lazy(() => import("./pages/Gallery.jsx"));
const Announcements = lazy(() => import("./pages/Announcements.jsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const PaymentReturn = lazy(() => import("./pages/PaymentReturn.jsx"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail.jsx"));
const NewsletterUnsubscribe = lazy(() => import("./pages/NewsletterUnsubscribe.jsx"));
const ResumeGuestBooking = lazy(() => import("./pages/ResumeGuestBooking.jsx"));

// Guest dashboard (protected) — lazy-loaded portal shell
import RequireAuth from "./components/auth/RequireAuth.jsx";
const DashboardShell = lazy(() => import("./components/dashboard/DashboardShell.jsx"));
const GuestDashboard = lazy(() => import("./pages/dashboard/GuestDashboard.jsx"));
const MyBookings = lazy(() => import("./pages/dashboard/MyBookings.jsx"));
const EditProfile = lazy(() => import("./pages/dashboard/EditProfile.jsx"));
const VerifyEmailChange = lazy(() => import("./pages/dashboard/VerifyEmailChange.jsx"));
const Messages = lazy(() => import("./pages/dashboard/Messages.jsx"));

// Shared staff login
const StaffLogin = lazy(() => import("./pages/StaffLogin.jsx"));

// Owner portal (consolidated — includes all admin pages) — lazy-loaded portal shell
import RequireOwner from "./components/auth/RequireOwner.jsx";
const OwnerShell = lazy(() => import("./components/owner/OwnerShell.jsx"));
const OwnerDashboard = lazy(() => import("./pages/owner/Dashboard.jsx"));
const OwnerTransactions = lazy(() => import("./pages/owner/Transactions.jsx"));
const OwnerReports = lazy(() => import("./pages/owner/Reports.jsx"));
const OwnerPromoCodes = lazy(() => import("./pages/owner/PromoCodes.jsx"));
const OwnerNewsletter = lazy(() => import("./pages/owner/Newsletter.jsx"));
const OwnerUsers = lazy(() => import("./pages/owner/Users.jsx"));
const OwnerSettings = lazy(() => import("./pages/owner/Settings.jsx"));
// Pages absorbed from admin portal (now live in pages/owner/)
const OwnerActivityLog = lazy(() => import("./pages/owner/History.jsx"));
const OwnerRooms = lazy(() => import("./pages/owner/Rooms.jsx"));
const OwnerContent = lazy(() => import("./pages/owner/Content.jsx"));
const OwnerReviews = lazy(() => import("./pages/owner/Reviews.jsx"));
const OwnerMessages = lazy(() => import("./pages/owner/Messages.jsx"));
// NOTE: Guests, Announcements, Addons are no longer routed directly.
// They're rendered as tabs inside Users.jsx, Content.jsx, and Rooms.jsx
// respectively (merged 2026-04-21). The source files still exist —
// their default exports are imported as components, not as routes.

// Frontdesk portal — lazy-loaded (no shared shell, each page is a portal entry)
import RequireFrontdesk from "./components/auth/RequireFrontdesk.jsx";
const FDDashboard = lazy(() => import("./frontdesk/components/Dashboard.jsx"));
const FDBookings = lazy(() => import("./frontdesk/components/Bookings.jsx"));
const FDBilling = lazy(() => import("./frontdesk/components/Billing.jsx"));
const FDWalkIn = lazy(() => import("./frontdesk/components/WalkIn.jsx"));
const FDGuestRecords = lazy(() => import("./frontdesk/components/GuestRecords.jsx"));
const FDRooms = lazy(() => import("./frontdesk/components/Rooms.jsx"));
const FDMessages = lazy(() => import("./frontdesk/components/Messages.jsx"));
const FDReports = lazy(() => import("./frontdesk/components/Reports.jsx"));

const SuspenseFallback = (
  <div className="flex items-center justify-center min-h-screen">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
  </div>
);

// Forward legacy /frontdesk/reservation to /frontdesk/bookings while
// preserving the query string (?status=Pending, ?booking=<id>, etc.) —
// plain <Navigate> drops the search.
function LegacyReservationRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/frontdesk/bookings${search}`} replace />;
}

export default function App() {
  return (
    <Suspense fallback={SuspenseFallback}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/resort" element={<Resort />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/verify-email"    element={<VerifyEmail />} />

        {/* PayMongo return pages */}
        <Route path="/payment/success" element={<PaymentReturn outcome="success" />} />
        <Route path="/payment/failed"  element={<PaymentReturn outcome="failed" />} />

        {/* Public unsubscribe — reached from the footer link in every
            newsletter email. HMAC token in the query string is
            verified server-side before the subscription is removed. */}
        <Route path="/newsletter/unsubscribe" element={<NewsletterUnsubscribe />} />

        {/* Public resume-payment page for guest-token (no-account)
            bookings. PendingPaymentBanner navigates here when the guest
            closes PayMongo mid-payment. Hydrates BookingModal in
            resume mode via /api/guest-booking/{token}. */}
        <Route path="/resume-booking" element={<ResumeGuestBooking />} />

        {/* Guest dashboard (protected), still inside Layout */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardShell />
            </RequireAuth>
          }
        >
          <Route index element={<GuestDashboard />} />
          <Route path="bookings" element={<MyBookings />} />
          <Route path="profile" element={<EditProfile />} />
          <Route path="verify-email-change" element={<VerifyEmailChange />} />
          <Route path="messages" element={<Messages />} />
        </Route>
      </Route>

      {/* ── Shared staff login ── */}
      <Route path="/staff-login" element={<StaffLogin />} />

      {/* ── Owner portal (consolidated — all management in one place) ── */}
      <Route
        path="/owner"
        element={
          <RequireOwner>
            <OwnerShell />
          </RequireOwner>
        }
      >
        <Route index element={<OwnerDashboard />} />
        {/* Management */}
        <Route path="rooms"         element={<OwnerRooms />} />
        <Route path="users"         element={<OwnerUsers />} />
        <Route path="reviews"       element={<OwnerReviews />} />
        {/* Website */}
        <Route path="content"       element={<OwnerContent />} />
        {/* Marketing */}
        <Route path="promo-codes"   element={<OwnerPromoCodes />} />
        <Route path="newsletter"    element={<OwnerNewsletter />} />
        {/* Analytics */}
        <Route path="transactions"  element={<OwnerTransactions />} />
        <Route path="reports"       element={<OwnerReports />} />
        <Route path="activity-log"  element={<OwnerActivityLog />} />
        {/* System */}
        <Route path="messages"      element={<OwnerMessages />} />
        <Route path="settings"      element={<OwnerSettings />} />

        {/* Legacy redirects from the three 2026-04-21 merges. Kept so
            bookmarks, old notification deep-links, and the admin
            portal redirect chain keep working. */}
        <Route path="guests"        element={<Navigate to="/owner/users?tab=guests" replace />} />
        <Route path="addons"        element={<Navigate to="/owner/rooms?tab=addons" replace />} />
        <Route path="announcements" element={<Navigate to="/owner/content?tab=announcements" replace />} />
      </Route>

      {/* ── Legacy admin redirects → owner portal ── */}
      <Route path="/admin" element={<Navigate to="/owner" replace />} />
      <Route path="/admin/*" element={<Navigate to="/owner" replace />} />

      {/* ── Frontdesk portal (outside guest Layout) ── */}
      <Route
        path="/frontdesk"
        element={
          <RequireFrontdesk>
            <FDDashboard />
          </RequireFrontdesk>
        }
      />
      <Route
        path="/frontdesk/bookings"
        element={
          <RequireFrontdesk>
            <FDBookings />
          </RequireFrontdesk>
        }
      />
      {/* Legacy route — notification deep-links and bookmarks can still land
          here; forward to the consolidated Bookings page preserving any
          ?status= / ?booking= query params. */}
      <Route
        path="/frontdesk/reservation"
        element={<LegacyReservationRedirect />}
      />
      <Route
        path="/frontdesk/billing"
        element={
          <RequireFrontdesk>
            <FDBilling />
          </RequireFrontdesk>
        }
      />
      <Route
        path="/frontdesk/walkin"
        element={
          <RequireFrontdesk>
            <FDWalkIn />
          </RequireFrontdesk>
        }
      />
      <Route
        path="/frontdesk/records"
        element={
          <RequireFrontdesk>
            <FDGuestRecords />
          </RequireFrontdesk>
        }
      />
      <Route
        path="/frontdesk/rooms"
        element={
          <RequireFrontdesk>
            <FDRooms />
          </RequireFrontdesk>
        }
      />
      <Route
        path="/frontdesk/messages"
        element={
          <RequireFrontdesk>
            <FDMessages />
          </RequireFrontdesk>
        }
      />
      <Route
        path="/frontdesk/reports"
        element={
          <RequireFrontdesk>
            <FDReports />
          </RequireFrontdesk>
        }
      />
    </Routes>
    </Suspense>
  );
}
