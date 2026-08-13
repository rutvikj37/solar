import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { Journey } from "@/components/site/Journey";
import { NeighborhoodScan } from "@/components/site/NeighborhoodScan";
import { Dashboard } from "@/components/site/Dashboard";
import { WhyUs } from "@/components/site/WhyUs";

import { Pricing } from "@/components/site/Pricing";
import { FinalCTA, Footer } from "@/components/site/FinalCTA";

const TITLE = "SolarX.live — AI Solar Intelligence for Residential Installers";
const DESC =
  "AI-powered property intelligence that helps residential solar companies discover qualified homes, analyze rooftops, and accelerate sales.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="relative">
      <Toaster theme="dark" position="top-center" />
      <Nav />
      <Hero />
      <Journey />
      <NeighborhoodScan />
      <Dashboard />
      <WhyUs />
      
      <Pricing />
      <FinalCTA />
      <Footer />
    </main>
  );
}
