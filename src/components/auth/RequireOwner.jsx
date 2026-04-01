import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

export default function RequireOwner({ children }) {
  const { user, booting } = useAuth();
  if (booting) return null;
  if (!user || user.role !== "owner") return <Navigate to="/staff-login" replace />;
  return children;
}
