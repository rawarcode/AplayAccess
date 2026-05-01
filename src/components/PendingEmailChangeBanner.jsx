import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Persistent amber strip surfaced across the dashboard whenever the
// authenticated user has a pending email change on file
// (user.pending_email is non-null). Clicking it jumps to the
// dedicated /dashboard/verify-email-change page where the user can
// enter the 6-digit code, resend it, or cancel the change.
//
// Hidden as soon as pending_email clears (either because the swap
// verified or the user cancelled).
//
// Stacks with UnverifiedEmailBanner — a newly-signed-up guest who
// also requests an email change would see both, which is correct:
// they genuinely have two verification items outstanding.
export default function PendingEmailChangeBanner() {
  const { user } = useAuth();

  if (!user) return null;
  if (user.role !== 'guest') return null;
  if (!user.pending_email) return null;

  return (
    <Link
      to="/dashboard/verify-email-change"
      className="w-full bg-sky-100 border-b border-sky-300 px-4 py-2.5 min-h-11 flex items-center justify-center gap-2 text-sm text-sky-900 hover:bg-sky-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600"
    >
      <i className="fas fa-envelope-circle-check text-sky-700" aria-hidden="true" />
      <span>
        Email change pending — confirm{' '}
        <span className="font-semibold break-all">{user.pending_email}</span>.{' '}
        <span className="font-semibold underline">Enter code →</span>
      </span>
    </Link>
  );
}
