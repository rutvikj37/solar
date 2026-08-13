import { jsx, jsxs } from "react/jsx-runtime";
import { motion, useScroll, useTransform } from "motion/react";
import { useMemo, useRef } from "react";
import neighborhood from "@/marketing/assets/neighborhood.jpg";
function mulberry(seed) {
  return () => {
    seed |= 0;
    seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function NetworkMap() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const scale = useTransform(scrollYProgress, [0, 1], [3.2, 1]);
  const nodeOpacity = useTransform(scrollYProgress, [0.25, 0.55], [0, 1]);
  const lineOpacity = useTransform(scrollYProgress, [0.45, 0.8], [0, 1]);
  const headline = useTransform(scrollYProgress, [0.6, 0.85], [0, 1]);
  const { nodes, links } = useMemo(() => {
    const rand = mulberry(42);
    const n = Array.from({ length: 130 }, () => {
      const r = rand();
      return {
        x: 4 + rand() * 92,
        y: 6 + rand() * 88,
        type: r > 0.72 ? "qualified" : r > 0.5 ? "solar" : "cold"
      };
    });
    const l = [];
    n.forEach((a, i) => {
      if (a.type === "cold") return;
      let best = -1;
      let bestD = Infinity;
      n.forEach((b, j) => {
        if (i === j || b.type === "cold") return;
        const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
        if (d < bestD && d > 0.5) {
          bestD = d;
          best = j;
        }
      });
      if (best >= 0 && bestD < 320) l.push([i, best]);
    });
    return { nodes: n, links: l };
  }, []);
  return /* @__PURE__ */ jsx("div", { id: "network", ref, className: "relative h-[340vh]", children: /* @__PURE__ */ jsxs("div", { className: "sticky top-0 h-screen overflow-hidden bg-deep", children: [
    /* @__PURE__ */ jsxs(motion.div, { style: { scale }, className: "absolute inset-0 will-change-transform", children: [
      /* @__PURE__ */ jsx(
        "img",
        {
          src: neighborhood,
          alt: "Aerial view of hundreds of homes mapped by the platform",
          loading: "lazy",
          width: 1536,
          height: 1536,
          className: "h-full w-full object-cover opacity-55"
        }
      ),
      /* @__PURE__ */ jsx(
        motion.svg,
        {
          viewBox: "0 0 100 100",
          preserveAspectRatio: "none",
          className: "absolute inset-0 h-full w-full",
          style: { opacity: lineOpacity },
          "aria-hidden": true,
          children: links.map(([a, b], i) => /* @__PURE__ */ jsx(
            "line",
            {
              x1: nodes[a].x,
              y1: nodes[a].y,
              x2: nodes[b].x,
              y2: nodes[b].y,
              stroke: "var(--primary-glow)",
              strokeOpacity: 0.35,
              strokeWidth: 0.12,
              strokeDasharray: "1.2 1.6",
              style: { animation: `dash-flow ${18 + i % 7 * 3}s linear infinite` }
            },
            i
          ))
        }
      ),
      /* @__PURE__ */ jsx(motion.div, { style: { opacity: nodeOpacity }, className: "absolute inset-0", children: nodes.map((nd, i) => /* @__PURE__ */ jsx(
        "span",
        {
          className: "absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
          style: {
            left: `${nd.x}%`,
            top: `${nd.y}%`,
            width: nd.type === "cold" ? 5 : 7,
            height: nd.type === "cold" ? 5 : 7,
            background: nd.type === "qualified" ? "var(--primary-glow)" : nd.type === "solar" ? "oklch(0.98 0.005 250)" : "oklch(0.55 0.02 260)",
            boxShadow: nd.type === "cold" ? "none" : `0 0 12px 3px color-mix(in oklab, var(--primary) ${nd.type === "qualified" ? 80 : 40}%, transparent)`,
            opacity: nd.type === "cold" ? 0.5 : 1,
            animation: nd.type === "qualified" ? `twinkle ${3 + i % 5}s ease-in-out ${i % 7 * 0.3}s infinite` : void 0
          }
        },
        i
      )) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_50%,transparent,var(--deep))]" }),
    /* @__PURE__ */ jsxs(
      motion.div,
      {
        style: { opacity: headline },
        className: "absolute inset-x-0 bottom-0 px-6 pb-20 text-center",
        children: [
          /* @__PURE__ */ jsx("p", { className: "font-mono text-[11px] tracking-[0.3em] text-primary-glow uppercase", children: "The SolarX Grid" }),
          /* @__PURE__ */ jsx("h2", { className: "mx-auto mt-4 max-w-3xl text-4xl font-semibold text-balance sm:text-5xl", children: /* @__PURE__ */ jsx("span", { className: "text-gradient", children: "A nationwide intelligence layer across 128 million rooftops." }) }),
          /* @__PURE__ */ jsxs("div", { className: "mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground", children: [
            /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "size-2 rounded-full bg-primary-glow" }),
              " Qualified opportunity"
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "size-2 rounded-full bg-foreground" }),
              " Existing solar"
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "size-2 rounded-full bg-muted-foreground" }),
              " Not qualified"
            ] })
          ] })
        ]
      }
    )
  ] }) });
}
export {
  NetworkMap
};
