import { motion, useScroll, useTransform, useInView } from "motion/react";
import { useRef } from "react";
import neighborhoodAerial from "@/assets/neighborhood-aerial.jpg";

type Status = "opportunity" | "installed" | "unqualified";

type Roof = {
  id: string;
  points: string; // percent polygon
  cx: number;
  cy: number;
  status: Status;
  score: number;
  at: number;
};

const ROOFS: Roof[] = [
  { id: "r1", points: "6,52 30,44 44,60 34,80 12,74", cx: 23, cy: 60, status: "installed", score: 91, at: 0.14 },
  { id: "r2", points: "36,37 55,31 66,42 52,55 38,49", cx: 49, cy: 43, status: "opportunity", score: 98, at: 0.18 },
  { id: "r3", points: "6,33 22,29 32,37 20,44 8,40", cx: 18, cy: 36, status: "opportunity", score: 94, at: 0.22 },
  { id: "r4", points: "54,27 68,23 78,29 66,35 56,32", cx: 66, cy: 29, status: "installed", score: 88, at: 0.26 },
  { id: "r5", points: "80,21 92,18 98,24 88,30 80,27", cx: 88, cy: 24, status: "opportunity", score: 99, at: 0.3 },
  { id: "r6", points: "22,18 32,16 38,20 30,24 23,22", cx: 30, cy: 20, status: "unqualified", score: 41, at: 0.34 },
  { id: "r7", points: "39,18 48,16 53,20 45,24 39,22", cx: 46, cy: 20, status: "unqualified", score: 47, at: 0.36 },
  { id: "r8", points: "62,39 76,35 84,41 72,47 63,44", cx: 72, cy: 42, status: "opportunity", score: 82, at: 0.38 },
  { id: "r9", points: "0,74 10,72 14,82 4,90 0,86", cx: 6, cy: 80, status: "unqualified", score: 52, at: 0.4 },
];

const STATUS_COLOR: Record<Status, string> = {
  opportunity: "var(--primary-glow)",
  installed: "oklch(0.78 0.17 155)",
  unqualified: "oklch(0.72 0.02 260)",
};

type Card = {
  roof: string;
  rows: [string, string][];
  tone: Status;
  delay: number;
  from: { x: number; y: number };
  pos: string;
  anchor: { x: number; y: number };
};

const CARDS: Card[] = [
  {
    roof: "r2",
    rows: [
      ["Owner", "Daniel & Marie Okafor"],
      ["Address", "1458 Palm Ridge Dr, Phoenix"],
      ["Phone", "(602) 555-0142"],
      ["Roof Score", "98 / 100 — Excellent"],
      ["Estimated Usable Space", "2,480 sq ft · 15.2 kW"],
    ],
    tone: "opportunity",
    delay: 1.4,
    from: { x: -60, y: -20 },
    pos: "left-[3%] top-[34%]",
    anchor: { x: 20, y: 44 },
  },
  {
    roof: "r1",
    rows: [
      ["Owner", "The Whitmore Residence"],
      ["Address", "1462 Palm Ridge Dr, Phoenix"],
      ["Phone", "(602) 555-0198"],
      ["Roof Score", "91 / 100 — Already covered"],
      ["Estimated Usable Space", "0 sq ft left · 11.4 kW live"],
    ],
    tone: "installed",
    delay: 1.8,
    from: { x: -50, y: 40 },
    pos: "left-[6%] bottom-[10%]",
    anchor: { x: 22, y: 82 },
  },
  {
    roof: "r5",
    rows: [
      ["Owner", "Priya & Arun Raghavan"],
      ["Address", "82 Solstice Court, Phoenix"],
      ["Phone", "(602) 555-0176"],
      ["Roof Score", "99 / 100 — Best on block"],
      ["Estimated Usable Space", "2,910 sq ft · 17.6 kW"],
    ],
    tone: "opportunity",
    delay: 2.2,
    from: { x: 60, y: -30 },
    pos: "right-[4%] top-[20%]",
    anchor: { x: 80, y: 28 },
  },
  {
    roof: "r6",
    rows: [
      ["Owner", "Chen Family Home"],
      ["Address", "31 Mesa Crest Ln, Phoenix"],
      ["Phone", "(602) 555-0129"],
      ["Roof Score", "41 / 100 — Low, heavy shading"],
      ["Estimated Usable Space", "610 sq ft · 3.1 kW"],
    ],
    tone: "unqualified",
    delay: 2.6,
    from: { x: 60, y: 30 },
    pos: "right-[5%] bottom-[26%]",
    anchor: { x: 80, y: 60 },
  },
  {
    roof: "r3",
    rows: [
      ["Owner", "Sofia Delgado"],
      ["Address", "1450 Palm Ridge Dr, Phoenix"],
      ["Phone", "(602) 555-0165"],
      ["Roof Score", "94 / 100 — Strong"],
      ["Estimated Usable Space", "2,240 sq ft · 13.8 kW"],
    ],
    tone: "opportunity",
    delay: 3.0,
    from: { x: 0, y: -50 },
    pos: "left-[38%] bottom-[8%]",
    anchor: { x: 45, y: 84 },
  },
];

