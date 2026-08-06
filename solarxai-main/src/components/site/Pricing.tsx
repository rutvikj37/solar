import { motion } from "motion/react";
import { useRef } from "react";
import {
  Check,
  X,
  Shield,
  Zap,
  RefreshCw,
  CreditCard,
  ArrowRight,
  Play,
} from "lucide-react";
import { toast } from "sonner";

const PLANS = [
  {
    id: "scout",
    badge: "For Small Teams",
    name: "Scout",
    price: "$299",
    period: "/month",
    description: "Everything you need to start finding qualified solar opportunities.",
    features: [
      { text: "20 Qualified Leads / Month", included: true },
      { text: "AI Roof Analysis", included: true },
      { text: "Solar Opportunity Score", included: true },
      { text: "Property Details", included: true },
      { text: "Basic Contact Information", included: true },
      { text: "Verified Emails", included: false },
      { text: "Verified Phone Numbers", included: false },
      { text: "AI Calling Agent", included: false },
    ],
    cta: "Claim 7-Day Free Trial",
    featured: false,
  },
  {
    id: "pioneer",
    badge: "MOST POPULAR",
    name: "Pioneer",
    price: "$449",
    period: "/month",
    description: "Built for growing solar companies ready to scale faster.",
    features: [
      { text: "50 Qualified Leads / Month", included: true },
      { text: "AI Roof Analysis", included: true },
      { text: "Solar Opportunity Score", included: true },
      { text: "Property Details", included: true },
      { text: "Verified Emails", included: true },
      { text: "Verified Phone Numbers", included: true },
      { text: "Lead Priority Score", included: true },
      { text: "CSV Export", included: true },
      { text: "AI Calling Agent", included: false },
    ],
    cta: "Claim 7-Day Free Trial",
    featured: true,
  },
  {
    id: "mission",
    badge: "Best Value",
    name: "Mission Control",
    price: "$649",
    period: "/month",
    description: "Complete AI sales automation for high-volume solar businesses.",
    features: [
      { text: "100 Qualified Leads / Month", included: true },
      { text: "AI Roof Analysis", included: true },
      { text: "Verified Emails", included: true },
      { text: "Verified Phone Numbers", included: true },
      { text: "AI Calling Agent", included: true },
      { text: "AI Appointment Booking", included: true },
      { text: "Advanced Analytics Dashboard", included: true },
      { text: "CRM Integration", included: true },
      { text: "Priority Support", included: true },
    ],
    cta: "Claim 7-Day Free Trial",
    featured: false,
  },
];

const TRUST_BADGES = [
  { icon: RefreshCw, text: "Cancel Anytime" },
  { icon: CreditCard, text: "No Setup Fees" },
  { icon: Zap, text: "Fresh Qualified Leads" },
  { icon: Shield, text: "Enterprise-Grade Security" },
];

