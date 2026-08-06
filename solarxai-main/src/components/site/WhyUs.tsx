import { motion } from "motion/react";
import {
  Satellite,
  ScanLine,
  Database,
  Sparkles,
  Gauge,
  Rocket,
  TrendingUp,
} from "lucide-react";

const CARDS = [
  {
    icon: Satellite,
    title: "Satellite Intelligence",
    body: "Sub-meter orbital imagery refreshed continuously across every residential market in the country.",
  },
  {
    icon: ScanLine,
    title: "AI Roof Analysis",
    body: "Pitch, azimuth, usable area, shading and obstructions extracted automatically from every roof plane.",
  },
  {
    icon: Database,
    title: "Qualified Property Data",
    body: "Ownership, tenure, utility rate zone and permit history fused into a single verified property record.",
  },
  {
    icon: Sparkles,
    title: "High Quality Leads",
    body: "Only homeowners who clear physical, financial and intent thresholds ever reach your reps.",
  },
  {
    icon: Gauge,
    title: "Solar Opportunity Score",
    body: "One 0–100 number that ranks every address by installable value, so your pipeline sorts itself.",
  },
  {
    icon: Rocket,
    title: "Fast Prospecting",
    body: "Draw a territory and get a ranked, contact-ready target list in under sixty seconds.",
  },
  {
    icon: TrendingUp,
    title: "Recurring Growth",
    body: "Continuous market monitoring surfaces new opportunities the moment a property becomes viable.",
  },
];

export function WhyUs() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-32">
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-30" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl"
        >
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary-glow uppercase">
            Why choose us
          </p>
          <h2 className="mt-4 text-[2rem] font-semibold text-balance sm:text-5xl">
            <span className="text-gradient">Built for teams that sell at satellite speed.</span>
          </h2>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {CARDS.map((c, i) => (
            <motion.article
              key={c.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.7, delay: (i % 3) * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={`group glass-panel relative overflow-hidden rounded-2xl p-7 transition-transform duration-500 hover:-translate-y-1.5 ${
                i === 0 ? "lg:col-span-2" : ""
              }`}
            >
              <div
                className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in oklab, var(--primary) 55%, transparent), transparent 70%)",
                }}
              />
              <span className="relative flex size-11 items-center justify-center rounded-xl border border-glass-border bg-glass">
                <c.icon className="size-5 text-primary-glow" />
              </span>
              <h3 className="relative mt-6 font-display text-lg font-semibold">{c.title}</h3>
              <p className="relative mt-3 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
