import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform
} from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import earth from '@/marketing/assets/earth.png';
import neighborhood from '@/marketing/assets/neighborhood.jpg';
import neighborhoodAerial from '@/marketing/assets/neighborhood-aerial.jpg';
import { Starfield } from './Starfield';

/** Exclusive scroll windows — only one headline is active at a time. */
const STEP_HEADLINES = [
  {
    stage: 'Space',
    title: 'It Starts From Space',
    subtitle: 'AI-powered satellites search for solar opportunities.',
    from: 0,
    to: 0.17
  },
  {
    stage: 'Earth',
    title: 'Scanning Millions of Homes',
    subtitle: 'Every neighborhood. Every rooftop. Every opportunity.',
    from: 0.17,
    to: 0.33
  },
  {
    stage: 'United States',
    title: 'Finding the Right Market',
    subtitle: 'AI focuses on the cities with the highest potential.',
    from: 0.33,
    to: 0.5
  },
  {
    stage: 'Neighborhood',
    title: 'Zooming Into Your Next Customers',
    subtitle: 'Discover the neighborhoods ready for solar.',
    from: 0.5,
    to: 0.66
  },
  {
    stage: 'Multiple Roofs',
    title: 'Every Roof Is Analyzed',
    subtitle: 'AI scans multiple homes in seconds.',
    from: 0.66,
    to: 0.82
  },
  {
    stage: 'AI Scan + Floating Cards',
    title: 'The Best Opportunities Rise to the Top',
    subtitle: 'Qualified homes are identified instantly with actionable insights.',
    from: 0.82,
    to: 1.01
  }
];

function stepIndexForProgress(p) {
  const v = Math.min(1, Math.max(0, p));
  for (let i = 0; i < STEP_HEADLINES.length; i++) {
    const step = STEP_HEADLINES[i];
    if (v >= step.from && v < step.to) return i;
  }
  return STEP_HEADLINES.length - 1;
}

function readJourneyProgress(el) {
  if (!el) return 0;
  const total = el.offsetHeight - window.innerHeight;
  if (total <= 0) return 0;
  const scrolled = -el.getBoundingClientRect().top;
  return Math.min(1, Math.max(0, scrolled / total));
}

function StepHeadlines({ sectionRef }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = stepIndexForProgress(readJourneyProgress(sectionRef.current));
        setActive((prev) => (prev === next ? prev : next));
      });
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [sectionRef]);

  const step = STEP_HEADLINES[active];

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-start pt-[16vh] text-center sm:pt-[14vh]">
      <div className="relative w-full max-w-3xl px-5 sm:px-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.stage}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            <span className="mb-3 inline-block font-mono text-[10px] font-medium uppercase tracking-[0.3em] text-primary-glow">
              {step.stage}
            </span>
            <h2 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-balance text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
              {step.title}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-balance text-muted-foreground sm:mt-4 sm:text-base md:text-lg">
              {step.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Journey() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end']
  });

  const earthScale = useTransform(scrollYProgress, [0, 0.42], [1, 9]);
  const earthOpacity = useTransform(scrollYProgress, [0, 0.26, 0.4], [1, 1, 0]);
  const earthBlur = useTransform(scrollYProgress, [0.24, 0.4], [0, 14]);
  const earthFilter = useTransform(earthBlur, (v) => `blur(${v}px)`);

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
          style={{ scale: earthScale, opacity: earthOpacity, filter: earthFilter }}
          className="absolute inset-0 flex items-center justify-center will-change-transform"
        >
          <img
            src={earth}
            alt="Earth from orbit during descent"
            decoding="async"
            fetchPriority="high"
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
            decoding="async"
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
            decoding="async"
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

        <StepHeadlines sectionRef={ref} />
      </div>
    </div>
  );
}
