import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../../config.js';
import { invoiceNumber, openInvoicePdf } from '../../utils/invoicePdf.js';
import { formatLedgerEntryType, formatMoney, formatWhen } from '../../lib/marketplace.js';

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
  const s = String(status || '').toLowerCase();
  const paid = s === 'paid';
  const adjusted = s === 'adjusted' || s === 'admin';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide ${
        paid
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
          : adjusted
            ? 'bg-sky-500/10 text-sky-300 border-sky-500/25'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
      }`}
    >
      {status || 'pending'}
    </span>
  );
}

function formatBillingReason(reason) {
  const map = {
    initial: 'Lead plan purchase',
    renewal: 'Lead plan renewal',
    admin_plan_grant: 'Admin plan grant',
    admin_plan_change: 'Admin plan change',
    admin_plan_restrict: 'Admin plan restrict',
    admin_plan_unrestrict: 'Admin restriction lifted',
    admin_credit_adjustment: 'Lead credit adjustment',
    marketplace_wallet: 'Bid wallet top-up',
  };
  return map[reason] || String(reason || 'initial').replace(/_/g, ' ');
}

function isMarketplaceWalletInvoice(tx) {
  return tx?.billing_reason === 'marketplace_wallet';
}

function invoiceProductLabel(tx) {
  if (isMarketplaceWalletInvoice(tx)) {
    const pack = String(tx.package_id || '');
    const match = pack.match(/^mkt_(\d+)$/);
    if (match) return `$${match[1]} Bid Wallet`;
    if (pack === 'mkt_custom') return 'Custom Bid Wallet top-up';
    return 'Bid Wallet';
  }
  return tx.package_name || tx.package_id || '—';
}

function invoiceQuantityLabel(tx) {
  if (isMarketplaceWalletInvoice(tx)) {
    const usd = Number(tx.credits || 0);
    return usd ? `$${usd.toLocaleString()} bid balance` : '—';
  }
  if (tx.credits == null) return '—';
  return `${Number(tx.credits).toLocaleString()} lead credits`;
}

function invoicePaymentMethod(tx) {
  if (!tx?.method) return '—';
  const map = {
    stripe: 'Stripe',
    stripe_subscription: 'Stripe',
    stripe_marketplace: 'Stripe',
    razorpay_marketplace: 'Razorpay (legacy)',
    razorpay_plan: 'Razorpay (legacy)',
    razorpay_subscription: 'Razorpay (legacy)',
    dev_credit: 'Dev checkout',
    dev_subscription: 'Dev checkout',
    dev_marketplace: 'Dev checkout',
  };
  return map[tx.method] || String(tx.method).replace(/_/g, ' ');
}

export default function Billing() {
  const [credits, setCredits] = useState(0);
  const [activePackage, setActivePackage] = useState('Free');
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [invoiceDetailLoading, setInvoiceDetailLoading] = useState(false);
  const [invoiceDetailError, setInvoiceDetailError] = useState('');
  const [invoicePdfBusyId, setInvoicePdfBusyId] = useState(null);
  const [invoicePdfError, setInvoicePdfError] = useState('');
  const [packages, setPackages] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [billingMonths, setBillingMonths] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [plansLoading, setPlansLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [marketplaceWallet, setMarketplaceWallet] = useState({ balance: 0, ledger: [] });
  const [entitlements, setEntitlements] = useState(null);
  const [planDetails, setPlanDetails] = useState(null);
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

  const planPerMonth = (pkg, months = billingMonths) => {
    const m = Number(months) || 1;
    if (m === 12) return Number(pkg.price_12mo ?? pkg.price_6mo ?? pkg.price_1mo ?? pkg.price) || 0;
    if (m === 6) return Number(pkg.price_6mo ?? pkg.price_1mo ?? pkg.price) || 0;
    return Number(pkg.price_1mo ?? pkg.price) || 0;
  };

  const loadPlans = async () => {
    try {
      const res = await fetch(`${API}/api/billing/packages`);
      const rows = await res.json();
      const list = (Array.isArray(rows) ? rows : []).filter(
        (p) => !['Starter', 'Growth', 'Enterprise', 'Custom'].includes(p.id),
      );
      setPackages(list);
      const planParam = searchParams.get('plan');
      const monthsParam = Number(searchParams.get('months'));
      if ([1, 6, 12].includes(monthsParam)) {
        setBillingMonths(monthsParam);
      }
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
    setCheckoutError('');
    setMessage('');
    try {
      const res = await fetch(`${API}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageId: pkgId, billingMonths })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.mode === 'stripe' && data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.mode === 'dev') {
        setMessage(data.message || 'Subscription activated (dev checkout)');
        await load();
        return;
      }
      setMessage(data.message || 'Subscription activated');
      await load();
    } catch (err) {
      setCheckoutError(err.message || 'Could not start checkout');
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
      const [meRes, invRes, subRes, mktWalletRes] = await Promise.all([
        fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/billing/invoices`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/billing/subscription`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/billing/marketplace-wallet`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!meRes.ok) throw new Error('Unauthorized');
      const me = await meRes.json();
      setCredits(me.credits);
      setActivePackage(me.activePackage || 'Free');
      setSubscription(me.subscription || null);
      if (invRes.ok) {
        const invData = await invRes.json();
        const list = Array.isArray(invData)
          ? invData
          : Array.isArray(invData?.invoices)
            ? invData.invoices
            : [];
        setInvoices(list);
      }
      if (subRes.ok) {
        const subData = await subRes.json();
        if (subData.subscription) setSubscription(subData.subscription);
        if (subData.credits !== undefined) setCredits(subData.credits);
        if (subData.activePackage) setActivePackage(subData.activePackage);
        if (subData.entitlements) setEntitlements(subData.entitlements);
        if (subData.plan) setPlanDetails(subData.plan);
      }
      if (mktWalletRes.ok) {
        const walletData = await mktWalletRes.json();
        setMarketplaceWallet({
          balance: walletData.balance ?? 0,
          ledger: walletData.ledger ?? [],
        });
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
      const success = searchParams.get('success');
      const canceled = searchParams.get('canceled');
      if (token && sessionId) {
        await fetch(`${API}/api/billing/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sessionId })
        });
        setMessage('Subscription confirmed — credits updated.');
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

  const closeInvoice = () => {
    setViewingInvoice(null);
    setInvoiceDetailError('');
    setInvoiceDetailLoading(false);
    setInvoicePdfError('');
  };

  const viewInvoicePdf = async (id, { download = false } = {}) => {
    if (!id || invoicePdfBusyId) return;
    setInvoicePdfBusyId(id);
    setInvoicePdfError('');
    try {
      await openInvoicePdf(id, { download });
    } catch (err) {
      setInvoicePdfError(err.message || 'Could not open invoice PDF');
    } finally {
      setInvoicePdfBusyId(null);
    }
  };

  const openInvoice = async (tx) => {
    if (!tx?.id) return;
    setViewingInvoice(tx);
    setInvoiceDetailError('');
    setInvoiceDetailLoading(true);
    try {
      const token = localStorage.getItem('solar_token');
      const res = await fetch(`${API}/api/billing/invoices/${tx.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load invoice');
      setViewingInvoice(data);
    } catch (err) {
      setInvoiceDetailError(err.message || 'Could not load invoice');
    } finally {
      setInvoiceDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!viewingInvoice) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeInvoice();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewingInvoice]);

  if (loading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
      </div>
    );
  }

  const planName =
    subscription?.packageName ||
    planDetails?.name ||
    entitlements?.packageName ||
    activePackage ||
    'Free';
  const isFreeTier =
    (activePackage === 'Free' || !activePackage) &&
    (!subscription || subscription.status === 'canceled');
  const planLeadLimit =
    subscription?.leadLimit != null
      ? Number(subscription.leadLimit)
      : planDetails?.leadLimit != null && Number(planDetails.leadLimit) > 0
        ? Number(planDetails.leadLimit)
        : entitlements?.limits?.leadLimit != null && Number(entitlements.limits.leadLimit) > 0
          ? Number(entitlements.limits.leadLimit)
          : isFreeTier
            ? 5
            : null;
  const hasCustomBalance = isFreeTier && Number(credits) !== 5;
  const creditsLabel = Number(credits).toLocaleString();

  let planDescription;
  if (subscription) {
    planDescription = (
      <>
        Active subscription ({subscription.packageName || planName}) with{' '}
        <span className="text-on-surface font-semibold">{planLeadLimit?.toLocaleString() ?? '—'}</span> credits
        per billing cycle
        {subscription.billingInterval === 'year'
          ? ', billed yearly.'
          : subscription.billingInterval
            ? ', billed monthly.'
            : '.'}
      </>
    );
  } else if (planDetails?.description) {
    planDescription = `${planDetails.description}. ${isFreeTier ? 'Your initial free allowance includes 5 map lead scan credits.' : ''}`;
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
        <p className="text-2xl font-bold text-on-surface tracking-tight mt-1">{formatDate(subscription.currentPeriodEnd)}</p>
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
        <p className="text-lg font-semibold text-on-surface mt-1">No renewal scheduled</p>
        <p className="text-xs text-on-surface-variant mt-3 leading-relaxed">
          Subscribe to a monthly plan for automatic credit refresh each billing cycle.
        </p>
      </>
    );
  }

  return (
    <>
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
          {subscription && (
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
              <h3 className="text-xl font-bold text-on-surface tracking-tight">{planName}</h3>
            </div>
            <StatusPill status={subscription?.status || (isFreeTier ? 'Free' : null)} cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd} />
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed flex-1">{planDescription}</p>
          <div className="mt-5 flex flex-col gap-2">
            {subscription && (
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

      {/* Comprehensive Plan Details & Entitlements Overview */}
      <section className="mb-8 p-6 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-white/[0.06] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[22px]">
                verified
              </span>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {planName} Plan Details & Entitlements
              </h3>
              <StatusPill
                status={subscription?.status || (isFreeTier ? 'Free Tier' : 'Active')}
                cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live breakdown of your monthly allowances, team seats, and unlocked platform capabilities.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="#plans"
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition active:scale-95 shadow-xs flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">upgrade</span>
              <span>{isFreeTier ? 'Upgrade to Pro' : 'Compare All Plans'}</span>
            </a>
          </div>
        </div>

        {/* Plan Specs Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] text-xs">
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">Plan Cost</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 block">
              {subscription?.price
                ? `$${Number(subscription.price).toLocaleString()} / ${subscription.billingInterval || 'mo'}`
                : planDetails?.price && Number(planDetails.price) > 0
                  ? `$${Number(planDetails.price).toLocaleString()} / ${planDetails.billingInterval || 'mo'}`
                  : 'Free ($0 / mo)'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">Billing Cadence</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 block">
              {subscription?.billingInterval === 'year'
                ? 'Annual (12 Months)'
                : subscription?.billingInterval === '6mo'
                  ? 'Semi-Annual (6 Months)'
                  : subscription
                    ? 'Monthly Plan'
                    : 'No Auto-Renewal'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">Credit Refresh</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 block truncate">
              {subscription?.currentPeriodEnd
                ? formatDate(subscription.currentPeriodEnd)
                : 'On-demand Top-ups'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">Team Seats</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 block">
              {entitlements?.limits?.crmUserLimit || 1} Seat{(entitlements?.limits?.crmUserLimit || 1) > 1 ? 's' : ''} Included
            </span>
          </div>
        </div>

        {/* Quota Progress Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Quota 1: Lead Credits */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/[0.06] space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-500 text-[18px]">bolt</span>
                Lead Credits
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {credits} {planLeadLimit ? `/ ${planLeadLimit}` : 'Available'}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${planLeadLimit ? Math.min(100, Math.round((credits / planLeadLimit) * 100)) : 100}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {planLeadLimit ? `${credits} credits remaining in current cycle.` : 'Signup credits & balance.'}
            </p>
          </div>

          {/* Quota 2: Team Member Seats */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/[0.06] space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-500 text-[18px]">group</span>
                Workspace Seats
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {entitlements?.usage?.crmSeats || 1} / {entitlements?.limits?.crmUserLimit || 1}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.round(((entitlements?.usage?.crmSeats || 1) / (entitlements?.limits?.crmUserLimit || 1)) * 100))}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {(entitlements?.limits?.crmUserLimit || 1) > 1
                ? `${(entitlements?.limits?.crmUserLimit || 1) - (entitlements?.usage?.crmSeats || 1)} seat(s) remaining for team.`
                : '1 master owner seat included.'}
            </p>
          </div>

          {/* Quota 3: Automated Outreach */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/[0.06] space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-purple-500 text-[18px]">forward_to_inbox</span>
                Outreach Sequences
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {entitlements?.usage?.dripCampaigns || 0} / {entitlements?.limits?.emailAutomationLimit || 1}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
              <div
                className="bg-purple-600 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.round(((entitlements?.usage?.dripCampaigns || 0) / (entitlements?.limits?.emailAutomationLimit || 1)) * 100))}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Active email drip cadence campaigns.
            </p>
          </div>

          {/* Quota 4: Monthly Email Volume */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/[0.06] space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-500 text-[18px]">mark_email_read</span>
                Email Sends
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {entitlements?.limits?.emailLimit ? `${entitlements.limits.emailLimit.toLocaleString()}/mo` : '100/mo'}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: '100%' }}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Transactional & cold outreach allowance.
            </p>
          </div>
        </div>

        {/* Feature Capabilities Matrix */}
        <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              Included Platform Features & Tools
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Based on your active {planName} tier
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: 'Satellite Area Scan', active: true, desc: 'High-res rooftop analysis' },
              { label: 'Interactive Proposals', active: entitlements?.features?.proposals ?? false, desc: 'System sizing & payback' },
              { label: 'Marketplace Bidding', active: entitlements?.features?.marketplace ?? false, desc: 'Buy & bid on fresh leads' },
              { label: 'CSV / CRM Export', active: entitlements?.features?.csvExport ?? false, desc: 'One-click lead download' },
              { label: 'Advanced Map Filters', active: entitlements?.features?.advancedFilters ?? false, desc: 'Property value & shading' },
              { label: 'Drip Automations', active: entitlements?.features?.dripAutomations ?? true, desc: 'Scheduled follow-ups' },
              { label: 'Territory Lock', active: entitlements?.features?.territoryLock ?? false, desc: 'Exclusive ZIP territory' },
              { label: 'Early Marketplace', active: entitlements?.features?.earlyMarketplace ?? false, desc: 'Priority lead access' },
            ].map((feat) => (
              <div
                key={feat.label}
                className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                  feat.active
                    ? 'bg-emerald-500/[0.05] border-emerald-500/20 text-slate-900 dark:text-white'
                    : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.06] text-slate-400 opacity-60'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${
                    feat.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {feat.active ? 'check_circle' : 'lock'}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight truncate">{feat.label}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 truncate">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Invoice history */}
      <section className="glass-card rounded-2xl border border-glass-stroke overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b border-glass-stroke flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-headline-md text-base font-bold text-on-surface">Payment History</h3>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Lead credit plans, bid wallet top-ups, and admin adjustments — with downloadable invoices.
            </p>
          </div>
          {invoices.length > 0 && (
            <span className="text-[10px] font-label-mono uppercase tracking-wider text-on-surface-variant">
              {invoices.length} record{invoices.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {invoicePdfError && !viewingInvoice && (
          <p className="px-3 sm:px-6 py-2 text-[11px] text-amber-300 border-b border-glass-stroke">{invoicePdfError}</p>
        )}

        {invoices.length === 0 ? (
          <div className="px-3 sm:px-6 py-14 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-glass-stroke flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl text-on-surface-variant">receipt_long</span>
            </div>
            <p className="text-sm font-semibold text-on-surface mb-1">No invoices yet</p>
            <p className="text-xs text-on-surface-variant max-w-sm leading-relaxed mb-5">
              Lead plan purchases, bid wallet top-ups, and account adjustments will appear here after
              payment.
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
            <table className="w-full border-collapse text-xs text-left min-w-[560px] sm:min-w-[720px]">
              <thead>
                <tr className="bg-white/[0.03]">
                  {['Invoice', 'Date', 'Product', 'Type', 'Amount', 'Purchased', 'Status', ''].map((h) => (
                    <th
                      key={h || 'actions'}
                      className="px-3 sm:px-6 py-3.5 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-stroke">
                {invoices.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => openInvoice(tx)}
                  >
                    <td className="px-3 sm:px-6 py-4 text-on-surface">
                      <p className="font-semibold font-mono text-[11px]">{invoiceNumber(tx.id)}</p>
                      {tx.description && (
                        <p className="text-[10px] text-on-surface-variant mt-0.5 leading-snug max-w-xs">
                          {tx.description}
                        </p>
                      )}
                      {tx.admin_name && (
                        <p className="text-[10px] text-on-surface-variant/80 mt-0.5">by {tx.admin_name}</p>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-on-surface-variant whitespace-nowrap">
                      {tx.created_at ? formatDate(tx.created_at) : '—'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-on-surface">{invoiceProductLabel(tx)}</td>
                    <td className="px-3 sm:px-6 py-4 text-on-surface-variant capitalize">
                      {formatBillingReason(tx.billing_reason)}
                    </td>
                    <td className="px-3 sm:px-6 py-4 font-semibold text-on-surface tabular-nums">
                      {formatAmount(tx.amount_cents)}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-on-surface-variant tabular-nums">
                      {invoiceQuantityLabel(tx)}
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <InvoiceStatusPill status={tx.status} />
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInvoice(tx);
                        }}
                        className="text-primary font-bold text-[10px] hover:underline"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        disabled={invoicePdfBusyId === tx.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          viewInvoicePdf(tx.id);
                        }}
                        className="ml-3 text-primary font-bold text-[10px] hover:underline disabled:opacity-50"
                      >
                        {invoicePdfBusyId === tx.id ? 'Opening…' : 'View PDF'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bid wallet activity (marketplace wins & top-ups) */}
      <section className="glass-card rounded-2xl border border-glass-stroke overflow-hidden mt-8">
        <div className="px-3 sm:px-6 py-4 border-b border-glass-stroke flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-headline-md text-base font-bold text-on-surface">Bid Wallet Activity</h3>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Marketplace bid wallet balance and charges — including lead win deductions.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Balance</p>
            <p className="text-lg font-bold text-primary">{formatMoney(marketplaceWallet.balance)}</p>
          </div>
        </div>
        {marketplaceWallet.ledger.length === 0 ? (
          <div className="px-3 sm:px-6 py-10 text-center text-sm text-on-surface-variant">
            No bid wallet activity yet. Top-ups and lead win charges appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs text-left min-w-[480px] sm:min-w-[640px]">
              <thead>
                <tr className="bg-white/[0.03]">
                  {['Date', 'Type', 'Amount', 'Balance', 'Note'].map((h) => (
                    <th
                      key={h}
                      className="px-3 sm:px-6 py-3 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-stroke">
                {marketplaceWallet.ledger.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.03]">
                    <td className="px-3 sm:px-6 py-3 text-on-surface-variant whitespace-nowrap">
                      {formatWhen(row.created_at)}
                    </td>
                    <td className="px-3 sm:px-6 py-3 text-on-surface">{formatLedgerEntryType(row.entry_type)}</td>
                    <td
                      className={`px-6 py-3 font-semibold ${
                        Number(row.amount) < 0 ? 'text-red-300' : 'text-emerald-300'
                      }`}
                    >
                      {formatMoney(row.amount)}
                    </td>
                    <td className="px-3 sm:px-6 py-3">{formatMoney(row.balance_after)}</td>
                    <td className="px-3 sm:px-6 py-3 text-on-surface-variant">{row.note || '—'}</td>
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
          <h3 className="font-headline-md text-xl font-bold text-primary">Founding Launch Plans</h3>
          <p className="text-on-surface-variant text-sm mt-1 max-w-2xl">
            Monthly AI opportunity credits refresh every billing cycle. Choose commitment length for a lower monthly rate.
          </p>
          <div className="mt-4 inline-flex rounded-xl border border-glass-stroke bg-surface-container-low/60 p-1 gap-1">
            {[
              { months: 1, label: '1 Month' },
              { months: 6, label: '6 Months' },
              { months: 12, label: '12 Months' },
            ].map((opt) => (
              <button
                key={opt.months}
                type="button"
                onClick={() => setBillingMonths(opt.months)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  billingMonths === opt.months
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {checkoutError && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-amber-300 text-xs font-semibold bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 max-w-2xl">
              <span className="material-symbols-outlined text-sm">error</span>
              {checkoutError}
            </p>
          )}
        </div>

        {plansLoading ? (
          <div className="text-center text-on-surface-variant py-12">Loading plans…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {packages.map((pkg, idx) => {
              const features = parseFeatures(pkg.features);
              const isMonthly = Number(pkg.is_subscription) === 1 || pkg.billing_interval === 'month';
              const perMonth = planPerMonth(pkg);
              const total = Math.round(perMonth * billingMonths * 100) / 100;
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
                      {isMonthly ? `${billingMonths}-month plan` : 'Credit pack'}
                    </p>
                    <h4 className="font-headline-md text-xl font-bold text-on-surface">{pkg.name}</h4>
                    <div className="mt-4 flex items-baseline gap-1 flex-wrap">
                      <span className="text-3xl font-bold text-on-surface">${perMonth.toLocaleString()}</span>
                      <span className="text-xs text-on-surface-variant">
                        / month
                        {billingMonths > 1 ? ` · $${total.toLocaleString()} billed` : ''}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-2">
                      {pkg.lead_limit} opportunities/mo
                      {Number(pkg.email_limit) > 0
                        ? ` · ${Number(pkg.email_limit).toLocaleString()} emails/mo`
                        : ''}
                      {Number(pkg.whatsapp_limit) > 0
                        ? ` · ${Number(pkg.whatsapp_limit)} WhatsApp`
                        : ''}
                    </p>
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
                        ? `Subscribe — ${billingMonths} mo`
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

      {viewingInvoice && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeInvoice}
          role="presentation"
        >
          <div
            className="glass-card rounded-2xl w-full max-w-lg border border-glass-stroke p-6 relative"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-detail-title"
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <p className="font-label-mono text-[9px] text-primary uppercase tracking-[0.2em] mb-1">
                  Invoice
                </p>
                <h3 id="invoice-detail-title" className="text-lg font-bold text-on-surface font-mono">
                  {invoiceNumber(viewingInvoice.id)}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeInvoice}
                className="text-on-surface-variant hover:text-on-surface"
                aria-label="Close invoice"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {invoiceDetailLoading && (
              <p className="text-[11px] text-on-surface-variant mb-4">Refreshing invoice details…</p>
            )}
            {invoiceDetailError && (
              <p className="text-[11px] text-amber-300 mb-4">{invoiceDetailError}</p>
            )}
            {invoicePdfError && (
              <p className="text-[11px] text-amber-300 mb-4">{invoicePdfError}</p>
            )}

            <dl className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Date', viewingInvoice.created_at ? formatDate(viewingInvoice.created_at) : '—'],
                ['Product', invoiceProductLabel(viewingInvoice)],
                ['Type', formatBillingReason(viewingInvoice.billing_reason)],
                ['Amount', formatAmount(viewingInvoice.amount_cents)],
                ['Purchased', invoiceQuantityLabel(viewingInvoice)],
                ['Payment', invoicePaymentMethod(viewingInvoice)],
              ].map(([label, value]) => (
                <div key={label} className="bg-white/5 rounded-lg p-3">
                  <dt className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
                    {label}
                  </dt>
                  <dd className="text-on-surface font-semibold mt-1 break-words">{value}</dd>
                </div>
              ))}
              <div className="bg-white/5 rounded-lg p-3">
                <dt className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
                  Status
                </dt>
                <dd className="mt-1">
                  <InvoiceStatusPill status={viewingInvoice.status} />
                </dd>
              </div>
            </dl>

            {viewingInvoice.description && (
              <div className="mt-3 bg-white/5 rounded-lg p-3">
                <p className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
                  Description
                </p>
                <p className="text-on-surface text-xs mt-1 leading-relaxed">{viewingInvoice.description}</p>
              </div>
            )}

            {viewingInvoice.admin_name && (
              <div className="mt-3 bg-white/5 rounded-lg p-3">
                <p className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
                  Admin
                </p>
                <p className="text-on-surface text-xs mt-1">
                  {viewingInvoice.admin_name}
                  {viewingInvoice.admin_email ? ` · ${viewingInvoice.admin_email}` : ''}
                </p>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={invoicePdfBusyId === viewingInvoice.id}
                onClick={() => viewInvoicePdf(viewingInvoice.id, { download: true })}
                className="px-4 py-2 rounded-xl bg-white/5 border border-glass-stroke text-on-surface text-xs font-bold hover:bg-white/10 disabled:opacity-50"
              >
                {invoicePdfBusyId === viewingInvoice.id ? 'Preparing…' : 'Download PDF'}
              </button>
              <button
                type="button"
                disabled={invoicePdfBusyId === viewingInvoice.id}
                onClick={() => viewInvoicePdf(viewingInvoice.id)}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:brightness-110 disabled:opacity-50"
              >
                {invoicePdfBusyId === viewingInvoice.id ? 'Opening…' : 'View PDF'}
              </button>
              <button
                type="button"
                onClick={closeInvoice}
                className="px-4 py-2 rounded-xl bg-white/5 border border-glass-stroke text-on-surface text-xs font-bold hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
