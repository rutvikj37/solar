import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { BRAND_MONOGRAM, BRAND_NAME } from "../../config/brand.js";
import { scrollToLeadForm } from "../../lib/scrollToLeadForm.js";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/5 bg-navy-dark pt-20 pb-12 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />

      <div className="mx-auto max-w-[1500px] px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-16">
          <div className="lg:col-span-1 space-y-6">
            <Link to="/" className="flex items-center gap-2 group w-fit">
              <div className="relative size-8 flex items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 transition-transform group-hover:scale-110">
                <span className="text-white font-black text-xs tracking-tight">{BRAND_MONOGRAM}</span>
                <div className="absolute inset-0 rounded-lg bg-cyan-400 opacity-20 blur-md group-hover:opacity-40 transition-opacity" />
              </div>
              <span className="text-xl font-extrabold tracking-tighter text-white">
                SpaceTo<span className="text-cyan-400">Roof</span>
              </span>
            </Link>

            <p className="text-sm font-medium text-white/80 leading-relaxed max-w-xs">
              AI-powered solar intelligence for smarter energy decisions.
            </p>

            <p className="text-[13px] leading-relaxed text-white/40 max-w-xs">
              Analyze your home from above, discover your solar potential, and connect with qualified solar
              installers.
            </p>
          </div>

          <div className="space-y-6">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">Quick Links</h4>
            <nav className="flex flex-col gap-4">
              {[
                { label: "Home", href: "/" },
                { label: "How It Works", href: "/#how-it-works" },
                { label: "Solar Report", href: "/#lead-form" },
                { label: "FAQs", href: "/#faq" },
              ].map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  className="text-[13px] font-medium text-white/60 transition-colors hover:text-cyan-400 w-fit"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="space-y-6">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">Company</h4>
            <nav className="flex flex-col gap-4">
              {[
                { label: `About ${BRAND_NAME}`, to: "/about" },
                { label: "Contact", to: "/contact" },
                { label: "For Solar Installers", to: "/for-installers" },
                { label: "Privacy Policy", to: "/privacy" },
                { label: "Terms of Service", to: "/terms" },
              ].map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="text-[13px] font-medium text-white/60 transition-colors hover:text-cyan-400 w-fit"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="space-y-6">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 invisible lg:visible">
              Action
            </h4>
            <button
              type="button"
              onClick={scrollToLeadForm}
              className="group inline-flex items-center gap-2 rounded-full bg-cyan-500 px-6 py-2.5 text-[12px] font-bold uppercase tracking-widest text-[#070B19] transition-all hover:bg-cyan-400 hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              Check Your Solar Potential
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 space-y-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-white/30">
            <span>© {currentYear} {BRAND_NAME}. All rights reserved.</span>
            <Link to="/privacy" className="hover:text-cyan-400">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-cyan-400">
              Terms
            </Link>
          </div>

          <p className="text-[10px] leading-relaxed text-white/20 max-w-3xl italic">
            {BRAND_NAME} provides property and solar estimates for informational purposes only. Not legal, tax,
            or financial advice. Actual solar performance, savings, pricing, and installation suitability vary.
            See our Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </footer>
  );
}
