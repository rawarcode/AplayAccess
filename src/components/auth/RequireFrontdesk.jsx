import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ALLOWED_ROLES = ["front_desk", "admin", "owner"];

export default function RequireFrontdesk({ children }) {
  const { isLoggedIn, user, booting } = useAuth();
  const location = useLocation();

  if (booting) return null;

  if (!isLoggedIn) {
    return <Navigate to="/staff-login" state={{ from: location }} replace />;
  }

  if (!ALLOWED_ROLES.includes(user?.role)) {
    // Guest trying to access frontdesk — send them to their own dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
