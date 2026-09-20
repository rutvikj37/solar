import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { BRAND_MONOGRAM } from "../../config/brand.js";
import { scrollToLeadForm } from "../../lib/scrollToLeadForm.js";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-navy">
      <div className="mx-auto max-w-[1500px] px-6 lg:px-12">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="relative size-8 flex items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 transition-transform group-hover:scale-110">
              <span className="text-white font-black text-xs tracking-tight">{BRAND_MONOGRAM}</span>
              <div className="absolute inset-0 rounded-lg bg-cyan-400 opacity-20 blur-md group-hover:opacity-40 transition-opacity" />
            </div>
            <span className="text-xl font-extrabold tracking-tighter text-white">
              SpaceTo<span className="text-cyan-400">Roof</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-10">
            {[
              { label: "How It Works", id: "how-it-works" },
              { label: "About Us", id: "about" },
              { label: "FAQ", id: "faq" },
              { label: "Contact Us", id: "contact" }
            ].map((item) => (
              <a
                key={item.label}
                href={item.id === "about" || item.id === "contact" ? `/${item.id}` : `/#${item.id}`}
                className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70 transition-colors hover:text-cyan-400"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={scrollToLeadForm}
              className="group flex items-center gap-3 rounded-full bg-cyan-500 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-[#070B19] transition-all hover:bg-cyan-400 hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              Get My Free Report
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>
            <Link
              to="/for-installers"
              className="hidden lg:inline-flex text-[10px] font-bold uppercase tracking-[0.18em] text-white/70 hover:text-cyan-400"
            >
              For Solar Installers
            </Link>
            <Link
              to="/login"
              className="hidden xl:inline-flex text-[10px] font-bold uppercase tracking-[0.18em] text-white/70 hover:text-cyan-400"
            >
              Log In
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
