import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DispositionBadge from '../../components/ai-calling/DispositionBadge';
import { API_BASE } from '../../config.js';

const API = API_BASE;

export default function AiCallingCallDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('solar_token');
    if (!t) return;
    fetch(`${API}/api/ai-calling/calls/${id}`, {
      headers: { Authorization: `Bearer ${t}` }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setCall(d))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[60vh]">
          <span className="material-symbols-outlined text-4xl animate-spin text-primary">progress_activity</span>
        </div>
      </>
    );
  }

  if (!call) {
    return (
      <>
        <div className="p-8 text-center text-white">
          <p>Call record not found.</p>
          <button onClick={() => navigate('/ai-calling')} className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs">
            Back to Dashboard
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/5 text-slate-300 hover:text-on-surface">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Call Recording & Analysis</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">Call #{call.id} · {call.owner_name || 'Homeowner'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Audio Recording */}
          {call.recording_url && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-bold text-white text-sm mb-3">Call Audio Recording</h3>
              <audio controls className="w-full">
                <source src={call.recording_url} type="audio/mpeg" />
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {/* Transcript */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold text-white text-sm mb-4">Call Transcript</h3>
            {call.transcript ? (
              <div className="space-y-3 text-xs leading-relaxed max-h-[500px] overflow-y-auto pr-2">
                <p className="text-slate-300 whitespace-pre-wrap">{call.transcript}</p>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant italic">No transcript recorded for this call.</p>
            )}
          </div>
        </div>

        {/* Call Summary & Meta */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 space-y-4 text-xs">
            <h3 className="font-bold text-white text-sm">Call Overview</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Status:</span>
                <DispositionBadge status={call.status} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Disposition:</span>
                <DispositionBadge status={call.disposition} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Sentiment:</span>
                <DispositionBadge status={call.sentiment} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Duration:</span>
                <span className="font-mono text-white">{call.duration_seconds || 0}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Voice:</span>
                <span className="font-mono text-white capitalize">{call.voice_provider || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">QA Score:</span>
                <span className="font-mono text-white">{call.qa_score != null ? `${call.qa_score}/100` : '—'}</span>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-3 text-xs">
            <h3 className="font-bold text-white text-sm">AI Summary</h3>
            <p className="text-slate-300 leading-relaxed">{call.ai_summary || 'No AI summary generated.'}</p>
            {call.qa_notes && (
              <p className="text-on-surface-variant mt-2">
                QA notes: {typeof call.qa_notes === 'string'
                  ? (() => { try { return JSON.parse(call.qa_notes).notes; } catch { return call.qa_notes; } })()
                  : call.qa_notes.notes || ''}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
