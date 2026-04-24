import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../context/AuthContext';

const ROLE_REDIRECTS = {
  front_desk: '/frontdesk',
  admin:      '/admin',
  owner:      '/owner',
};

const ALLOWED_ROLES = Object.keys(ROLE_REDIRECTS);

function getRoleRedirect(role) {
  return ROLE_REDIRECTS[role] ?? '/frontdesk';
}

export default function StaffLogin() {
  const { loginStaff, isLoggedIn, user, booting } = useAuth();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);
  const navigate = useNavigate();

  // Already logged in as staff — redirect to their dashboard
  if (!booting && isLoggedIn && ALLOWED_ROLES.includes(user?.role)) {
    return <Navigate to={getRoleRedirect(user.role)} replace />;
  }

  // Guest trying to access staff login — send them home
  if (!booting && isLoggedIn && !ALLOWED_ROLES.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      const u = await loginStaff(email, password);
      if (!ALLOWED_ROLES.includes(u?.role)) {
        setError('Access denied. This portal is for staff only.');
        return;
      }
      navigate(getRoleRedirect(u.role));
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        'Invalid credentials. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative auth-surface"
    >
      <Helmet><title>Staff Login — Aplaya Beach Resort</title></Helmet>
      {/* Background accents */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-20">
        <i className="fas fa-umbrella-beach absolute text-7xl bottom-5 right-8 text-coastal-decor rotate-6"></i>
        <i className="fas fa-circle absolute text-5xl left-5 top-8 text-coastal-decor-light -rotate-12"></i>
      </div>

      {/* Card */}
      <div
        className="relative z-20 bg-white rounded-[48px] shadow-2xl max-w-4xl w-full flex flex-wrap overflow-hidden border border-coastal-border-alt animate-hero-fade-in [animation-delay:0.1s] opacity-0"
        style={{ boxShadow: '0 30px 50px -30px rgba(0,80,100,0.25), 0 6px 12px rgba(0,0,0,0.02)' }}
      >
        {/* Left — Branding */}
        <div className="flex-1 min-w-[280px] bg-coastal-bg p-12 flex flex-col justify-between border-r border-coastal-border-alt">
          <div>
            <div className="flex items-center gap-2">
              <i className="fas fa-umbrella-beach text-4xl text-brand"></i>
              <span className="text-3xl font-light text-brand tracking-tight">AplayAccess</span>
              <span className="text-xs text-coastal-text-muted font-light ml-1">staff</span>
            </div>
            <div className="mt-10 mb-4">
              <h2 className="font-light text-3xl text-brand leading-tight">
                welcome back,<br />team member
              </h2>
              <p className="text-coastal-text font-light mt-3">
                <i className="fas fa-wave-square text-coastal-accent mr-2"></i>
                you'll be redirected to your dashboard after login
              </p>
            </div>

            {/* Role hints */}
            <div className="mt-6 space-y-2 text-sm text-coastal-text">
              <div className="flex items-center gap-2">
                <i className="fas fa-circle-dot text-coastal-accent text-xs"></i>
                <span>Front Desk → reservations & walk-ins</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-circle-dot text-coastal-accent text-xs"></i>
                <span>Owner → management & analytics</span>
              </div>
            </div>
          </div>

          <div className="text-coastal-text-muted font-light text-sm border-t border-dashed border-coastal-border pt-6">
            <i className="fas fa-map-pin text-coastal-accent mr-2"></i>
            Aplaya Beach Resort · Cavite
          </div>
        </div>

        {/* Right — Login form */}
        <div className="flex-1 min-w-[340px] bg-white p-12">
          <div className="flex items-center gap-2 mb-10">
            <i className="fas fa-lock-open text-2xl text-brand bg-coastal-bg-accent p-3 rounded-full"></i>
            <h2 className="font-light text-3xl text-brand">Staff Portal</h2>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-lg text-sm border border-rose-200">
              <i className="fas fa-exclamation-circle mr-2"></i>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="relative mb-6">
              <i className="fas fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-coastal-accent text-xl"></i>
              <input
                type="email"
                autoComplete="email"
                placeholder="work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full py-4 pl-14 pr-6 bg-coastal-bg-alt border border-coastal-border rounded-[34px] text-brand outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand focus:bg-white transition-all placeholder:text-coastal-placeholder"
              />
            </div>

            <div className="relative mb-3">
              <i className="fas fa-lock absolute left-5 top-1/2 -translate-y-1/2 text-coastal-accent text-xl"></i>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full py-4 pl-14 pr-14 bg-coastal-bg-alt border border-coastal-border rounded-[34px] text-brand outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand focus:bg-white transition-all placeholder:text-coastal-placeholder"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-coastal-accent hover:text-brand transition"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>

            <div className="flex justify-end mb-6">
              <Link to="/forgot-password" className="text-xs text-coastal-accent hover:text-brand transition">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-brand text-white rounded-[60px] font-medium text-xl shadow-lg auth-cta-shadow flex items-center justify-center gap-3 transition-all hover:bg-brand-dark hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60"
            >
              <i className="fas fa-arrow-right-to-bracket"></i>
              {loading ? 'signing in...' : 'log in'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-coastal-text-muted">
            <i className="fas fa-circle-check text-coastal-accent mr-2"></i>
            authorized personnel only
          </div>

          <div className="mt-4 text-center">
            <Link
              to="/resort"
              className="text-xs text-coastal-accent hover:text-brand transition"
            >
              <i className="fas fa-arrow-left mr-1"></i>
              Back to resort
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
