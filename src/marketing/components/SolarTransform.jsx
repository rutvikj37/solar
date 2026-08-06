import { jsx, jsxs } from "react/jsx-runtime";
import { motion, useScroll, useTransform } from "motion/react";
import { useMemo, useRef } from "react";
import houseRoof from "@/marketing/assets/house-roof.jpg";
import houseSolar from "@/marketing/assets/house-solar.jpg";
import { Counter } from "./Dashboard";
function SolarTransform() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const solarOpacity = useTransform(scrollYProgress, [0.15, 0.55], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.08, 1]);
  const glow = useTransform(scrollYProgress, [0.4, 0.8], [0, 0.75]);
  const cardY = useTransform(scrollYProgress, [0.3, 0.7], [60, 0]);
  const cardOpacity = useTransform(scrollYProgress, [0.3, 0.55], [0, 1]);
  const particles = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({
      left: 8 + i * 37 % 84,
      delay: i % 9 * 0.45,
      dur: 3.4 + i * 7 % 22 / 10
    })),
    []
  );
  return /* @__PURE__ */ jsx("div", { ref, className: "relative h-[280vh]", children: /* @__PURE__ */ jsxs("div", { className: "sticky top-0 h-screen overflow-hidden bg-deep", children: [
    /* @__PURE__ */ jsx(
      motion.img,
      {
        src: houseRoof,
        alt: "Rooftop before solar installation",
        loading: "lazy",
        width: 1536,
        height: 1536,
        style: { scale },
        className: "absolute inset-0 h-full w-full object-cover"
      }
    ),
    /* @__PURE__ */ jsx(
      motion.img,
      {
        src: houseSolar,
        alt: "Same rooftop covered in premium black solar panels",
        loading: "lazy",
        width: 1536,
        height: 1536,
        style: { scale, opacity: solarOpacity },
        className: "absolute inset-0 h-full w-full object-cover"
      }
    ),
    /* @__PURE__ */ jsx(
      motion.div,
      {
        style: { opacity: glow },
        className: "pointer-events-none absolute inset-0",
        "aria-hidden": true,
        children: /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute inset-0",
            style: {
              background: "radial-gradient(45% 40% at 50% 52%, color-mix(in oklab, var(--primary-glow) 35%, transparent), transparent 70%)"
            }
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(motion.div, { style: { opacity: glow }, className: "pointer-events-none absolute inset-0", children: particles.map((p, i) => /* @__PURE__ */ jsx(
      "span",
      {
        className: "absolute bottom-0 size-1 rounded-full bg-primary-glow",
        style: {
          left: `${p.left}%`,
          boxShadow: "0 0 10px 2px color-mix(in oklab, var(--primary-glow) 70%, transparent)",
          animation: `float-up ${p.dur}s linear ${p.delay}s infinite`
        }
      },
      i
    )) }),
    /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(75%_70%_at_50%_50%,transparent,var(--deep))]" }),
    /* @__PURE__ */ jsx("div", { className: "absolute inset-x-0 top-24 px-6", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-7xl", children: [
      /* @__PURE__ */ jsx("p", { className: "font-mono text-[11px] tracking-[0.3em] text-primary-glow uppercase", children: "Installation simulation" }),
      /* @__PURE__ */ jsx("h2", { className: "mt-3 max-w-xl text-3xl font-semibold text-balance sm:text-4xl", children: "From rooftop to power plant." })
    ] }) }),
    /* @__PURE__ */ jsx(
      motion.div,
      {
        style: { y: cardY, opacity: cardOpacity },
        className: "absolute inset-x-0 bottom-16 px-6",
        children: /* @__PURE__ */ jsxs("div", { className: "glass-panel mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-6 rounded-2xl px-8 py-6", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "text-[10px] tracking-[0.22em] text-muted-foreground uppercase", children: "Solar Score" }),
            /* @__PURE__ */ jsxs("div", { className: "mt-1 font-display text-4xl font-semibold text-primary-glow", children: [
              /* @__PURE__ */ jsx(Counter, { to: 100, active: true }),
              " ",
              /* @__PURE__ */ jsx("span", { className: "text-lg text-muted-foreground", children: "/100" })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "h-12 w-px bg-border" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "text-[10px] tracking-[0.22em] text-muted-foreground uppercase", children: "Status" }),
            /* @__PURE__ */ jsxs("div", { className: "mt-2 inline-flex items-center gap-2 rounded-full bg-primary/15 px-4 py-1.5 font-display text-sm font-semibold text-primary-glow", children: [
              /* @__PURE__ */ jsx("span", { className: "size-2 animate-pulse rounded-full bg-primary-glow" }),
              "Installation Ready"
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "h-12 w-px bg-border" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "text-[10px] tracking-[0.22em] text-muted-foreground uppercase", children: "Annual Output" }),
            /* @__PURE__ */ jsx("div", { className: "mt-1 font-display text-2xl font-semibold", children: /* @__PURE__ */ jsx(Counter, { to: 23.4, decimals: 1, suffix: " MWh", active: true }) })
          ] })
        ] })
      }
    )
  ] }) });
}
export {
  SolarTransform
};
