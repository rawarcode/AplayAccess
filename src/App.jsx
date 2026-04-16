import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";

import Home from "./pages/Home.jsx";
import Resort from "./pages/Resort.jsx";
import Rooms from "./pages/Rooms.jsx";
import Gallery from "./pages/Gallery.jsx";
import Announcements from "./pages/Announcements.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import PaymentReturn from "./pages/PaymentReturn.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";

// Guest dashboard (protected) — lazy-loaded portal shell
import RequireAuth from "./components/auth/RequireAuth.jsx";
const DashboardShell = lazy(() => import("./components/dashboard/DashboardShell.jsx"));
import GuestDashboard from "./pages/dashboard/GuestDashboard.jsx";
import MyBookings from "./pages/dashboard/MyBookings.jsx";
import EditProfile from "./pages/dashboard/EditProfile.jsx";
import Messages from "./pages/dashboard/Messages.jsx";

// Shared staff login
import StaffLogin from "./pages/StaffLogin.jsx";

// Owner portal (consolidated — includes all admin pages) — lazy-loaded portal shell
import RequireOwner from "./components/auth/RequireOwner.jsx";
const OwnerShell = lazy(() => import("./components/owner/OwnerShell.jsx"));
import OwnerDashboard from "./pages/owner/Dashboard.jsx";
import OwnerTransactions from "./pages/owner/Transactions.jsx";
import OwnerReports from "./pages/owner/Reports.jsx";
import OwnerPromoCodes from "./pages/owner/PromoCodes.jsx";
import OwnerNewsletter from "./pages/owner/Newsletter.jsx";
import OwnerUsers from "./pages/owner/Users.jsx";
import OwnerSettings from "./pages/owner/Settings.jsx";
// Pages absorbed from admin portal
import OwnerActivityLog from "./pages/admin/History.jsx";
import OwnerRooms from "./pages/admin/Rooms.jsx";
import OwnerContent from "./pages/admin/Content.jsx";
import OwnerReviews from "./pages/admin/Reviews.jsx";
import OwnerGuests from "./pages/admin/Guests.jsx";
import OwnerMessages from "./pages/admin/Messages.jsx";
import OwnerAnnouncements from "./pages/admin/Announcements.jsx";
import OwnerAddons from "./pages/admin/Addons.jsx";

// Frontdesk portal — lazy-loaded (no shared shell, each page is a portal entry)
import RequireFrontdesk from "./components/auth/RequireFrontdesk.jsx";
const FDDashboard = lazy(() => import("./frontdesk/components/Dashboard.jsx"));
const FDReservation = lazy(() => import("./frontdesk/components/Reservation.jsx"));
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
        <Route path="guests"        element={<OwnerGuests />} />
        {/* Website */}
        <Route path="content"       element={<OwnerContent />} />
        <Route path="announcements" element={<OwnerAnnouncements />} />
        <Route path="reviews"       element={<OwnerReviews />} />
        <Route path="addons"        element={<OwnerAddons />} />
        {/* Marketing */}
        <Route path="promo-codes"   element={<OwnerPromoCodes />} />
        <Route path="newsletter"    element={<OwnerNewsletter />} />
        {/* Analytics */}
        <Route path="transactions"  element={<OwnerTransactions />} />
        <Route path="reports"       element={<OwnerReports />} />
        <Route path="activity-log"  element={<OwnerActivityLog />} />
        {/* System */}
        <Route path="users"         element={<OwnerUsers />} />
        <Route path="messages"      element={<OwnerMessages />} />
        <Route path="settings"      element={<OwnerSettings />} />
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
        path="/frontdesk/reservation"
        element={
          <RequireFrontdesk>
            <FDReservation />
          </RequireFrontdesk>
        }
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
