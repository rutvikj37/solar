import { createFileRoute } from "@tanstack/react-router";
import { SolarHero } from "@/components/solar/SolarHero";
import { HowItWorks } from "@/components/solar/HowItWorks";
import { FAQ } from "@/components/solar/FAQ";
import { LeadForm } from "@/components/solar/LeadForm/LeadForm";
import { Footer } from "@/components/solar/Footer";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    title: "SolarXAI — Stop Overpaying for Electricity",
    meta: [
      {
        name: "description",
        content:
          "Calculate your home's solar savings in seconds with AI-powered intelligence. Free, personalized, and no obligation.",
      },
      { property: "og:title", content: "SolarXAI — Stop Overpaying for Electricity" },
      {
        property: "og:description",
        content:
          "Find out how much you could save with solar on your home. Get a free AI-powered analysis of your solar potential.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  return (
    <main className="bg-navy-dark">
      <SolarHero />
      <HowItWorks />
      <FAQ />
      <LeadForm />
      <Footer />
    </main>
  );
}
