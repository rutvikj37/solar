import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, AlertCircle, ArrowRight, Building2, UserCheck } from 'lucide-react';
import { API_BASE } from '../../config.js';
import { BRAND_NAME, BRAND_DISPLAY } from '../../config/brand.js';
import { setToken, getToken, isTokenValid } from '../../lib/auth.js';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setVerifyError('Missing invitation token. Please check the link from your email.');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/team/invite/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.valid) {
          setVerifyError(data.error || 'This invitation link is invalid or has expired.');
        } else {
          setInviteData(data);
          setName(data.existingName || '');
        }
      } catch (err) {
        setVerifyError('Could not connect to the verification server. Please check your internet connection.');
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const existingAccount = Boolean(inviteData?.userExists);
  const loginNext = `/login?next=${encodeURIComponent(`/accept-invite?token=${token}`)}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (existingAccount && !isTokenValid(getToken())) {
      navigate(loginNext);
      return;
    }
    if (!existingAccount) {
      if (!name.trim()) {
        setSubmitError('Please enter your full name');
        return;
      }
      if (password.length < 8) {
        setSubmitError('Password must be at least 8 characters long');
        return;
      }
      if (password !== confirmPassword) {
        setSubmitError('Passwords do not match');
        return;
      }
    }

    setSubmitting(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const sessionToken = getToken();
      if (existingAccount && sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
      const res = await fetch(`${API_BASE}/api/team/invite/accept`, {
        method: 'POST',
        headers,
        body: JSON.stringify(
          existingAccount ? { token } : { token, name: name.trim(), password },
        ),
      });

      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && data.code === 'LOGIN_REQUIRED') {
        navigate(loginNext);
        return;
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to accept invitation. Please try again.');
      }

      setSuccess(true);
      if (data.token) {
        setToken(data.token);
      }

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
    } catch (err) {
      setSubmitError(err.message || 'An error occurred while setting your password.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasLength = password.length >= 8;
  const hasLetterAndNumber = /[A-Za-z]/.test(password) && /\d/.test(password);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center px-4 py-12 transition-colors duration-200">
      {/* Brand Header */}
      <div className="text-center mb-8 space-y-2">
        <Link to="/" className="inline-flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            STR
          </div>
          <span className="font-bold text-2xl tracking-tight text-slate-900 dark:text-white">
            {BRAND_NAME}<span className="text-blue-600">.com</span>
          </span>
        </Link>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tracking-wide uppercase">
          AI Solar Intelligence Platform
        </p>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-md bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xl p-7 sm:p-8 space-y-6">
        {verifying && (
          <div className="py-12 text-center space-y-4">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Validating your workspace invitation...
            </p>
          </div>
        )}

        {!verifying && verifyError && (
          <div className="space-y-5 text-center py-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h2 className="font-bold text-lg text-slate-900 dark:text-white">Invitation Unavailable</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                {verifyError}
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2.5">
              <Link
                to="/login"
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>Return to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {!verifying && !verifyError && inviteData && (
          <>
            {/* Header & Workspace Details Card */}
            <div className="space-y-4 border-b border-slate-100 dark:border-white/[0.06] pb-5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 text-[11px] font-semibold font-mono">
                <Building2 className="w-3.5 h-3.5" />
                <span>Workspace Invitation</span>
              </div>

              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Join {inviteData.companyName || 'the Team'}
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Invited by <strong className="text-slate-800 dark:text-slate-200">{inviteData.inviterName}</strong> to collaborate as{' '}
                  <span className="capitalize font-semibold text-blue-600 dark:text-blue-400">
                    {inviteData.role ? inviteData.role.replace(/_/g, ' ') : 'Team Member'}
                  </span>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">Assigned Role</span>
                <span className="font-semibold text-slate-900 dark:text-white capitalize px-2 py-0.5 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-[11px]">
                  {inviteData.role ? inviteData.role.replace(/_/g, ' ') : 'Team Member'}
                </span>
              </div>
            </div>

            {/* Success Banner */}
            {success ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Workspace Activated!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Welcome to the team. Redirecting to your dashboard now...
                </p>
              </div>
            ) : (
              /* Setup Password Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {submitError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Email (Readonly) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Your Workspace Email
                  </label>
                  <input
                    type="text"
                    disabled
                    value={inviteData.email || ''}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 text-xs font-mono cursor-not-allowed"
                  />
                </div>

                {existingAccount ? (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {isTokenValid(getToken())
                      ? 'You already have an account. Accepting adds it to this workspace — your password and settings stay the same.'
                      : 'You already have an account. Sign in with this email to accept the invitation.'}
                  </p>
                ) : (
                <>
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-black/30 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Set Your Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-white dark:bg-black/30 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-white dark:bg-black/30 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Criteria Checklist */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.05] space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasLength ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-400'}`}>
                      {hasLength ? '✓' : '•'}
                    </span>
                    <span className={hasLength ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-400'}>
                      At least 8 characters
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasLetterAndNumber ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-400'}`}>
                      {hasLetterAndNumber ? '✓' : '•'}
                    </span>
                    <span className={hasLetterAndNumber ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-400'}>
                      Contains letters and numbers
                    </span>
                  </div>
                </div>
                </>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Activating Workspace...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Accept Invitation & Join Workspace</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500 space-y-1">
        <p>Already have an account? <Link to="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">Sign In</Link></p>
        <p>© {new Date().getFullYear()} {BRAND_DISPLAY}. All rights reserved.</p>
      </div>
    </div>
  );
}
