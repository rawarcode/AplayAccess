import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";

import Home from "./pages/Home.jsx";
import Resort from "./pages/Resort.jsx";
import Rooms from "./pages/Rooms.jsx";
import Gallery from "./pages/Gallery.jsx";
import Signup from "./pages/Signup.jsx";

// ✅ Dashboard (new)
import RequireAuth from "./components/auth/RequireAuth.jsx";
import DashboardShell from "./components/dashboard/DashboardShell.jsx";
import GuestDashboard from "./pages/dashboard/GuestDashboard.jsx";
import MyBookings from "./pages/dashboard/MyBookings.jsx";
import EditProfile from "./pages/dashboard/EditProfile.jsx";
import Messages from "./pages/dashboard/Messages.jsx";

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
      {/* ✅ Keep your Layout wrapper */}
      <Route element={<Layout />}>
        {/* ✅ Your existing routes */}
        <Route path="/" element={<Home />} />
        <Route path="/resort" element={<Resort />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/login" element={<Placeholder title="Login" />} />
        <Route path="/forgot-password" element={<Placeholder title="Forgot Password" />} />

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
    </Routes>
  );
}