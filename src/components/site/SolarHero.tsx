import { ArrowRight, Sun, Zap, Triangle, BrainCircuit, Satellite, ShieldCheck, ArrowDown } from "lucide-react";
import heroImage from "@/assets/solar-home-hero.jpg";

const navLinks = ["How It Works", "Solar Report", "About Us", "FAQ"];

const dataCards = [
  { icon: Sun, label: "Solar Potential", value: "92", suffix: "/100", note: "Excellent" },
  { icon: Sun, label: "Sun Exposure", value: "Excellent" },
  { icon: Triangle, label: "Roof Suitability", value: "High" },
  { icon: Zap, label: "Est. System Size", value: "9.4 kW" },
];

const trustItems = [
  { icon: BrainCircuit, lines: ["AI-powered", "Property Analysis"] },
  { icon: Satellite, lines: ["Satellite & Solar", "Intelligence"] },
  { icon: ShieldCheck, lines: ["Qualified Installer", "Matching"] },
];

export function SolarHero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-background">
      <img
        src={heroImage}
        alt="Suburban home with rooftop solar panels analyzed by AI"
        width={1600}
        height={1200}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/90 to-transparent" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6">
        <header className="flex items-center justify-between gap-6 py-6">
          <a href="/" className="flex items-center gap-2">
            <Sun className="size-7 text-brand" strokeWidth={2.2} />
            <span className="text-2xl font-extrabold tracking-tight">
              Solar<span className="text-brand">XAI</span>
            </span>
          </a>
          <nav className="hidden items-center gap-9 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm font-medium text-foreground/80 transition-colors hover:text-brand"
              >
                {link}
              </a>
            ))}
          </nav>
          <a
            href="#"
            className="hidden items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/25 transition-transform hover:scale-[1.02] sm:inline-flex"
          >
            Scan My Home Free <ArrowRight className="size-4" />
          </a>
        </header>

        <div className="grid flex-1 items-center gap-10 pb-24 pt-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand">
              <span className="size-2 rounded-full bg-brand" />
              AI Solar Intelligence
            </span>

            <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              See Your Home&rsquo;s
              <br />
              <span className="text-brand">Solar Potential.</span>
            </h1>

            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              SolarXAI uses satellite and property intelligence to analyze your roof,
              sunlight, and savings potential in seconds.
            </p>

            <a
              href="#"
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-brand px-8 py-4 text-base font-semibold text-brand-foreground shadow-xl shadow-brand/30 transition-transform hover:scale-[1.02]"
            >
              Scan My Home Free <ArrowRight className="size-5" />
            </a>
            <p className="mt-4 text-sm text-muted-foreground">Free report • No commitment</p>

            <div className="mt-10 flex flex-wrap items-center gap-8">
              <div>
                <p className="text-2xl font-bold text-brand">10,000+</p>
                <p className="text-sm text-muted-foreground">Homeowners Analyzed</p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div>
                <p className="text-sm font-semibold">★★★★★ Trustpilot</p>
                <p className="text-sm text-muted-foreground">4.9 out of 5</p>
              </div>
            </div>

            <div className="mt-10 hidden gap-6 rounded-2xl bg-card/70 p-5 backdrop-blur-sm sm:flex sm:flex-wrap">
              {trustItems.map(({ icon: Icon, lines }) => (
                <div key={lines[0]} className="flex items-center gap-3">
                  <Icon className="size-6 shrink-0 text-brand" />
                  <p className="text-sm leading-tight text-foreground/80">
                    {lines[0]}
                    <br />
                    {lines[1]}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex w-full flex-col gap-4 lg:w-72">
            {dataCards.map(({ icon: Icon, label, value, suffix, note }) => (
              <div
                key={label}
                className="flex items-center gap-4 rounded-xl bg-card/85 p-4 shadow-lg ring-1 ring-border/60 backdrop-blur-md"
              >
                <Icon className="size-7 shrink-0 text-brand" />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold leading-tight">
                    {value}
                    {suffix ? (
                      <span className="text-sm font-medium text-muted-foreground">{suffix}</span>
                    ) : null}
                  </p>
                  {note ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-brand" />
                      {note}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-3">
          <p className="text-sm text-foreground/70">
            Scroll to explore how SolarXAI analyzes your home
          </p>
          <span className="flex size-10 items-center justify-center rounded-full ring-1 ring-foreground/30">
            <ArrowDown className="size-4" />
          </span>
        </div>
      </div>
    </section>
  );
}
