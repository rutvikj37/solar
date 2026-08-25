import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/homeowner/Navbar';
import { Footer } from '@/components/homeowner/Footer';
import { HomeownerShell } from '@/components/homeowner/HomeownerShell';
import { BRAND_EMAIL, BRAND_NAME, BRAND_URL } from '@/config/brand.js';

type LegalPageShellProps = {
  title: string;
  subtitle: string;
  updated: string;
  children: ReactNode;
};

export function LegalPageShell({ title, subtitle, updated, children }: LegalPageShellProps) {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <HomeownerShell stickyCta={false}>
      <main className="bg-navy-dark min-h-screen">
        <Navbar />
        <div className="pt-28 pb-16 px-6 lg:px-12">
          <div className="mx-auto max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400/80">{subtitle}</p>
            <h1 className="mt-3 text-3xl md:text-4xl font-black text-white tracking-tight">{title}</h1>
            <p className="mt-3 text-sm text-white/45">Last updated: {updated}</p>

            <div className="mt-10 space-y-8 text-sm leading-relaxed text-white/70 legal-prose">
              {children}
            </div>

            <div className="mt-12 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 text-xs text-amber-100/90 leading-relaxed">
              <p className="font-bold uppercase tracking-wider text-amber-300/90 mb-2">Important legal notice</p>
              <p>
                This document is provided for general information only and does not constitute legal, tax,
                energy, or financial advice. {BRAND_NAME} is a technology platform — not a solar installer,
                utility, lender, or government agency. Consult qualified professionals before making purchase
                or contract decisions. For questions contact{' '}
                <a href={`mailto:${BRAND_EMAIL}`} className="text-cyan-400 hover:underline">
                  {BRAND_EMAIL}
                </a>
                .
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-4 text-xs">
              <Link to="/privacy" className="text-cyan-400 hover:underline">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-cyan-400 hover:underline">
                Terms of Service
              </Link>
              <Link to="/" className="text-white/50 hover:text-cyan-400">
                Homeowner site
              </Link>
              <Link to="/for-installers" className="text-white/50 hover:text-cyan-400">
                Installer site
              </Link>
              <a href={BRAND_URL} className="text-white/50 hover:text-cyan-400">
                {BRAND_URL.replace('https://', '')}
              </a>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    </HomeownerShell>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="text-lg font-black text-white mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
