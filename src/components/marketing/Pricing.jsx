import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, X, Shield, Zap, RefreshCw, CreditCard, ArrowRight, Play } from 'lucide-react';
import { API_BASE } from '../../config.js';

const TRUST_BADGES = [
  { icon: Shield, text: 'Secure checkout' },
  { icon: Zap, text: 'Instant lead unlocks' },
  { icon: RefreshCw, text: 'Cancel anytime' },
  { icon: CreditCard, text: 'Card or invoice' }
];

const FALLBACK_PLANS = [
  {
    id: 'Growth',
    badge: 'Starter',
    name: 'Growth',
    price: '$299',
    period: '',
    description: 'Qualified solar lead credits for growing teams.',
    features: [
      { text: 'Lead unlocks', included: true },
      { text: 'AI roof analysis', included: true },
      { text: 'CSV export', included: true }
    ],
    featured: false
  }
];

function parseFeatures(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((t) => ({ text: String(t), included: true }));
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((t) => ({ text: String(t), included: true }));
  } catch (_) {
    /* ignore */
  }
  return [];
}

function mapPackage(pkg, index, total) {
  const features = parseFeatures(pkg.features);
  if (pkg.lead_limit != null) {
    features.unshift({ text: `${pkg.lead_limit} lead credits`, included: true });
  }
  const priceNum = Number(pkg.price);
  return {
    id: pkg.id,
    badge: index === 1 || (total === 1 && index === 0) ? 'MOST POPULAR' : pkg.description?.slice(0, 24) || 'Plan',
    name: pkg.name || pkg.id,
    price: Number.isFinite(priceNum) ? `$${priceNum.toLocaleString('en-US')}` : String(pkg.price || ''),
    period: Number(pkg.is_subscription) ? '/month' : '',
    description: pkg.description || 'Solar lead package',
    features: features.length
      ? features
      : [
          { text: 'Property + solar enrichment', included: true },
          { text: 'Owner contact when available', included: true }
        ],
    featured: index === Math.min(1, Math.max(0, total - 1)),
    cta: 'Start with 5 free credits'
  };
}

function PricingCard({ plan, index, loggedIn }) {
  const to = loggedIn ? '/billing#plans' : `/register?plan=${encodeURIComponent(plan.id)}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: 0.7, delay: index * 0.08 }}
      className={`relative flex flex-col rounded-3xl border p-6 sm:p-8 ${
        plan.featured
          ? 'border-primary/50 bg-card/80 shadow-[0_0_60px_-20px_color-mix(in_oklab,var(--primary)_50%,transparent)] lg:scale-[1.04]'
          : 'border-glass-border bg-card/40'
      }`}
    >
      {plan.featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-primary/40 bg-primary/20 px-3 py-1 text-[10px] font-semibold tracking-wider text-primary-glow uppercase">
          {plan.badge}
        </span>
      )}
      {!plan.featured && (
        <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{plan.badge}</p>
      )}
      <h3 className="mt-3 font-display text-2xl font-semibold">{plan.name}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
      <div className="mt-6 flex items-baseline gap-1">
        <span className="font-display text-4xl font-semibold text-primary-glow">{plan.price}</span>
        {plan.period ? <span className="text-sm text-muted-foreground">{plan.period}</span> : null}
      </div>
      <ul className="mt-8 flex-1 space-y-3 text-sm">
        {plan.features.map((f) => (
          <li key={f.text} className="flex items-start gap-2.5">
            {f.included ? (
              <Check className="mt-0.5 size-4 shrink-0 text-primary-glow" />
            ) : (
              <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
            )}
            <span className={f.included ? 'text-foreground' : 'text-muted-foreground/60'}>{f.text}</span>
          </li>
        ))}
      </ul>
      <Link
        to={to}
        className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-transform hover:scale-[1.02] ${
          plan.featured
            ? 'glow-ring text-primary-foreground'
            : 'border border-glass-border bg-glass'
        }`}
        style={plan.featured ? { background: 'var(--gradient-primary)' } : undefined}
      >
        {plan.cta || 'Get started'}
        <ArrowRight className="size-4" />
      </Link>
    </motion.div>
  );
}

export function Pricing() {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [loading, setLoading] = useState(true);
  const loggedIn = useMemo(() => !!localStorage.getItem('solar_token'), []);
  const navigate = useNavigate();
  const trialTo = loggedIn ? '/map' : '/register';

  useEffect(() => {
    fetch(`${API_BASE}/api/billing/packages`)
      .then((r) => r.json())
      .then((rows) => {
        const list = Array.isArray(rows) ? rows.filter((p) => Number(p.is_active) !== 0) : [];
        if (list.length) {
          setPlans(list.map((p, i) => mapPackage(p, i, list.length)));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="pricing" className="relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-primary/30"
            style={{
              left: `${8 + ((i * 7) % 85)}%`,
              bottom: '-4%',
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              animation: `float-up ${10 + (i % 5)}s linear ${i * 0.6}s infinite`
            }}
          />
        ))}
      </div>
      <div className="relative mx-auto max-w-7xl px-5 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 0.8 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary-glow uppercase">Pricing</p>
          <h2 className="mt-4 text-[2rem] font-semibold text-balance sm:text-5xl lg:text-6xl">
            <span className="text-gradient">Simple Pricing. Smarter Growth.</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            {loading
              ? 'Loading live packages…'
              : 'Start free. Upgrade when you are ready to scale. Plans sync from your live billing catalog.'}
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:mt-16 lg:grid-cols-3 lg:items-center">
          {plans.map((plan, i) => (
            <PricingCard key={plan.id} plan={plan} index={i} loggedIn={loggedIn} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-14 grid max-w-md grid-cols-2 gap-4 sm:flex sm:max-w-none sm:flex-wrap sm:items-center sm:justify-center sm:gap-10"
        >
          {TRUST_BADGES.map((badge) => (
            <div
              key={badge.text}
              className="flex items-center gap-2.5 text-xs text-muted-foreground sm:text-sm"
            >
              <span className="flex size-8 items-center justify-center rounded-full border border-glass-border bg-glass">
                <badge.icon className="size-4 text-primary-glow" />
              </span>
              {badge.text}
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.8 }}
          className="relative mx-auto mt-20 max-w-5xl overflow-hidden rounded-[1.75rem] border border-glass-border bg-gradient-to-br from-card/80 to-card/30 p-7 text-center sm:mt-28 sm:rounded-[2.5rem] sm:p-16"
          style={{
            boxShadow: '0 40px 100px -40px oklch(0 0 0 / 80%), inset 0 1px 0 0 oklch(1 0 0 / 10%)'
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                'radial-gradient(100% 100% at 50% 0%, color-mix(in oklab, var(--primary) 20%, transparent), transparent 60%)'
            }}
          />
          <div className="relative">
            <h3 className="font-display text-2xl font-semibold text-balance sm:text-4xl lg:text-5xl">
              Ready to Find Your Next Solar Customer?
            </h3>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Join solar companies using AI to discover, qualify, and convert more homeowners.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to={trialTo}
                className="glow-ring inline-flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03] sm:w-auto"
                style={{ background: 'var(--gradient-primary)' }}
              >
                Get 5 Free Lead Credits <ArrowRight className="size-4" />
              </Link>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('contact');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-glass-border bg-glass px-8 py-4 text-sm font-semibold transition-colors hover:bg-glass-border sm:w-auto"
              >
                <Play className="size-4 text-primary-glow" /> Book a Live Demo
              </button>
            </div>
            {!loggedIn ? null : (
              <button
                type="button"
                onClick={() => navigate('/billing#plans')}
                className="mt-4 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                View plans in billing
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
