import { ArrowRight } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/5 bg-navy-dark pt-20 pb-12 overflow-hidden">
      {/* Subtle top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
      
      <div className="mx-auto max-w-[1500px] px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-16">
          {/* Left: Logo & Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="flex items-center gap-2 group cursor-pointer w-fit">
              <div className="relative size-8 flex items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 transition-transform group-hover:scale-110">
                <span className="text-white font-black text-lg">S</span>
                <div className="absolute inset-0 rounded-lg bg-cyan-400 opacity-20 blur-md group-hover:opacity-40 transition-opacity" />
              </div>
              <span className="text-xl font-extrabold tracking-tighter text-white">
                Solar<span className="text-cyan-400">X</span>AI
              </span>
            </div>
            
            <p className="text-sm font-medium text-white/80 leading-relaxed max-w-xs">
              "AI-powered solar intelligence for smarter energy decisions."
            </p>
            
            <p className="text-[13px] leading-relaxed text-white/40 max-w-xs">
              Analyze your home from above, discover your solar potential, and connect with qualified solar installers.
            </p>
          </div>

          {/* Center: Quick Links */}
          <div className="space-y-6">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">
              Quick Links
            </h4>
            <nav className="flex flex-col gap-4">
              {[
                { label: "Home", href: "/" },
                { label: "How It Works", href: "/#how-it-works" },
                { label: "Solar Report", href: "/#lead-form" },
                { label: "FAQs", href: "/#faq" }
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-[13px] font-medium text-white/60 transition-colors hover:text-cyan-400 w-fit"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Right: Company */}
          <div className="space-y-6">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">
              Company
            </h4>
            <nav className="flex flex-col gap-4">
              {[
                { label: "About SolarXAI", href: "/about" },
                { label: "Contact", href: "/contact" },
                { label: "For Solar Installers", href: "/for-installers" },
                { label: "Privacy Policy", href: "#" },
                { label: "Terms & Conditions", href: "#" }
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-[13px] font-medium text-white/60 transition-colors hover:text-cyan-400 w-fit"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* CTA Section */}
          <div className="space-y-6">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 invisible lg:visible">
              Action
            </h4>
            <a
              href="#lead-form"
              className="group inline-flex items-center gap-2 rounded-full bg-cyan-500 px-6 py-2.5 text-[12px] font-bold uppercase tracking-widest text-navy-dark transition-all hover:bg-cyan-400 hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              Check Your Solar Potential
              <ArrowRight className="size-4" />
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/5 space-y-6">
          <p className="text-[11px] text-white/30 tracking-wide font-medium">
            © {currentYear} SolarXAI. All rights reserved.
          </p>
          
          <p className="text-[10px] leading-relaxed text-white/20 max-w-3xl italic">
            "SolarXAI provides property and solar estimates for informational purposes. Actual solar performance, savings, pricing and installation suitability may vary."
          </p>
        </div>
      </div>
    </footer>
  );
}