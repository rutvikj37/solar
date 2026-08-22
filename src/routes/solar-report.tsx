import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SolarReport } from "@/components/solar/LeadForm/SolarReport";
import { getReportData } from "@/lib/report-store";
import { useEffect } from "react";

export const Route = createFileRoute("/solar-report")({
  component: ReportPage,
  head: () => ({
    title: "Your SolarXAI Property Report",
    meta: [
      {
        name: "description",
        content: "Personalized AI-powered solar analysis report for your property.",
      },
      { property: "og:title", content: "Your SolarXAI Property Report" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ReportPage() {
  const data = getReportData();
  const navigate = useNavigate();

  useEffect(() => {
    if (!data) {
      navigate({ to: "/" });
    }
  }, [data, navigate]);

  if (!data) return null;

  return <SolarReport data={data} />;
}
