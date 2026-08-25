import { jsx } from "react/jsx-runtime";
import { useMemo } from "react";
function mulberry(seed) {
  return () => {
    seed |= 0;
    seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function Starfield({ count = 160, seed = 7 }) {
  const stars = useMemo(() => {
    const rand = mulberry(seed);
    return Array.from({ length: count }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      s: 0.6 + rand() * 1.8,
      d: 2 + rand() * 6,
      delay: rand() * 6,
      o: 0.2 + rand() * 0.7
    }));
  }, [count, seed]);
  return /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-0 overflow-hidden", "aria-hidden": true, children: stars.map((st, i) => /* @__PURE__ */ jsx(
    "span",
    {
      className: "absolute rounded-full bg-foreground",
      style: {
        left: `${st.x}%`,
        top: `${st.y}%`,
        width: st.s,
        height: st.s,
        opacity: st.o,
        animation: `twinkle ${st.d}s ease-in-out ${st.delay}s infinite`
      }
    },
    i
  )) });
}
export {
  Starfield
};
