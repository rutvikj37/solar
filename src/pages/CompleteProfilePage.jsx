import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../config.js";
import { authHeaders, fetchMe, getToken } from "../lib/auth.js";
import FullPageLoader from "../components/FullPageLoader.jsx";

const LEAD_VOLUME_OPTIONS = [
  "< 50 leads/mo",
  "50-200 leads/mo",
  "200-500 leads/mo",
  "500+ leads/mo",
];

const COMPANY_ROLE_OPTIONS = [
  "Owner / Founder",
  "Sales Manager",
  "Solar Acquisition Lead",
  "Sales Representative",
  "Marketing",
  "Operations",
  "Other",
];

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    company: "",
    leadVolume: "50-200 leads/mo",
    jobTitle: "Solar Acquisition Lead",
  });

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    fetchMe().then((data) => {
      if (!data?.user) {
        navigate("/login", { replace: true });
        return;
      }
      if (!data.needsOnboarding && data.user.company) {
        navigate("/dashboard", { replace: true });
        return;
      }
      setForm((prev) => ({
        ...prev,
        company: data.user.company || "",
        leadVolume: data.user.leadVolume || prev.leadVolume,
        jobTitle: data.user.jobTitle || prev.jobTitle,
      }));
      setChecking(false);
    });
  }, [navigate]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/onboarding`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          company: form.company,
          leadVolume: form.leadVolume,
          jobTitle: form.jobTitle,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save profile");
      }
      navigate("/dashboard?welcome=1", { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (checking) {
    return <FullPageLoader />;
  }

  return (
    <div className="bg-deep text-on-background min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-glow/10 blur-3xl rounded-full pointer-events-none" />

      <div className="w-full max-w-[460px] z-10">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-baseline gap-0 mb-2 select-none font-display"
          >
            <span className="text-on-surface font-semibold text-2xl tracking-tight">
              SollarX
            </span>
            <span className="text-primary-glow font-semibold text-2xl tracking-tight">
              .ai
            </span>
          </Link>
          <p className="text-xs text-on-surface-variant">
            One more step — tell us about your company so we can set up your
            pipeline.
          </p>
        </div>

        <div className="glass-card p-8 rounded-2xl border border-glass-stroke shadow-2xl bg-surface-elevated/40 backdrop-blur-xl">
          <h3 className="text-lg font-bold text-white mb-6">
            Complete your profile
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-on-surface-variant block font-medium">
                Company Name
              </label>
              <input
                type="text"
                required
                value={form.company}
                onChange={(e) => handleChange("company", e.target.value)}
                placeholder="EcoGen Installers Ltd"
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs placeholder:text-on-surface-variant/30 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-on-surface-variant block font-medium">
                Monthly Target Lead Volume
              </label>
              <select
                required
                value={form.leadVolume}
                onChange={(e) => handleChange("leadVolume", e.target.value)}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs"
              >
                {LEAD_VOLUME_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-on-surface-variant block font-medium">
                Your Role in Company
              </label>
              <select
                required
                value={form.jobTitle}
                onChange={(e) => handleChange("jobTitle", e.target.value)}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs"
              >
                {COMPANY_ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary font-bold py-3 rounded-lg mt-2 hover:brightness-110 active:scale-[0.98] transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-75"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">
                    sync
                  </span>
                  Saving...
                </>
              ) : (
                "Continue to Dashboard"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
