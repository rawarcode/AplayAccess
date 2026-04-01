import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

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
