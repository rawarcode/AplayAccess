import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

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

  return children;
}