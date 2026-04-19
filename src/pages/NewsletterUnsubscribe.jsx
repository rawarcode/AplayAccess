import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api.js';

// Public page reached from the unsubscribe link in newsletter emails.
// URL shape: /newsletter/unsubscribe?email=<addr>&token=<hmac>
// The token is verified server-side against HMAC-SHA256(email, APP_KEY)
// so people can't unsubscribe strangers by guessing emails.
//
// Two-step confirm instead of one-click-unsubscribe — protects against
// link pre-fetchers (email clients like Gmail, Outlook that pre-render
// links) accidentally unsubscribing the user.
export default function NewsletterUnsubscribe() {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const token = params.get('token') || '';

  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState('');

  async function handleUnsubscribe() {
    if (!email || !token) {
      setError('Invalid or expired unsubscribe link.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/newsletter-unsubscribe', { email, token });
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pt-16 min-h-screen bg-slate-50 flex flex-col">
      <Helmet><title>Unsubscribe — Aplaya Beach Resort</title></Helmet>
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          {done ? (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-check text-emerald-600 text-2xl" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Unsubscribed</h2>
              <p className="text-sm text-slate-500 mb-6">
                {email && <><strong className="text-slate-700">{email}</strong> has been removed from the Aplaya Beach Resort newsletter.<br /></>}
                We're sorry to see you go. You won't receive any more campaign emails from us.
              </p>
              <Link to="/" className="inline-block py-2 px-5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg transition">
                Back to Home
              </Link>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-envelope-circle-check text-amber-600 text-2xl" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Unsubscribe from newsletter?</h2>
              <p className="text-sm text-slate-500 mb-6">
                {email
                  ? <>You're about to unsubscribe <strong className="text-slate-700 break-all">{email}</strong> from the Aplaya Beach Resort newsletter. You'll stop receiving promotional emails, but your booking confirmations and account notifications will still work.</>
                  : <>This unsubscribe link is missing its email address. Try clicking the link from your email again.</>
                }
              </p>

              {error && (
                <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-lg text-sm border border-rose-200">
                  <i className="fas fa-exclamation-circle mr-2" />{error}
                </div>
              )}

              <div className="flex gap-2">
                <Link
                  to="/"
                  className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Link>
                <button
                  onClick={handleUnsubscribe}
                  disabled={submitting || !email || !token}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition inline-flex items-center justify-center gap-2"
                >
                  {submitting
                    ? <><i className="fas fa-spinner fa-spin" /> Unsubscribing…</>
                    : <><i className="fas fa-times-circle" /> Confirm Unsubscribe</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
