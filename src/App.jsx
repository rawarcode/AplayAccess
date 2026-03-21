import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";

import Home from "./pages/Home.jsx";
import Resort from "./pages/Resort.jsx";
import Rooms from "./pages/Rooms.jsx";
import Gallery from "./pages/Gallery.jsx";
import Signup from "./pages/Signup.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";

// ✅ Guest Dashboard (protected)
import RequireAuth from "./components/auth/RequireAuth.jsx";
import DashboardShell from "./components/dashboard/DashboardShell.jsx";
import GuestDashboard from "./pages/dashboard/GuestDashboard.jsx";
import MyBookings from "./pages/dashboard/MyBookings.jsx";
import EditProfile from "./pages/dashboard/EditProfile.jsx";
import Messages from "./pages/dashboard/Messages.jsx";

// ✅ Admin Dashboard (protected)
import RequireAdmin from "./components/admin/RequireAdmin.jsx";
import AdminShell from "./components/admin/AdminShell.jsx";
// Admin login page not used; simply redirect
import { Navigate } from "react-router-dom";
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

function Placeholder({ title }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-bold mb-3">{title}</h1>
        <p className="text-gray-600">Not converted yet.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* ✅ Public Routes (with Layout) */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/resort" element={<Resort />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Placeholder title="Login" />} />
        <Route path="/forgot-password" element={<Placeholder title="Forgot Password" />} />

        {/* ✅ Guest Dashboard Routes (protected, inside Layout) */}
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

      {/* ✅ Admin Routes (NO Layout wrapper) */}
      <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
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
    </Routes>
  );
}