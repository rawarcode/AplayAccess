import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ALLOWED_ROLES = ["frontdesk", "admin", "owner"];

export default function RequireFrontdesk({ children }) {
  const { isLoggedIn, user, booting } = useAuth();
  const location = useLocation();

  if (booting) return null;

  if (!isLoggedIn) {
    return <Navigate to="/frontdesk/login" state={{ from: location }} replace />;
  }

  if (!ALLOWED_ROLES.includes(user?.role)) {
    // Guest trying to access frontdesk — send them to their own dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
