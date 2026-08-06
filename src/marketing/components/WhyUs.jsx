import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "motion/react";
import {
  Satellite,
  ScanLine,
  Database,
  Sparkles,
  Gauge,
  Rocket,
  TrendingUp
} from "lucide-react";
const CARDS = [
  {
    icon: Satellite,
    title: "Satellite Intelligence",
    body: "Sub-meter orbital imagery refreshed continuously across every residential market in the country."
  },
  {
    icon: ScanLine,
    title: "AI Roof Analysis",
    body: "Pitch, azimuth, usable area, shading and obstructions extracted automatically from every roof plane."
  },
  {
    icon: Database,
    title: "Qualified Property Data",
    body: "Ownership, tenure, utility rate zone and permit history fused into a single verified property record."
  },
  {
    icon: Sparkles,
    title: "High Quality Leads",
    body: "Only homeowners who clear physical, financial and intent thresholds ever reach your reps."
  },
  {
    icon: Gauge,
    title: "Solar Opportunity Score",
    body: "One 0\u2013100 number that ranks every address by installable value, so your pipeline sorts itself."
  },
  {
    icon: Rocket,
    title: "Fast Prospecting",
    body: "Draw a territory and get a ranked, contact-ready target list in under sixty seconds."
  },
  {
    icon: TrendingUp,
    title: "Recurring Growth",
    body: "Continuous market monitoring surfaces new opportunities the moment a property becomes viable."
  }
];
function WhyUs() {
  return /* @__PURE__ */ jsxs("section", { className: "relative overflow-hidden py-20 sm:py-32", children: [
    /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-0 grid-fade opacity-30" }),
    /* @__PURE__ */ jsxs("div", { className: "relative mx-auto max-w-7xl px-5 sm:px-6", children: [
      /* @__PURE__ */ jsxs(
        motion.div,
        {
          initial: { opacity: 0, y: 30 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-15%" },
          transition: { duration: 0.8 },
          className: "max-w-2xl",
          children: [
            /* @__PURE__ */ jsx("p", { className: "font-mono text-[11px] tracking-[0.3em] text-primary-glow uppercase", children: "Why choose us" }),
            /* @__PURE__ */ jsx("h2", { className: "mt-4 text-[2rem] font-semibold text-balance sm:text-5xl", children: /* @__PURE__ */ jsx("span", { className: "text-gradient", children: "Built for teams that sell at satellite speed." }) })
          ]
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3", children: CARDS.map((c, i) => /* @__PURE__ */ jsxs(
        motion.article,
        {
          initial: { opacity: 0, y: 40 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-10%" },
          transition: { duration: 0.7, delay: i % 3 * 0.08, ease: [0.16, 1, 0.3, 1] },
          className: `group glass-panel relative overflow-hidden rounded-2xl p-7 transition-transform duration-500 hover:-translate-y-1.5 ${i === 0 ? "lg:col-span-2" : ""}`,
          children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                className: "pointer-events-none absolute -top-24 -right-24 size-56 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100",
                style: {
                  background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 55%, transparent), transparent 70%)"
                }
              }
            ),
            /* @__PURE__ */ jsx("span", { className: "relative flex size-11 items-center justify-center rounded-xl border border-glass-border bg-glass", children: /* @__PURE__ */ jsx(c.icon, { className: "size-5 text-primary-glow" }) }),
            /* @__PURE__ */ jsx("h3", { className: "relative mt-6 font-display text-lg font-semibold", children: c.title }),
            /* @__PURE__ */ jsx("p", { className: "relative mt-3 text-sm leading-relaxed text-muted-foreground", children: c.body })
          ]
        },
        c.title
      )) })
    ] })
  ] });
}
export {
  WhyUs
};
