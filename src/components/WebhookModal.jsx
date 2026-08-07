import React, { useState } from 'react';

export default function WebhookModal({ show, onClose, leadId, leadName }) {
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('solar_saved_webhook') || '');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'success' | 'error'
  const [message, setMessage] = useState('');

  if (!show) return null;

  const handleSend = async () => {
    if (!webhookUrl.trim()) {
      setMessage('Please enter a valid HTTP/HTTPS Webhook URL');
      setStatus('error');
      return;
    }
    setStatus('sending');
    setMessage('');
    localStorage.setItem('solar_saved_webhook', webhookUrl.trim());

    try {
      const token = localStorage.getItem('solar_token');
      const res = await fetch(`/api/leads/${leadId}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ webhookUrl: webhookUrl.trim() })
      });
      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Lead successfully pushed to Webhook CRM!');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to dispatch webhook.');
      }
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Network error pushing to webhook');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-elevated border border-glass-stroke rounded-2xl p-6 shadow-2xl space-y-5 text-left">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">hub</span>
            <h3 className="font-bold text-white text-sm">Instant CRM & Webhook Push</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <p className="text-xs text-on-surface-variant leading-relaxed">
          Push enriched lead details for <strong className="text-white">{leadName || `#${leadId}`}</strong> directly to{' '}
          <span className="text-primary font-semibold">GoHighLevel, HubSpot, Salesforce, or Zapier</span>.
        </p>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            WEBHOOK ENDPOINT URL
          </label>
          <input
            type="url"
            placeholder="https://services.leadconnectorhq.com/hooks/..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-3 text-white font-mono text-xs focus:outline-none focus:border-primary"
          />
        </div>

        {message && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold ${
              status === 'success'
                ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                : 'bg-red-500/15 text-red-400 border border-red-500/30'
            }`}
          >
            {message}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2.5 rounded-xl text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={status === 'sending'}
            className="flex-1 bg-primary text-on-primary font-bold py-2.5 rounded-xl text-xs hover:brightness-110 flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
          >
            {status === 'sending' ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                Pushing...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">send</span>
                Push to CRM
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
