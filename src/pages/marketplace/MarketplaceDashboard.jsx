import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import { API_BASE } from '../../config.js';
import { isAdminRole } from '../../lib/auth.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import PlanUpgradeGate from '../../components/PlanUpgradeGate.jsx';
import BiddingCountdown from '../../components/marketplace/BiddingCountdown.jsx';
import {
  DISPUTE_TYPES,
  MARKETPLACE_TABS,
  MARKETPLACE_WALLET_PACKS,
  OUTCOME_OPTIONS,
  formatLedgerEntryType,
  formatMoney,
  formatWhen,
  isBiddingOpen,
  strengthClass,
} from '../../lib/marketplace.js';

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('solar_token')}`,
    'Content-Type': 'application/json',
  };
}

function resetWalletCheckoutState(setWalletPaying, lockRef) {
  lockRef.current = false;
  setWalletPaying(false);
}

export default function MarketplaceDashboard() {
  const { user, unlimitedCredits, can, entitlements } = useAuth();
  const { theme } = useTheme();
  const isAdmin = isAdminRole(user?.role) || unlimitedCredits;

  if (!can('marketplace')) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <PlanUpgradeGate
          title="Marketplace requires Pioneer or Mission Control"
          message={`Your current plan (${entitlements?.packageName || 'Free'}) does not include Marketplace bidding. Upgrade to Pioneer or Mission Control to access opportunities.`}
          feature="marketplace"
          packageName={entitlements?.packageName}
        />
      </div>
    );
  }

  return <MarketplaceDashboardInner isAdmin={isAdmin} theme={theme} />;
}

function MarketplaceDashboardInner({ isAdmin, theme }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('opportunities');
  const [loading, setLoading] = useState(false);
  const [opportunities, setOpportunities] = useState([]);
  const [bids, setBids] = useState([]);
  const [won, setWon] = useState([]);
  const [active, setActive] = useState([]);
  const [closed, setClosed] = useState([]);
  const [wallet, setWallet] = useState({
    balance: 0,
    minBalanceToBid: 25,
    canBid: false,
    ledger: [],
    packs: MARKETPLACE_WALLET_PACKS,
    currency: 'USD',
    currencySymbol: '$',
    paymentProvider: 'stripe',
  });
  const [areas, setAreas] = useState([]);
  const [profile, setProfile] = useState(null);
  const [oppFilter, setOppFilter] = useState(null);
  const [bidDrafts, setBidDrafts] = useState({});
  const [areaForm, setAreaForm] = useState({ zip: '', state: '', radiusMiles: '25' });
  const [selectedLead, setSelectedLead] = useState(null);
  const [disputeForm, setDisputeForm] = useState({ claimType: 'wrong_number', details: '' });
  const [walletAmount, setWalletAmount] = useState('');
  const [walletPaying, setWalletPaying] = useState(false);
  const [biddingLeadId, setBiddingLeadId] = useState(null);
  const walletCheckoutLock = useRef(false);
  const isDevBuild = import.meta.env.DEV || import.meta.env.MODE !== 'production';
  const verificationStatus = String(
    oppFilter?.verificationStatus || profile?.verification_status || 'pending',
  ).toLowerCase();
  const accountBlocked =
    verificationStatus === 'rejected' || verificationStatus === 'suspended';
  const needsVerification =
    Boolean(oppFilter?.requireVerified) && verificationStatus !== 'verified' && !accountBlocked;

  const mergeWalletFromApi = (prev, data) => {
    const balance = data.walletBalance ?? data.balance ?? prev.balance;
    const minBalanceToBid = data.minBalanceToBid ?? prev.minBalanceToBid ?? 25;
    return {
      ...prev,
      balance,
      minBalanceToBid,
      canBid: data.canBid ?? balance >= minBalanceToBid,
      ledger: data.ledger ?? prev.ledger,
      packs: data.packs ?? prev.packs,
      currency: data.currency ?? prev.currency,
      currencySymbol: data.currencySymbol ?? prev.currencySymbol,
      paymentProvider: data.paymentProvider ?? prev.paymentProvider,
    };
  };

  const load = useCallback(async (activeTab) => {
    setLoading(true);
    try {
      if (activeTab === 'opportunities') {
        const res = await fetch(`${API_BASE}/api/marketplace/opportunities`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setOpportunities(data.opportunities || []);
        setOppFilter(data.filter || null);
        setWallet((w) => mergeWalletFromApi(w, data));
        const areasRes = await fetch(`${API_BASE}/api/marketplace/service-areas`, {
          headers: authHeaders(),
        });
        const areasData = await areasRes.json();
        if (areasRes.ok) {
          setAreas(areasData.areas || []);
          setProfile(areasData.profile);
        }
      } else if (activeTab === 'bids') {
        const res = await fetch(`${API_BASE}/api/marketplace/my-bids`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setBids(data.bids || []);
      } else if (activeTab === 'won') {
        const res = await fetch(`${API_BASE}/api/marketplace/won`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setWon(data.leads || []);
      } else if (activeTab === 'active') {
        const res = await fetch(`${API_BASE}/api/marketplace/active`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setActive(data.leads || []);
      } else if (activeTab === 'closed') {
        const res = await fetch(`${API_BASE}/api/marketplace/closed`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setClosed(data.leads || []);
      } else if (activeTab === 'wallet') {
        const res = await fetch(`${API_BASE}/api/marketplace/wallet`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setWallet((w) => mergeWalletFromApi(w, data));
      }
    } catch (err) {
      toast.error(err.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const walletReturnFlag = searchParams.get('wallet');

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  useEffect(() => {
    if (!walletReturnFlag) return;

    const confirmStripe = async (sessionId) => {
      try {
        const res = await fetch(`${API_BASE}/api/marketplace/wallet/confirm-stripe`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Stripe confirm failed');
        toast.success(`Bid wallet topped up — ${formatMoney(data.balance ?? data.walletBalance)}`);
      } catch (err) {
        toast.error(err.message);
      }
    };

    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      confirmStripe(sessionId);
    } else if (walletReturnFlag === '1') {
      toast.message('Returned from checkout — refreshing wallet…');
    } else if (walletReturnFlag === 'canceled') {
      toast.message('Wallet top-up canceled');
    }
    setTab('wallet');
    load('wallet');
    const next = new URLSearchParams(searchParams);
    next.delete('wallet');
    next.delete('session_id');
    setSearchParams(next, { replace: true });
  }, [walletReturnFlag, searchParams, setSearchParams, load]);

  const placeBid = async (leadId) => {
    const amount = Number(bidDrafts[leadId]);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid bid amount');
      return;
    }
    if (!wallet.canBid) {
      toast.error(
        `Add at least ${formatMoney(wallet.minBalanceToBid || 25)} to your bid wallet to place bids`,
      );
      setTab('wallet');
      return;
    }
    setBiddingLeadId(leadId);
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/opportunities/${leadId}/bids`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'min_wallet_balance') {
          toast.error(
            data.error ||
              `Add at least $${data.minBalanceToBid || wallet.minBalanceToBid || 25} to your bid wallet to place bids`,
          );
          setTab('wallet');
          return;
        }
        throw new Error(data.error || 'Bid failed');
      }
      toast.success(`Bid placed — ${data.bid?.strength || 'submitted'}`);
      load('opportunities');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBiddingLeadId(null);
    }
  };

  const postServiceArea = async ({ zip, state, radiusMiles }) => {
    const res = await fetch(`${API_BASE}/api/marketplace/service-areas`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        zip: zip || undefined,
        state: state || undefined,
        radiusMiles: radiusMiles != null && radiusMiles !== '' ? Number(radiusMiles) : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    return data;
  };

  const addArea = async (e) => {
    e.preventDefault();
    try {
      await postServiceArea({
        zip: areaForm.zip,
        state: areaForm.state,
        radiusMiles: areaForm.radiusMiles,
      });
      toast.success('Service area added');
      setAreaForm({ zip: '', state: '', radiusMiles: '25' });
      load('opportunities');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removeArea = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/service-areas/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to remove');
      toast.success('Removed');
      load('opportunities');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const updateOutcome = async (leadId, status) => {
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/won/${leadId}/outcome`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      toast.success(`Status → ${status}`);
      load(tab);
      setSelectedLead(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const fileDispute = async (leadId) => {
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/won/${leadId}/disputes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(disputeForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dispute failed');
      toast.success('Dispute submitted for review');
      setSelectedLead(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const startWalletCheckout = async ({ packId, amount } = {}) => {
    if (walletCheckoutLock.current || walletPaying) return;
    if (!packId) {
      const dollars = Number(amount);
      if (!Number.isFinite(dollars) || dollars < 25 || dollars > 5000) {
        toast.error('Enter an amount between $25 and $5,000');
        return;
      }
    }
    walletCheckoutLock.current = true;
    setWalletPaying(true);
    let redirecting = false;
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/wallet/checkout`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(packId ? { packId } : { amount: Number(amount) }),
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(data.error || 'Please log in again (session token missing or expired).');
        }
        if (data.code === 'payment_provider' || res.status === 503) {
          throw new Error(data.error || 'Stripe is not configured. Set STRIPE_SECRET_KEY in server/.env.');
        }
        throw new Error(data.error || 'Checkout failed');
      }

      if (data.mode === 'stripe' && data.url) {
        redirecting = true;
        window.location.href = data.url;
        return;
      }

      if (data.mode === 'dev') {
        toast.success(`Dev wallet top-up — ${formatMoney(data.balance)}`);
        load('wallet');
        return;
      }

      throw new Error(
        data.error ||
          'Stripe checkout could not start. Set STRIPE_SECRET_KEY in server/.env — credits are not added without payment.',
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      if (!redirecting) {
        resetWalletCheckoutState(setWalletPaying, walletCheckoutLock);
      }
    }
  };

  return (
    <div className="p-0 sm:p-2 md:p-4 space-y-5 max-w-6xl mx-auto">
      <Toaster theme={theme === 'light' ? 'light' : 'dark'} position="top-right" />
      <div>
        <h1 className="text-2xl font-display font-bold text-on-surface">Marketplace</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Bid on masked solar opportunities. Contact details unlock only when you win.
        </p>
      </div>

      {isAdmin && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-amber-200">
            <span className="font-bold">Admin:</span> Homeowner form submissions are approved in the operator
            console — not on this installer bidding page.
          </div>
          <Link
            to="/admin?tab=marketplace&mkt=leads"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 text-black text-xs font-bold px-3 py-2 hover:bg-amber-300 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">fact_check</span>
            Open marketplace approvals
          </Link>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto custom-scrollbar border-b border-glass-stroke pb-3 -mx-1 px-1">
        {MARKETPLACE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              tab === t.id
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-on-surface-variant">Loading…</p>}

      {tab === 'opportunities' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-glass-stroke bg-surface-container p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-on-surface">Your service area</h2>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  Add at least one ZIP code or state to see homeowner inquiries in your territory.
                  Opportunities are hidden until you choose where you work.
                </p>
              </div>
              {profile && (
                <div className="text-right space-y-1">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      accountBlocked
                        ? 'border-red-400/40 bg-red-500/10 text-red-200'
                        : verificationStatus === 'verified'
                          ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                          : 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                    }`}
                  >
                    {accountBlocked
                      ? `Account ${verificationStatus}`
                      : verificationStatus === 'verified'
                        ? 'Verified installer'
                        : `Verification: ${verificationStatus || 'pending'}`}
                  </span>
                  {(needsVerification || accountBlocked) && (
                    <p className="text-[10px] text-on-surface-variant max-w-[220px]">
                      {accountBlocked
                        ? 'Contact support or an admin to restore marketplace access.'
                        : 'Ask an admin to verify your installer account to see all opportunities.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={addArea} className="flex flex-wrap gap-2 items-end">
              <label className="text-xs text-on-surface-variant">
                ZIP
                <input
                  className={inputCls}
                  value={areaForm.zip}
                  onChange={(e) => setAreaForm((f) => ({ ...f, zip: e.target.value }))}
                  placeholder="85001"
                />
              </label>
              <label className="text-xs text-on-surface-variant">
                State
                <input
                  className={inputCls}
                  value={areaForm.state}
                  onChange={(e) => setAreaForm((f) => ({ ...f, state: e.target.value }))}
                  placeholder="AZ"
                />
              </label>
              <label className="text-xs text-on-surface-variant">
                Radius (mi)
                <input
                  className={inputCls}
                  value={areaForm.radiusMiles}
                  onChange={(e) => setAreaForm((f) => ({ ...f, radiusMiles: e.target.value }))}
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-primary text-on-primary text-xs font-semibold px-3 py-2 cursor-pointer hover:brightness-110"
              >
                Add area
              </button>
            </form>
            <ul className="flex flex-wrap gap-2">
              {areas.map((a) => (
                <li
                  key={a.id}
                  className="text-xs rounded-full border border-glass-stroke px-3 py-1 flex items-center gap-2"
                >
                  {[a.zip, a.state, a.radius_miles ? `${a.radius_miles}mi` : null]
                    .filter(Boolean)
                    .join(' · ')}
                  <button
                    type="button"
                    className="text-red-300"
                    onClick={() => removeArea(a.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
              {!areas.length && (
                <li className="text-xs text-amber-200/90">
                  No service area yet — add a ZIP or state above to view leads in your market.
                </li>
              )}
            </ul>
          </section>

          {areas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 p-6 text-sm text-on-surface-variant space-y-2">
              <p className="font-semibold text-amber-100">Choose your service area first</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Bidders only see homeowner inquiries that match their territory. Add a ZIP code
                (e.g. 85001) or state (e.g. AZ) with an optional radius, then relevant open leads
                will appear here.
              </p>
              {oppFilter?.openLeadCount > 0 && (
                <p className="text-[11px] text-on-surface-variant">
                  {oppFilter.openLeadCount} open lead{oppFilter.openLeadCount === 1 ? '' : 's'}{' '}
                  nationwide — waiting for your area selection.
                </p>
              )}
            </div>
          ) : (
            <>
          {!wallet.canBid && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 flex flex-wrap items-center justify-between gap-2">
              <span>
                Top up at least {formatMoney(wallet.minBalanceToBid || 25)} in your bid wallet to
                place bids on opportunities in your area.
              </span>
              <button
                type="button"
                onClick={() => setTab('wallet')}
                className="rounded-lg bg-amber-400/20 border border-amber-400/40 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/30"
              >
                Go to Bid Wallet
              </button>
            </div>
          )}

          <div className="grid gap-3">
            {oppFilter &&
              oppFilter.openLeadCount > 0 &&
              oppFilter.visibleCount < oppFilter.openLeadCount && (
                <p className="text-xs text-on-surface-variant">
                  Showing{' '}
                  <span className="text-on-surface font-semibold">{oppFilter.visibleCount}</span> of{' '}
                  <span className="text-on-surface font-semibold">{oppFilter.openLeadCount}</span> open
                  opportunities
                  {oppFilter.hiddenByAccountStatus
                    ? ' (account restricted)'
                    : oppFilter.hiddenByVerification
                      ? ' (verification required)'
                      : oppFilter.hiddenByCoverage
                        ? ' (coverage filter)'
                        : ''}
                  .
                </p>
              )}
            {opportunities.map((o) => (
              <article
                key={o.id}
                className="rounded-xl border border-glass-stroke bg-surface-container p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs text-on-surface-variant font-mono">{o.leadCode}</div>
                      {o.earlyAccessExclusive || o.earlyAccess ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-300">
                          Early access
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-base font-semibold text-on-surface">{o.locationLabel}</h3>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {o.propertyType} · Bill {o.electricityBillRange || '—'} · Timeline{' '}
                      {o.installationTimeline || '—'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <BiddingCountdown closesAt={o.biddingClosesAt} />
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">{o.leadScore ?? o.opportunityScore}</div>
                      <div className="text-[10px] uppercase tracking-wide text-on-surface-variant">
                        Lead score{o.leadScoreTier ? ` · ${o.leadScoreTier}` : ''}
                      </div>
                      {o.solarPotentialScore != null && o.solarPotentialScore > 0 && (
                        <div className="text-[10px] text-on-surface-variant mt-0.5">
                          Solar {o.solarPotentialScore}/100
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-on-surface-variant">
                  <Meta label="Roof est." value={o.estimatedRoofSqft ? `${o.estimatedRoofSqft} sqft` : '—'} />
                  <Meta label="Solar est." value={o.estimatedSolarKw ? `${o.estimatedSolarKw} kW` : '—'} />
                  <Meta label="Potential" value={o.solarPotentialLabel || '—'} />
                  <Meta label="Created" value={formatWhen(o.createdAt)} />
                  <Meta label="Min bid" value={formatMoney(o.minBid)} />
                  <Meta label="Closes" value={formatWhen(o.biddingClosesAt)} />
                  <Meta
                    label="Your bid"
                    value={o.ownBid ? formatMoney(o.ownBid.amount) : '—'}
                  />
                  <Meta
                    label="Strength"
                    value={
                      o.bidStrength ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[10px] ${strengthClass(o.bidStrength)}`}
                        >
                          {o.bidStrength}
                        </span>
                      ) : (
                        '—'
                      )
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="number"
                    min={o.minBid}
                    step="1"
                    placeholder={`Min ${o.minBid}`}
                    className={`${inputCls} max-w-[140px] disabled:opacity-50`}
                    value={bidDrafts[o.id] ?? ''}
                    disabled={!wallet.canBid || biddingLeadId === o.id}
                    onChange={(e) =>
                      setBidDrafts((d) => ({ ...d, [o.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => placeBid(o.id)}
                    disabled={!wallet.canBid || biddingLeadId != null}
                    className="rounded-lg bg-primary text-on-primary text-xs font-bold px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:brightness-110"
                  >
                    {biddingLeadId === o.id
                      ? 'Placing…'
                      : wallet.canBid
                        ? 'Place bid'
                        : `Need ${formatMoney(wallet.minBalanceToBid || 25)} wallet`}
                  </button>
                  {!wallet.canBid && (
                    <button
                      type="button"
                      onClick={() => setTab('wallet')}
                      className="text-[11px] text-amber-200/90 underline-offset-2 hover:underline"
                    >
                      View wallet / pay window
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!loading && !opportunities.length && (
              <div className="rounded-xl border border-dashed border-glass-stroke p-5 text-sm text-on-surface-variant space-y-2">
                {accountBlocked && (oppFilter?.openLeadCount > 0 || oppFilter?.hiddenByAccountStatus > 0) ? (
                  <>
                    <p>
                      Your installer account is{' '}
                      <span className="text-red-300 font-semibold">{verificationStatus}</span>, so
                      marketplace opportunities are hidden.
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Contact an admin or support to restore access.
                    </p>
                  </>
                ) : oppFilter?.hiddenByVerification > 0 || needsVerification ? (
                  <>
                    <p>
                      There {oppFilter?.openLeadCount === 1 ? 'is' : 'are'}{' '}
                      <span className="text-on-surface font-semibold">
                        {oppFilter?.openLeadCount || 0}
                      </span>{' '}
                      open lead{(oppFilter?.openLeadCount || 0) === 1 ? '' : 's'}, but your account
                      still needs verification (
                      <span className="text-amber-300">{verificationStatus || 'pending'}</span>).
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Ask an admin to verify your installer account under Admin → Marketplace →
                      Installers.
                    </p>
                  </>
                ) : oppFilter?.hiddenByNoServiceArea > 0 ? (
                  <>
                    <p>Add your service area above to see open homeowner inquiries.</p>
                  </>
                ) : oppFilter?.hiddenByCoverage > 0 ? (
                  <>
                    <p>
                      There {oppFilter.openLeadCount === 1 ? 'is' : 'are'}{' '}
                      <span className="text-on-surface font-semibold">{oppFilter.openLeadCount}</span>{' '}
                      open lead{oppFilter.openLeadCount === 1 ? '' : 's'}, but none match your
                      coverage filter ({oppFilter.serviceAreaCount} area
                      {oppFilter.serviceAreaCount === 1 ? '' : 's'}).
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Delete mismatched ZIP/state rows above, or add the lead&apos;s ZIP/state, to
                      see them.
                    </p>
                  </>
                ) : (
                  <>
                    <p>No open homeowner inquiries yet.</p>
                    <p className="text-xs text-on-surface-variant">
                      New opportunities appear here after admin approves homeowner submissions.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
            </>
          )}
        </div>
      )}

      {tab === 'bids' && (
        <div className="grid gap-2">
          {bids.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-glass-stroke bg-surface-container p-4 flex flex-wrap justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="font-mono text-xs text-on-surface-variant">{b.leadCode}</div>
                <div className="font-semibold text-on-surface">{b.locationLabel || b.zip}</div>
                <div className="text-xs text-on-surface-variant">
                  Lead: {b.leadStatus} · Bid: {b.status}
                  {isBiddingOpen(b.leadStatus) && b.biddingClosesAt && (
                    <span className="text-on-surface-variant"> · closes {formatWhen(b.biddingClosesAt)}</span>
                  )}
                </div>
              </div>
              <div className="text-right space-y-1.5">
                {isBiddingOpen(b.leadStatus) && (
                  <BiddingCountdown closesAt={b.biddingClosesAt} compact />
                )}
                <div className="font-bold text-on-surface">{formatMoney(b.amount)}</div>
                <span
                  className={`inline-block px-2 py-0.5 rounded border text-[10px] ${strengthClass(b.strength)}`}
                >
                  {b.strength || '—'}
                </span>
              </div>
            </div>
          ))}
          {!loading && !bids.length && (
            <p className="text-sm text-on-surface-variant">You have not placed any bids yet.</p>
          )}
        </div>
      )}

      {['won', 'active', 'closed'].includes(tab) && (
        <LeadList
          leads={tab === 'won' ? won : tab === 'active' ? active : closed}
          loading={loading}
          onSelect={setSelectedLead}
          showActions={tab !== 'closed'}
          emptyHint={
            tab === 'won'
              ? 'Leads you win will appear here with full contact details.'
              : tab === 'active'
                ? 'Won leads you are still working appear here.'
                : 'Completed or closed marketplace leads appear here (view only).'
          }
        />
      )}

      {tab === 'wallet' && (
        <div className="space-y-4">
                    <div className="rounded-xl border border-primary/30 bg-primary/10 p-5">
            <div className="text-xs uppercase tracking-wide text-on-surface-variant">Bid wallet balance</div>
            <div className="text-3xl font-bold text-primary mt-1">{formatMoney(wallet.balance)}</div>
            <p className="text-xs text-on-surface-variant mt-2">
              Bid wallet (USD) — not used for map lead unlocks. Minimum{' '}
              {formatMoney(wallet.minBalanceToBid || 25)} balance required to bid on opportunities.
            </p>
          </div>

          <div className="rounded-xl border border-glass-stroke bg-surface-container p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-on-surface">Top up bid wallet</h2>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Add at least {formatMoney(wallet.minBalanceToBid || 25)} before placing bids.
                Winning bids debit this balance. Map lead unlocks use separate lead credits.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(wallet.packs || MARKETPLACE_WALLET_PACKS).map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  disabled={walletPaying}
                  onClick={() => startWalletCheckout({ packId: pack.id })}
                  className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
                >
                  {pack.label}
                </button>
              ))}
            </div>
            <form
              className="flex flex-wrap gap-2 items-end"
              onSubmit={(e) => {
                e.preventDefault();
                startWalletCheckout({ amount: walletAmount });
              }}
            >
              <label className="text-xs text-on-surface-variant flex-1 min-w-[140px]">
                Custom amount (USD)
                <input
                  className={inputCls}
                  type="number"
                  min={25}
                  max={5000}
                  step={1}
                  placeholder="25–5000"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  disabled={walletPaying}
                />
              </label>
              <button
                type="submit"
                disabled={walletPaying}
                className="rounded-lg bg-primary text-on-primary text-xs font-bold px-4 py-2 disabled:opacity-50 cursor-pointer hover:brightness-110"
              >
                {walletPaying ? 'Processing…' : 'Top up wallet'}
              </button>
            </form>
            {isDevBuild && (
              <p className="text-[10px] text-on-surface-variant">
                Dev mode may credit instantly without Stripe when payment keys are missing.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
            <h2 className="text-sm font-semibold text-amber-200">When you win a bid</h2>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Your winning bid amount is debited from this wallet. If the balance is too low at win
              time, complete payment within <strong className="text-on-surface">10 minutes</strong> — a
              payment due timer is set on the won lead.
            </p>
          </div>
          <div className="rounded-xl border border-glass-stroke overflow-hidden">
            <div className="px-3 py-2 border-b border-glass-stroke flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-on-surface-variant">Recent wallet activity</p>
              <a
                href="/billing"
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                View invoices & PDFs on Billing →
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-surface-container text-left text-xs text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Balance</th>
                    <th className="px-3 py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {wallet.ledger.map((row) => (
                    <tr key={row.id} className="border-t border-glass-stroke">
                      <td className="px-3 py-2 text-xs text-on-surface-variant whitespace-nowrap">
                        {formatWhen(row.created_at)}
                      </td>
                      <td className="px-3 py-2">{formatLedgerEntryType(row.entry_type)}</td>
                      <td
                        className={`px-3 py-2 ${
                          Number(row.amount) < 0 ? 'text-red-400' : 'text-emerald-500'
                        }`}
                      >
                        {formatMoney(row.amount)}
                      </td>
                      <td className="px-3 py-2">{formatMoney(row.balance_after)}</td>
                      <td className="px-3 py-2 text-xs text-on-surface-variant">{row.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!wallet.ledger.length && (
              <p className="p-4 text-sm text-on-surface-variant">No wallet activity yet.</p>
            )}
          </div>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-glass-stroke bg-surface-elevated p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-mono text-xs text-on-surface-variant">{selectedLead.leadCode}</div>
                <h3 className="text-lg font-semibold text-on-surface">{selectedLead.homeownerName}</h3>
              </div>
              <button type="button" className="text-on-surface-variant" onClick={() => setSelectedLead(null)}>
                ✕
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <Meta label="Phone" value={selectedLead.phone} />
              <Meta label="Email" value={selectedLead.email} />
              <Meta label="Address" value={selectedLead.address} />
              <Meta label="Status" value={selectedLead.status} />
              <Meta label="Bill" value={selectedLead.monthlyBill ?? selectedLead.billRange} />
              <Meta label="Timeline" value={selectedLead.installationTimeline} />
            </dl>
            {selectedLead.paymentDueAt && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                  new Date(selectedLead.paymentDueAt).getTime() < Date.now()
                    ? 'border-red-400/40 bg-red-500/10 text-red-200'
                    : 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                }`}
              >
                Payment due: {formatWhen(selectedLead.paymentDueAt)}
              </div>
            )}
            {selectedLead.projectDetails && (
              <p className="text-xs text-on-surface-variant border border-glass-stroke rounded-lg p-3">
                {selectedLead.projectDetails}
              </p>
            )}
            {selectedLead.showActions !== false && (
              <>
                <div>
                  <div className="text-xs text-on-surface-variant mb-2">Update outcome</div>
                  <div className="flex flex-wrap gap-2">
                    {OUTCOME_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateOutcome(selectedLead.id, s)}
                        className="rounded-lg border border-glass-stroke px-2.5 py-1 text-xs hover:bg-surface-container-high"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-glass-stroke pt-3 space-y-2">
                  <div className="text-xs font-semibold text-amber-200">Report invalid lead</div>
                  <select
                    className={inputCls}
                    value={disputeForm.claimType}
                    onChange={(e) =>
                      setDisputeForm((f) => ({ ...f, claimType: e.target.value }))
                    }
                  >
                    {DISPUTE_TYPES.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    className={`${inputCls} min-h-[70px]`}
                    placeholder="Details…"
                    value={disputeForm.details}
                    onChange={(e) =>
                      setDisputeForm((f) => ({ ...f, details: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => fileDispute(selectedLead.id)}
                    className="rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-semibold px-3 py-2"
                  >
                    Submit claim
                  </button>
                </div>
              </>
            )}
            {selectedLead.showActions === false && (
              <p className="text-xs text-on-surface-variant border border-glass-stroke rounded-lg p-3">
                This lead is closed. Contact and outcome updates are available from Active / Won tabs
                while the lead is still in progress.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadList({ leads, loading, onSelect, showActions, emptyHint }) {
  return (
    <div className="grid gap-2">
      {leads.map((lead) => (
        <button
          key={lead.id}
          type="button"
          onClick={() => onSelect({ ...lead, showActions: Boolean(showActions) })}
          className="text-left rounded-xl border border-glass-stroke bg-surface-container p-4 hover:border-primary/40 transition"
        >
          <div className="flex justify-between gap-2">
            <div>
              <div className="font-mono text-xs text-on-surface-variant">{lead.leadCode}</div>
              <div className="font-semibold text-on-surface">{lead.homeownerName || 'Unlocked lead'}</div>
              <div className="text-xs text-on-surface-variant mt-1">{lead.address}</div>
              {isBiddingOpen(lead.status) && lead.biddingClosesAt && (
                <div className="mt-2">
                  <BiddingCountdown closesAt={lead.biddingClosesAt} compact />
                </div>
              )}
              {lead.paymentDueAt && (
                <div
                  className={`mt-2 inline-flex items-center gap-1 text-[10px] font-semibold rounded px-1.5 py-0.5 ${
                    new Date(lead.paymentDueAt).getTime() < Date.now()
                      ? 'text-red-300 bg-red-500/10'
                      : 'text-amber-200 bg-amber-500/10'
                  }`}
                >
                  Payment due {formatWhen(lead.paymentDueAt)}
                </div>
              )}
            </div>
            <div className="text-xs text-primary font-semibold">{lead.status}</div>
          </div>
          {showActions ? (
            <div className="text-[11px] text-on-surface-variant mt-2">Click to view contact & update status</div>
          ) : (
            <div className="text-[11px] text-on-surface-variant mt-2">Click to view details (read only)</div>
          )}
        </button>
      ))}
      {!loading && !leads.length && (
        <div className="rounded-xl border border-dashed border-glass-stroke p-5 text-sm text-on-surface-variant space-y-1">
          <p>No leads in this tab.</p>
          {emptyHint && <p className="text-xs text-on-surface-variant">{emptyHint}</p>}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-on-surface-variant">{label}</div>
      <div className="text-on-surface break-words">{value ?? '—'}</div>
    </div>
  );
}

const inputCls =
  'mt-1 block w-full rounded-lg border border-glass-stroke bg-surface-container-low px-2.5 py-2 text-sm text-on-surface outline-none focus:border-primary/40 placeholder:text-on-surface-variant';
