import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, Satellite, X } from 'lucide-react';
import { BRAND_NAME } from '@/config/brand.js';

const LINKS = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#contact', label: 'Contact Us' }
];

function primaryPath() {
  return localStorage.getItem('solar_token') ? '/map' : '/register';
}

/** Scroll to the start of tall sticky sections (native hash scroll can leave you mid-section). */
function scrollToHash(hash, { behavior = 'smooth' } = {}) {
  const id = hash.replace(/^#/, '');
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top, behavior });
  if (history.replaceState) {
    history.replaceState(null, '', `#${id}`);
  } else {
    window.location.hash = id;
  }
}

function onHashNav(e, href) {
  if (!href.startsWith('#')) return;
  e.preventDefault();
  scrollToHash(href);
}

export function Nav() {
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 200], [0, 1]);
  const [open, setOpen] = useState(false);
  const trialTo = primaryPath();

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <motion.div
        style={{ opacity: open ? 1 : bg }}
        className="absolute inset-0 border-b border-border bg-background/80 backdrop-blur-xl"
      />
      <nav className="relative mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-6 sm:py-5 md:flex md:justify-between">
        <a
          href="#top"
          className="flex min-w-0 items-center gap-2.5"
          onClick={(e) => {
            setOpen(false);
            onHashNav(e, '#top');
          }}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-glass-border bg-glass">
            <Satellite className="size-4 text-primary-glow" />
          </span>
          <span className="truncate font-display text-sm font-semibold tracking-tight">
            {BRAND_NAME}<span className="text-primary-glow">.com</span>
          </span>
        </a>

        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={(e) => onHashNav(e, l.href)}
              className="transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            to={trialTo}
            className="group glow-ring inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            style={{ background: 'var(--gradient-primary)' }}
          >
            Get 5 Free Lead Credits
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:hidden">
          <Link
            to={trialTo}
            className="glow-ring inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap text-primary-foreground"
            style={{ background: 'var(--gradient-primary)' }}
          >
            Free Trial
            <ArrowRight className="size-3.5" />
          </Link>
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-xl border border-glass-border bg-glass"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
            className="relative border-b border-border bg-background/95 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 pt-2 pb-5">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={(e) => {
                    setOpen(false);
                    onHashNav(e, l.href);
                  }}
                  className="rounded-xl px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground"
                >
                  {l.label}
                </a>
              ))}
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="mt-1 rounded-xl border border-glass-border bg-glass px-3 py-3 text-center text-sm font-semibold"
              >
                Log in
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
