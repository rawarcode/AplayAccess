import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";

import Home from "./pages/Home.jsx";
import Resort from "./pages/Resort.jsx";
import Rooms from "./pages/Rooms.jsx";
import Gallery from "./pages/Gallery.jsx";
import Signup from "./pages/Signup.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";

// Guest dashboard (protected)
import RequireAuth from "./components/auth/RequireAuth.jsx";
import DashboardShell from "./components/dashboard/DashboardShell.jsx";
import GuestDashboard from "./pages/dashboard/GuestDashboard.jsx";
import MyBookings from "./pages/dashboard/MyBookings.jsx";
import EditProfile from "./pages/dashboard/EditProfile.jsx";
import Messages from "./pages/dashboard/Messages.jsx";

// Owner dashboard (standalone layout with sidebar)
import OwnerDashboard from "./pages/owner/Dashboard.jsx";
import OwnerFinancials from "./pages/owner/Financials.jsx";
import OwnerTransactions from "./pages/owner/Transactions.jsx";

export default function App() {
  return (
    <Routes>
      {/* Guest-facing routes (inside shared Layout with Navbar/Footer) */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/resort" element={<Resort />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Guest dashboard routes (protected) */}
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

      {/* Owner dashboard routes (standalone — uses its own Sidebar/Header layout) */}
      <Route path="/owner" element={<OwnerDashboard />} />
      <Route path="/owner/financials" element={<OwnerFinancials />} />
      <Route path="/owner/transactions" element={<OwnerTransactions />} />
    </Routes>
  );
}