import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const STAFF_ROLES = ["admin", "owner", "frontdesk"];

export default function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return (
      <Navigate
        to={`/resort?login=1&next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // Staff have their own dashboard — redirect them out of the guest area
  if (STAFF_ROLES.includes(user.role)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}