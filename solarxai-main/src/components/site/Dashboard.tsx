import { animate, motion, useInView, useMotionValue, useMotionValueEvent } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { CheckCircle2, Gauge, MapPin, Sun, Zap } from "lucide-react";

export function Counter({
  to,
  duration = 1.6,
  prefix = "",
  suffix = "",
  decimals = 0,
  active,
}: {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  active: boolean;
}) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(0);
  useMotionValueEvent(mv, "change", (v) => setDisplay(v));
  useEffect(() => {
    if (active) {
      const controls = animate(mv, to, { duration, ease: [0.16, 1, 0.3, 1] });
      return () => controls.stop();
    }
  }, [active, to, duration, mv]);
  return (
    <span>
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

const sun = [
  { m: "Jan", v: 132 },
  { m: "Feb", v: 158 },
  { m: "Mar", v: 196 },
  { m: "Apr", v: 232 },
  { m: "May", v: 268 },
  { m: "Jun", v: 281 },
  { m: "Jul", v: 262 },
  { m: "Aug", v: 251 },
  { m: "Sep", v: 234 },
  { m: "Oct", v: 198 },
  { m: "Nov", v: 152 },
  { m: "Dec", v: 126 },
];

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`font-display text-sm font-semibold ${accent ? "text-primary-glow" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function Dashboard() {
  const ref = useRef<HTMLElement>(null);
  const active = useInView(ref, { once: true, margin: "-20%" });

  return (
    <section id="platform" ref={ref} className="relative overflow-hidden py-20 sm:py-32">
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-40" />
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 size-[70vmax] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--primary) 30%, transparent), transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl"
        >
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary-glow uppercase">
            Property intelligence report
          </p>
          <h2 className="mt-4 text-[2rem] font-semibold text-balance sm:text-5xl">
            <span className="text-gradient">Every rooftop quantified .</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, rotateX: 8 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel mt-10 rounded-3xl p-4 sm:mt-14 sm:p-8 lg:p-10"
        >
          <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6 sm:pb-8">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative flex size-20 shrink-0 items-center justify-center sm:size-24">
                <svg viewBox="0 0 100 100" className="absolute size-20 -rotate-90 sm:size-24">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="var(--border)" strokeWidth="6" />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="var(--primary-glow)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={active ? { pathLength: 0.98 } : {}}
                    transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </svg>
                <div className="text-center">
                  <div className="font-display text-2xl font-semibold">
                    <Counter to={98} active={active} />
                  </div>
                  <div className="text-[9px] tracking-widest text-muted-foreground">/100</div>
                </div>
              </div>
              <div>
                <div className="text-[11px] tracking-[0.25em] text-muted-foreground uppercase">
                  Solar Score
                </div>
                <div className="mt-1 font-display text-xl font-semibold">Exceptional</div>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs text-primary-glow">
                  <CheckCircle2 className="size-3.5" /> Lead Quality · High
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary-glow" />
              <div>
                <div className="font-display font-semibold">1458 Palm Ridge Drive</div>
                <div className="text-muted-foreground">Phoenix, Arizona</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 pt-6 sm:gap-6 sm:pt-8 lg:grid-cols-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
              {[
                { icon: Gauge, label: "Roof Area", node: <Counter to={2450} active={active} suffix=" sq ft" /> },
                { icon: Sun, label: "Sunlight", node: "Excellent" },
                {
                  icon: Zap,
                  label: "Estimated System Size",
                  node: <Counter to={14.8} decimals={1} active={active} suffix=" kW" />,
                },
                {
                  icon: CheckCircle2,
                  label: "Annual Savings",
                  node: <Counter to={2860} prefix="$" active={active} />,
                },
              ].map((c) => (
                <div
                  key={c.label}
                  className="rounded-2xl border border-glass-border bg-glass p-4 transition-colors hover:border-primary/40 sm:p-5"
                >
                  <c.icon className="size-4 text-primary-glow" />
                  <div className="mt-3 text-[10px] tracking-[0.2em] text-muted-foreground uppercase sm:mt-4">
                    {c.label}
                  </div>
                  <div className="mt-1.5 font-display text-xl font-semibold sm:text-2xl">{c.node}</div>
                </div>
              ))}

              <div className="rounded-2xl border border-glass-border bg-glass p-4 sm:col-span-2 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    Monthly irradiance · kWh/m²
                  </div>
                  <span className="text-xs text-primary-glow">Peak Jun</span>
                </div>
                <div className="mt-4 h-32 sm:h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sun}>
                      <defs>
                        <linearGradient id="sunFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1E90FF" stopOpacity={0.7} />
                          <stop offset="100%" stopColor="#1E90FF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="m"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                      />
                      <Tooltip
                        cursor={{ stroke: "#1E90FF", strokeOpacity: 0.3 }}
                        contentStyle={{
                          background: "rgba(5,8,22,0.92)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke="#63B3FF"
                        strokeWidth={2}
                        fill="url(#sunFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:gap-6">
              <div className="rounded-2xl border border-glass-border bg-glass p-4 sm:p-5">
                <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  Property
                </div>
                <div className="mt-2">
                  <Field label="Roof Condition" value="Excellent" accent />
                  <Field label="Existing Solar" value="No" />
                  <Field label="Lead Quality" value="High" accent />
                </div>
              </div>

              <div className="rounded-2xl border border-glass-border bg-glass p-4 sm:p-5">
                <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  Homeowner
                </div>
                <div className="mt-2">
                  <Field label="Name" value="Michael Johnson" />
                  <Field label="Phone" value="(602) 555-0187" />
                  <Field label="Email" value="michael@example.com" />
                </div>
              </div>



            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
