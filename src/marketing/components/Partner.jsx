import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "motion/react";
import { ArrowUpRight, Layers, Radar, ShieldCheck, Users } from "lucide-react";
const PILLARS = [
  {
    icon: Radar,
    title: "Territory Intelligence",
    body: "Claim exclusive zones and watch every qualified rooftop inside them update in real time."
  },
  {
    icon: Layers,
    title: "Pipeline Integration",
    body: "Push scored properties straight into your CRM with full imagery, metrics and contact records."
  },
  {
    icon: Users,
    title: "Rep Enablement",
    body: "Every appointment arrives with a rooftop proposal your closers can present on the doorstep."
  },
  {
    icon: ShieldCheck,
    title: "Verified & Compliant",
    body: "Consent-checked contact data, suppression lists and audit trails baked into every export."
  }
];
function Partner() {
  return /* @__PURE__ */ jsxs("section", { id: "partner", className: "relative overflow-hidden py-32", children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "pointer-events-none absolute top-0 right-0 size-[60vmax] rounded-full opacity-25 blur-3xl",
        style: {
          background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 45%, transparent), transparent 65%)"
        }
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "relative mx-auto grid max-w-7xl gap-16 px-6 lg:grid-cols-2 lg:items-start", children: [
      /* @__PURE__ */ jsxs(
        motion.div,
        {
          initial: { opacity: 0, y: 30 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-15%" },
          transition: { duration: 0.8 },
          className: "lg:sticky lg:top-32",
          children: [
            /* @__PURE__ */ jsx("p", { className: "font-mono text-[11px] tracking-[0.3em] text-primary-glow uppercase", children: "Partner program" }),
            /* @__PURE__ */ jsx("h2", { className: "mt-4 text-4xl font-semibold text-balance sm:text-5xl lg:text-6xl", children: /* @__PURE__ */ jsx("span", { className: "text-gradient", children: "Grow Your Solar Business Smarter" }) }),
            /* @__PURE__ */ jsx("p", { className: "mt-6 max-w-lg text-base leading-relaxed text-muted-foreground", children: "SolarX.live replaces guesswork with orbital certainty. We continuously scan residential markets, score every rooftop for installable potential, and hand your team a ranked list of homeowners who are physically and financially ready for solar. No cold lists, no wasted truck rolls \u2014 just verified opportunity, delivered daily." }),
            /* @__PURE__ */ jsxs("div", { className: "mt-10 flex flex-wrap gap-4", children: [
              /* @__PURE__ */ jsxs(
                "a",
                {
                  href: "#contact",
                  className: "glow-ring inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]",
                  style: { background: "var(--gradient-primary)" },
                  children: [
                    "Become a Partner ",
                    /* @__PURE__ */ jsx(ArrowUpRight, { className: "size-4" })
                  ]
                }
              ),
              /* @__PURE__ */ jsx(
                "a",
                {
                  href: "#contact",
                  className: "inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass px-7 py-3.5 text-sm font-semibold backdrop-blur-xl transition-colors hover:bg-glass-border",
                  children: "Book Demo"
                }
              )
            ] })
          ]
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "grid gap-5 sm:grid-cols-2", children: PILLARS.map((p, i) => /* @__PURE__ */ jsxs(
        motion.div,
        {
          initial: { opacity: 0, y: 40 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-10%" },
          transition: { duration: 0.7, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] },
          className: "group glass-panel rounded-2xl p-7 transition-all duration-500 hover:-translate-y-1.5 hover:border-primary/40",
          children: [
            /* @__PURE__ */ jsx("span", { className: "flex size-11 items-center justify-center rounded-xl border border-glass-border bg-glass transition-transform duration-500 group-hover:scale-110", children: /* @__PURE__ */ jsx(p.icon, { className: "size-5 text-primary-glow" }) }),
            /* @__PURE__ */ jsx("h3", { className: "mt-6 font-display text-base font-semibold", children: p.title }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-relaxed text-muted-foreground", children: p.body })
          ]
        },
        p.title
      )) })
    ] })
  ] });
}
export {
  Partner
};
