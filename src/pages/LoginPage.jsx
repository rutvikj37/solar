import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../config.js';
import SatelliteUplinkLoader from '../components/SatelliteUplinkLoader.jsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAuthLoader, setShowAuthLoader] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid email or password');
      }

      setShowAuthLoader(true);
      localStorage.setItem('solar_token', data.token);
      const next = searchParams.get('next');
      navigate(next && next.startsWith('/') ? next : '/dashboard');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="bg-deep text-on-background min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <SatelliteUplinkLoader visible={showAuthLoader} />
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 blur-3xl rounded-full pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-glow/10 blur-3xl rounded-full pointer-events-none"></div>

      <div className="w-full max-w-[420px] z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-baseline gap-0 mb-2 select-none font-display">
            <span className="text-on-surface font-semibold text-2xl tracking-tight">SollarX</span>
            <span className="text-primary-glow font-semibold text-2xl tracking-tight">.ai</span>
          </Link>
          <p className="text-xs text-on-surface-variant">Sign in to manage your solar leads pipeline.</p>
        </div>

        {/* Login Form Card */}
        <div className="glass-card p-8 rounded-2xl border border-glass-stroke shadow-2xl bg-surface-elevated/40 backdrop-blur-xl">
          <h3 className="text-lg font-bold text-white mb-6">Welcome Back</h3>
          
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-on-surface-variant block font-medium">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs placeholder:text-on-surface-variant/30 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-on-surface-variant block font-medium">Password</label>
                <a href="#" className="text-primary hover:underline text-[10px]">Forgot password?</a>
              </div>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs placeholder:text-on-surface-variant/30 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input 
                type="checkbox" 
                id="remember"
                className="rounded bg-surface-container-low border-glass-stroke text-primary focus:ring-primary w-4 h-4"
              />
              <label htmlFor="remember" className="text-on-surface-variant select-none">Remember this device</label>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary text-on-primary font-bold py-3 rounded-lg mt-4 hover:brightness-110 active:scale-[0.98] transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-75"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

        </div>

        {/* Footnote */}
        <p className="text-center text-on-surface-variant text-[11px] mt-6">
          Don't have an account? <Link to="/register" className="text-primary hover:underline font-semibold">Sign up for free</Link>
        </p>
      </div>
    </div>
  );
}
