import React, { useState, useEffect } from 'react';
import AppLayout from '../../components/AppLayout';
import { API_BASE } from '../../config.js';

const API = API_BASE;

export default function AiCallingPrompts() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prompts, setPrompts] = useState({
    systemPrompt: '',
    greetingScript: '',
    bookingScript: '',
    closingScript: '',
  });

  useEffect(() => {
    const t = localStorage.getItem('solar_token');
    if (!t) return;
    fetch(`${API}/api/ai-calling/campaigns`, {
      headers: { Authorization: `Bearer ${t}` }
    })
      .then((res) => res.json())
      .then((data) => {
        setCampaigns(data);
        if (data.length > 0) setSelectedCampaignId(String(data[0].id));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) return;
    const t = localStorage.getItem('solar_token');
    fetch(`${API}/api/ai-calling/prompts/${selectedCampaignId}`, {
      headers: { Authorization: `Bearer ${t}` }
    })
      .then((res) => res.json())
      .then((data) => setPrompts(data))
      .catch((e) => console.error(e));
  }, [selectedCampaignId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedCampaignId) return;
    const t = localStorage.getItem('solar_token');
    setSaving(true);
    try {
      await fetch(`${API}/api/ai-calling/prompts/${selectedCampaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(prompts)
      });
      alert('Prompts updated successfully!');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <span className="material-symbols-outlined text-4xl animate-spin text-primary">progress_activity</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">AI Prompt & Script Engineering</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">Customize conversation flows and persona prompts per campaign</p>
        </div>
        {campaigns.length > 0 && (
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="bg-surface-container-low border border-glass-stroke rounded-xl px-3 py-2 text-xs text-white"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {!selectedCampaignId ? (
        <div className="glass-card rounded-2xl p-8 text-center text-xs text-on-surface-variant">
          Create a campaign first to configure custom AI prompts.
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6 text-xs">
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-white text-sm">System Prompt Persona</h2>
            <textarea
              rows={6}
              value={prompts.systemPrompt || ''}
              onChange={(e) => setPrompts({ ...prompts, systemPrompt: e.target.value })}
              placeholder="You are Emily, a friendly solar representative..."
              className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-3 text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h2 className="font-bold text-white text-sm">Opening Greeting Script</h2>
              <textarea
                rows={4}
                value={prompts.greetingScript || ''}
                onChange={(e) => setPrompts({ ...prompts, greetingScript: e.target.value })}
                placeholder="Hi {lead_name}, this is calling regarding your property..."
                className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-3 text-white"
              />
            </div>
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h2 className="font-bold text-white text-sm">Appointment Booking Script</h2>
              <textarea
                rows={4}
                value={prompts.bookingScript || ''}
                onChange={(e) => setPrompts({ ...prompts, bookingScript: e.target.value })}
                placeholder="We can send a solar specialist to assess your roof..."
                className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-3 text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Script Configuration'}
          </button>
        </form>
      )}
    </AppLayout>
  );
}
