import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/solar/Navbar";
import { ContactPage } from "@/components/solar/ContactPage";
import { Footer } from "@/components/solar/Footer";

export const Route = createFileRoute("/contact")({
  component: Contact,
  head: () => ({
    title: "Contact SolarXAI — Get Expert Solar Support",
    meta: [
      {
        name: "description",
        content:
          "Have questions about your solar potential? Contact SolarXAI for help with property reports and installer matching.",
      },
      { property: "og:title", content: "Contact SolarXAI — Get Expert Solar Support" },
      {
        property: "og:description",
        content:
          "We're here to help you navigate your journey to clean energy. Reach out to our solar specialists.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Contact() {
  return (
    <main className="bg-navy-dark min-h-screen">
      <Navbar />
      <ContactPage />
      <Footer />
    </main>
  );
}
