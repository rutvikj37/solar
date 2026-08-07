import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { API_BASE } from '../config.js';

const API = API_BASE;

function StatusPill({ status, cancelAtPeriodEnd }) {
  const s = String(status || '').toLowerCase();
  let classes = 'bg-white/5 text-on-surface-variant border-white/10';
  let label = status || 'None';

  if (cancelAtPeriodEnd) {
    classes = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    label = 'Cancels at period end';
  } else if (s === 'active' || s === 'authenticated' || s === 'created') {
    classes = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    label = s === 'active' ? 'Active' : status;
  } else if (s === 'canceled' || s === 'cancelled' || s === 'expired') {
    classes = 'bg-red-500/15 text-red-300 border-red-500/30';
  } else if (s === 'past_due' || s === 'halted') {
    classes = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${classes}`}>
      {label}
    </span>
  );
}

function InvoiceStatusPill({ status }) {
  const paid = String(status || '').toLowerCase() === 'paid';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide ${
        paid
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
          : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
      }`}
    >
      {status || 'pending'}
    </span>
  );
}

export default function Billing() {
  const [credits, setCredits] = useState(0);
  const [activePackage, setActivePackage] = useState('Free');
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [plansLoading, setPlansLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const parseFeatures = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const loadPlans = async () => {
    try {
      const res = await fetch(`${API}/api/billing/packages`);
      const rows = await res.json();
      const list = Array.isArray(rows) ? rows : [];
      setPackages(list);
      const planParam = searchParams.get('plan');
      if (planParam && list.some((p) => p.id === planParam)) {
        setSelectedPlan(planParam);
      } else if (list[0]) {
        setSelectedPlan(list[0].id);
      }
    } catch {
      setPackages([]);
    } finally {
      setPlansLoading(false);
    }
  };

  const handlePurchase = async (pkgId) => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      navigate('/login');
      return;
    }
    setPurchasing(true);
    setSelectedPlan(pkgId);
    try {
      const res = await fetch(`${API}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageId: pkgId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.mode === 'razorpay' && data.url) {
        sessionStorage.setItem('pending_razorpay_sub', data.subscriptionId || '');
        window.location.href = data.url;
        return;
      }
      if (data.mode === 'stripe' && data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage(data.message || 'Subscription activated');
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setPurchasing(false);
    }
  };

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
        if (subData.activePackage) setActivePackage(subData.activePackage);
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
      const canceled = searchParams.get('canceled');
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
      } else if (canceled) {
        setMessage('Checkout canceled — no changes were made.');
      }
      await Promise.all([load(), loadPlans()]);
    };
    run();
  }, [navigate, searchParams]);

  useEffect(() => {
    if (window.location.hash === '#plans') {
      document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading, plansLoading]);

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

  const formatAmount = (cents) => {
    const n = Number(cents || 0) / 100;
    return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  };

  if (loading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
      </div>
    );
  }

  const planName = subscription?.packageName || activePackage || 'Free';
  const isFreeTier = !subscription;
  const planLeadLimit = subscription?.leadLimit != null ? Number(subscription.leadLimit) : null;
  const hasCustomBalance = isFreeTier && Number(credits) !== 5;
  const creditsLabel = Number(credits).toLocaleString();

  let planDescription;
  if (subscription) {
    planDescription = (
      <>
        Monthly plan with{' '}
        <span className="text-white font-semibold">{planLeadLimit?.toLocaleString() ?? '—'}</span> credits
        per billing cycle
        {subscription.billingInterval === 'year'
          ? ', billed yearly.'
          : subscription.billingInterval
            ? ', billed monthly.'
            : '.'}
      </>
    );
  } else if (hasCustomBalance) {
    planDescription =
      'Free plan with no monthly subscription. Your available credit balance is the source of truth and may include signup credits plus account adjustments.';
  } else {
    planDescription =
      'Free plan with no monthly subscription. New accounts start with 5 signup credits; your remaining balance above is what you can spend.';
  }

  let renewalBody;
  if (subscription?.currentPeriodEnd) {
    renewalBody = (
      <>
        <p className="text-2xl font-bold text-white tracking-tight mt-1">{formatDate(subscription.currentPeriodEnd)}</p>
        <p className="text-xs text-on-surface-variant mt-3 leading-relaxed">
          {subscription.cancelAtPeriodEnd
            ? 'Access continues until this date. Credits will not refresh after cancellation.'
            : 'Credits refresh to your plan allowance on each renewal.'}
        </p>
        {subscription.currentPeriodStart && (
          <p className="text-[10px] text-on-surface-variant/80 mt-2 font-label-mono uppercase tracking-wider">
            Period started {formatDate(subscription.currentPeriodStart)}
          </p>
        )}
      </>
    );
  } else {
    renewalBody = (
      <>
        <p className="text-lg font-semibold text-white mt-1">No renewal scheduled</p>
        <p className="text-xs text-on-surface-variant mt-3 leading-relaxed">
          Subscribe to a monthly plan for automatic credit refresh each billing cycle.
        </p>
      </>
    );
  }

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-2xl md:text-headline-lg font-bold text-primary">
            Billing & Subscription
          </h2>
          <p className="text-on-surface-variant text-sm mt-1 max-w-xl">
            Plan status, credit balance, renewal dates, and invoice history.
          </p>
          {message && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-emerald-400 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              {message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {subscription && subscription.paymentProvider !== 'razorpay' && (
            <button
              type="button"
              onClick={openPortal}
              disabled={portalLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 border border-glass-stroke text-on-surface text-xs font-bold hover:bg-white/10 active:scale-95 transition-all disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-base">manage_accounts</span>
              {portalLoading ? 'Opening…' : 'Manage billing'}
            </button>
          )}
          <a
            href="#plans"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/25"
          >
            <span className="material-symbols-outlined text-base">{subscription ? 'upgrade' : 'workspace_premium'}</span>
            {subscription ? 'Change plan' : 'View plans'}
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Active plan */}
        <div className="glass-card rounded-2xl border border-glass-stroke p-6 flex flex-col min-h-[220px] relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <span className="font-label-mono text-[9px] text-primary uppercase tracking-[0.2em] block mb-2">
                Active plan
              </span>
              <h3 className="text-xl font-bold text-white tracking-tight">{planName}</h3>
            </div>
            <StatusPill status={subscription?.status || (isFreeTier ? 'Free' : null)} cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd} />
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed flex-1">{planDescription}</p>
          <div className="mt-5 flex flex-col gap-2">
            {subscription?.paymentProvider === 'razorpay' && (
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
            )}
            {subscription && subscription.paymentProvider !== 'razorpay' && (
              <button
                type="button"
                onClick={openPortal}
                disabled={portalLoading}
                className="text-left text-on-surface-variant font-label-mono text-[10px] hover:text-primary hover:underline font-bold disabled:opacity-60"
              >
                {portalLoading ? 'Opening portal…' : 'Open Stripe customer portal'}
              </button>
            )}
            <a
              href="#plans"
              className="text-primary font-label-mono text-[10px] hover:underline font-bold"
            >
              {subscription ? 'Compare monthly plans →' : 'Browse monthly plans →'}
            </a>
          </div>
        </div>

        {/* Credit balance — source of truth */}
        <div className="glass-card rounded-2xl border border-glass-stroke p-6 flex flex-col min-h-[220px]">
          <span className="font-label-mono text-[9px] text-secondary uppercase tracking-[0.2em] block mb-2">
            Credit balance
          </span>
          <h3 className="text-sm font-semibold text-on-surface-variant mb-3">Available to spend</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-secondary tracking-tight tabular-nums">{creditsLabel}</span>
            <span className="text-sm text-on-surface-variant font-medium">credits</span>
          </div>
          <p className="text-xs text-on-surface-variant mt-3 leading-relaxed">
            1 lead unlock = 1 credit. This balance is your remaining allowance
            {isFreeTier ? ' on the Free plan' : ' for the current period'}
            {hasCustomBalance ? ', including any credits added to your account' : ''}.
          </p>
          {planLeadLimit != null && (
            <p className="text-[10px] text-on-surface-variant mt-2 font-label-mono uppercase tracking-wider">
              Plan allowance · {planLeadLimit.toLocaleString()} / month
            </p>
          )}
          <a
            href="#plans"
            className="mt-auto pt-5 w-full inline-flex items-center justify-center gap-1.5 bg-primary text-on-primary font-bold text-xs py-2.5 rounded-xl hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-primary/20"
          >
            <span className="material-symbols-outlined text-base">{subscription ? 'rocket_launch' : 'add_card'}</span>
            {subscription ? 'Upgrade plan' : 'Subscribe'}
          </a>
        </div>

        {/* Renewal / period */}
        <div className="glass-card rounded-2xl border border-glass-stroke p-6 flex flex-col min-h-[220px]">
          <span className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-[0.2em] block mb-2">
            {subscription ? 'Current period ends' : 'Renewal'}
          </span>
          <h3 className="text-sm font-semibold text-on-surface-variant mb-1">
            {subscription ? 'Next credit refresh' : 'Billing cycle'}
          </h3>
          <div className="flex-1">{renewalBody}</div>
          {subscription?.paymentProvider && (
            <p className="text-[10px] text-on-surface-variant/70 mt-4 font-label-mono uppercase tracking-wider">
              Provider · {subscription.paymentProvider}
            </p>
          )}
        </div>
      </div>

      {/* Invoice history */}
      <section className="glass-card rounded-2xl border border-glass-stroke overflow-hidden">
        <div className="px-6 py-4 border-b border-glass-stroke flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-headline-md text-base font-bold text-on-surface">Invoice History</h3>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Receipts from Stripe and Razorpay checkouts and renewals.
            </p>
          </div>
          {invoices.length > 0 && (
            <span className="text-[10px] font-label-mono uppercase tracking-wider text-on-surface-variant">
              {invoices.length} record{invoices.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {invoices.length === 0 ? (
          <div className="px-6 py-14 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-glass-stroke flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl text-on-surface-variant">receipt_long</span>
            </div>
            <p className="text-sm font-semibold text-white mb-1">No invoices yet</p>
            <p className="text-xs text-on-surface-variant max-w-sm leading-relaxed mb-5">
              When you subscribe to a monthly plan, payment receipts will appear here after each successful charge.
            </p>
            <a
              href="#plans"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
              View monthly plans
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs text-left min-w-[720px]">
              <thead>
                <tr className="bg-white/[0.03]">
                  {['Invoice', 'Date', 'Package', 'Type', 'Amount', 'Credits', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3.5 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-stroke">
                {invoices.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-6 py-4 font-semibold text-white font-mono text-[11px]">
                      INV-{String(tx.id).padStart(4, '0')}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                      {tx.created_at ? formatDate(tx.created_at) : '—'}
                    </td>
                    <td className="px-6 py-4 text-on-surface">{tx.package_id || '—'}</td>
                    <td className="px-6 py-4 text-on-surface-variant capitalize">
                      {(tx.billing_reason || 'initial').replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 font-semibold text-white tabular-nums">
                      {formatAmount(tx.amount_cents)}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant tabular-nums">{tx.credits ?? '—'}</td>
                    <td className="px-6 py-4">
                      <InvoiceStatusPill status={tx.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Monthly plans */}
      <section id="plans" className="mt-10 scroll-mt-24">
        <div className="mb-6 text-center sm:text-left">
          <h3 className="font-headline-md text-xl font-bold text-primary">Monthly Plans</h3>
          <p className="text-on-surface-variant text-sm mt-1 max-w-2xl">
            1 lead unlock = 1 credit. Plans renew every month — credits refresh each billing cycle.
          </p>
        </div>

        {plansLoading ? (
          <div className="text-center text-on-surface-variant py-12">Loading plans…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {packages.map((pkg, idx) => {
              const features = parseFeatures(pkg.features);
              const isMonthly = Number(pkg.is_subscription) === 1 || pkg.billing_interval === 'month';
              return (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPlan(pkg.id)}
                  className={`glass-card rounded-xl p-6 flex flex-col h-full cursor-pointer relative overflow-hidden transition-all ${
                    selectedPlan === pkg.id ? 'border-primary/50 bg-surface-elevated/40' : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  {idx === 1 && (
                    <div className="absolute top-0 right-0 bg-primary text-on-primary font-label-mono text-[9px] px-3 py-1 font-bold uppercase rounded-bl-lg">
                      Popular
                    </div>
                  )}
                  <div className="mb-6">
                    <p className="font-label-mono text-[9px] text-primary uppercase tracking-widest mb-1">
                      {isMonthly ? 'Monthly plan' : 'Credit pack'}
                    </p>
                    <h4 className="font-headline-md text-xl font-bold text-on-surface">{pkg.name}</h4>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">${Number(pkg.price).toLocaleString()}</span>
                      <span className="text-xs text-on-surface-variant">
                        {isMonthly ? '/ month' : ''} · {pkg.lead_limit} credits{isMonthly ? '/month' : ''}
                      </span>
                    </div>
                    {pkg.description && <p className="text-xs text-on-surface-variant mt-3">{pkg.description}</p>}
                  </div>
                  <ul className="space-y-2 mb-8 flex-grow text-xs">
                    {features.map((f) => (
                      <li key={f} className="flex gap-2 text-on-surface-variant">
                        <span className="material-symbols-outlined text-primary text-sm">check</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={purchasing}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePurchase(pkg.id);
                    }}
                    className="w-full bg-primary text-on-primary font-bold py-2.5 rounded-lg text-xs hover:brightness-110 disabled:opacity-60"
                  >
                    {purchasing && selectedPlan === pkg.id
                      ? 'Processing…'
                      : isMonthly
                        ? `Subscribe to ${pkg.name}`
                        : `Buy ${pkg.name}`}
                  </button>
                </div>
              );
            })}
            {packages.length === 0 && (
              <p className="col-span-full text-center text-on-surface-variant py-8">
                No active plans. Contact support for subscription options.
              </p>
            )}
          </div>
        )}
      </section>
    </AppLayout>
  );
}
