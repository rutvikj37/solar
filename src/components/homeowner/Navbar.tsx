import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { BRAND_MONOGRAM } from "../../config/brand.js";
import { scrollToLeadForm } from "../../lib/scrollToLeadForm.js";

export function Navbar() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 glass-navy transition-all duration-700 ease-out"
      style={{
        transform: isVisible ? "translateY(0)" : "translateY(-20px)",
        opacity: isVisible ? 1 : 0
      }}
    >
      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-12">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link to="/" className="flex min-w-0 items-center gap-2 group cursor-pointer">
            <div className="relative size-7 sm:size-8 shrink-0 flex items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 transition-transform group-hover:scale-110">
              <span className="text-white font-black text-[10px] sm:text-xs tracking-tight">{BRAND_MONOGRAM}</span>
              <div className="absolute inset-0 rounded-lg bg-cyan-400 opacity-20 blur-md group-hover:opacity-40 transition-opacity" />
            </div>
            <span className="truncate text-base sm:text-xl font-extrabold tracking-tighter text-white">
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
                className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50 transition-colors hover:text-cyan-400"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={scrollToLeadForm}
              className="group flex items-center gap-1.5 sm:gap-3 whitespace-nowrap rounded-full bg-cyan-500 px-3 py-2 sm:px-5 sm:py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider sm:tracking-widest text-navy-dark transition-all hover:bg-cyan-400 hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              <span className="sm:hidden">Free Report</span>
              <span className="hidden sm:inline">Get My Free Report</span>
              <ArrowRight className="size-3 sm:size-3.5 transition-transform group-hover:translate-x-1" />
            </button>
            <Link
              to="/for-installers"
              className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-[0.18em] text-white/70 hover:text-cyan-400"
            >
              For Solar Installers
            </Link>
            <Link
              to="/login"
              state={{ from: "/for-installers" }}
              className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-[0.18em] text-white/70 hover:text-cyan-400"
            >
              Log In
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
