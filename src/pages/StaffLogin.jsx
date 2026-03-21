import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { TOKEN_KEY } from '../lib/api';

const StaffLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [keepSignedIn, setKeepSignedIn] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await api.post('/api/admin/login', { email, password });
            const { user, token } = res.data;

            localStorage.setItem(TOKEN_KEY, token);
            login(user);

            if (user.role === 'owner')       navigate('/owner');
            else if (user.role === 'admin')  navigate('/admin');
            else if (user.role === 'front_desk') navigate('/frontdesk');
            else navigate('/owner'); // fallback
        } catch (err) {
            const msg = err?.response?.data?.message || 'Invalid credentials.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative"
             style={{ background: 'radial-gradient(circle at 10% 30%, #d4e9f5, #f8ffff)' }}>
            {/* Beach background elements */}
            <div className="absolute inset-0 pointer-events-none z-0 opacity-20">
                <i className="fas fa-umbrella-beach absolute text-7xl bottom-5 right-8 text-[#b0d0dd] rotate-6"></i>
                <i className="fas fa-shell absolute text-5xl left-5 top-8 text-[#cbe0e9] -rotate-12"></i>
            </div>

            {/* Main card */}
            <div className="relative z-20 bg-white rounded-[48px] shadow-2xl max-w-4xl w-full flex flex-wrap overflow-hidden border border-[#e2edf2]"
                 style={{ boxShadow: '0 30px 50px -30px rgba(0, 80, 100, 0.25), 0 6px 12px rgba(0,0,0,0.02)' }}>

                {/* Left column - Branding */}
                <div className="flex-1 min-w-[280px] bg-[#f9fcfe] p-12 flex flex-col justify-between border-r border-[#e2edf2]">
                    <div>
                        <div className="flex items-center gap-2">
                            <i className="fas fa-umbrella-beach text-4xl text-[#1e3a8a]"></i>
                            <span className="text-3xl font-light text-[#1e3a8a] tracking-tight">AplayAccess</span>
                            <span className="text-xs text-[#6b8cae] font-light ml-1">staff</span>
                        </div>

                        <div className="mt-10 mb-4">
                            <h2 className="font-light text-3xl text-[#1e3a8a] leading-tight">
                                good afternoon,<br />team member
                            </h2>
                            <p className="text-[#4a6f8c] font-light mt-3">
                                <i className="fas fa-wave-square text-[#5f9db2] mr-2"></i>
                                manage reservations, beach access & your shift
                            </p>
                        </div>
                    </div>

                    <div className="text-[#6b8cae] font-light text-sm border-t border-dashed border-[#cde3ea] pt-6">
                        <i className="fas fa-map-pin text-[#5f9db2] mr-2"></i>
                        Aplaya Beach Resort · Staff Portal
                    </div>
                </div>

                {/* Right column - Login form */}
                <div className="flex-1 min-w-[340px] bg-white p-12">
                    <div className="flex items-center gap-2 mb-10">
                        <i className="fas fa-lock-open text-2xl text-[#1e3a8a] bg-[#e1f1f7] p-3 rounded-full"></i>
                        <h2 className="font-light text-3xl text-[#1e3a8a]">Staff Portal</h2>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">
                            <i className="fas fa-exclamation-circle mr-2"></i>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="relative mb-6">
                            <i className="fas fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-[#5f9db2] text-xl"></i>
                            <input
                                type="email"
                                placeholder="work email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full py-4 pl-14 pr-6 bg-[#f3fafd] border border-[#cde3ec] rounded-[34px] text-[#1e3a8a] outline-none focus:border-[#1e3a8a] focus:bg-white focus:shadow-[0_0_0_4px_#d8eef6] transition-all placeholder:text-[#9dbecb]"
                                required
                            />
                        </div>

                        <div className="relative mb-6">
                            <i className="fas fa-lock absolute left-5 top-1/2 -translate-y-1/2 text-[#5f9db2] text-xl"></i>
                            <input
                                type="password"
                                placeholder="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full py-4 pl-14 pr-6 bg-[#f3fafd] border border-[#cde3ec] rounded-[34px] text-[#1e3a8a] outline-none focus:border-[#1e3a8a] focus:bg-white focus:shadow-[0_0_0_4px_#d8eef6] transition-all placeholder:text-[#9dbecb]"
                                required
                            />
                        </div>

                        <div className="flex items-center mb-8 text-[#4a6f8c]">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={keepSignedIn}
                                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                                    className="accent-[#1e3a8a] w-4 h-4"
                                />
                                keep signed in
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-[#1e3a8a] text-white rounded-[60px] font-medium text-xl shadow-lg border border-[#bce2ee] flex items-center justify-center gap-3 transition-all hover:bg-[#152c6e] hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60"
                            style={{ boxShadow: '0 8px 18px -6px #5f9db2' }}
                        >
                            <i className="fas fa-arrow-right-to-bracket"></i>
                            {loading ? 'signing in...' : 'log in'}
                        </button>
                    </form>

                    <div className="mt-8 flex flex-col items-center gap-3">
                        <div className="flex items-center gap-3 w-full text-[#b0cfdb]">
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#cbe2eb] to-transparent"></div>
                            <span className="text-sm text-[#4a6f8c]">secure clock‑in</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#cbe2eb] to-transparent"></div>
                        </div>

                        <div className="text-center text-sm text-[#6b8cae]">
                            <i className="fas fa-circle-check text-[#5f9db2] mr-2"></i>
                            authorized personnel only
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StaffLogin;
