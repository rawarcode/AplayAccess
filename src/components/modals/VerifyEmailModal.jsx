import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { verifyEmailRequest, resendVerificationRequest } from '../../lib/authApi.js';
import useFocusTrap from '../../hooks/useFocusTrap.js';

// In-modal version of the /verify-email page. Same OTP logic, just
// rendered inside an overlay so the user doesn't have to leave the
// page they're on (dashboard, profile, booking flow, etc.) to enter
// their code. Opened by UnverifiedEmailBanner and by the BookingModal's
// "Verify your email before booking" CTA.
export default function VerifyEmailModal({ open, onClose }) {
  const { user, login } = useAuth();
  const [code, setCode]         = useState(['', '', '', '', '', '']);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // Full celebration UI shown in place of the form for 2s after
  // successful verification. Gives the user time to register the
  // success visually before the modal closes.
  const [verified, setVerified] = useState(false);
  const inputsRef = useRef([]);
  const dialogRef = useFocusTrap(open);

  // Reset state when the modal re-opens so a second visit after a
  // failure / retry starts clean.
  useEffect(() => {
    if (open) {
      setCode(['', '', '', '', '', '']);
      setError('');
      setSuccess('');
      setVerified(false);
    }
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Escape to close — but only if we're not mid-verify (looks bad if
  // the modal vanishes while the user waits on the API).
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape' && !loading) onClose?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onClose]);

  function handleChange(i, val) {
    // Clear any stale error the moment the user starts retyping — the
    // aria-invalid state on each input would otherwise linger from the
    // previous failed attempt even as the user corrects it.
    if (error) setError('');

    if (val.length > 1) {
      const digits = val.replace(/\D/g, '').slice(0, 6).split('');
      const next = [...code];
      digits.forEach((d, idx) => { if (i + idx < 6) next[i + idx] = d; });
      setCode(next);
      const focusIdx = Math.min(i + digits.length, 5);
      inputsRef.current[focusIdx]?.focus();
      return;
    }
    if (val && !/^\d$/.test(val)) return;
    const next = [...code];
    next[i] = val;
    setCode(next);
    if (val && i < 5) inputsRef.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    const otp = code.join('');
    if (otp.length !== 6) { setError('Please enter the full 6-digit code.'); return; }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const data = await verifyEmailRequest(otp);
      // Refresh the auth user so email_verified_at propagates everywhere —
      // banner disappears, BookingModal unlocks the Pay button, etc.
      if (data.user) login(data.user);
      // Show a big celebration state INSIDE the modal for 2s so the
      // user actually sees the success before the modal closes.
      // sessionStorage flag lets the Dashboard fire a follow-up toast
      // on arrival (belt + braces — useful if the user was on
      // /dashboard already and barely registered the inline state).
      sessionStorage.setItem("aplaya_just_verified", "1");
      setVerified(true);
      setTimeout(() => onClose?.(), 2000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Invalid code. Please try again.');
      // Reset the OTP inputs and drop focus back on digit 1 so the
      // retry path is single-step for both mouse and keyboard users —
      // SR users get the role="alert" announcement, then focus lands
      // exactly where they need to start typing again.
      setCode(['', '', '', '', '', '']);
      queueMicrotask(() => inputsRef.current[0]?.focus());
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setSuccess('');
    setResending(true);
    try {
      await resendVerificationRequest();
      setSuccess('New code sent! Check your email.');
      setCooldown(60);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not resend code. Try again later.');
    } finally {
      setResending(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={e => e.target === e.currentTarget && !loading && onClose?.()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-email-title"
        className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        {verified ? (
          /* Celebration state — replaces the entire modal body for 2s
             after success so the user actually sees they made it. */
          <div className="px-6 py-10 text-center" role="status" aria-live="polite">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5 animate-pulse">
              <i className="fas fa-check text-emerald-600 text-4xl" aria-hidden="true"></i>
            </div>
            <h3 className="text-2xl font-bold text-emerald-700 mb-2">Email Verified!</h3>
            <p className="text-sm text-slate-500">You're all set — all booking features are now unlocked.</p>
          </div>
        ) : (
        <>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center">
              <i className="fas fa-envelope-open-text text-sky-600 text-sm" aria-hidden="true" />
            </span>
            <h3 id="verify-email-title" className="text-lg font-bold text-slate-900">Verify Your Email</h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50 p-2 -mr-2 rounded-lg hover:bg-slate-100"
            aria-label="Close"
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 text-center">
          <p className="text-sm text-slate-500 mb-6">
            We sent a 6-digit code to <strong className="text-slate-700">{user?.email || 'your email'}</strong>.
            Enter it below to verify your account.
          </p>

          {error && (
            <div id="verify-email-error" role="alert" className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-lg text-sm border border-rose-200">
              <i className="fas fa-exclamation-circle mr-2" aria-hidden="true"></i>{error}
            </div>
          )}
          {success && (
            <div id="verify-email-success" role="status" className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm border border-emerald-200">
              <i className="fas fa-check-circle mr-2" aria-hidden="true"></i>{success}
            </div>
          )}

          <form onSubmit={handleVerify}>
            <fieldset className="mb-6 border-0 p-0 m-0">
              <legend className="sr-only">Enter the 6-digit verification code sent to your email</legend>
              <div className="flex justify-center gap-1.5 sm:gap-2">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => inputsRef.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold border-2 border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition aria-[invalid=true]:border-rose-300"
                    aria-label={`Digit ${i + 1} of 6`}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? 'verify-email-error' : undefined}
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  />
                ))}
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={loading || code.join('').length !== 6}
              aria-busy={loading}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-medium rounded-lg transition inline-flex items-center justify-center gap-2"
            >
              {loading
                ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Verifying...</>
                : <><i className="fas fa-check-circle" aria-hidden="true"></i> Verify Email</>}
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-500">
            Didn't receive the code?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              aria-label={cooldown > 0 ? `Resend code — available in ${cooldown} seconds` : 'Resend code'}
              className="font-medium text-sky-600 hover:text-sky-700 disabled:text-slate-400 disabled:cursor-not-allowed transition"
            >
              {cooldown > 0
                ? `Resend in ${cooldown}s`
                : resending ? 'Sending...' : 'Resend Code'}
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-400">Code expires in 15 minutes.</p>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
