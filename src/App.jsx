import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";

import Home from "./pages/Home.jsx";
import Resort from "./pages/Resort.jsx";
import Rooms from "./pages/Rooms.jsx";
import Gallery from "./pages/Gallery.jsx";
import Signup from "./pages/Signup.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import PaymentReturn from "./pages/PaymentReturn.jsx";

// Guest dashboard (protected)
import RequireAuth from "./components/auth/RequireAuth.jsx";
import DashboardShell from "./components/dashboard/DashboardShell.jsx";
import GuestDashboard from "./pages/dashboard/GuestDashboard.jsx";
import MyBookings from "./pages/dashboard/MyBookings.jsx";
import EditProfile from "./pages/dashboard/EditProfile.jsx";
import Messages from "./pages/dashboard/Messages.jsx";

// Shared staff login
import StaffLogin from "./pages/StaffLogin.jsx";

// Admin portal
import RequireAdmin from "./components/admin/RequireAdmin.jsx";
import AdminShell from "./components/admin/AdminShell.jsx";
import AdminDashboard from "./pages/admin/Dashboard.jsx";
import AdminUsers from "./pages/admin/Users.jsx";
import AdminRooms from "./pages/admin/Rooms.jsx";
import AdminFoods from "./pages/admin/Foods.jsx";
import AdminServices from "./pages/admin/Services.jsx";
import AdminInventory from "./pages/admin/Inventory.jsx";
import AdminTransactions from "./pages/admin/Transactions.jsx";
import AdminHistory from "./pages/admin/History.jsx";
import AdminContent from "./pages/admin/Content.jsx";
import AdminReviews from "./pages/admin/Reviews.jsx";
import AdminGuests from "./pages/admin/Guests.jsx";

// Frontdesk portal
import RequireFrontdesk from "./components/auth/RequireFrontdesk.jsx";
import FDDashboard from "./frontdesk/components/Dashboard.jsx";
import FDReservation from "./frontdesk/components/Reservation.jsx";
import FDBilling from "./frontdesk/components/Billing.jsx";
import FDWalkIn from "./frontdesk/components/WalkIn.jsx";
import FDGuestRecords from "./frontdesk/components/GuestRecords.jsx";
import FDReports from "./frontdesk/components/Reports.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/resort" element={<Resort />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* PayMongo return pages */}
        <Route path="/payment/success" element={<PaymentReturn outcome="success" />} />
        <Route path="/payment/failed"  element={<PaymentReturn outcome="failed" />} />

        {/* ✅ Dashboard routes (protected), still inside Layout */}
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
      <Route path="/admin/login" element={<StaffLogin />} />

      {/* ── Admin portal (outside guest Layout, nested routes) ── */}
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminShell />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="rooms" element={<AdminRooms />} />
        <Route path="foods" element={<AdminFoods />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="inventory" element={<AdminInventory />} />
        <Route path="transactions" element={<AdminTransactions />} />
        <Route path="history" element={<AdminHistory />} />
        <Route path="content" element={<AdminContent />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="guests" element={<AdminGuests />} />
      </Route>

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
        path="/frontdesk/reports"
        element={
          <RequireFrontdesk>
            <FDReports />
          </RequireFrontdesk>
        }
      />
    </Routes>
  );
}