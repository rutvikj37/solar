import React, { useState, useEffect } from 'react';
import AppLayout from '../../components/AppLayout';
import DispositionBadge from '../../components/ai-calling/DispositionBadge';
import { API_BASE } from '../../config.js';

const API = API_BASE;

export default function AiCallingLiveMonitor() {
  const [activeTab, setActiveTab] = useState('all'); // 'live' | 'all'
  const [calls, setCalls] = useState([]);
  const [totalCalls, setTotalCalls] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCall, setSelectedCall] = useState(null);
  const [liveSessions, setLiveSessions] = useState([]);
  const [whisperNote, setWhisperNote] = useState('');
  const [whisperStatus, setWhisperStatus] = useState('');

  const fetchCalls = async () => {
    const t = localStorage.getItem('solar_token');
    if (!t) return;
    try {
      let url = `${API}/api/ai-calling/calls?limit=50`;
      if (activeTab === 'live') {
        url += '&status=in_progress';
      } else if (statusFilter) {
        url += `&status=${statusFilter}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls || []);
        setTotalCalls(data.total || 0);
      }

      const liveRes = await fetch(`${API}/api/ai-calling/live-sessions`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (liveRes.ok) {
        setLiveSessions(await liveRes.json());
      }
    } catch (e) {
      console.error('Fetch calls error:', e);
    } finally {
      setLoading(false);
    }
  };

  const sendWhisper = async (callRecordId) => {
    const t = localStorage.getItem('solar_token');
    if (!t || !whisperNote.trim()) return;
    setWhisperStatus('Sending...');
    try {
      const res = await fetch(`${API}/api/ai-calling/live-sessions/${callRecordId}/whisper`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: whisperNote.trim() }),
      });
      const data = await res.json();
      setWhisperStatus(data.ok ? 'Coach note sent' : (data.error || 'Failed'));
      if (data.ok) setWhisperNote('');
    } catch {
      setWhisperStatus('Failed to send');
    }
  };

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(fetchCalls, 3000);
    return () => clearInterval(interval);
  }, [activeTab, statusFilter]);

  const filteredCalls = calls.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.owner_name && c.owner_name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.twilio_call_sid && c.twilio_call_sid.toLowerCase().includes(q)) ||
      (c.transcript && c.transcript.toLowerCase().includes(q))
    );
  });

  const liveCallsCount = calls.filter((c) => c.status === 'in_progress' || c.status === 'ringing').length;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Live Call Monitor & Calling Logs</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">Real-time status of active AI voice calls and complete execution history</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full border border-glass-stroke">
            <span className={`w-2.5 h-2.5 rounded-full ${liveCallsCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-xs font-bold text-slate-300">
              {liveCallsCount > 0 ? `${liveCallsCount} Active Call${liveCallsCount > 1 ? 's' : ''}` : 'No Active Line'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs & Controls Bar */}
      <div className="glass-card rounded-2xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-xl border border-glass-stroke w-full md:w-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'all' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-white'
            }`}
          >
            All Call Logs ({totalCalls})
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'live' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-on-surface-variant hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-ping" />
            Live Stream
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search phone, lead, transcript..."
              className="w-full bg-surface-container-low border border-glass-stroke rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
            />
          </div>

          {activeTab === 'all' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-container-low border border-glass-stroke rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="initiated">Initiated</option>
              <option value="ringing">Ringing</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          )}
        </div>
      </div>

      {/* Live coach panel */}
      {activeTab === 'live' && liveSessions.length > 0 && (
        <div className="glass-card rounded-2xl p-4 mb-6 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-base">hearing</span>
            Live Coach Whisper
          </h3>
          {liveSessions.map((s) => (
            <div key={s.streamSid || s.callRecordId} className="bg-surface-container-low rounded-xl p-3 text-xs">
              <p className="text-slate-300 mb-2">
                Call #{s.callRecordId} · {s.voice_provider || s.provider || 'voice'} · Lead {s.leadId}
              </p>
              <div className="flex gap-2">
                <input
                  value={whisperNote}
                  onChange={(e) => setWhisperNote(e.target.value)}
                  placeholder="Private coach note for the AI (not heard by customer)..."
                  className="flex-1 bg-black/20 border border-glass-stroke rounded-lg px-3 py-1.5 text-white"
                />
                <button
                  onClick={() => sendWhisper(s.callRecordId)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold"
                >
                  Whisper
                </button>
              </div>
              {whisperStatus && <p className="text-[10px] text-on-surface-variant mt-1">{whisperStatus}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <span className="material-symbols-outlined text-4xl animate-spin text-primary">progress_activity</span>
        </div>
      ) : filteredCalls.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3 block">graphic_eq</span>
          <h3 className="text-base font-bold text-white mb-1">No Call Logs Found</h3>
          <p className="text-xs text-on-surface-variant">There are no calls matching your selected filter parameters.</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-glass-stroke text-[11px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container-low/50">
                  <th className="py-3 px-4">Lead / Owner</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Disposition</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Started At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-stroke text-xs">
                {filteredCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-white">{call.owner_name || 'Homeowner'}</p>
                      <p className="text-[10px] text-on-surface-variant">{call.campaign_name || 'Default Campaign'}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {call.phone || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <DispositionBadge status={call.status} />
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize text-slate-300 font-medium">
                        {(call.disposition || 'no_disposition').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {call.duration_seconds || 0}s
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant font-mono text-[11px]">
                      {call.started_at ? new Date(call.started_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedCall(call)}
                        className="px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[11px] transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Call Details Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-2xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-glass-stroke mb-4">
              <div>
                <h3 className="text-lg font-bold text-white font-display">Call Details #{selectedCall.id}</h3>
                <p className="text-xs text-on-surface-variant">Twilio SID: <span className="font-mono text-slate-300">{selectedCall.twilio_call_sid || 'N/A'}</span></p>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-surface-container-low p-4 rounded-xl">
                <div>
                  <p className="text-on-surface-variant mb-0.5">Lead Name</p>
                  <p className="font-bold text-white">{selectedCall.owner_name || 'Homeowner'}</p>
                </div>
                <div>
                  <p className="text-on-surface-variant mb-0.5">Phone Number</p>
                  <p className="font-mono font-bold text-white">{selectedCall.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-on-surface-variant mb-0.5">Call Status</p>
                  <DispositionBadge status={selectedCall.status} />
                </div>
                <div>
                  <p className="text-on-surface-variant mb-0.5">Duration</p>
                  <p className="font-mono font-bold text-white">{selectedCall.duration_seconds || 0} seconds</p>
                </div>
              </div>

              {selectedCall.ai_summary && (
                <div className="bg-surface-container-low p-4 rounded-xl">
                  <p className="font-bold text-primary mb-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    AI Call Summary
                  </p>
                  <p className="text-slate-300 leading-relaxed">{selectedCall.ai_summary}</p>
                </div>
              )}

              {(selectedCall.qa_score != null || selectedCall.voice_provider) && (
                <div className="bg-surface-container-low p-4 rounded-xl grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-on-surface-variant mb-0.5">Voice Provider</p>
                    <p className="font-bold text-white capitalize">{selectedCall.voice_provider || '—'}</p>
                  </div>
                  <div>
                    <p className="text-on-surface-variant mb-0.5">QA Score</p>
                    <p className="font-bold text-white">{selectedCall.qa_score != null ? `${selectedCall.qa_score}/100` : '—'}</p>
                  </div>
                </div>
              )}

              <div>
                <p className="font-bold text-white mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-violet-400">forum</span>
                  Conversation Transcript
                </p>
                {selectedCall.transcript ? (
                  <div className="bg-surface-container-low p-4 rounded-xl font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                    {selectedCall.transcript}
                  </div>
                ) : (
                  <div className="bg-surface-container-low p-4 rounded-xl text-on-surface-variant text-center">
                    No transcript recorded for this call yet.
                  </div>
                )}
              </div>

              {selectedCall.recording_url && (
                <div className="bg-surface-container-low p-4 rounded-xl">
                  <p className="font-bold text-white mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-emerald-400">play_circle</span>
                    Call Audio Recording
                  </p>
                  <audio controls className="w-full" src={selectedCall.recording_url}>
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
