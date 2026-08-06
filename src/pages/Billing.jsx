import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { API_BASE } from '../config.js';

const API = API_BASE;

export default function Billing() {
  const [credits, setCredits] = useState(0);
  const [activePackage, setActivePackage] = useState('Free');
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const load = async () => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const [meRes, invRes, subRes] = await Promise.all([
        fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/billing/invoices`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/billing/subscription`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (!meRes.ok) throw new Error('Unauthorized');
      const me = await meRes.json();
      setCredits(me.credits);
      setActivePackage(me.activePackage || 'Free');
      setSubscription(me.subscription || null);
      if (invRes.ok) setInvoices(await invRes.json());
      if (subRes.ok) {
        const subData = await subRes.json();
        if (subData.subscription) setSubscription(subData.subscription);
        if (subData.credits !== undefined) setCredits(subData.credits);
      }
    } catch (err) {
      localStorage.removeItem('solar_token');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      const token = localStorage.getItem('solar_token');
      const sessionId = searchParams.get('session_id');
      const razorpaySub =
        searchParams.get('razorpay_sub') || sessionStorage.getItem('pending_razorpay_sub');
      const success = searchParams.get('success');
      if (token && sessionId) {
        await fetch(`${API}/api/billing/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sessionId })
        });
        setMessage('Subscription confirmed — credits updated.');
      } else if (token && razorpaySub) {
        await fetch(`${API}/api/billing/confirm-razorpay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ subscriptionId: razorpaySub })
        });
        sessionStorage.removeItem('pending_razorpay_sub');
        setMessage('Razorpay subscription confirmed — credits updated.');
      } else if (success) {
        setMessage('Subscription active — credits updated.');
      }
      await load();
    };
    run();
  }, [navigate, searchParams]);

  const openPortal = async () => {
    const token = localStorage.getItem('solar_token');
    setPortalLoading(true);
    try {
      const res = await fetch(`${API}/api/billing/portal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open billing portal');
      if (data.url) {
        window.location.href = data.url;
      } else if (data.manageOnBilling) {
        setMessage(data.message || 'Manage your subscription below.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setPortalLoading(false);
    }
  };

  const cancelSubscription = async () => {
    const token = localStorage.getItem('solar_token');
    if (!window.confirm('Cancel subscription at end of this billing period?')) return;
    setCancelLoading(true);
    try {
      const res = await fetch(`${API}/api/billing/cancel-subscription`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancel failed');
      setMessage(data.message || 'Subscription canceled.');
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setCancelLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg text-2xl md:text-headline-lg font-bold text-primary">Billing & Subscription</h2>
        <p className="text-on-surface-variant text-sm mt-1">Monthly plans, credit balance, and invoices.</p>
        {message && <p className="mt-2 text-green-400 text-xs font-semibold">{message}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter mb-stack-lg text-xs">
        <div className="glass-card p-6 rounded-xl flex flex-col justify-between h-56 border-l-4 border-l-primary">
          <div>
            <span className="font-label-mono text-[9px] text-primary uppercase tracking-widest block mb-1">
              ACTIVE PLAN
            </span>
            <h3 className="font-headline-md text-xl font-bold text-white mb-2">
              {subscription?.packageName || activePackage}
            </h3>
            {subscription ? (
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Status: <span className="text-white font-semibold">{subscription.status}</span>
                {subscription.cancelAtPeriodEnd && (
                  <span className="text-yellow-400"> · Cancels at period end</span>
                )}
              </p>
            ) : (
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Free tier — 5 signup credits. Subscribe for monthly lead credits.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 mt-4">
            {subscription && (
              <>
                {subscription.paymentProvider === 'razorpay' ? (
                  <button
                    type="button"
                    onClick={cancelSubscription}
                    disabled={cancelLoading || subscription.cancelAtPeriodEnd}
                    className="text-left text-red-400 font-label-mono text-[10px] hover:underline font-bold disabled:opacity-50"
                  >
                    {cancelLoading
                      ? 'Canceling…'
                      : subscription.cancelAtPeriodEnd
                        ? 'Cancellation scheduled'
                        : 'Cancel subscription'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openPortal}
                    disabled={portalLoading}
                    className="text-primary font-label-mono text-[10px] hover:underline font-bold text-left disabled:opacity-60"
                  >
                    {portalLoading ? 'Opening portal…' : 'Manage subscription'}
                  </button>
                )}
              </>
            )}
            <Link to="/packages" className="text-primary font-label-mono text-[10px] hover:underline font-bold">
              {subscription ? 'Change plan' : 'View monthly plans'}
            </Link>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl flex flex-col justify-between h-56">
          <div>
            <span className="font-label-mono text-[9px] text-secondary uppercase tracking-widest block mb-1">
              CREDIT BALANCE
            </span>
            <h3 className="font-headline-md text-xl font-bold text-white mb-2">Remaining Leads</h3>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-lg text-3xl font-bold text-secondary">{credits}</span>
              <span className="text-xs text-on-surface-variant font-medium">credits</span>
            </div>
            {subscription?.leadLimit && (
              <p className="text-[10px] text-on-surface-variant mt-2">
                Plan allowance: {subscription.leadLimit} credits/month
              </p>
            )}
          </div>
          <Link
            to="/packages"
            className="w-full mt-4 bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 text-secondary font-button text-xs py-2 rounded-lg transition-colors font-bold text-center"
          >
            {subscription ? 'Upgrade plan' : 'Subscribe'}
          </Link>
        </div>

        <div className="glass-card p-6 rounded-xl flex flex-col justify-between h-56">
          <div>
            <span className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest block mb-1">
              RENEWAL
            </span>
            <h3 className="font-headline-md text-xl font-bold text-white mb-2">Next credit refresh</h3>
            {subscription?.currentPeriodEnd ? (
              <>
                <p className="text-sm text-white font-semibold mt-2">{formatDate(subscription.currentPeriodEnd)}</p>
                <p className="text-[10px] text-on-surface-variant mt-2">
                  Credits reset to your plan limit on each monthly renewal.
                </p>
              </>
            ) : (
              <p className="text-xs text-on-surface-variant mt-2">
                Subscribe to a monthly plan for automatic credit refresh every billing cycle.
              </p>
            )}
          </div>
        </div>
      </div>

      <section className="glass-card rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-glass-stroke">
          <h3 className="font-headline-md text-base font-bold text-on-surface">Invoice History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs text-left">
            <thead>
              <tr className="bg-white/5">
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Invoice
                </th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Date
                </th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Package
                </th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Type
                </th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Amount
                </th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Credits
                </th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-stroke">
              {invoices.map((tx) => (
                <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-semibold text-white">INV-{tx.id}</td>
                  <td className="px-6 py-4 text-on-surface-variant">
                    {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">{tx.package_id}</td>
                  <td className="px-6 py-4 text-on-surface-variant capitalize">{tx.billing_reason || 'initial'}</td>
                  <td className="px-6 py-4 font-semibold text-white">
                    ${(Number(tx.amount_cents || 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">{tx.credits}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase ${
                        tx.status === 'paid'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-on-surface-variant">
                    No invoices yet. Subscribe to a monthly plan to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppLayout>
  );
}
