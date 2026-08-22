import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/solar/Navbar";
import { AboutPage } from "@/components/solar/AboutPage";
import { Footer } from "@/components/solar/Footer";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => ({
    title: "About SolarXAI — Smarter Solar Intelligence",
    meta: [
      {
        name: "description",
        content:
          "Learn how SolarXAI uses AI and satellite intelligence to help homeowners understand their solar potential.",
      },
      { property: "og:title", content: "About SolarXAI — Smarter Solar Intelligence" },
      {
        property: "og:description",
        content:
          "Discover our mission to make solar decisions simpler for homeowners everywhere.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function About() {
  return (
    <main className="bg-navy-dark min-h-screen">
      <Navbar />
      <AboutPage />
      <Footer />
    </main>
  );
}