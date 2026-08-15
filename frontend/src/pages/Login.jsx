import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Mail, Lock, ShieldAlert, ArrowRight } from 'lucide-react';

const Login = () => {
  const { login, error } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setUnverifiedEmail('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      if (err.response?.data?.requiresVerification) {
        setUnverifiedEmail(err.response?.data?.email || email);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 relative overflow-hidden">
      {/* Background soft ambient accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-200 relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome Back</h2>
          <p className="text-slate-500 text-xs mt-2">Log in to manage and analyze your software planning workspace</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl space-y-2">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            {unverifiedEmail && (
              <button
                type="button"
                onClick={() => navigate('/verify-email', { state: { email: unverifiedEmail } })}
                className="w-full mt-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
              >
                <span>Verify Email Now</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@company.com"
                className="w-full py-3 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-3 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 font-semibold text-sm text-white shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          <p>Don't have an account? <Link to="/register" className="text-indigo-600 hover:underline font-semibold">Register here</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Login;
