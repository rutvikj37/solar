import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import { API_BASE } from '../../config.js';
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

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function resetWalletCheckoutState(setWalletPaying, lockRef) {
  lockRef.current = false;
  setWalletPaying(false);
}

function describeRazorpayFailure(resp) {
  const desc = String(resp?.error?.description || resp?.error?.reason || '').trim();
  const code = String(resp?.error?.code || '').trim();
  const status = Number(resp?.error?.statusCode || resp?.statusCode || 0);
  const combined = `${desc} ${code} ${status}`.toLowerCase();
  const isDev = import.meta.env.DEV || import.meta.env.MODE !== 'production';

  if (
    status === 429 ||
    /429|rate limit|too many.*otp|otp.*too many|failed otp verification attempts|otp.*locked|try again after some time/i.test(
      combined,
    )
  ) {
    return {
      message: isDev
        ? 'Razorpay blocked OTP after too many wrong attempts. Wait 30–60 minutes, then retry in incognito. In test mode enter OTP exactly 123456.'
        : 'Payment OTP was locked after too many attempts. Wait 30–60 minutes, then try again.',
      isOtpLockout: true,
    };
  }
  if (/otp/i.test(combined)) {
    return {
      message:
        desc ||
        (isDev
          ? 'OTP verification failed. In Razorpay test mode, enter exactly 123456.'
          : 'OTP verification failed. Please try again.'),
      isOtpLockout: false,
    };
  }
  return {
    message: desc || 'Payment failed. Please try again.',
    isOtpLockout: false,
  };
}

