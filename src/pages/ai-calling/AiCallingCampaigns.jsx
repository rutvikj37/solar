import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DispositionBadge from '../../components/ai-calling/DispositionBadge';
import { API_BASE } from '../../config.js';
import { BRAND_NAME } from '../../config/brand.js';

const API = API_BASE;

export default function AiCallingCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [leads, setLeads] = useState([]);
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAddLeadsModal, setShowAddLeadsModal] = useState(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    callerName: 'Emily',
    businessName: BRAND_NAME,
    twilioNumber: '',
    elevenlabsVoiceId: '',
    timezone: 'America/New_York',
    callingWindowStart: '09:00',
    callingWindowEnd: '20:00',
    retryAttempts: 3,
    retryDelayMinutes: 60,
  });

  const navigate = useNavigate();
  const token = () => localStorage.getItem('solar_token');

  const loadData = async () => {
    const t = token();
    if (!t) { navigate('/login'); return; }
    try {
      const [cRes, lRes, vRes] = await Promise.all([
        fetch(`${API}/api/ai-calling/campaigns`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API}/api/leads`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API}/api/ai-calling/voices`, { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (cRes.ok) setCampaigns(await cRes.json());
      if (lRes.ok) setLeads(await lRes.json());
      if (vRes.ok) setVoices(await vRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    const t = token();
    if (!t) return;
    try {
      const res = await fetch(`${API}/api/ai-calling/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({
          name: '',
          callerName: 'Emily',
          businessName: BRAND_NAME,
          twilioNumber: '',
          elevenlabsVoiceId: '',
          timezone: 'America/New_York',
          callingWindowStart: '09:00',
          callingWindowEnd: '20:00',
          retryAttempts: 3,
          retryDelayMinutes: 60,
        });
        await loadData();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAction = async (id, action) => {
    const t = token();
    if (!t) return;
    await fetch(`${API}/api/ai-calling/campaigns/${id}/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` }
    });
    await loadData();
  };

  const handleAddLeadsSubmit = async (e) => {
    e.preventDefault();
    const t = token();
    if (!t || !showAddLeadsModal || selectedLeadIds.length === 0) return;
    try {
      const res = await fetch(`${API}/api/ai-calling/campaigns/${showAddLeadsModal}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ leadIds: selectedLeadIds })
      });
      if (res.ok) {
        setShowAddLeadsModal(null);
        setSelectedLeadIds([]);
        await loadData();
      }
    } catch (err) {
      alert(err.message);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-on-surface font-display">AI Calling Campaigns</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">Manage automated cold-calling sequences</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Create Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.length === 0 && (
          <div className="col-span-full glass-card rounded-2xl p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3 block">campaign</span>
            <h3 className="text-base font-bold text-on-surface mb-1">No Campaigns Created</h3>
            <p className="text-xs text-on-surface-variant mb-4">Set up an automated AI calling campaign to qualify leads 24/7.</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs"
            >
              Create Campaign Now
            </button>
          </div>
        )}

        {campaigns.map((c) => (
          <div key={c.id} className="glass-card rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="text-base font-bold text-on-surface font-display">{c.name}</h3>
                <DispositionBadge status={c.status} />
              </div>
              <div className="space-y-1.5 text-xs text-on-surface-variant">
                <p><span className="text-slate-400">Caller:</span> {c.caller_name || 'Emily'} ({c.business_name || BRAND_NAME})</p>
                <p><span className="text-slate-400">Hours:</span> {c.calling_window_start} - {c.calling_window_end} ({c.timezone})</p>
                <p><span className="text-slate-400">Progress:</span> {c.queue_done || 0} / {c.queue_total || 0} leads called</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/5 rounded-full h-2 mt-4 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${c.queue_total > 0 ? Math.round(((c.queue_done || 0) / c.queue_total) * 100) : 0}%` }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-glass-stroke flex items-center justify-between gap-2">
              <button
                onClick={() => setShowAddLeadsModal(c.id)}
                className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                Add Leads
              </button>

              <div className="flex items-center gap-2">
                {c.status === 'draft' || c.status === 'paused' ? (
                  <button
                    onClick={() => handleAction(c.id, c.status === 'draft' ? 'start' : 'resume')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px] uppercase hover:bg-emerald-500/30"
                  >
                    {c.status === 'draft' ? 'Start' : 'Resume'}
                  </button>
                ) : c.status === 'active' ? (
                  <button
                    onClick={() => handleAction(c.id, 'pause')}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-[10px] uppercase hover:bg-amber-500/30"
                  >
                    Pause
                  </button>
                ) : null}

                {c.status !== 'completed' && c.status !== 'cancelled' && (
                  <button
                    onClick={() => handleAction(c.id, 'stop')}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-[10px] uppercase hover:bg-red-500/30"
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-2xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-on-surface mb-4 font-display">Create AI Calling Campaign</h2>
            <form onSubmit={handleCreateCampaign} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Q3 Cold Lead Outreach"
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-on-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">AI Agent Name</label>
                  <input
                    type="text"
                    value={formData.callerName}
                    onChange={(e) => setFormData({ ...formData, callerName: e.target.value })}
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Business Name</label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-on-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Voice Selection (ElevenLabs)</label>
                <select
                  value={formData.elevenlabsVoiceId}
                  onChange={(e) => setFormData({ ...formData, elevenlabsVoiceId: e.target.value })}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-on-surface"
                >
                  <option value="">Default (Sarah)</option>
                  {voices.map((v) => (
                    <option key={v.voice_id} value={v.voice_id}>
                      {v.recommended ? `★ ${v.name}` : v.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-on-surface-variant mt-1">★ Recommended: Sarah, Jessica, Adam, Brian · Eleven v3 Conversational</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Calling Window Start</label>
                  <input
                    type="time"
                    value={formData.callingWindowStart}
                    onChange={(e) => setFormData({ ...formData, callingWindowStart: e.target.value })}
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Calling Window End</label>
                  <input
                    type="time"
                    value={formData.callingWindowEnd}
                    onChange={(e) => setFormData({ ...formData, callingWindowEnd: e.target.value })}
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-on-surface"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-glass-stroke">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold shadow-lg shadow-primary/20"
                >
                  Save Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Leads Modal */}
      {showAddLeadsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-on-surface mb-4 font-display">Add Leads to Queue</h2>
            <form onSubmit={handleAddLeadsSubmit} className="space-y-4">
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                {leads.map((l) => (
                  <label key={l.id} className="flex items-center gap-3 p-2 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 text-xs text-on-surface">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(l.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedLeadIds([...selectedLeadIds, l.id]);
                        else setSelectedLeadIds(selectedLeadIds.filter((id) => id !== l.id));
                      }}
                      className="rounded border-glass-stroke"
                    />
                    <div>
                      <p className="font-semibold">{l.owner_name || 'Lead'}</p>
                      <p className="text-[10px] text-on-surface-variant">{l.phone || 'No Phone'} · {l.address || ''}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-glass-stroke">
                <button
                  type="button"
                  onClick={() => { setShowAddLeadsModal(null); setSelectedLeadIds([]); }}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedLeadIds.length === 0}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs disabled:opacity-50"
                >
                  Enqueue {selectedLeadIds.length} Leads
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
