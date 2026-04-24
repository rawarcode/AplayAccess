import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

// Admin portal admits both admin and owner — owner keeps every
// admin-eligible capability by design, so an owner hitting /admin/*
// should work (useful when owner is doing operational work and
// doesn't want to leave the admin surface). Admin-only restriction
// is handled on the backend per-route middleware, not here.
const ALLOWED_ROLES = ["admin", "owner"];

export default function RequireAdmin({ children }) {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) return null;

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return <Navigate to="/staff-login" replace state={{ from: location }} />;
  }

  return children;
}
