import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../config.js';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const selectedPlan = searchParams.get('plan') || '';
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    password: '',
    region: 'California',
    license: '',
    volume: '50-200 leads/mo',
    crm: 'Salesforce'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (step === 1) {
      setStep(2);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');

      localStorage.setItem('solar_token', data.token);
      if (selectedPlan) {
        navigate(`/packages?plan=${encodeURIComponent(selectedPlan)}`);
      } else {
        navigate('/dashboard?welcome=1');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-deep text-on-background min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/15 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-primary-glow/10 blur-3xl rounded-full pointer-events-none" />
      <div className="w-full max-w-[500px] z-10 my-8">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-baseline gap-0 mb-2 select-none font-display">
            <span className="text-on-surface font-semibold text-2xl tracking-tight">SollarX</span>
            <span className="text-primary-glow font-semibold text-2xl tracking-tight">.ai</span>
          </Link>
          <p className="text-xs text-on-surface-variant">
            Step {step} of 2: {step === 1 ? 'Create Account' : 'Business Details'} — includes <span className="text-primary font-semibold">5 free credits</span>
          </p>
          <div className="flex justify-center gap-2 mt-4 max-w-[160px] mx-auto">
            <div className={`h-1.5 rounded-full flex-1 ${step >= 1 ? 'bg-primary' : 'bg-white/10'}`} />
            <div className={`h-1.5 rounded-full flex-1 ${step >= 2 ? 'bg-primary' : 'bg-white/10'}`} />
          </div>
        </div>

        <div className="glass-card p-8 rounded-2xl border border-glass-stroke shadow-2xl bg-surface-elevated/40 backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white mb-2">Credentials</h3>
                <div className="space-y-1">
                  <label className="text-on-surface-variant block font-medium">Full Name</label>
                  <input type="text" required value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-on-surface-variant block font-medium">Company Name</label>
                  <input type="text" required value={formData.company} onChange={(e) => handleInputChange('company', e.target.value)}
                    placeholder="EcoGen Installers Ltd"
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-on-surface-variant block font-medium">Email Address</label>
                  <input type="email" required value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-on-surface-variant block font-medium">Create Password</label>
                  <input type="password" required minLength={8} value={formData.password} onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white mb-2">Business Profile</h3>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[11px] font-semibold">
                  You get 5 free lead credits on signup. Subscribe to a monthly plan when you need more.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-on-surface-variant block font-medium">Target Region</label>
                    <select value={formData.region} onChange={(e) => handleInputChange('region', e.target.value)}
                      className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs">
                      <option value="California">California</option>
                      <option value="Texas">Texas</option>
                      <option value="Arizona">Arizona</option>
                      <option value="Florida">Florida</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-on-surface-variant block font-medium">CSLB License Number</label>
                    <input type="text" value={formData.license} onChange={(e) => handleInputChange('license', e.target.value)}
                      placeholder="e.g. CSLB-990184"
                      className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-on-surface-variant block font-medium">Monthly Target Lead Volume</label>
                  <select value={formData.volume} onChange={(e) => handleInputChange('volume', e.target.value)}
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs">
                    <option value="< 50 leads/mo">&lt; 50 leads/mo</option>
                    <option value="50-200 leads/mo">50 - 200 leads/mo</option>
                    <option value="200-500 leads/mo">200 - 500 leads/mo</option>
                    <option value="500+ leads/mo">500+ leads/mo</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-on-surface-variant block font-medium">Primary CRM Preference</label>
                  <select value={formData.crm} onChange={(e) => handleInputChange('crm', e.target.value)}
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs">
                    <option value="Salesforce">Salesforce CRM</option>
                    <option value="HubSpot">HubSpot CRM</option>
                    <option value="Zapier">Zapier Webhook</option>
                    <option value="CSV">CSV Downloads</option>
                  </select>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold">{error}</div>
            )}

            <div className="flex gap-3 pt-4">
              {step > 1 && (
                <button type="button" disabled={loading} onClick={() => setStep(1)}
                  className="flex-1 border border-glass-stroke hover:bg-white/5 text-on-surface font-semibold py-2.5 rounded-lg text-xs">
                  Back
                </button>
              )}
              <button type="submit" disabled={loading}
                className="flex-1 bg-primary text-on-primary font-bold py-2.5 rounded-lg hover:brightness-110 text-xs flex items-center justify-center gap-2 disabled:opacity-75">
                {loading ? 'Creating account…' : step === 1 ? 'Continue' : 'Create Account — 5 Free Credits'}
              </button>
            </div>
          </form>
        </div>

        {step === 1 && (
          <p className="text-center text-on-surface-variant text-[11px] mt-6">
            Already have an account? <Link to="/login" className="text-primary hover:underline font-semibold">Sign in here</Link>
          </p>
        )}
      </div>
    </div>
  );
}
