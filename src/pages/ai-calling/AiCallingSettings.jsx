import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config.js';

const API = API_BASE;

export default function AiCallingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [voices, setVoices] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [agencyForm, setAgencyForm] = useState({ name: '', phone: '', email: '', zipCodes: '', states: '' });
  const [form, setForm] = useState({
    twilioPhoneNumber: '',
    elevenlabsVoiceId: '',
    elevenlabsAgentId: '',
    openaiModel: 'gpt-4o',
    defaultBusinessName: 'Solar Velocity',
    defaultCallerName: 'Emily',
    defaultTimezone: 'America/New_York',
    businessHoursStart: '09:00',
    businessHoursEnd: '20:00',
    dailyCallLimit: 100,
    concurrentCallLimit: 5,
  });

  const token = () => localStorage.getItem('solar_token');

  const loadSettings = async () => {
    const t = token();
    if (!t) return;
    try {
      const [sRes, vRes, aRes] = await Promise.all([
        fetch(`${API}/api/ai-calling/settings`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API}/api/ai-calling/voices`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API}/api/ai-calling/agencies`, { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (sRes.ok) {
        const data = await sRes.json();
        setForm((prev) => ({
          ...prev,
          twilioPhoneNumber: data.twilio_phone_number || data.twilioPhoneNumber || prev.twilioPhoneNumber,
          elevenlabsVoiceId: data.elevenlabs_voice_id || data.elevenlabsVoiceId || prev.elevenlabsVoiceId,
          elevenlabsAgentId: data.elevenlabs_agent_id || data.elevenlabsAgentId || prev.elevenlabsAgentId,
          openaiModel: data.openai_model || data.openaiModel || prev.openaiModel,
          defaultBusinessName: data.default_business_name || data.defaultBusinessName || prev.defaultBusinessName,
          defaultCallerName: data.default_caller_name || data.defaultCallerName || prev.defaultCallerName,
          defaultTimezone: data.default_timezone || data.defaultTimezone || prev.defaultTimezone,
          businessHoursStart: (data.business_hours_start || data.businessHoursStart || prev.businessHoursStart || '').toString().slice(0, 5),
          businessHoursEnd: (data.business_hours_end || data.businessHoursEnd || prev.businessHoursEnd || '').toString().slice(0, 5),
          dailyCallLimit: data.daily_call_limit ?? data.dailyCallLimit ?? prev.dailyCallLimit,
          concurrentCallLimit: data.concurrent_call_limit ?? data.concurrentCallLimit ?? prev.concurrentCallLimit,
        }));
      }
      if (vRes.ok) setVoices(await vRes.json());
      if (aRes.ok) setAgencies(await aRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const t = token();
    if (!t) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/ai-calling/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(form)
      });
      if (res.ok) alert('Settings saved successfully!');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAgency = async (e) => {
    e.preventDefault();
    const t = token();
    if (!t) return;
    const zipArray = agencyForm.zipCodes.split(',').map((s) => s.trim()).filter(Boolean);
    const stateArray = agencyForm.states.split(',').map((s) => s.trim()).filter(Boolean);

    const res = await fetch(`${API}/api/ai-calling/agencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({
        name: agencyForm.name,
        phone: agencyForm.phone,
        email: agencyForm.email,
        zipCodes: zipArray,
        states: stateArray,
      })
    });
    if (res.ok) {
      setShowAgencyModal(false);
      setAgencyForm({ name: '', phone: '', email: '', zipCodes: '', states: '' });
      loadSettings();
    }
  };

  const handleDeleteAgency = async (id) => {
    if (!window.confirm('Delete agency?')) return;
    const t = token();
    await fetch(`${API}/api/ai-calling/agencies/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${t}` }
    });
    loadSettings();
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[60vh]">
          <span className="material-symbols-outlined text-4xl animate-spin text-primary">progress_activity</span>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface font-display">AI Calling Settings</h1>
        <p className="text-xs text-on-surface-variant mt-0.5">Configure Telephony, Voice Synthesis, AI Models, and Solar Agency Routing</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          {/* Telephony Settings */}
          <div className="glass-card rounded-2xl p-6 space-y-4 text-xs">
            <h2 className="font-bold text-on-surface text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">call</span>
              Twilio Telephony Integration
            </h2>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Default Outbound Twilio Phone Number</label>
              <input
                type="text"
                value={form.twilioPhoneNumber || ''}
                onChange={(e) => setForm({ ...form, twilioPhoneNumber: e.target.value })}
                placeholder="+18005550199"
                className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-on-surface"
              />
              <p className="text-[10px] text-on-surface-variant mt-1">Credentials (Account SID / Auth Token) are securely referenced from your server .env configuration.</p>
            </div>
          </div>

          {/* Voice Synthesis & AI Model */}
          <div className="glass-card rounded-2xl p-6 space-y-4 text-xs">
            <h2 className="font-bold text-on-surface text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-violet-400 text-base">graphic_eq</span>
              Voice & AI Model Selection
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">ElevenLabs Voice</label>
                <select
                  value={form.elevenlabsVoiceId || ''}
                  onChange={(e) => setForm({ ...form, elevenlabsVoiceId: e.target.value })}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-on-surface"
                >
                  <option value="">Default (Sarah — American sales)</option>
                  {voices.map((v) => (
                    <option key={v.voice_id} value={v.voice_id}>
                      {v.recommended ? `★ ${v.name}` : v.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-on-surface-variant mt-1">
                  Recommended: Sarah, Jessica, Adam, Brian · Model: Eleven v3 Conversational
                </p>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">ElevenLabs Agent ID (optional)</label>
                <input
                  type="text"
                  value={form.elevenlabsAgentId || ''}
                  onChange={(e) => setForm({ ...form, elevenlabsAgentId: e.target.value })}
                  placeholder="Auto-created per campaign if empty"
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-on-surface"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">OpenAI Post-Call Model</label>
                <select
                  value={form.openaiModel || 'gpt-4o'}
                  onChange={(e) => setForm({ ...form, openaiModel: e.target.value })}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-on-surface"
                >
                  <option value="gpt-4o">GPT-4o (Summary + QA)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (Cost Optimized)</option>
                </select>
              </div>
            </div>
            <p className="text-[10px] text-on-surface-variant">
              Live calls use ElevenLabs <strong className="text-slate-300">v3 Conversational</strong> (µ-law telephony). OpenAI Realtime is the fallback.
            </p>
          </div>

          {/* Call Controls & Limits */}
          <div className="glass-card rounded-2xl p-6 space-y-4 text-xs">
            <h2 className="font-bold text-on-surface text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400 text-base">tune</span>
              Business Hours & Rate Limits
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Business Hours Start</label>
                <input
                  type="time"
                  value={form.businessHoursStart || '09:00'}
                  onChange={(e) => setForm({ ...form, businessHoursStart: e.target.value })}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-on-surface"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Business Hours End</label>
                <input
                  type="time"
                  value={form.businessHoursEnd || '20:00'}
                  onChange={(e) => setForm({ ...form, businessHoursEnd: e.target.value })}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-on-surface"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Max Daily Calls</label>
                <input
                  type="number"
                  value={form.dailyCallLimit || 100}
                  onChange={(e) => setForm({ ...form, dailyCallLimit: Number(e.target.value) })}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-on-surface"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Max Concurrent Calls</label>
                <input
                  type="number"
                  value={form.concurrentCallLimit || 5}
                  onChange={(e) => setForm({ ...form, concurrentCallLimit: Number(e.target.value) })}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-on-surface"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>

        {/* Agency Management */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-on-surface text-sm">Partner Agencies</h2>
              <button
                onClick={() => setShowAgencyModal(true)}
                className="px-2.5 py-1 rounded-lg bg-primary/20 text-primary font-bold text-[10px]"
              >
                + Add Agency
              </button>
            </div>
            <p className="text-on-surface-variant">Qualified leads will be dynamically routed to partner solar installation companies based on ZIP/State rules.</p>

            <div className="divide-y divide-glass-stroke">
              {agencies.length === 0 && <p className="py-4 text-on-surface-variant">No agencies configured.</p>}
              {agencies.map((agency) => (
                <div key={agency.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-on-surface">{agency.name}</p>
                    <p className="text-[10px] text-on-surface-variant">{agency.phone || 'No phone'} · {agency.email || 'No email'}</p>
                  </div>
                  <button onClick={() => handleDeleteAgency(agency.id)} className="text-red-400 hover:text-red-300">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showAgencyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-on-surface mb-4 font-display">Add Partner Agency</h2>
            <form onSubmit={handleCreateAgency} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Agency Name</label>
                <input
                  type="text"
                  required
                  value={agencyForm.name}
                  onChange={(e) => setAgencyForm({ ...agencyForm, name: e.target.value })}
                  placeholder="SunPower Local Agency"
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2 text-on-surface"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Phone</label>
                <input
                  type="text"
                  value={agencyForm.phone}
                  onChange={(e) => setAgencyForm({ ...agencyForm, phone: e.target.value })}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2 text-on-surface"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={agencyForm.email}
                  onChange={(e) => setAgencyForm({ ...agencyForm, email: e.target.value })}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2 text-on-surface"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Coverage ZIP Codes (comma separated)</label>
                <input
                  type="text"
                  value={agencyForm.zipCodes}
                  onChange={(e) => setAgencyForm({ ...agencyForm, zipCodes: e.target.value })}
                  placeholder="90210, 90211, 90212"
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2 text-on-surface"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-glass-stroke">
                <button
                  type="button"
                  onClick={() => setShowAgencyModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-bold"
                >
                  Save Agency
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
