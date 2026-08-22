import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../config.js';
import { openRazorpayOrderCheckout } from '../lib/razorpayCheckout.js';

export default function LeadPackages() {
  const [packages, setPackages] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutError, setCheckoutError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetch(`${API_BASE}/api/billing/packages`)
      .then((r) => r.json())
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setPackages(list);
        const planParam = searchParams.get('plan');
        if (planParam && list.some((p) => p.id === planParam)) {
          setSelectedPlan(planParam);
        } else if (list[0]) {
          setSelectedPlan(list[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [searchParams]);

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

  const handlePurchase = async (pkgId) => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      navigate('/login');
      return;
    }
    setPurchasing(true);
    setSelectedPlan(pkgId);
    setCheckoutError('');
    try {
      const res = await fetch(`${API_BASE}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageId: pkgId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.mode === 'razorpay' && data.orderId && data.keyId) {
        try {
          const result = await openRazorpayOrderCheckout({
            keyId: data.keyId,
            orderId: data.orderId,
            amount: data.amount,
            currency: data.currency || 'USD',
            name: 'SolarX.live',
            description: data.description || `${data.packName || 'Monthly plan'} (USD)`,
            prefill: data.prefill || {},
            onSuccess: async (response) => {
              const confirmRes = await fetch(`${API_BASE}/api/billing/confirm-razorpay-plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              const confirmData = await confirmRes.json().catch(() => ({}));
              if (!confirmRes.ok) throw new Error(confirmData.error || 'Could not confirm plan payment');
              navigate('/billing?success=1');
            },
            onFailure: ({ message }) => setCheckoutError(message),
          });
          if (result?.dismissed) {
            setCheckoutError('Checkout canceled — no changes were made.');
          }
        } catch (err) {
          setCheckoutError(err.message || 'Payment failed');
        } finally {
          setPurchasing(false);
        }
        return;
      }
      if (data.mode === 'stripe' && data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.mode === 'dev') {
        navigate('/billing?success=1');
        return;
      }
      navigate('/billing?success=1');
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <>
      <div className="relative w-full text-center py-10 md:py-16">
        <h2 className="font-headline-xl text-3xl md:text-headline-xl font-bold premium-gradient-text">
          Monthly Plans
        </h2>
        <p className="mt-4 text-on-surface-variant max-w-2xl mx-auto text-sm md:text-base">
          1 lead unlock = 1 credit. Plans renew every month — pay via Razorpay (USD cards). Credits refresh each billing cycle.
        </p>
      </div>

      {checkoutError && (
        <div className="max-w-2xl mx-auto mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {checkoutError}
        </div>
      )}

      {loading ? (
        <div className="text-center text-on-surface-variant py-12">Loading plans…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter mb-20">
          {packages.map((pkg, idx) => {
            const features = parseFeatures(pkg.features);
            const isMonthly = Number(pkg.is_subscription) === 1 || pkg.billing_interval === 'month';
            return (
              <div
                key={pkg.id}
                onClick={() => setSelectedPlan(pkg.id)}
                className={`glass-card rounded-xl p-6 md:p-8 flex flex-col h-full cursor-pointer relative overflow-hidden transition-all ${
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
                  <h3 className="font-headline-md text-xl md:text-2xl font-bold text-on-surface">{pkg.name}</h3>
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
            <p className="col-span-full text-center text-on-surface-variant">
              No active plans. Ask an admin to create a monthly plan.
            </p>
          )}
        </div>
      )}
    </>
  );
}