export function NeighborhoodScan() {
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const inView = useInView(inner, { margin: "-25% 0px -25% 0px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const imgScale = useTransform(scrollYProgress, [0, 1], [1.12, 1.02]);
  const imgY = useTransform(scrollYProgress, [0, 1], ["-2%", "2%"]);


  return (
    <div id="neighborhood" ref={ref} className="relative h-[190vh] sm:h-[260vh] lg:h-[380vh]">
      <div ref={inner} className="sticky top-0 h-screen overflow-hidden bg-deep">
        <motion.img
          src={neighborhoodAerial}
          alt="Angled aerial view of a premium American suburban neighborhood with multiple rooftops"
          loading="lazy"
          width={1920}
          height={1280}
          style={{ scale: imgScale, y: imgY }}
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-[radial-gradient(85%_80%_at_50%_45%,transparent,var(--deep))]" />

        {/* satellite beam */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: inView ? 1 : 0 }}
          transition={{ duration: 0.9 }}
          className="pointer-events-none absolute top-0 left-1/2 h-[62%] w-[70vmin] -translate-x-1/2"
        >
          <div
            className="h-full w-full"
            style={{
              clipPath: "polygon(46% 0%, 54% 0%, 100% 100%, 0% 100%)",
              background:
                "linear-gradient(to bottom, color-mix(in oklab, var(--primary) 55%, transparent), transparent)",
              filter: "blur(3px)",
            }}
          />
        </motion.div>

        {/* holographic grid */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={inView ? { opacity: 0.6, scale: 1 } : { opacity: 0, scale: 0.5 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 origin-center"
          aria-hidden
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, color-mix(in oklab, var(--primary-glow) 30%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--primary-glow) 30%, transparent) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(70% 65% at 50% 48%, black, transparent)",
              transform: "perspective(700px) rotateX(52deg)",
            }}
          />
        </motion.div>

        {/* roof wireframes + connectors */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        >
          {ROOFS.map((r, i) => (
            <RoofShape key={r.id} roof={r} delay={0.6 + i * 0.18} active={inView} />
          ))}
          {CARDS.map((c) => {
            const roof = ROOFS.find((r) => r.id === c.roof)!;
            return (
              <Connector
                key={c.roof}
                from={c.anchor}
                to={{ x: roof.cx, y: roof.cy }}
                delay={c.delay}
                active={inView}
              />
            );
          })}
        </svg>

        {/* glowing scan rings per roof */}
        {ROOFS.map((r, i) => (
          <RoofRing key={r.id} roof={r} delay={0.8 + i * 0.18} active={inView} />
        ))}

        {/* header */}
        <div className="absolute inset-x-0 top-24 z-20 px-5 sm:top-20 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <p className="font-mono text-[11px] tracking-[0.3em] text-primary-glow uppercase">
              Neighborhood-scale analysis
            </p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-balance sm:text-4xl">
              Nine rooftops found with no solar panel
            </h2>
          </div>
        </div>

        {/* cards — floating on desktop */}
        {CARDS.map((c) => (
          <InfoCard key={c.roof} card={c} active={inView} />
        ))}

        {/* cards — swipeable strip on mobile/tablet */}
        <div className="absolute inset-x-0 bottom-16 z-20 lg:hidden">
          <p className="mb-2 px-5 font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
            Swipe for property intelligence
          </p>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CARDS.map((c, i) => (
              <InfoCard key={c.roof} card={c} active={inView} variant="mobile" index={i} />
            ))}
          </div>
        </div>

        {/* legend */}
        <div className="absolute inset-x-0 bottom-4 z-20 px-5 sm:bottom-6 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[9px] tracking-[0.18em] text-muted-foreground uppercase sm:gap-x-8 sm:gap-y-2 sm:text-[10px]">
            <Legend color={STATUS_COLOR.opportunity} label="High opportunity" />
            <Legend color={STATUS_COLOR.installed} label="MEDIUM OPPORTUNITY" />
            <Legend color={STATUS_COLOR.unqualified} label="Not qualified" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="size-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 10px 2px ${color}` }}
      />
      {label}
    </span>
  );
}

function RoofShape({ roof, delay, active }: { roof: Roof; delay: number; active: boolean }) {
  const color = STATUS_COLOR[roof.status];
  return (
    <motion.polygon
      points={roof.points}
      stroke={color}
      strokeWidth={1.4}
      vectorEffect="non-scaling-stroke"
      fill={`color-mix(in oklab, ${color} 12%, transparent)`}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={active ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
      transition={{ duration: 1.1, delay: active ? delay : 0, ease: "easeInOut" }}
    />
  );
}

function Connector({
  from,
  to,
  delay,
  active,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  delay: number;
  active: boolean;
}) {
  return (
    <motion.line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke="var(--primary-glow)"
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={active ? { pathLength: 1, opacity: 0.9 } : { pathLength: 0, opacity: 0 }}
      transition={{ duration: 0.7, delay: active ? delay : 0, ease: "easeOut" }}
    />
  );
}

function RoofRing({ roof, delay, active }: { roof: Roof; delay: number; active: boolean }) {
  const color = STATUS_COLOR[roof.status];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ duration: 0.6, delay: active ? delay : 0 }}
      style={{ left: `${roof.cx}%`, top: `${roof.cy}%` }}
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
    >
      <span
        className="absolute top-0 left-0 block size-[11vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ borderColor: color, opacity: 0.55 }}
      />
      {active && (
        <span
          className="absolute top-0 left-0 block size-[11vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{ borderColor: color, animation: `pulse-ring 4s ease-out ${delay}s infinite` }}
        />
      )}
      <span
        className="absolute top-0 left-0 block size-[6vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed"
        style={{ borderColor: color, animation: "spin-slow 22s linear infinite" }}
      />
      {active && (
        <span className="absolute top-0 left-0 block size-[11vmin] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full">
          <span
            className="block h-[40%] w-full"
            style={{
              background: `linear-gradient(to bottom, transparent, color-mix(in oklab, ${color} 65%, transparent), transparent)`,
              animation: `scan-sweep 3.2s ease-in-out ${delay}s infinite`,
            }}
          />
        </span>
      )}
      <span
        className="absolute top-0 left-0 -translate-x-1/2 translate-y-[3.4vmin] rounded-full px-2 py-0.5 font-mono text-[10px] whitespace-nowrap"
        style={{
          color,
          background: "color-mix(in oklab, var(--deep) 85%, transparent)",
          border: `1px solid color-mix(in oklab, ${color} 45%, transparent)`,
        }}
      >
        {roof.score}
      </span>
    </motion.div>
  );
}

