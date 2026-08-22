import React, { useState, useEffect } from 'react';
import KpiCard from '../../components/ai-calling/KpiCard';
import { API_BASE } from '../../config.js';

const API = API_BASE;

export default function AiCallingAnalytics() {
  const [data, setData] = useState({ daily: [], campaigns: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('solar_token');
    if (!t) return;
    fetch(`${API}/api/ai-calling/analytics`, {
      headers: { Authorization: `Bearer ${t}` }
    })
      .then((res) => res.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[60vh]">
          <span className="material-symbols-outlined text-4xl animate-spin text-primary">progress_activity</span>
        </div>
      </>
    );
  }

  const totalCalls = data.daily.reduce((acc, d) => acc + (d.calls || 0), 0);
  const totalBookings = data.daily.reduce((acc, d) => acc + (d.bookings || 0), 0);
  const totalAnswered = data.daily.reduce((acc, d) => acc + (d.answered || 0), 0);
  const overallBookingRate = totalAnswered > 0 ? Math.round((totalBookings / totalAnswered) * 100) : 0;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white font-display">AI Call Analytics & Reporting</h1>
        <p className="text-xs text-on-surface-variant mt-0.5">Performance tracking across campaigns and voice interactions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard icon="call" label="Total Calls Placed" value={totalCalls} color="blue" />
        <KpiCard icon="phone_in_talk" label="Total Answers" value={totalAnswered} color="indigo" />
        <KpiCard icon="event_available" label="Appointments Booked" value={totalBookings} color="green" />
        <KpiCard icon="percent" label="Conversion Rate" value={overallBookingRate} suffix="%" color="pink" />
      </div>

      {/* Campaign Comparison Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-glass-stroke">
          <h3 className="font-bold text-white text-sm">Campaign Performance Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Campaign Name</th>
                <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Status</th>
                <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Total Calls</th>
                <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Bookings</th>
                <th className="px-4 py-3 font-label-mono text-[9px] uppercase text-on-surface-variant">Avg Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-stroke">
              {data.campaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-on-surface-variant">No campaign analytics data available.</td>
                </tr>
              )}
              {data.campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 font-semibold text-white">{c.name}</td>
                  <td className="px-4 py-3 uppercase text-[10px] text-on-surface-variant">{c.status}</td>
                  <td className="px-4 py-3 font-mono">{c.total_calls || 0}</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">{c.bookings || 0}</td>
                  <td className="px-4 py-3 font-mono">{c.avg_duration ? `${Math.round(c.avg_duration)}s` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
