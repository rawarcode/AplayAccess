import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const ROLE_REDIRECTS = { front_desk: "/frontdesk", admin: "/admin", owner: "/owner" };

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

  // Staff have their own dashboards — redirect them out of the guest area
  if (ROLE_REDIRECTS[user.role]) {
    return <Navigate to={ROLE_REDIRECTS[user.role]} replace />;
  }

  return children;
}