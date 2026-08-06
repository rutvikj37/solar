import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef } from "react";
import earth from "@/assets/earth.png";
import neighborhood from "@/assets/neighborhood.jpg";
import neighborhoodAerial from "@/assets/neighborhood-aerial.jpg";
import { Starfield } from "./Starfield";

const STEP_HEADLINES = [
  {
    stage: "Space",
    title: "It Starts From Space",
    subtitle: "AI-powered satellites search for solar opportunities.",
    range: [0, 0.06, 0.12, 0.20],
  },
  {
    stage: "Earth",
    title: "Scanning Millions of Homes",
    subtitle: "Every neighborhood. Every rooftop. Every opportunity.",
    range: [0.14, 0.22, 0.28, 0.36],
  },
  {
    stage: "United States",
    title: "Finding the Right Market",
    subtitle: "AI focuses on the cities with the highest potential.",
    range: [0.30, 0.38, 0.44, 0.50],
  },
  {
    stage: "Neighborhood",
    title: "Zooming Into Your Next Customers",
    subtitle: "Discover the neighborhoods ready for solar.",
    range: [0.46, 0.54, 0.60, 0.66],
  },
  {
    stage: "Multiple Roofs",
    title: "Every Roof Is Analyzed",
    subtitle: "AI scans multiple homes in seconds.",
    range: [0.60, 0.68, 0.74, 0.80],
  },
  {
    stage: "AI Scan + Floating Cards",
    title: "The Best Opportunities Rise to the Top",
    subtitle: "Qualified homes are identified instantly with actionable insights.",
    range: [0.74, 0.84, 0.95, 1],
  },
];

function StepHeadline({
  step,
  progress,
}: {
  step: (typeof STEP_HEADLINES)[number];
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(progress, step.range as number[], [0, 1, 1, 0]);
  const y = useTransform(progress, step.range as number[], [24, 0, 0, -24]);

  return (
    <motion.div
      style={{ opacity, y }}
      className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-start pt-[16vh] text-center sm:pt-[14vh]"
    >
      <div className="max-w-3xl px-5 sm:px-6">
        <span className="mb-3 inline-block font-mono text-[10px] font-medium uppercase tracking-[0.3em] text-primary-glow">
          {step.stage}
        </span>
        <h2 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-balance text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
          {step.title}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-balance text-muted-foreground sm:mt-4 sm:text-base md:text-lg">
          {step.subtitle}
        </p>
      </div>
    </motion.div>
  );
}


function StepHeadlines({ progress }: { progress: MotionValue<number> }) {
  return (
    <>
      {STEP_HEADLINES.map((step) => (
        <StepHeadline key={step.stage} step={step} progress={progress} />
      ))}
    </>
  );
}



export function Journey() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  // continuous camera zoom — each layer scales up and fades out as the next arrives
  const earthScale = useTransform(scrollYProgress, [0, 0.42], [1, 9]);
  const earthOpacity = useTransform(scrollYProgress, [0, 0.26, 0.4], [1, 1, 0]);
  const earthBlur = useTransform(scrollYProgress, [0.24, 0.4], [0, 14]);

  const hoodScale = useTransform(scrollYProgress, [0.26, 0.78], [1.02, 4.6]);
  const hoodOpacity = useTransform(scrollYProgress, [0.28, 0.4, 0.72, 0.82], [0, 1, 1, 0]);

  const blockScale = useTransform(scrollYProgress, [0.7, 1], [1.35, 1.04]);
  const blockOpacity = useTransform(scrollYProgress, [0.72, 0.84], [0, 1]);

  const vignette = useTransform(scrollYProgress, [0, 0.5, 1], [0.85, 0.55, 0.3]);
  const starOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  return (
    <div id="how-it-works" ref={ref} className="relative h-[520vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-deep">
        <motion.div style={{ opacity: starOpacity }} className="absolute inset-0">
          <Starfield count={200} seed={19} />
        </motion.div>

        <motion.div
          style={{
            scale: earthScale,
            opacity: earthOpacity,
            filter: useTransform(earthBlur, (v) => `blur(${v}px)`),
          }}
          className="absolute inset-0 flex items-center justify-center will-change-transform"
        >
          <img
            src={earth}
            alt="Earth from orbit during descent"
            loading="lazy"
            width={1024}
            height={1024}
            className="h-[85vmin] w-[85vmin] object-contain"
          />
        </motion.div>

        <motion.div
          style={{ scale: hoodScale, opacity: hoodOpacity }}
          className="absolute inset-0 will-change-transform"
        >
          <img
            src={neighborhood}
            alt="Aerial satellite view of an Arizona suburban neighborhood"
            loading="lazy"
            width={1536}
            height={1536}
            className="h-full w-full object-cover"
          />
        </motion.div>

        <motion.div
          style={{ scale: blockScale, opacity: blockOpacity }}
          className="absolute inset-0 will-change-transform"
        >
          <img
            src={neighborhoodAerial}
            alt="Angled aerial view of a premium suburban neighborhood block"
            loading="lazy"
            width={1920}
            height={1280}
            className="h-full w-full object-cover"
          />
        </motion.div>

        <motion.div
          style={{ opacity: vignette }}
          className="pointer-events-none absolute inset-0"
          aria-hidden
        >
          <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_50%,transparent,var(--deep))]" />
        </motion.div>

        <StepHeadlines progress={scrollYProgress} />
      </div>
    </div>
  );
}
