import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Mail, Lock, ShieldAlert, ArrowRight } from 'lucide-react';

const Login = () => {
  const { login, error } = useContext(AuthContext);
  const [email, setEmail] = useState('admin@devpilot.ai');
  const [password, setPassword] = useState('password123');
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
    <div className="min-h-screen flex items-center justify-center bg-[#070b13] px-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>

      <div className="w-full max-w-md glass p-8 rounded-2xl shadow-2xl border border-white/5 relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Welcome Back</h2>
          <p className="text-slate-400 text-xs mt-2">Log in to manage and analyze your software planning workspace</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl space-y-2">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            {unverifiedEmail && (
              <button
                type="button"
                onClick={() => navigate('/verify-email', { state: { email: unverifiedEmail } })}
                className="w-full mt-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors shadow-md shadow-indigo-600/20"
              >
                <span>Verify Email Now</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@company.com"
                className="w-full py-3 pl-10 pr-4 rounded-xl glass-input text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-3 pl-10 pr-4 rounded-xl glass-input text-sm text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-semibold text-sm text-white shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          <p>Don't have an account? <Link to="/register" className="text-indigo-400 hover:underline">Register here</Link></p>
        </div>

        {/* Demo Credentials Alert */}
        <div className="mt-8 p-3 rounded-xl bg-white/5 border border-white/5 text-[11px] text-slate-400">
          <span className="font-bold text-slate-300 block mb-1">💡 MongoDB Atlas Connected Admin Details:</span>
          Login Email: <code className="text-indigo-300">admin@devpilot.ai</code><br/>
          Password: <code className="text-indigo-300">password123</code>
        </div>
      </div>
    </div>
  );
};

export default Login;
