import { jsx, jsxs } from "react/jsx-runtime";
import { motion, useScroll, useTransform, useInView } from "motion/react";
import { useRef } from "react";
import neighborhoodAerial from "@/marketing/assets/neighborhood-aerial.jpg";
const ROOFS = [
  { id: "r1", points: "6,52 30,44 44,60 34,80 12,74", cx: 23, cy: 60, status: "installed", score: 91, at: 0.14 },
  { id: "r2", points: "36,37 55,31 66,42 52,55 38,49", cx: 49, cy: 43, status: "opportunity", score: 98, at: 0.18 },
  { id: "r3", points: "6,33 22,29 32,37 20,44 8,40", cx: 18, cy: 36, status: "opportunity", score: 94, at: 0.22 },
  { id: "r4", points: "54,27 68,23 78,29 66,35 56,32", cx: 66, cy: 29, status: "installed", score: 88, at: 0.26 },
  { id: "r5", points: "80,21 92,18 98,24 88,30 80,27", cx: 88, cy: 24, status: "opportunity", score: 99, at: 0.3 },
  { id: "r6", points: "22,18 32,16 38,20 30,24 23,22", cx: 30, cy: 20, status: "unqualified", score: 41, at: 0.34 },
  { id: "r7", points: "39,18 48,16 53,20 45,24 39,22", cx: 46, cy: 20, status: "unqualified", score: 47, at: 0.36 },
  { id: "r8", points: "62,39 76,35 84,41 72,47 63,44", cx: 72, cy: 42, status: "opportunity", score: 82, at: 0.38 },
  { id: "r9", points: "0,74 10,72 14,82 4,90 0,86", cx: 6, cy: 80, status: "unqualified", score: 52, at: 0.4 }
];
const STATUS_COLOR = {
  opportunity: "var(--primary-glow)",
  installed: "oklch(0.78 0.17 155)",
  unqualified: "oklch(0.72 0.02 260)"
};
const CARDS = [
  {
    roof: "r2",
    rows: [
      ["Owner", "Daniel & Marie Okafor"],
      ["Address", "1458 Palm Ridge Dr, Phoenix"],
      ["Phone", "(602) 555-0142"],
      ["Roof Score", "98 / 100 \u2014 Excellent"],
      ["Estimated Usable Space", "2,480 sq ft \xB7 15.2 kW"]
    ],
    tone: "opportunity",
    delay: 1.4,
    from: { x: -60, y: -20 },
    pos: "left-[3%] top-[34%]",
    anchor: { x: 20, y: 44 }
  },
  {
    roof: "r1",
    rows: [
      ["Owner", "The Whitmore Residence"],
      ["Address", "1462 Palm Ridge Dr, Phoenix"],
      ["Phone", "(602) 555-0198"],
      ["Roof Score", "91 / 100 \u2014 Already covered"],
      ["Estimated Usable Space", "0 sq ft left \xB7 11.4 kW live"]
    ],
    tone: "installed",
    delay: 1.8,
    from: { x: -50, y: 40 },
    pos: "left-[6%] bottom-[10%]",
    anchor: { x: 22, y: 82 }
  },
  {
    roof: "r5",
    rows: [
      ["Owner", "Priya & Arun Raghavan"],
      ["Address", "82 Solstice Court, Phoenix"],
      ["Phone", "(602) 555-0176"],
      ["Roof Score", "99 / 100 \u2014 Best on block"],
      ["Estimated Usable Space", "2,910 sq ft \xB7 17.6 kW"]
    ],
    tone: "opportunity",
    delay: 2.2,
    from: { x: 60, y: -30 },
    pos: "right-[4%] top-[20%]",
    anchor: { x: 80, y: 28 }
  },
  {
    roof: "r6",
    rows: [
      ["Owner", "Chen Family Home"],
      ["Address", "31 Mesa Crest Ln, Phoenix"],
      ["Phone", "(602) 555-0129"],
      ["Roof Score", "41 / 100 \u2014 Low, heavy shading"],
      ["Estimated Usable Space", "610 sq ft \xB7 3.1 kW"]
    ],
    tone: "unqualified",
    delay: 2.6,
    from: { x: 60, y: 30 },
    pos: "right-[5%] bottom-[26%]",
    anchor: { x: 80, y: 60 }
  },
  {
    roof: "r3",
    rows: [
      ["Owner", "Sofia Delgado"],
      ["Address", "1450 Palm Ridge Dr, Phoenix"],
      ["Phone", "(602) 555-0165"],
      ["Roof Score", "94 / 100 \u2014 Strong"],
      ["Estimated Usable Space", "2,240 sq ft \xB7 13.8 kW"]
    ],
    tone: "opportunity",
    delay: 3,
    from: { x: 0, y: -50 },
    pos: "left-[38%] bottom-[8%]",
    anchor: { x: 45, y: 84 }
  }
];
function NeighborhoodScan() {
  const ref = useRef(null);
  const inner = useRef(null);
  const inView = useInView(inner, { margin: "-25% 0px -25% 0px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.12, 1.02]);
  const imgY = useTransform(scrollYProgress, [0, 1], ["-2%", "2%"]);
  return /* @__PURE__ */ jsx("div", { id: "neighborhood", ref, className: "relative h-[190vh] sm:h-[260vh] lg:h-[380vh]", children: /* @__PURE__ */ jsxs("div", { ref: inner, className: "sticky top-0 h-screen overflow-hidden bg-deep", children: [
    /* @__PURE__ */ jsx(
      motion.img,
      {
        src: neighborhoodAerial,
        alt: "Angled aerial view of a premium American suburban neighborhood with multiple rooftops",
        decoding: "async",
        width: 1920,
        height: 1280,
        style: { scale: imgScale, y: imgY },
        className: "absolute inset-0 h-full w-full object-cover opacity-90"
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(85%_80%_at_50%_45%,transparent,var(--deep))]" }),
    /* @__PURE__ */ jsx(
      motion.div,
      {
        initial: { opacity: 0 },
        animate: { opacity: inView ? 1 : 0 },
        transition: { duration: 0.9 },
        className: "pointer-events-none absolute top-0 left-1/2 h-[62%] w-[70vmin] -translate-x-1/2",
        children: /* @__PURE__ */ jsx(
          "div",
          {
            className: "h-full w-full",
            style: {
              clipPath: "polygon(46% 0%, 54% 0%, 100% 100%, 0% 100%)",
              background: "linear-gradient(to bottom, color-mix(in oklab, var(--primary) 55%, transparent), transparent)",
              filter: "blur(3px)"
            }
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      motion.div,
      {
        initial: { opacity: 0, scale: 0.5 },
        animate: inView ? { opacity: 0.6, scale: 1 } : { opacity: 0, scale: 0.5 },
        transition: { duration: 1.4, ease: "easeOut" },
        className: "pointer-events-none absolute inset-0 origin-center",
        "aria-hidden": true,
        children: /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute inset-0",
            style: {
              backgroundImage: "linear-gradient(to right, color-mix(in oklab, var(--primary-glow) 30%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--primary-glow) 30%, transparent) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(70% 65% at 50% 48%, black, transparent)",
              transform: "perspective(700px) rotateX(52deg)"
            }
          }
        )
      }
    ),
    /* @__PURE__ */ jsxs(
      "svg",
      {
        viewBox: "0 0 100 100",
        preserveAspectRatio: "none",
        className: "pointer-events-none absolute inset-0 h-full w-full",
        "aria-hidden": true,
        children: [
          ROOFS.map((r, i) => /* @__PURE__ */ jsx(RoofShape, { roof: r, delay: 0.6 + i * 0.18, active: inView }, r.id)),
          CARDS.map((c) => {
            const roof = ROOFS.find((r) => r.id === c.roof);
            return /* @__PURE__ */ jsx(
              Connector,
              {
                from: c.anchor,
                to: { x: roof.cx, y: roof.cy },
                delay: c.delay,
                active: inView
              },
              c.roof
            );
          })
        ]
      }
    ),
    ROOFS.map((r, i) => /* @__PURE__ */ jsx(RoofRing, { roof: r, delay: 0.8 + i * 0.18, active: inView }, r.id)),
    /* @__PURE__ */ jsx("div", { className: "absolute inset-x-0 top-24 z-20 px-5 sm:top-20 sm:px-6", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-7xl", children: [
      /* @__PURE__ */ jsx("p", { className: "font-mono text-[11px] tracking-[0.3em] text-primary-glow uppercase", children: "Neighborhood-scale analysis" }),
      /* @__PURE__ */ jsx("h2", { className: "mt-3 max-w-2xl text-2xl font-semibold text-balance sm:text-4xl", children: "Nine rooftops found with no solar panel" })
    ] }) }),
    CARDS.map((c) => /* @__PURE__ */ jsx(InfoCard, { card: c, active: inView }, c.roof)),
    /* @__PURE__ */ jsxs("div", { className: "absolute inset-x-0 bottom-16 z-20 lg:hidden", children: [
      /* @__PURE__ */ jsx("p", { className: "mb-2 px-5 font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase", children: "Swipe for property intelligence" }),
      /* @__PURE__ */ jsx("div", { className: "flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", children: CARDS.map((c, i) => /* @__PURE__ */ jsx(InfoCard, { card: c, active: inView, variant: "mobile", index: i }, c.roof)) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "absolute inset-x-0 bottom-4 z-20 px-5 sm:bottom-6 sm:px-6", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[9px] tracking-[0.18em] text-muted-foreground uppercase sm:gap-x-8 sm:gap-y-2 sm:text-[10px]", children: [
      /* @__PURE__ */ jsx(Legend, { color: STATUS_COLOR.opportunity, label: "High opportunity" }),
      /* @__PURE__ */ jsx(Legend, { color: STATUS_COLOR.installed, label: "MEDIUM OPPORTUNITY" }),
      /* @__PURE__ */ jsx(Legend, { color: STATUS_COLOR.unqualified, label: "Not qualified" })
    ] }) })
  ] }) });
}
function Legend({ color, label }) {
  return /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2", children: [
    /* @__PURE__ */ jsx(
      "span",
      {
        className: "size-2 rounded-full",
        style: { background: color, boxShadow: `0 0 10px 2px ${color}` }
      }
    ),
    label
  ] });
}
function RoofShape({ roof, delay, active }) {
  const color = STATUS_COLOR[roof.status];
  return /* @__PURE__ */ jsx(
    motion.polygon,
    {
      points: roof.points,
      stroke: color,
      strokeWidth: 1.4,
      vectorEffect: "non-scaling-stroke",
      fill: `color-mix(in oklab, ${color} 12%, transparent)`,
      initial: { pathLength: 0, opacity: 0 },
      animate: active ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 },
      transition: { duration: 1.1, delay: active ? delay : 0, ease: "easeInOut" }
    }
  );
}
function Connector({
  from,
  to,
  delay,
  active
}) {
  return /* @__PURE__ */ jsx(
    motion.line,
    {
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      stroke: "var(--primary-glow)",
      strokeWidth: 1,
      vectorEffect: "non-scaling-stroke",
      initial: { pathLength: 0, opacity: 0 },
      animate: active ? { pathLength: 1, opacity: 0.9 } : { pathLength: 0, opacity: 0 },
      transition: { duration: 0.7, delay: active ? delay : 0, ease: "easeOut" }
    }
  );
}
function RoofRing({ roof, delay, active }) {
  const color = STATUS_COLOR[roof.status];
  return /* @__PURE__ */ jsxs(
    motion.div,
    {
      initial: { opacity: 0 },
      animate: { opacity: active ? 1 : 0 },
      transition: { duration: 0.6, delay: active ? delay : 0 },
      style: { left: `${roof.cx}%`, top: `${roof.cy}%` },
      className: "pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2",
      children: [
        /* @__PURE__ */ jsx(
          "span",
          {
            className: "absolute top-0 left-0 block size-[11vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border",
            style: { borderColor: color, opacity: 0.55 }
          }
        ),
        active && /* @__PURE__ */ jsx(
          "span",
          {
            className: "absolute top-0 left-0 block size-[11vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border",
            style: { borderColor: color, animation: `marketing-pulse-ring 4s ease-out ${delay}s infinite` }
          }
        ),
        /* @__PURE__ */ jsx(
          "span",
          {
            className: "absolute top-0 left-0 block size-[6vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed",
            style: { borderColor: color, animation: "spin-slow 22s linear infinite" }
          }
        ),
        active && /* @__PURE__ */ jsx("span", { className: "absolute top-0 left-0 block size-[11vmin] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full", children: /* @__PURE__ */ jsx(
          "span",
          {
            className: "block h-[40%] w-full",
            style: {
              background: `linear-gradient(to bottom, transparent, color-mix(in oklab, ${color} 65%, transparent), transparent)`,
              animation: `scan-sweep 3.2s ease-in-out ${delay}s infinite`
            }
          }
        ) }),
        /* @__PURE__ */ jsx(
          "span",
          {
            className: "absolute top-0 left-0 -translate-x-1/2 translate-y-[3.4vmin] rounded-full px-2 py-0.5 font-mono text-[10px] whitespace-nowrap",
            style: {
              color,
              background: "color-mix(in oklab, var(--deep) 85%, transparent)",
              border: `1px solid color-mix(in oklab, ${color} 45%, transparent)`
            },
            children: roof.score
          }
        )
      ]
    }
  );
}
function InfoCard({
  card,
  active,
  variant = "desktop",
  index = 0
}) {
  const color = STATUS_COLOR[card.tone];
  const mobile = variant === "mobile";
  return /* @__PURE__ */ jsx(
    motion.div,
    {
      initial: mobile ? { opacity: 0, y: 24 } : { opacity: 0, x: card.from.x, y: card.from.y },
      animate: active ? { opacity: 1, x: 0, y: 0 } : mobile ? { opacity: 0, y: 24 } : { opacity: 0, x: card.from.x, y: card.from.y },
      transition: {
        duration: 0.6,
        delay: active ? mobile ? 0.6 + index * 0.15 : card.delay : 0,
        ease: "easeOut"
      },
      className: mobile ? "w-[70vw] max-w-[250px] min-w-[220px] shrink-0 snap-center" : `pointer-events-none absolute z-20 hidden w-[268px] lg:block ${card.pos}`,
      children: /* @__PURE__ */ jsx(
        "div",
        {
          className: "rounded-2xl border px-4 py-3.5 backdrop-blur-2xl sm:px-5 sm:py-4",
          style: {
            animation: mobile ? void 0 : "float-slow 7s ease-in-out infinite",
            background: "linear-gradient(160deg, oklch(0.22 0.045 268 / 0.96), oklch(0.15 0.04 272 / 0.97))",
            boxShadow: `0 0 50px -10px ${color}, 0 30px 60px -30px oklch(0 0 0 / 90%), inset 0 1px 0 0 oklch(1 0 0 / 12%)`,
            borderColor: `color-mix(in oklab, ${color} 55%, transparent)`
          },
          children: /* @__PURE__ */ jsx("dl", { className: "space-y-1.5 sm:space-y-2", children: card.rows.map(([k, v]) => /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { className: "font-mono text-[9px] tracking-[0.16em] text-foreground/55 uppercase", children: k }),
            /* @__PURE__ */ jsx("dd", { className: "font-display text-[12px] leading-snug font-semibold", style: { color }, children: v })
          ] }, k)) })
        }
      )
    }
  );
}
export {
  NeighborhoodScan
};
