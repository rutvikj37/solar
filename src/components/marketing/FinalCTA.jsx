import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Satellite as SatIcon } from 'lucide-react';
import earth from '@/components/marketing/assets/earth.png';
import satellite from '@/components/marketing/assets/satellite.png';
import { Starfield } from './Starfield';
import { API_BASE } from '../../config.js';
import { BRAND_DISPLAY, BRAND_NAME } from '@/config/brand.js';

const FIELDS = [
  { name: 'name', label: 'Name', type: 'text', placeholder: 'Michael Johnson' },
  { name: 'company', label: 'Company', type: 'text', placeholder: 'Desert Solar Co.' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'you@company.com' },
  { name: 'phone', label: 'Phone', type: 'tel', placeholder: '(602) 555-0187' },
  { name: 'country', label: 'Country', type: 'text', placeholder: 'United States' }
];

export function FinalCTA() {
  const [intent, setIntent] = useState('demo');
  const [submitting, setSubmitting] = useState(false);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const px = useSpring(mx, { stiffness: 55, damping: 20 });
  const py = useSpring(my, { stiffness: 55, damping: 20 });
  const earthX = useTransform(px, (v) => v * 30);
  const earthY = useTransform(py, (v) => v * 22);
  const satX = useTransform(px, (v) => v * -70);
  const satY = useTransform(py, (v) => v * -50);

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const selectedIntent = data.intent === 'partner' ? 'partner' : intent || 'demo';
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/marketing/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          company: data.company,
          email: data.email,
          phone: data.phone,
          country: data.country,
          message: data.message || '',
          intent: selectedIntent
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Submission failed');
      toast.success(selectedIntent === 'demo' ? 'Demo request received.' : 'Partner application received.', {
        description: 'Our team will reach out within one business day.'
      });
      form.reset();
    } catch (err) {
      toast.error(err.message || 'Could not send inquiry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="contact"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      className="relative flex min-h-screen items-center overflow-hidden bg-deep py-28"
    >
      <Starfield count={200} seed={91} />

      <motion.div
        style={{ x: earthX, y: earthY }}
        className="pointer-events-none absolute -bottom-[45vmin] left-1/2 w-[110vmin] -translate-x-1/2"
      >
        <motion.img
          src={earth}
          alt=""
          aria-hidden
          loading="lazy"
          width={1024}
          height={1024}
          className="w-full opacity-70"
          animate={{ rotate: 360 }}
          transition={{ duration: 260, ease: 'linear', repeat: Infinity }}
        />
      </motion.div>
      <motion.div
        style={{ x: satX, y: satY }}
        className="pointer-events-none absolute top-[12%] right-[6%] hidden w-[22vmin] lg:block"
      >
        <motion.img
          src={satellite}
          alt=""
          aria-hidden
          loading="lazy"
          width={1024}
          height={1024}
          className="w-full"
          animate={{ rotate: [-8, 8, -8], y: [0, -20, 0] }}
          transition={{ duration: 16, ease: 'easeInOut', repeat: Infinity }}
        />
      </motion.div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 sm:gap-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary-glow uppercase">Begin the descent</p>
          <h2 className="mt-4 text-[2rem] font-semibold text-balance sm:text-5xl lg:text-6xl">
            <span className="text-gradient">See your territory from orbit.</span>
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            Tell us where you sell. We&apos;ll return a live scored map of your market within 48 hours.
          </p>
          <div className="mt-10 flex items-center gap-3 text-xs text-muted-foreground">
            <SatIcon className="size-4 text-primary-glow" />
            Trusted by installers across 34 states
          </div>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          onSubmit={onSubmit}
          className="glass-panel rounded-3xl p-5 sm:p-9"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.name} className={f.name === 'country' ? 'sm:col-span-2' : ''}>
                <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{f.label}</span>
                <input
                  required
                  name={f.name}
                  type={f.type}
                  placeholder={f.placeholder}
                  className="mt-2 w-full rounded-xl border border-input bg-glass px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/40"
                />
              </label>
            ))}
            <label className="sm:col-span-2">
              <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Message</span>
              <textarea
                name="message"
                rows={4}
                placeholder="Tell us about your markets and monthly install volume."
                className="mt-2 w-full resize-none rounded-xl border border-input bg-glass px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </label>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <button
              type="submit"
              name="intent"
              value="demo"
              disabled={submitting}
              onClick={() => setIntent('demo')}
              className="glow-ring inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03] disabled:opacity-60"
              style={{ background: 'var(--gradient-primary)' }}
            >
              {submitting ? 'Sending…' : 'Book Demo'} <ArrowRight className="size-4" />
            </button>
            <button
              type="submit"
              name="intent"
              value="partner"
              disabled={submitting}
              onClick={() => setIntent('partner')}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-glass-border bg-glass px-7 py-3.5 text-sm font-semibold transition-colors hover:bg-glass-border disabled:opacity-60"
            >
              Become a Partner
            </button>
          </div>
        </motion.form>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="relative border-t border-border bg-deep">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-5 py-14 sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl border border-glass-border bg-glass">
              <SatIcon className="size-4 text-primary-glow" />
            </span>
            <span className="font-display text-sm font-semibold">
              {BRAND_NAME}<span className="text-primary-glow">.com</span>
            </span>
          </div>
          <p className="mt-5 max-w-xs text-sm text-muted-foreground">
            Orbital solar intelligence for residential installers.
          </p>
        </div>
        {[
          { h: 'Platform', items: ['Roof Analysis', 'Opportunity Score', 'Territory Maps', 'API'] },
          { h: 'Company', items: ['About', 'Careers', 'Press', 'Contact'] },
          { h: 'Legal', items: ['Privacy', 'Terms', 'Data Ethics', 'Security'] }
        ].map((col) => (
          <div key={col.h}>
            <div className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">{col.h}</div>
            <ul className="mt-5 space-y-3 text-sm">
              {col.items.map((it) => (
                <li key={it}>
                  <a href="#contact" className="text-muted-foreground transition-colors hover:text-foreground">
                    {it}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} {BRAND_DISPLAY} Solar Intelligence. All rights reserved.</span>
          <span className="font-mono">33.4484° N · 112.0740° W</span>
        </div>
      </div>
    </footer>
  );
}
