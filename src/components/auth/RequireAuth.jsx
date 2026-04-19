import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const ROLE_REDIRECTS = { front_desk: "/frontdesk", owner: "/owner" };

export default function RequireAuth({ children }) {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) return null;

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

  // Unverified guests are allowed into the dashboard. The persistent
  // UnverifiedEmailBanner (mounted in DashboardShell) nudges them to
  // verify, and BookingController::store still 403s any booking attempt
  // from an unverified account. This lets guests browse / manage the
  // profile they just created without being stonewalled on the
  // /verify-email page when the OTP email is slow or bounces.
  return children;
}