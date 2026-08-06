import { jsx, jsxs } from "react/jsx-runtime";
import { animate, motion, useInView, useMotionValue, useMotionValueEvent } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Gauge, MapPin, Sun, Zap } from "lucide-react";
function Counter({
  to,
  duration = 1.6,
  prefix = "",
  suffix = "",
  decimals = 0,
  active
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
  return /* @__PURE__ */ jsxs("span", { children: [
    prefix,
    display.toLocaleString(void 0, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }),
    suffix
  ] });
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
  { m: "Dec", v: 126 }
];
function IrradianceChart({ data }) {
  const { line, area, labels } = useMemo(() => {
    const w = 480;
    const h = 140;
    const padX = 8;
    const padY = 12;
    const max = Math.max(...data.map((d) => d.v));
    const min = Math.min(...data.map((d) => d.v));
    const span = Math.max(max - min, 1);
    const pts = data.map((d, i) => {
      const x = padX + (i / Math.max(data.length - 1, 1)) * (w - padX * 2);
      const y = h - padY - ((d.v - min) / span) * (h - padY * 2);
      return { x, y, m: d.m };
    });
    const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${h - padY} L${pts[0].x.toFixed(1)},${h - padY} Z`;
    return { line: linePath, area: areaPath, labels: pts };
  }, [data]);
  return /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 480 160", className: "h-full w-full", preserveAspectRatio: "none", children: [
    /* @__PURE__ */ jsxs("defs", { children: [
      /* @__PURE__ */ jsxs("linearGradient", { id: "sunFill", x1: "0", y1: "0", x2: "0", y2: "1", children: [
        /* @__PURE__ */ jsx("stop", { offset: "0%", stopColor: "#1E90FF", stopOpacity: 0.7 }),
        /* @__PURE__ */ jsx("stop", { offset: "100%", stopColor: "#1E90FF", stopOpacity: 0 })
      ] })
    ] }),
    /* @__PURE__ */ jsx("path", { d: area, fill: "url(#sunFill)" }),
    /* @__PURE__ */ jsx("path", { d: line, fill: "none", stroke: "#63B3FF", strokeWidth: "2", vectorEffect: "non-scaling-stroke" }),
    labels.map((p) => /* @__PURE__ */ jsx(
      "text",
      {
        x: p.x,
        y: 156,
        textAnchor: "middle",
        fill: "rgba(255,255,255,0.4)",
        fontSize: "10",
        children: p.m
      },
      p.m
    ))
  ] });
}
function Field({ label, value, accent }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-4 border-b border-border/60 py-2.5 last:border-0", children: [
    /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground", children: label }),
    /* @__PURE__ */ jsx(
      "span",
      {
        className: `font-display text-sm font-semibold ${accent ? "text-primary-glow" : "text-foreground"}`,
        children: value
      }
    )
  ] });
}
function Dashboard() {
  const ref = useRef(null);
  const active = useInView(ref, { once: true, margin: "-20%" });
  return /* @__PURE__ */ jsxs("section", { id: "platform", ref, className: "relative overflow-hidden py-20 sm:py-32", children: [
    /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-0 grid-fade opacity-40" }),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "pointer-events-none absolute top-1/3 left-1/2 size-[70vmax] -translate-x-1/2 rounded-full opacity-40 blur-3xl",
        style: {
          background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 30%, transparent), transparent 60%)"
        }
      }
    ),
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
            /* @__PURE__ */ jsx("p", { className: "font-mono text-[11px] tracking-[0.3em] text-primary-glow uppercase", children: "Property intelligence report" }),
            /* @__PURE__ */ jsx("h2", { className: "mt-4 text-[2rem] font-semibold text-balance sm:text-5xl", children: /* @__PURE__ */ jsx("span", { className: "text-gradient", children: "Every rooftop quantified ." }) })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        motion.div,
        {
          initial: { opacity: 0, y: 60, rotateX: 8 },
          whileInView: { opacity: 1, y: 0, rotateX: 0 },
          viewport: { once: true, margin: "-15%" },
          transition: { duration: 1, ease: [0.16, 1, 0.3, 1] },
          className: "glass-panel mt-10 rounded-3xl p-4 sm:mt-14 sm:p-8 lg:p-10",
          children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6 sm:pb-8", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-center gap-4", children: [
                /* @__PURE__ */ jsxs("div", { className: "relative flex size-20 shrink-0 items-center justify-center sm:size-24", children: [
                  /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 100 100", className: "absolute size-20 -rotate-90 sm:size-24", children: [
                    /* @__PURE__ */ jsx("circle", { cx: "50", cy: "50", r: "44", fill: "none", stroke: "var(--border)", strokeWidth: "6" }),
                    /* @__PURE__ */ jsx(
                      motion.circle,
                      {
                        cx: "50",
                        cy: "50",
                        r: "44",
                        fill: "none",
                        stroke: "var(--primary-glow)",
                        strokeWidth: "6",
                        strokeLinecap: "round",
                        initial: { pathLength: 0 },
                        animate: active ? { pathLength: 0.98 } : {},
                        transition: { duration: 1.8, ease: [0.16, 1, 0.3, 1] }
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
                    /* @__PURE__ */ jsx("div", { className: "font-display text-2xl font-semibold", children: /* @__PURE__ */ jsx(Counter, { to: 98, active }) }),
                    /* @__PURE__ */ jsx("div", { className: "text-[9px] tracking-widest text-muted-foreground", children: "/100" })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("div", { className: "text-[11px] tracking-[0.25em] text-muted-foreground uppercase", children: "Solar Score" }),
                  /* @__PURE__ */ jsx("div", { className: "mt-1 font-display text-xl font-semibold", children: "Exceptional" }),
                  /* @__PURE__ */ jsxs("div", { className: "mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs text-primary-glow", children: [
                    /* @__PURE__ */ jsx(CheckCircle2, { className: "size-3.5" }),
                    " Lead Quality \xB7 High"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 text-sm", children: [
                /* @__PURE__ */ jsx(MapPin, { className: "mt-0.5 size-4 shrink-0 text-primary-glow" }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("div", { className: "font-display font-semibold", children: "1458 Palm Ridge Drive" }),
                  /* @__PURE__ */ jsx("div", { className: "text-muted-foreground", children: "Phoenix, Arizona" })
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid gap-4 pt-6 sm:gap-6 sm:pt-8 lg:grid-cols-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2", children: [
                [
                  { icon: Gauge, label: "Roof Area", node: /* @__PURE__ */ jsx(Counter, { to: 2450, active, suffix: " sq ft" }) },
                  { icon: Sun, label: "Sunlight", node: "Excellent" },
                  {
                    icon: Zap,
                    label: "Estimated System Size",
                    node: /* @__PURE__ */ jsx(Counter, { to: 14.8, decimals: 1, active, suffix: " kW" })
                  },
                  {
                    icon: CheckCircle2,
                    label: "Annual Savings",
                    node: /* @__PURE__ */ jsx(Counter, { to: 2860, prefix: "$", active })
                  }
                ].map((c) => /* @__PURE__ */ jsxs(
                  "div",
                  {
                    className: "rounded-2xl border border-glass-border bg-glass p-4 transition-colors hover:border-primary/40 sm:p-5",
                    children: [
                      /* @__PURE__ */ jsx(c.icon, { className: "size-4 text-primary-glow" }),
                      /* @__PURE__ */ jsx("div", { className: "mt-3 text-[10px] tracking-[0.2em] text-muted-foreground uppercase sm:mt-4", children: c.label }),
                      /* @__PURE__ */ jsx("div", { className: "mt-1.5 font-display text-xl font-semibold sm:text-2xl", children: c.node })
                    ]
                  },
                  c.label
                )),
                /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-glass-border bg-glass p-4 sm:col-span-2 sm:p-5", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                    /* @__PURE__ */ jsx("div", { className: "text-[10px] tracking-[0.2em] text-muted-foreground uppercase", children: "Monthly irradiance \xB7 kWh/m\xB2" }),
                    /* @__PURE__ */ jsx("span", { className: "text-xs text-primary-glow", children: "Peak Jun" })
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "mt-4 h-32 sm:h-40", children: /* @__PURE__ */ jsx(IrradianceChart, { data: sun }) })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 sm:gap-6", children: [
                /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-glass-border bg-glass p-4 sm:p-5", children: [
                  /* @__PURE__ */ jsx("div", { className: "text-[10px] tracking-[0.2em] text-muted-foreground uppercase", children: "Property" }),
                  /* @__PURE__ */ jsxs("div", { className: "mt-2", children: [
                    /* @__PURE__ */ jsx(Field, { label: "Roof Condition", value: "Excellent", accent: true }),
                    /* @__PURE__ */ jsx(Field, { label: "Existing Solar", value: "No" }),
                    /* @__PURE__ */ jsx(Field, { label: "Lead Quality", value: "High", accent: true })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-glass-border bg-glass p-4 sm:p-5", children: [
                  /* @__PURE__ */ jsx("div", { className: "text-[10px] tracking-[0.2em] text-muted-foreground uppercase", children: "Homeowner" }),
                  /* @__PURE__ */ jsxs("div", { className: "mt-2", children: [
                    /* @__PURE__ */ jsx(Field, { label: "Name", value: "Michael Johnson" }),
                    /* @__PURE__ */ jsx(Field, { label: "Phone", value: "(602) 555-0187" }),
                    /* @__PURE__ */ jsx(Field, { label: "Email", value: "michael@example.com" })
                  ] })
                ] })
              ] })
            ] })
          ]
        }
      )
    ] })
  ] });
}
export {
  Counter,
  Dashboard
};