function InfoCard({
  card,
  active,
  variant = "desktop",
  index = 0,
}: {
  card: Card;
  active: boolean;
  variant?: "desktop" | "mobile";
  index?: number;
}) {
  const color = STATUS_COLOR[card.tone];
  const mobile = variant === "mobile";

  return (
    <motion.div
      initial={mobile ? { opacity: 0, y: 24 } : { opacity: 0, x: card.from.x, y: card.from.y }}
      animate={
        active
          ? { opacity: 1, x: 0, y: 0 }
          : mobile
            ? { opacity: 0, y: 24 }
            : { opacity: 0, x: card.from.x, y: card.from.y }
      }
      transition={{
        duration: 0.6,
        delay: active ? (mobile ? 0.6 + index * 0.15 : card.delay) : 0,
        ease: "easeOut",
      }}
      className={
        mobile
          ? "w-[70vw] max-w-[250px] min-w-[220px] shrink-0 snap-center"
          : `pointer-events-none absolute z-20 hidden w-[268px] lg:block ${card.pos}`
      }
    >
      <div
        className="rounded-2xl border px-4 py-3.5 backdrop-blur-2xl sm:px-5 sm:py-4"
        style={{
          animation: mobile ? undefined : "float-slow 7s ease-in-out infinite",
          background:
            "linear-gradient(160deg, oklch(0.22 0.045 268 / 0.96), oklch(0.15 0.04 272 / 0.97))",
          boxShadow: `0 0 50px -10px ${color}, 0 30px 60px -30px oklch(0 0 0 / 90%), inset 0 1px 0 0 oklch(1 0 0 / 12%)`,
          borderColor: `color-mix(in oklab, ${color} 55%, transparent)`,
        }}
      >
        <dl className="space-y-1.5 sm:space-y-2">
          {card.rows.map(([k, v]) => (
            <div key={k}>
              <dt className="font-mono text-[9px] tracking-[0.16em] text-foreground/55 uppercase">
                {k}
              </dt>
              <dd className="font-display text-[12px] leading-snug font-semibold" style={{ color }}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </motion.div>
  );
}
