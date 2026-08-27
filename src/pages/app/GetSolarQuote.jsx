import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config.js';
import { HOMEOWNER_STATUS_OPTIONS, TIMELINE_OPTIONS } from '../../lib/marketplace.js';

const initial = {
  name: '',
  phone: '',
  email: '',
  address: '',
  zip: '',
  monthlyBill: '',
  homeownerStatus: 'Homeowner',
  installationTimeline: '1–3 months',
  projectDetails: '',
};

export default function GetSolarQuote() {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          address: form.address,
          zip: form.zip,
          monthlyBill: form.monthlyBill,
          homeownerStatus: form.homeownerStatus,
          installationTimeline: form.installationTimeline,
          projectDetails: form.projectDetails,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setResult(data);
    } catch (err) {
      setError(err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="bg-deep text-on-background min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center space-y-4">
          <span className="material-symbols-outlined text-5xl text-emerald-400">check_circle</span>
          <h1 className="text-2xl font-display font-bold">Inquiry received</h1>
          <p className="text-sm text-white/70">{result.message}</p>
          <div className="rounded-xl bg-black/30 border border-white/10 p-4 text-left text-sm space-y-1">
            <div>
              <span className="text-white/50">Lead ID:</span>{' '}
              <span className="font-mono text-primary">{result.leadCode}</span>
            </div>
            <div>
              <span className="text-white/50">Status:</span> {result.status}
            </div>
          </div>
          <Link to="/" className="inline-block text-sm text-primary hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-deep text-on-background min-h-screen py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <Link to="/" className="text-primary text-sm hover:underline">
            SpaceToRoof.com
          </Link>
          <h1 className="mt-3 text-3xl font-display font-bold">Get a solar quote</h1>
          <p className="mt-2 text-sm text-white/60">
            Submit one inquiry. Qualified installers bid for your project — your contact details stay
            private until an installer wins.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4"
        >
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name" required>
              <input className={inputCls} value={form.name} onChange={set('name')} required />
            </Field>
            <Field label="Phone" required>
              <input className={inputCls} value={form.phone} onChange={set('phone')} required />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                className={inputCls}
                value={form.email}
                onChange={set('email')}
                required
              />
            </Field>
            <Field label="ZIP">
              <input className={inputCls} value={form.zip} onChange={set('zip')} />
            </Field>
          </div>

          <Field label="Property address" required>
            <input className={inputCls} value={form.address} onChange={set('address')} required />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Monthly electricity bill ($)">
              <input
                type="number"
                min="0"
                step="1"
                className={inputCls}
                value={form.monthlyBill}
                onChange={set('monthlyBill')}
              />
            </Field>
            <Field label="Homeowner status">
              <select
                className={inputCls}
                value={form.homeownerStatus}
                onChange={set('homeownerStatus')}
              >
                {HOMEOWNER_STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Installation timeline">
              <select
                className={inputCls}
                value={form.installationTimeline}
                onChange={set('installationTimeline')}
              >
                {TIMELINE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Solar interest / project details">
            <textarea
              className={`${inputCls} min-h-[100px]`}
              value={form.projectDetails}
              onChange={set('projectDetails')}
              placeholder="Tell us about your roof, goals, or questions…"
            />
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary text-black font-semibold py-3 hover:brightness-110 disabled:opacity-50"
          >
            {loading ? 'Submitting…' : 'Submit inquiry'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50';

function Field({ label, required, children }) {
  return (
    <label className="block text-sm space-y-1.5">
      <span className="text-white/70">
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
