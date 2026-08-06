import { motion, useMotionValue, useSpring, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ArrowRight, Handshake } from "lucide-react";
import earth from "@/assets/earth.png";
import satellite from "@/assets/satellite.png";
import { Starfield } from "./Starfield";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const px = useSpring(mx, { stiffness: 60, damping: 20 });
  const py = useSpring(my, { stiffness: 60, damping: 20 });

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const lift = useTransform(scrollYProgress, [0, 1], [0, -120]);

  const earthX = useTransform(px, (v) => v * 26);
  const earthY = useTransform(py, (v) => v * 20);
  const satX = useTransform(px, (v) => v * -60);
  const satY = useTransform(py, (v) => v * -44);

  return (
    <section
      id="top"
      ref={ref}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      className="relative flex min-h-screen items-center overflow-hidden"
      style={{ background: "var(--gradient-hero)" }}
    >
      <Starfield count={220} />
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-60" />

      <motion.div
        style={{ opacity: fade, y: lift }}
        className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-5 pt-28 pb-28 sm:gap-16 sm:px-6 lg:grid-cols-2 lg:pt-24 lg:pb-20"
      >
        <div>

          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-1.5 text-xs tracking-widest text-muted-foreground uppercase backdrop-blur-xl"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-primary-glow" />
            Orbital Solar Intelligence
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1 }}
            className="mt-6 text-[2.5rem] leading-[1.02] font-semibold text-balance sm:mt-7 sm:text-6xl lg:text-7xl"
          >
            <span className="text-gradient">Find Your Next Solar Customer</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25 }}
            className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:mt-7 sm:text-lg"
          >
            Discover homes, verify contact information, and book more appointments with AI.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4 }}
            className="mt-8 flex flex-col items-stretch gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
          >
            <a
              href="#contact"
              className="group glow-ring inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
              style={{ background: "var(--gradient-primary)" }}
            >
              Claim Your 7-Day Free Trial
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#partner"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-glass-border bg-glass px-7 py-3.5 text-sm font-semibold backdrop-blur-xl transition-colors hover:bg-glass-border"
            >
              <Handshake className="size-4 text-primary-glow" />
              Become a Partner
            </a>
          </motion.div>

          <div className="mt-12 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-8 sm:mt-14 sm:gap-6">
            {[
              ["128M+", "Rooftops indexed"],
              ["94%", "Qualification accuracy"],
              ["3.2x", "Faster prospecting"],
            ].map(([v, l]) => (
              <div key={l}>
                <div className="font-display text-2xl font-semibold text-primary-glow">{v}</div>
                <div className="mt-1 text-xs text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[420px] [perspective:1200px] lg:max-w-none">
          <motion.div
            style={{ x: earthX, y: earthY }}
            className="absolute inset-[8%] flex items-center justify-center"
          >
            <div
              className="absolute inset-0 rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in oklab, var(--primary) 45%, transparent), transparent 65%)",
              }}
            />
            <motion.img
              src={earth}
              alt="Planet Earth viewed from orbit"
              width={1024}
              height={1024}
              className="relative w-full drop-shadow-2xl"
              animate={{ rotate: 360 }}
              transition={{ duration: 220, ease: "linear", repeat: Infinity }}
            />
          </motion.div>

          <motion.div
            style={{ x: satX, y: satY }}
            className="absolute top-[2%] right-[-4%] w-[46%]"
          >
            <motion.img
              src={satellite}
              alt="AI observation satellite in orbit"
              width={1024}
              height={1024}
              className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
              animate={{ rotate: [-6, 6, -6], y: [0, -18, 0] }}
              transition={{ duration: 14, ease: "easeInOut", repeat: Infinity }}
            />
          </motion.div>

          {[0, 1.6, 3.2].map((d) => (
            <span
              key={d}
              className="absolute top-1/2 left-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/40"
              style={{ animation: `pulse-ring 4.8s ease-out ${d}s infinite` }}
            />
          ))}
        </div>
      </motion.div>

      <motion.div
        style={{ opacity: fade }}
        className="absolute bottom-6 left-1/2 w-full -translate-x-1/2 px-4 text-center text-[10px] tracking-[0.25em] text-muted-foreground uppercase sm:bottom-8 sm:text-[11px]"
      >
        SCROLL TO SEE HOW IT WORKS
      </motion.div>
    </section>
  );
}