export default function MarketplaceDashboard() {
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
    razorpayAvailable: false,
    paymentProvider: 'razorpay',
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
      razorpayAvailable:
        data.razorpayAvailable !== undefined ? Boolean(data.razorpayAvailable) : prev.razorpayAvailable,
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
    let checkoutModalOpen = false;
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
        if (
          data.code === 'payment_provider_auth' ||
          res.status === 502 ||
          res.status === 503 ||
          /razorpay authentication failed/i.test(data.error || '')
        ) {
          throw new Error(data.error || 'Razorpay authentication failed — check test keys');
        }
        throw new Error(data.error || 'Checkout failed');
      }

      if (data.mode === 'stripe' && data.url) {
        window.location.href = data.url;
        checkoutModalOpen = true;
        return;
      }

      if (data.mode === 'dev') {
        toast.success(`Dev wallet top-up — ${formatMoney(data.balance)}`);
        load('wallet');
        return;
      }

      if (data.mode === 'razorpay' && data.orderId && data.keyId) {
        const ok = await loadRazorpayScript();
        if (!ok || !window.Razorpay) throw new Error('Could not load Razorpay checkout');
        const currency = data.currency || 'USD';
        const rzp = new window.Razorpay({
          key: data.keyId,
          amount: data.amount,
          currency,
          name: 'SpaceToRoof Marketplace',
          description: `${data.pack?.credits || ''} bid wallet (USD)`,
          order_id: data.orderId,
          prefill: data.prefill || {},
          theme: { color: '#22c55e' },
          modal: {
            ondismiss: () => resetWalletCheckoutState(setWalletPaying, walletCheckoutLock),
          },
          handler: async (response) => {
            try {
              const confirmRes = await fetch(`${API_BASE}/api/marketplace/wallet/confirm-razorpay`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              const confirmData = await confirmRes.json();
              if (!confirmRes.ok) throw new Error(confirmData.error || 'Could not credit wallet');
              toast.success(`Bid wallet topped up — ${formatMoney(confirmData.balance ?? confirmData.walletBalance)}`);
              load('wallet');
            } catch (err) {
              toast.error(err.message);
            } finally {
              resetWalletCheckoutState(setWalletPaying, walletCheckoutLock);
            }
          },
        });
        rzp.on('payment.failed', (resp) => {
          const { message, isOtpLockout } = describeRazorpayFailure(resp);
          toast.error(message, { duration: isOtpLockout ? 14000 : 7000 });
          resetWalletCheckoutState(setWalletPaying, walletCheckoutLock);
        });
        rzp.open();
        checkoutModalOpen = true;
        return;
      }

      throw new Error(
        data.error ||
          'Razorpay checkout could not start. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env — credits are not added without payment.',
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      if (!checkoutModalOpen) {
        walletCheckoutLock.current = false;
        setWalletPaying(false);
      }
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <Toaster theme="dark" position="top-right" />
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Marketplace</h1>
        <p className="text-sm text-white/55 mt-1">
          Bid on masked solar opportunities. Contact details unlock only when you win.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {MARKETPLACE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === t.id
                ? 'bg-primary text-black'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-white/50">Loading…</p>}

      {tab === 'opportunities' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-white">Your service area</h2>
                <p className="text-[11px] text-white/45 mt-1">
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
                    <p className="text-[10px] text-white/45 max-w-[220px]">
                      {accountBlocked
                        ? 'Contact support or an admin to restore marketplace access.'
                        : 'Ask an admin to verify your installer account to see all opportunities.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={addArea} className="flex flex-wrap gap-2 items-end">
              <label className="text-xs text-white/60">
                ZIP
                <input
                  className={inputCls}
                  value={areaForm.zip}
                  onChange={(e) => setAreaForm((f) => ({ ...f, zip: e.target.value }))}
                  placeholder="85001"
                />
              </label>
              <label className="text-xs text-white/60">
                State
                <input
                  className={inputCls}
                  value={areaForm.state}
                  onChange={(e) => setAreaForm((f) => ({ ...f, state: e.target.value }))}
                  placeholder="AZ"
                />
              </label>
              <label className="text-xs text-white/60">
                Radius (mi)
                <input
                  className={inputCls}
                  value={areaForm.radiusMiles}
                  onChange={(e) => setAreaForm((f) => ({ ...f, radiusMiles: e.target.value }))}
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-primary/90 text-black text-xs font-semibold px-3 py-2"
              >
                Add area
              </button>
            </form>
            <ul className="flex flex-wrap gap-2">
              {areas.map((a) => (
                <li
                  key={a.id}
                  className="text-xs rounded-full border border-white/15 px-3 py-1 flex items-center gap-2"
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
            <div className="rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 p-6 text-sm text-white/70 space-y-2">
              <p className="font-semibold text-amber-100">Choose your service area first</p>
              <p className="text-xs text-white/50 leading-relaxed">
                Bidders only see homeowner inquiries that match their territory. Add a ZIP code
                (e.g. 85001) or state (e.g. AZ) with an optional radius, then relevant open leads
                will appear here.
              </p>
              {oppFilter?.openLeadCount > 0 && (
                <p className="text-[11px] text-white/40">
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
                <p className="text-xs text-white/50">
                  Showing{' '}
                  <span className="text-white/80 font-semibold">{oppFilter.visibleCount}</span> of{' '}
                  <span className="text-white/80 font-semibold">{oppFilter.openLeadCount}</span> open
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
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-white/45 font-mono">{o.leadCode}</div>
                    <h3 className="text-base font-semibold text-white">{o.locationLabel}</h3>
                    <p className="text-xs text-white/55 mt-1">
                      {o.propertyType} · Bill {o.electricityBillRange || '—'} · Timeline{' '}
                      {o.installationTimeline || '—'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <BiddingCountdown closesAt={o.biddingClosesAt} />
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">{o.leadScore ?? o.opportunityScore}</div>
                      <div className="text-[10px] uppercase tracking-wide text-white/40">
                        Lead score{o.leadScoreTier ? ` · ${o.leadScoreTier}` : ''}
                      </div>
                      {o.solarPotentialScore != null && o.solarPotentialScore > 0 && (
                        <div className="text-[10px] text-white/35 mt-0.5">
                          Solar {o.solarPotentialScore}/100
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-white/65">
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
                    className="rounded-lg bg-primary text-black text-xs font-bold px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/55 space-y-2">
                {accountBlocked && (oppFilter?.openLeadCount > 0 || oppFilter?.hiddenByAccountStatus > 0) ? (
                  <>
                    <p>
                      Your installer account is{' '}
                      <span className="text-red-300 font-semibold">{verificationStatus}</span>, so
                      marketplace opportunities are hidden.
                    </p>
                    <p className="text-xs text-white/40">
                      Contact an admin or support to restore access.
                    </p>
                  </>
                ) : oppFilter?.hiddenByVerification > 0 || needsVerification ? (
                  <>
                    <p>
                      There {oppFilter?.openLeadCount === 1 ? 'is' : 'are'}{' '}
                      <span className="text-white/80 font-semibold">
                        {oppFilter?.openLeadCount || 0}
                      </span>{' '}
                      open lead{(oppFilter?.openLeadCount || 0) === 1 ? '' : 's'}, but your account
                      still needs verification (
                      <span className="text-amber-300">{verificationStatus || 'pending'}</span>).
                    </p>
                    <p className="text-xs text-white/40">
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
                      <span className="text-white/80 font-semibold">{oppFilter.openLeadCount}</span>{' '}
                      open lead{oppFilter.openLeadCount === 1 ? '' : 's'}, but none match your
                      coverage filter ({oppFilter.serviceAreaCount} area
                      {oppFilter.serviceAreaCount === 1 ? '' : 's'}).
                    </p>
                    <p className="text-xs text-white/40">
                      Delete mismatched ZIP/state rows above, or add the lead&apos;s ZIP/state, to
                      see them.
                    </p>
                  </>
                ) : (
                  <>
                    <p>No open homeowner inquiries yet.</p>
                    <p className="text-xs text-white/40">
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
              className="rounded-xl border border-white/10 bg-white/[0.04] p-4 flex flex-wrap justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="font-mono text-xs text-white/45">{b.leadCode}</div>
                <div className="font-semibold">{b.locationLabel || b.zip}</div>
                <div className="text-xs text-white/55">
                  Lead: {b.leadStatus} · Bid: {b.status}
                  {isBiddingOpen(b.leadStatus) && b.biddingClosesAt && (
                    <span className="text-white/40"> · closes {formatWhen(b.biddingClosesAt)}</span>
                  )}
                </div>
              </div>
              <div className="text-right space-y-1.5">
                {isBiddingOpen(b.leadStatus) && (
                  <BiddingCountdown closesAt={b.biddingClosesAt} compact />
                )}
                <div className="font-bold">{formatMoney(b.amount)}</div>
                <span
                  className={`inline-block px-2 py-0.5 rounded border text-[10px] ${strengthClass(b.strength)}`}
                >
                  {b.strength || '—'}
                </span>
              </div>
            </div>
          ))}
          {!loading && !bids.length && (
            <p className="text-sm text-white/50">You have not placed any bids yet.</p>
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
            <div className="text-xs uppercase tracking-wide text-white/50">Bid wallet balance</div>
            <div className="text-3xl font-bold text-primary mt-1">{formatMoney(wallet.balance)}</div>
            <p className="text-xs text-white/50 mt-2">
              Bid wallet (USD) — not used for map lead unlocks. Minimum{' '}
              {formatMoney(wallet.minBalanceToBid || 25)} balance required to bid on opportunities.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Top up bid wallet</h2>
              <p className="text-xs text-white/55 mt-1 leading-relaxed">
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
              <label className="text-xs text-white/60 flex-1 min-w-[140px]">
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
                className="rounded-lg bg-primary text-black text-xs font-bold px-4 py-2 disabled:opacity-50"
              >
                {walletPaying ? 'Processing…' : 'Top up wallet'}
              </button>
            </form>
            {isDevBuild && (
              <p className="text-[10px] text-white/40">
                Dev mode may credit instantly without Razorpay when payment keys are missing.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
            <h2 className="text-sm font-semibold text-amber-200">When you win a bid</h2>
            <p className="text-xs text-white/70 leading-relaxed">
              Your winning bid amount is debited from this wallet. If the balance is too low at win
              time, complete payment within <strong className="text-white">10 minutes</strong> — a
              payment due timer is set on the won lead.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="px-3 py-2 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-white/50">Recent wallet activity</p>
              <a
                href="/billing"
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                View invoices & PDFs on Billing →
              </a>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs text-white/50">
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
                  <tr key={row.id} className="border-t border-white/5">
                    <td className="px-3 py-2 text-xs text-white/60">{formatWhen(row.created_at)}</td>
                    <td className="px-3 py-2">{formatLedgerEntryType(row.entry_type)}</td>
                    <td className={`px-3 py-2 ${Number(row.amount) < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                      {formatMoney(row.amount)}
                    </td>
                    <td className="px-3 py-2">{formatMoney(row.balance_after)}</td>
                    <td className="px-3 py-2 text-xs text-white/50">{row.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!wallet.ledger.length && (
              <p className="p-4 text-sm text-white/50">No wallet activity yet.</p>
            )}
          </div>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0d1520] p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-mono text-xs text-white/45">{selectedLead.leadCode}</div>
                <h3 className="text-lg font-semibold">{selectedLead.homeownerName}</h3>
              </div>
              <button type="button" className="text-white/50" onClick={() => setSelectedLead(null)}>
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
              <p className="text-xs text-white/60 border border-white/10 rounded-lg p-3">
                {selectedLead.projectDetails}
              </p>
            )}
            {selectedLead.showActions !== false && (
              <>
                <div>
                  <div className="text-xs text-white/50 mb-2">Update outcome</div>
                  <div className="flex flex-wrap gap-2">
                    {OUTCOME_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateOutcome(selectedLead.id, s)}
                        className="rounded-lg border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-white/10 pt-3 space-y-2">
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
              <p className="text-xs text-white/45 border border-white/10 rounded-lg p-3">
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
          className="text-left rounded-xl border border-white/10 bg-white/[0.04] p-4 hover:border-primary/40 transition"
        >
          <div className="flex justify-between gap-2">
            <div>
              <div className="font-mono text-xs text-white/45">{lead.leadCode}</div>
              <div className="font-semibold">{lead.homeownerName || 'Unlocked lead'}</div>
              <div className="text-xs text-white/55 mt-1">{lead.address}</div>
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
            <div className="text-[11px] text-white/40 mt-2">Click to view contact & update status</div>
          ) : (
            <div className="text-[11px] text-white/40 mt-2">Click to view details (read only)</div>
          )}
        </button>
      ))}
      {!loading && !leads.length && (
        <div className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/55 space-y-1">
          <p>No leads in this tab.</p>
          {emptyHint && <p className="text-xs text-white/40">{emptyHint}</p>}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-white/35">{label}</div>
      <div className="text-white/80 break-words">{value ?? '—'}</div>
    </div>
  );
}

const inputCls =
  'mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-white outline-none focus:border-primary/40';
