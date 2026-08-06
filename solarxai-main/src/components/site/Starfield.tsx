import { useMemo } from "react";

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Starfield({ count = 160, seed = 7 }: { count?: number; seed?: number }) {
  const stars = useMemo(() => {
    const rand = mulberry(seed);
    return Array.from({ length: count }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      s: 0.6 + rand() * 1.8,
      d: 2 + rand() * 6,
      delay: rand() * 6,
      o: 0.2 + rand() * 0.7,
    }));
  }, [count, seed]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {stars.map((st, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-foreground"
          style={{
            left: `${st.x}%`,
            top: `${st.y}%`,
            width: st.s,
            height: st.s,
            opacity: st.o,
            animation: `twinkle ${st.d}s ease-in-out ${st.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
