import { motion } from "motion/react";
import { ArrowUpRight, Layers, Radar, ShieldCheck, Users } from "lucide-react";

const PILLARS = [
  {
    icon: Radar,
    title: "Territory Intelligence",
    body: "Claim exclusive zones and watch every qualified rooftop inside them update in real time.",
  },
  {
    icon: Layers,
    title: "Pipeline Integration",
    body: "Push scored properties straight into your CRM with full imagery, metrics and contact records.",
  },
  {
    icon: Users,
    title: "Rep Enablement",
    body: "Every appointment arrives with a rooftop proposal your closers can present on the doorstep.",
  },
  {
    icon: ShieldCheck,
    title: "Verified & Compliant",
    body: "Consent-checked contact data, suppression lists and audit trails baked into every export.",
  },
];

export function Partner() {
  return (
    <section id="partner" className="relative overflow-hidden py-32">
      <div
        className="pointer-events-none absolute top-0 right-0 size-[60vmax] rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--primary) 45%, transparent), transparent 65%)",
        }}
      />
      <div className="relative mx-auto grid max-w-7xl gap-16 px-6 lg:grid-cols-2 lg:items-start">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.8 }}
          className="lg:sticky lg:top-32"
        >
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary-glow uppercase">
            Partner program
          </p>
          <h2 className="mt-4 text-4xl font-semibold text-balance sm:text-5xl lg:text-6xl">
            <span className="text-gradient">Grow Your Solar Business Smarter</span>
          </h2>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground">
            Helios replaces guesswork with orbital certainty. We continuously scan residential
            markets, score every rooftop for installable potential, and hand your team a ranked
            list of homeowners who are physically and financially ready for solar. No cold lists,
            no wasted truck rolls — just verified opportunity, delivered daily.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#contact"
              className="glow-ring inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
              style={{ background: "var(--gradient-primary)" }}
            >
              Become a Partner <ArrowUpRight className="size-4" />
            </a>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass px-7 py-3.5 text-sm font-semibold backdrop-blur-xl transition-colors hover:bg-glass-border"
            >
              Book Demo
            </a>
          </div>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.7, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              className="group glass-panel rounded-2xl p-7 transition-all duration-500 hover:-translate-y-1.5 hover:border-primary/40"
            >
              <span className="flex size-11 items-center justify-center rounded-xl border border-glass-border bg-glass transition-transform duration-500 group-hover:scale-110">
                <p.icon className="size-5 text-primary-glow" />
              </span>
              <h3 className="mt-6 font-display text-base font-semibold">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