function PricingCard({
  plan,
  index,
}: {
  plan: (typeof PLANS)[number];
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{
        duration: 0.8,
        delay: index * 0.12,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={`relative flex flex-col rounded-3xl p-7 transition-all duration-500 hover:-translate-y-2 sm:p-8 ${
        plan.featured
          ? "z-10 scale-[1.02] border-2 border-primary/40 bg-gradient-to-b from-card/90 to-card/60 shadow-2xl lg:scale-105"
          : "border border-glass-border bg-glass/60"
      }`}
      style={{
        boxShadow: plan.featured
          ? "0 32px 80px -28px color-mix(in oklab, var(--primary) 35%, transparent), inset 0 1px 0 0 oklch(1 0 0 / 10%)"
          : "inset 0 1px 0 0 oklch(1 0 0 / 8%)",
      }}
    >
      {plan.featured && (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-40">
            <div
              className="absolute inset-0 rounded-3xl"
              style={{
                background:
                  "radial-gradient(120% 120% at 50% 0%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 55%)",
              }}
            />
          </div>
          <div className="pointer-events-none absolute -inset-0.5 rounded-3xl opacity-60 blur-sm">
            <div
              className="absolute inset-0 rounded-3xl"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in oklab, var(--primary) 60%, transparent), color-mix(in oklab, var(--primary-glow) 40%, transparent), transparent 60%)",
              }}
            />
          </div>
        </>
      )}

      <div className="relative">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold tracking-wider uppercase ${
            plan.featured
              ? "animate-pulse bg-primary/20 text-primary-glow"
              : "bg-glass-border/40 text-muted-foreground"
          }`}
        >
          {plan.badge}
        </span>

        <h3 className="mt-5 font-display text-2xl font-semibold tracking-tight">
          {plan.name}
        </h3>

        <div className="mt-3 flex items-baseline gap-1">
          <span className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            {plan.price}
          </span>
          {plan.period && (
            <span className="text-sm text-muted-foreground">{plan.period}</span>
          )}
        </div>

        <p className="mt-4 min-h-[44px] text-sm leading-relaxed text-muted-foreground">
          {plan.description}
        </p>

        <ul className="mt-8 space-y-3.5">
          {plan.features.map((feature) => (
            <li key={feature.text} className="flex items-start gap-3 text-sm">
              {feature.included ? (
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Check className="size-3 text-primary-glow" />
                </span>
              ) : (
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted">
                  <X className="size-3 text-muted-foreground" />
                </span>
              )}
              <span
                className={
                  feature.included ? "text-foreground" : "text-muted-foreground/70 line-through"
                }
              >
                {feature.text}
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() =>
            toast.success("Trial request received", {
              description: `You selected the ${plan.name} plan. Our team will reach out shortly.`,
            })
          }
          className={`mt-8 w-full rounded-full py-3.5 text-sm font-semibold transition-all duration-300 hover:scale-[1.02] ${
            plan.featured
              ? "text-primary-foreground"
              : "border border-glass-border bg-glass text-foreground hover:bg-glass-border"
          }`}
          style={plan.featured ? { background: "var(--gradient-primary)" } : undefined}
        >
          {plan.cta}
        </button>
      </div>
    </motion.div>
  );
}

function FloatingParticle({ delay, x, size }: { delay: number; x: string; size: number }) {
  return (
    <motion.div
      initial={{ y: "120%", opacity: 0 }}
      animate={{ y: "-20%", opacity: [0, 0.6, 0] }}
      transition={{
        duration: 12 + Math.random() * 8,
        delay,
        repeat: Infinity,
        ease: "linear",
      }}
      className="pointer-events-none absolute rounded-full"
      style={{
        left: x,
        width: size,
        height: size,
        background:
          "radial-gradient(circle, color-mix(in oklab, var(--primary) 70%, transparent), transparent 70%)",
        filter: "blur(1px)",
      }}
    />
  );
}

export function Pricing() {
  const containerRef = useRef<HTMLElement>(null);

  return (
    <section
      id="pricing"
      ref={containerRef}
      className="relative overflow-hidden py-28 sm:py-36"
      style={{ background: "#050816" }}
    >
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-25" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(18)].map((_, i) => (
          <FloatingParticle
            key={i}
            delay={i * 0.7}
            x={`${5 + (i * 5) % 90}%`}
            size={2 + (i % 4)}
          />
        ))}
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.8 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary-glow uppercase">
            Pricing
          </p>
          <h2 className="mt-4 text-[2rem] font-semibold text-balance sm:text-5xl lg:text-6xl">
            <span className="text-gradient">Simple Pricing. Smarter Growth.</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Start free. Upgrade when you&apos;re ready to scale. Every plan includes AI-powered
            property intelligence and qualified solar opportunities.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:mt-16 lg:grid-cols-3 lg:items-center">
          {PLANS.map((plan, i) => (
            <PricingCard key={plan.id} plan={plan} index={i} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
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
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.8 }}
          className="relative mx-auto mt-20 max-w-5xl overflow-hidden rounded-[1.75rem] border border-glass-border bg-gradient-to-br from-card/80 to-card/30 p-7 text-center sm:mt-28 sm:rounded-[2.5rem] sm:p-16"
          style={{
            boxShadow:
              "0 40px 100px -40px oklch(0 0 0 / 80%), inset 0 1px 0 0 oklch(1 0 0 / 10%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(100% 100% at 50% 0%, color-mix(in oklab, var(--primary) 20%, transparent), transparent 60%)",
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
              <button
                type="button"
                onClick={() =>
                  toast.success("Trial request received", {
                    description: "Our team will reach out within one business day.",
                  })
                }
                className="glow-ring inline-flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03] sm:w-auto"
                style={{ background: "var(--gradient-primary)" }}
              >
                Claim Your 7-Day Free Trial <ArrowRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("contact");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-glass-border bg-glass px-8 py-4 text-sm font-semibold transition-colors hover:bg-glass-border sm:w-auto"
              >
                <Play className="size-4 text-primary-glow" /> Book a Live Demo
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
