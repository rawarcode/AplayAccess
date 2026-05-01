import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import VerifyEmailModal from './modals/VerifyEmailModal.jsx';

// Sticky amber strip shown to unverified guests across the dashboard.
// Clicking it opens the verify-OTP modal — same UX as the /verify-email
// page but without making the user leave whatever dashboard screen
// they're on. Hidden entirely once email_verified_at is set.
//
// Mounted inside DashboardShell so it only appears on guest routes.
// Staff / owner routes never see it (they don't hit this shell).
export default function UnverifiedEmailBanner() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Guard: only show for guest-role users whose email isn't verified.
  // Public visitors (no user) and already-verified guests skip this.
  if (!user) return null;
  if (user.role !== 'guest') return null;
  if (user.email_verified_at) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="w-full bg-amber-100 border-b border-amber-300 px-4 py-2.5 min-h-11 flex items-center justify-center gap-2 text-sm text-amber-900 hover:bg-amber-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-600"
      >
        <i className="fas fa-exclamation-triangle text-amber-700" aria-hidden="true" />
        <span>
          Your email isn't verified yet.{' '}
          <span className="font-semibold underline">Click here to verify →</span>
        </span>
      </button>

      <VerifyEmailModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
