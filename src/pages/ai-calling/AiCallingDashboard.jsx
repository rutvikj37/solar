import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppLayout from '../../components/AppLayout';
import KpiCard from '../../components/ai-calling/KpiCard';
import DispositionBadge from '../../components/ai-calling/DispositionBadge';
import { API_BASE } from '../../config.js';

const API = API_BASE;

export default function AiCallingDashboard() {
  const [stats, setStats] = useState(null);
  const [recentCalls, setRecentCalls] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testCallerName, setTestCallerName] = useState('Emily');
  const [testBusinessName, setTestBusinessName] = useState('Solar Velocity');
  const [callingTest, setCallingTest] = useState(false);
  const [testStatusMsg, setTestStatusMsg] = useState(null);

  const navigate = useNavigate();
  const token = () => localStorage.getItem('solar_token');

  const load = async () => {
    const t = token();
    if (!t) { navigate('/login'); return; }
    try {
      const [dashRes, callsRes, campRes] = await Promise.all([
        fetch(`${API}/api/ai-calling/dashboard`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API}/api/ai-calling/calls?limit=10`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API}/api/ai-calling/campaigns`, { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (dashRes.ok) { const d = await dashRes.json(); setStats(d.today); }
      if (callsRes.ok) { const d = await callsRes.json(); setRecentCalls(d.calls || []); }
      if (campRes.ok) { setCampaigns(await campRes.json()); }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const triggerTestCall = async (e) => {
    e.preventDefault();
    const t = token();
    if (!t || !testPhone) return;
    setCallingTest(true);
    setTestStatusMsg(null);
    try {
      const res = await fetch(`${API}/api/ai-calling/test-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          phoneNumber: testPhone,
          callerName: testCallerName,
          businessName: testBusinessName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate test call');

      setTestStatusMsg({
        type: 'success',
        text: data.simulated
          ? `⚡ Test call initiated in SIMULATION mode to ${testPhone}! (Set TWILIO_PHONE_NUMBER in .env for live audio calls).`
          : `📞 Outbound AI Voice Call placed to ${testPhone}! Answer your phone to speak with the AI caller.`,
      });
      setTimeout(() => load(), 2000);
    } catch (err) {
      setTestStatusMsg({ type: 'error', text: err.message });
    } finally {
      setCallingTest(false);
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

  const s = stats || {};

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <span className="material-symbols-outlined text-white text-xl">smart_toy</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white font-display">AI Calling Automation</h1>
              <p className="text-xs text-on-surface-variant mt-0.5">Autonomous solar lead qualification & appointment booking</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowTestModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-xs hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-amber-500/20"
          >
            <span className="material-symbols-outlined text-sm">phone_iphone</span>
            ⚡ Test Call Personally
          </button>
          <Link to="/ai-calling/campaigns" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-sm">add</span>
            New Campaign
          </Link>
          <Link to="/ai-calling/live" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-xs hover:bg-emerald-500/25 transition-all">
            <span className="material-symbols-outlined text-sm">monitor_heart</span>
            Live Monitor
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-8">
        <KpiCard icon="call" label="Today's Calls" value={s.totalCalls || 0} color="blue" />
        <KpiCard icon="phone_in_talk" label="In Progress" value={s.inProgress || 0} color="green" />
        <KpiCard icon="check_circle" label="Completed" value={s.completed || 0} color="teal" />
        <KpiCard icon="call_received" label="Answered" value={s.answered || 0} color="indigo" />
        <KpiCard icon="phone_missed" label="No Answer" value={s.noAnswer || 0} color="amber" />
        <KpiCard icon="voicemail" label="Voicemail" value={s.voicemail || 0} color="purple" />
        <KpiCard icon="event_available" label="Appts Booked" value={s.appointmentsBooked || 0} color="green" />
        <KpiCard icon="thumb_up" label="Interested" value={s.interested || 0} color="sky" />
        <KpiCard icon="thumb_down" label="Not Interested" value={s.notInterested || 0} color="red" />
        <KpiCard icon="schedule" label="Callback" value={s.callbackRequested || 0} color="orange" />
        <KpiCard icon="timer" label="Avg Duration" value={s.avgDuration || 0} suffix="sec" color="cyan" />
        <KpiCard icon="trending_up" label="AI Success" value={s.aiSuccessRate || 0} suffix="%" color="lime" />
        <KpiCard icon="percent" label="Booking Rate" value={s.bookingRate || 0} suffix="%" color="pink" />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Campaigns */}
        <div className="lg:col-span-1 glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-glass-stroke flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">Active Campaigns</h3>
            <Link to="/ai-calling/campaigns" className="text-primary text-[10px] font-bold uppercase hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-glass-stroke max-h-[400px] overflow-y-auto">
            {campaigns.length === 0 && (
              <div className="p-6 text-center">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant/40 mb-2 block">campaign</span>
                <p className="text-xs text-on-surface-variant">No campaigns yet</p>
                <Link to="/ai-calling/campaigns" className="text-primary text-xs font-bold mt-2 inline-block hover:underline">Create your first campaign →</Link>
              </div>
            )}
            {campaigns.slice(0, 8).map((c) => (
              <Link key={c.id} to={`/ai-calling/campaigns`} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    {c.queue_done || 0}/{c.queue_total || 0} calls · {c.completed_calls || 0} completed
                  </p>
                </div>
                <DispositionBadge status={c.status} />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Calls */}
        <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-glass-stroke flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">Recent Calls</h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-on-surface-variant">Auto-refreshing</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Lead</th>
                  <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Phone</th>
                  <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Duration</th>
                  <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Status</th>
                  <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Disposition</th>
                  <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Sentiment</th>
                  <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-stroke">
                {recentCalls.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">
                      No calls recorded yet. Start a campaign or place a test call.
                    </td>
                  </tr>
                )}
                {recentCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-white/5 cursor-pointer transition-colors" onClick={() => navigate(`/ai-calling/calls/${call.id}`)}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{call.owner_name || 'Unknown'}</p>
                      <p className="text-[10px] text-on-surface-variant truncate max-w-[160px]">{call.address || ''}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-on-surface-variant">{call.phone || '—'}</td>
                    <td className="px-4 py-3 font-mono text-white">
                      {call.duration_seconds > 0 ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, '0')}` : '—'}
                    </td>
                    <td className="px-4 py-3"><DispositionBadge status={call.status} /></td>
                    <td className="px-4 py-3"><DispositionBadge status={call.disposition} /></td>
                    <td className="px-4 py-3"><DispositionBadge status={call.sentiment} /></td>
                    <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                      {call.created_at ? new Date(call.created_at).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/ai-calling/knowledge-base" className="glass-card rounded-xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors group">
          <span className="material-symbols-outlined text-lg text-violet-400 group-hover:scale-110 transition-transform">auto_stories</span>
          <div>
            <p className="text-xs font-bold text-white">Knowledge Base</p>
            <p className="text-[10px] text-on-surface-variant">Edit AI answers</p>
          </div>
        </Link>
        <Link to="/ai-calling/analytics" className="glass-card rounded-xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors group">
          <span className="material-symbols-outlined text-lg text-blue-400 group-hover:scale-110 transition-transform">analytics</span>
          <div>
            <p className="text-xs font-bold text-white">Analytics</p>
            <p className="text-[10px] text-on-surface-variant">Performance data</p>
          </div>
        </Link>
        <Link to="/ai-calling/settings" className="glass-card rounded-xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors group">
          <span className="material-symbols-outlined text-lg text-teal-400 group-hover:scale-110 transition-transform">settings</span>
          <div>
            <p className="text-xs font-bold text-white">Settings</p>
            <p className="text-[10px] text-on-surface-variant">API keys & config</p>
          </div>
        </Link>
        <Link to="/ai-calling/campaigns" className="glass-card rounded-xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors group">
          <span className="material-symbols-outlined text-lg text-amber-400 group-hover:scale-110 transition-transform">campaign</span>
          <div>
            <p className="text-xs font-bold text-white">Campaigns</p>
            <p className="text-[10px] text-on-surface-variant">Manage campaigns</p>
          </div>
        </Link>
      </div>

      {/* Test Call Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-2xl w-full max-w-md p-6 relative border border-amber-500/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-xl">phone_iphone</span>
                <h2 className="text-lg font-bold text-white font-display">Personal AI Test Call</h2>
              </div>
              <button onClick={() => setShowTestModal(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <p className="text-xs text-on-surface-variant mb-4">
              Test the AI caller personally before contacting real leads. Enter your mobile phone number below to receive a live test call.
            </p>

            <form onSubmit={triggerTestCall} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Your Mobile Phone Number</label>
                <input
                  type="text"
                  required
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+19876543210"
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">AI Agent Persona</label>
                  <input
                    type="text"
                    value={testCallerName}
                    onChange={(e) => setTestCallerName(e.target.value)}
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Company Name</label>
                  <input
                    type="text"
                    value={testBusinessName}
                    onChange={(e) => setTestBusinessName(e.target.value)}
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              {testStatusMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${testStatusMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                  {testStatusMsg.text}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-glass-stroke">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={callingTest || !testPhone}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold shadow-lg shadow-amber-500/20 hover:brightness-110 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {callingTest ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      Calling...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">ring_volume</span>
                      Call My Phone Now
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
