import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE } from "../../config.js";
import { clearToken } from "../../lib/auth.js";
import { formatLeadGeneratedAt } from "../../lib/formatDate.js";
import { buildLeadMarkerIcon } from "../../lib/mapMarkers.js";
import FullPageLoader from "../../components/layout/FullPageLoader.jsx";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(26);
  const [creditsUsedToday, setCreditsUsedToday] = useState(0);
  const [activePackage, setActivePackage] = useState("Growth");
  const [leads, setLeads] = useState([]);
  const [territorySummary, setTerritorySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [googleMapsKey, setGoogleMapsKey] = useState("");
  const [mapsLoaded, setMapsLoaded] = useState(false);

  const dashboardMapRef = useRef(null);
  const dashboardMapInstanceRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [welcomeMsg, setWelcomeMsg] = useState("");

  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      setWelcomeMsg(
        "Welcome! You have 5 free lead credits. Each lead unlock uses 1 credit.",
      );
      searchParams.delete("welcome");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const token = localStorage.getItem("solar_token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch User Me details
        const meResponse = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!meResponse.ok) throw new Error("Failed to fetch profile");
        const meData = await meResponse.json();
        setUser(meData.user);
        setCredits(meData.credits);
        setCreditsUsedToday(Number(meData.creditsUsedToday) || 0);
        setActivePackage(meData.activePackage || "Growth");

        // Fetch User Leads
        const leadsResponse = await fetch(`${API_BASE}/api/leads`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (leadsResponse.ok) {
          const leadsData = await leadsResponse.json();
          setLeads(leadsData);
        }

        const analyticsResponse = await fetch(`${API_BASE}/api/team/territory-analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
          setTerritorySummary(analyticsData.summary || null);
        }

        const { resolveGoogleMapsApiKey } = await import("../../lib/mapsKey.js");
        const mapsKey = await resolveGoogleMapsApiKey();
        if (mapsKey && !mapsKey.startsWith("AizaSyCBA9")) {
          setGoogleMapsKey(mapsKey);
          loadGoogleMapsScript(mapsKey);
        }
      } catch (error) {
        console.error(error);
        // If token is invalid, redirect to login
        clearToken();
        navigate("/login", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const loadGoogleMapsScript = (apiKey) => {
    if (typeof window.google?.maps?.Map === "function") {
      setMapsLoaded(true);
      return;
    }
    const scriptId = "google-maps-script";
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,drawing,geometry&v=weekly&loading=async`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const ready = () => {
      if (typeof window.google?.maps?.Map === "function") setMapsLoaded(true);
      else setTimeout(ready, 100);
    };
    script.addEventListener("load", ready, { once: true });
    ready();
  };

  useEffect(() => {
    if (
      mapsLoaded &&
      googleMapsKey &&
      dashboardMapRef.current &&
      !dashboardMapInstanceRef.current &&
      leads.length > 0
    ) {
      try {
        const leadsWithCoords = leads.filter((l) => l.latitude && l.longitude);
        const center =
          leadsWithCoords.length > 0
            ? {
                lat: parseFloat(leadsWithCoords[0].latitude),
                lng: parseFloat(leadsWithCoords[0].longitude),
              }
            : { lat: 34.0736, lng: -118.4004 };

        const map = new window.google.maps.Map(dashboardMapRef.current, {
          center,
          zoom: 16,
          mapTypeId: "satellite",
          tilt: 0,
          disableDefaultUI: true,
          gestureHandling: "none",
        });

        leadsWithCoords.forEach((lead) => {
          new window.google.maps.Marker({
            position: {
              lat: parseFloat(lead.latitude),
              lng: parseFloat(lead.longitude),
            },
            map,
            title: lead.owner_name || "Saved Lead",
            icon: buildLeadMarkerIcon(window.google),
          });
        });

        dashboardMapInstanceRef.current = map;
      } catch (err) {
        console.error("Dashboard map init error:", err);
      }
    }
  }, [mapsLoaded, googleMapsKey, leads]);

  if (loading) {
    return <FullPageLoader />;
  }

  // Calculate some overview stats
  const totalLeadsPurchased = leads.length;

  return (
    <>
      {welcomeMsg && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
          {welcomeMsg}
        </div>
      )}
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-stack-lg">
        <div>
          <h2 className="font-headline-lg text-2xl md:text-headline-lg text-primary font-semibold">
            Overview
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Welcome back, {user?.name || "Installer"}. Your solar pipeline is
            growing.
          </p>
        </div>
        <div className="flex gap-stack-sm text-xs">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-elevated border border-glass-stroke rounded-lg text-on-surface hover:bg-white/5 transition-all font-button">
            <span className="material-symbols-outlined text-[16px]">
              filter_list
            </span>
            Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-elevated border border-glass-stroke rounded-lg text-on-surface hover:bg-white/5 transition-all font-button">
            <span className="material-symbols-outlined text-[16px]">
              calendar_today
            </span>
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Summary Cards Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-stack-md mb-stack-lg text-xs">
        <div className="glass-card p-6 rounded-xl flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <p className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
              Purchased Leads
            </p>
            <span className="material-symbols-outlined text-primary opacity-80">
              shopping_cart
            </span>
          </div>
          <p className="font-headline-md text-2xl md:text-headline-md font-semibold text-primary font-mono tabular-nums">
            {totalLeadsPurchased}
          </p>
        </div>

        <div className="glass-card p-6 rounded-xl flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <p className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
              Lead credits
            </p>
            <span className="material-symbols-outlined text-secondary opacity-80">
              hourglass_empty
            </span>
          </div>
          <div className="flex items-end gap-2">
            <p className="font-headline-md text-2xl md:text-headline-md font-semibold text-secondary font-mono tabular-nums">
              {credits}
            </p>
            <p className="font-label-mono text-[9px] text-slate-300 pb-1">
              Lead credits left
            </p>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <p className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
              Used Today
            </p>
            <span className="material-symbols-outlined text-primary opacity-80">
              today
            </span>
          </div>
          <div>
            <p className="font-headline-md text-2xl md:text-headline-md font-semibold text-primary font-mono tabular-nums">
              {creditsUsedToday}
            </p>
            <p className="font-label-mono text-[9px] text-slate-300 mt-1">
              1 unlock = 1 credit
            </p>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <p className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
              Active Package
            </p>
            <span className="material-symbols-outlined text-primary opacity-50">
              workspace_premium
            </span>
          </div>
          <p className="font-headline-md text-2xl md:text-headline-md font-semibold text-primary">
            {activePackage}
          </p>
        </div>

        <div className="glass-card p-6 rounded-xl flex flex-col justify-between h-32 border-l-4 border-l-primary">
          <div className="flex justify-between items-start">
            <p className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
              Recent Activity
            </p>
            <span className="material-symbols-outlined text-primary opacity-50">
              bolt
            </span>
          </div>
          <p className="text-xs text-on-surface leading-snug">
            {totalLeadsPurchased > 0 ? (
              <>
                Last lead saved:{" "}
                <span className="font-bold text-primary">
                  {leads[0]?.address.split(",")[0]}
                </span>
              </>
            ) : (
              "No leads purchased yet. Run a map scan!"
            )}
          </p>
        </div>
      </div>

      {/* Main Content Area: Map & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-stack-lg mb-stack-lg">
        {/* Map Preview Card */}
        <div className="lg:col-span-2 glass-card rounded-xl overflow-hidden relative group min-h-[350px] flex flex-col justify-between">
          {mapsLoaded && googleMapsKey ? (
            <div ref={dashboardMapRef} className="absolute inset-0 z-0" />
          ) : (
            <div className="absolute inset-0 z-0">
              <div
                className="w-full h-full bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
                style={{
                  backgroundImage:
                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC6SxotVK31H5sRJLQQky2ZiNzqNsCQ8OzLUtGevw4L_ezbHqgVDRuVAZiZZiCALSqOBd5QAicshgQpfeGrwp3Xhx_23Z6om0mGBKXqyO9-KjD8moECGzkcF1LbOLf-FjTa5sSeMW7gMHzko6OO_5vK2VNrFobFhv8rYOlSFQBwasKYlGNxHaCyrkPxSzhoK-pLpLb-41NLv8tww1PFYKnGCMjd6RpnA9gejmTa9i_VA2vYgSpbzBn7')",
                }}
              />
              {/* Overlay Fallback Lead Markers */}
              {leads.slice(0, 5).map((lead, idx) => {
                const topOffset = 25 + ((idx * 14) % 55);
                const leftOffset = 20 + ((idx * 19) % 65);
                return (
                  <div
                    key={lead.id}
                    style={{ top: `${topOffset}%`, left: `${leftOffset}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center group cursor-pointer"
                  >
                    <div className="absolute inset-0 rounded-full border border-primary scale-150 animate-ping border-secondary" />
                    <span
                      className="material-symbols-outlined text-[24px] text-secondary drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      location_on
                    </span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-surface-elevated/90 text-white border border-glass-stroke text-[9px] font-bold py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                      {lead.owner_name || "Lead"} • {lead.lead_score}/100
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-elevated via-transparent to-transparent"></div>

          <div className="relative z-10 p-6 flex justify-between items-start">
            <div className="bg-surface-elevated/80 backdrop-blur-md px-4 py-2 rounded-lg border border-glass-stroke">
              <h3 className="font-button text-xs text-on-surface font-semibold">
                Live Heatmap
              </h3>
              <p className="text-[9px] font-label-mono text-primary">
                SCANNING CALIFORNIA SECTORS
              </p>
            </div>
            <Link
              to="/map"
              className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg active:scale-90 transition-transform"
            >
              <span className="material-symbols-outlined text-[20px]">
                fullscreen
              </span>
            </Link>
          </div>

          <div className="relative z-10 p-6 flex gap-4">
            <div className="glass-card bg-surface-elevated/90 px-4 py-3 rounded-lg border border-glass-stroke flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
              <div>
                <p className="font-label-mono text-[9px] text-on-surface-variant leading-none mb-1">
                  REAL-TIME FEED
                </p>
                <p className="text-xs text-on-surface">
                  Satellite overlay active. Open Map to scan.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="flex flex-col gap-stack-md">
          <h3 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-[0.2em] px-2">
            Quick Actions
          </h3>

          <Link
            to="/map"
            className="flex items-center gap-4 p-4 glass-card rounded-xl text-left hover:translate-x-1 transition-all active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[24px]">
                travel_explore
              </span>
            </div>
            <div>
              <p className="font-button text-sm text-on-surface font-bold">
                Search New Area
              </p>
              <p className="text-xs text-on-surface-variant">
                Analyze competitor density
              </p>
            </div>
          </Link>

          <Link
            to="/billing#plans"
            className="flex items-center gap-4 p-4 glass-card rounded-xl text-left hover:translate-x-1 transition-all active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[24px]">
                trending_up
              </span>
            </div>
            <div>
              <p className="font-button text-sm text-on-surface font-bold">
                Upgrade Plan
              </p>
              <p className="text-xs text-on-surface-variant">
                Subscribe to a monthly plan
              </p>
            </div>
          </Link>

          <div className="flex-1 bg-primary/5 rounded-xl border border-primary/20 border-dashed p-6 flex flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-primary mb-3 text-[28px] opacity-40">
              auto_awesome
            </span>
            <p className="font-button text-sm text-on-surface mb-1 font-semibold">
              Territory Insights
            </p>
            <p className="text-xs text-on-surface-variant max-w-[200px]">
              {territorySummary?.totalTerritories > 0 ? (
                <>
                  {territorySummary.totalTerritories} active ZIP{territorySummary.totalTerritories !== 1 ? "s" : ""} ·{" "}
                  {territorySummary.overallClosingRate || 0}% overall close rate
                </>
              ) : (
                "Scan properties on the map to build territory conversion metrics."
              )}
            </p>
            <Link
              to="/analysis"
              className="text-primary font-label-mono text-[10px] mt-4 hover:underline"
            >
              View Insight Report
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Leads Table */}
      <section className="glass-card rounded-xl overflow-hidden mb-stack-lg">
        <div className="px-6 py-5 border-b border-glass-stroke flex justify-between items-center">
          <h3 className="font-headline-md text-lg md:text-headline-md font-semibold text-on-surface">
            Recent Leads
          </h3>
          <Link
            to="/my-leads"
            className="text-primary font-label-mono text-[10px] flex items-center gap-1 hover:gap-2 transition-all"
          >
            VIEW ALL LEADS{" "}
            <span className="material-symbols-outlined text-[14px]">
              arrow_forward
            </span>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-white/5">
                <th className="px-6 py-4 text-left font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Lead Name
                </th>
                <th className="px-6 py-4 text-left font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Property Address
                </th>
                <th className="px-6 py-4 text-left font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Lead Score
                </th>
                <th className="px-6 py-4 text-left font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Phone Contact
                </th>
                <th className="px-6 py-4 text-left font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Generated
                </th>
                <th className="px-6 py-4 text-left font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Status
                </th>
                <th className="px-6 py-4 text-right font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-stroke text-xs">
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-white/5 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-primary/20 text-primary flex items-center justify-center font-bold">
                        {lead.owner_name
                          ? lead.owner_name.substring(0, 2).toUpperCase()
                          : "LD"}
                      </div>
                      <p className="font-button text-sm text-on-surface font-semibold">
                        {lead.owner_name || "N/A"}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">
                    {lead.address}
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-white">
                    {lead.lead_score}/100
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">
                    {lead.phone || "N/A"}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant font-mono text-[10px] whitespace-nowrap">
                    {formatLeadGeneratedAt(lead.created_at) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold uppercase text-[9px]">
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/lead/${lead.id}`}
                      className="text-primary hover:underline font-bold"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td
                    colSpan="7"
                    className="text-center py-8 text-on-surface-variant"
                  >
                    No purchased leads in your pipeline yet. Start scanning on
                    the map!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
