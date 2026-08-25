import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE } from "../../config.js";
import { clearToken, isAdminRole } from "../../lib/auth.js";
import FullPageLoader from "../../components/layout/FullPageLoader.jsx";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", jobTitle: "" });
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const navigate = useNavigate();

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("solar_token")}`,
    "Content-Type": "application/json",
  });

  const loadProfile = () => {
    const token = localStorage.getItem("solar_token");
    if (!token) {
      navigate("/login", { replace: true });
      return Promise.resolve();
    }

    return fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setForm({
          name: data.user?.name || "",
          phone: data.user?.phone || "",
          jobTitle: data.user?.jobTitle || "",
        });
        if (data.user?.hasApiKey && !apiKey) {
          setApiKey(data.user.apiKeyMasked || "");
        }
      })
      .catch((err) => {
        console.error(err);
        clearToken();
        navigate("/login", { replace: true });
      });
  };

  useEffect(() => {
    loadProfile().finally(() => setLoading(false));
  }, [navigate]);

  const handleCopy = () => {
    if (!apiKey || apiKey.includes("•")) {
      toast.error("Regenerate your API key first to copy the full value.");
      return;
    }
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegen = async () => {
    if (!window.confirm("Regenerate API key? Existing integrations using the old key will stop working.")) {
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/regenerate-api-key`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to regenerate key");
      setApiKey(data.apiKey);
      setShowKey(true);
      toast.success("New API key generated. Copy it now — it won't be shown again in full.");
    } catch (err) {
      toast.error(err.message || "Failed to regenerate API key");
    } finally {
      setRegenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setUser(data.user);
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = isAdminRole(user?.role);
  const displayKey =
    showKey && apiKey && !apiKey.includes("•")
      ? apiKey
      : user?.apiKeyMasked || apiKey || "No API key yet — click regenerate";

  if (loading) {
    return <FullPageLoader />;
  }

  return (
    <>
      <div className="mb-stack-lg flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-2xl md:text-headline-lg font-bold text-primary">
            User Profile & settings
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Manage your account credentials, preferences, and developer API keys.
          </p>
        </div>
        {isAdmin && (
          <Link
            to="/admin"
            className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold flex items-center gap-2 self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-base">admin_panel_settings</span>
            Open Admin Control Center
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-stack-lg">
        <div className="lg:col-span-5 space-y-gutter">
          <div className="glass-card p-6 rounded-xl relative overflow-hidden flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full border-2 border-primary/30 bg-primary/20 flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-primary">
                {(user?.name || "?").charAt(0).toUpperCase()}
              </span>
            </div>
            <h3 className="font-headline-md text-lg font-bold text-white mb-1">{user?.name}</h3>
            <div className="flex items-center gap-2">
              <span
                className={`font-label-mono text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                  isAdmin
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-primary/10 text-primary border-primary/20"
                }`}
              >
                {isAdmin ? "ADMINISTRATOR" : user?.role?.toUpperCase() || "USER"}
              </span>
            </div>
            <div className="w-full text-left space-y-3 mt-6 text-xs border-t border-glass-stroke pt-4">
              <div>
                <p className="text-[10px] font-label-mono text-on-surface-variant">ORGANIZATION</p>
                <p className="text-white font-semibold mt-0.5">{user?.company || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-label-mono text-on-surface-variant">ACCOUNT ROLE</p>
                <p className="text-white font-semibold mt-0.5">{user?.role || "user"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-gutter">
          <div className="glass-card p-6 rounded-xl space-y-4">
            <h4 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold mb-2">
              Account Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-on-surface-variant">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 focus:outline-none focus:border-primary text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-on-surface-variant">Email Address</label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface-variant cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <label className="text-on-surface-variant">Phone Number</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Add phone number"
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 focus:outline-none focus:border-primary text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-on-surface-variant">Role Title</label>
                <input
                  type="text"
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                  placeholder="Your role in the company"
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 focus:outline-none focus:border-primary text-white"
                />
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-on-primary font-bold text-xs py-2 px-5 rounded-lg hover:brightness-110 active:scale-98 transition-all disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Account Settings"}
            </button>
          </div>

          <div className="glass-card p-6 rounded-xl space-y-3">
            <h4 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">
              CRM Integrations
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Connect HubSpot or Salesforce to push leads from My Leads.
            </p>
            <Link
              to="/integrations"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:brightness-110"
            >
              <span className="material-symbols-outlined text-base">hub</span>
              Manage Integrations
            </Link>
          </div>

          <div className="glass-card p-6 rounded-xl space-y-4">
            <h4 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">
              Developer Settings
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Developer API keys for custom integrations with HubSpot, Salesforce, or internal dashboards.
            </p>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 flex items-center justify-between font-mono text-[11px]">
                <span className="truncate">{displayKey}</span>
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="text-on-surface-variant hover:text-white p-0.5 ml-2 shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showKey ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              <button
                onClick={handleCopy}
                className="bg-surface-container-highest border border-glass-stroke hover:bg-surface-bright text-white py-2 px-3 rounded-lg flex items-center justify-center font-semibold gap-1 min-w-[70px]"
              >
                <span className="material-symbols-outlined text-sm">{copied ? "check" : "content_copy"}</span>
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
              <button
                onClick={handleRegen}
                disabled={regenerating}
                className="border border-glass-stroke hover:bg-white/5 text-on-surface-variant hover:text-white py-2 px-3 rounded-lg disabled:opacity-50"
                title="Regenerate API Key"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
