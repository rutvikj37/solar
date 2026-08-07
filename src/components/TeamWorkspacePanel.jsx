import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config.js';

export default function TeamWorkspacePanel() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [role, setRole] = useState('sales_rep');
  const [message, setMessage] = useState('');

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('solar_token');
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/team/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error('Fetch team error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInvite = async () => {
    if (!memberEmail.trim()) return;
    try {
      const token = localStorage.getItem('solar_token');
      const res = await fetch(`${API_BASE}/api/team/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ memberEmail: memberEmail.trim(), role })
      });
      const data = await res.json();
      if (res.ok) {
        setShowInviteModal(false);
        setMemberEmail('');
        fetchMembers();
      } else {
        setMessage(data.error || 'Failed to invite team member');
      }
    } catch (err) {
      setMessage('Network error inviting member');
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Revoke seat for this team member?')) return;
    try {
      const token = localStorage.getItem('solar_token');
      const res = await fetch(`${API_BASE}/api/team/members/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchMembers();
    } catch (err) {
      console.error('Revoke error:', err);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-glass-stroke pb-3">
        <div>
          <h3 className="font-bold text-white text-base">Company Sub-Accounts & Multi-Seat Workspaces</h3>
          <p className="text-on-surface-variant text-xs mt-0.5">
            Invite sales reps, canvassers, and managers to share your company's master lead credit pool.
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="bg-primary text-on-primary font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg hover:brightness-110"
        >
          <span className="material-symbols-outlined text-base">person_add</span>
          Invite Team Member
        </button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-glass-stroke">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs text-left">
            <thead>
              <tr className="bg-white/5 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
                <th className="px-5 py-3 border-b border-glass-stroke">Team Member</th>
                <th className="px-5 py-3 border-b border-glass-stroke">Role</th>
                <th className="px-5 py-3 border-b border-glass-stroke">Status</th>
                <th className="px-5 py-3 border-b border-glass-stroke">Shared Credit Access</th>
                <th className="px-5 py-3 border-b border-glass-stroke text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-stroke">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold">
                        {(m.name || m.member_email).substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{m.name || 'Invited User'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{m.member_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="capitalize font-semibold text-white bg-white/10 px-2.5 py-0.5 rounded border border-white/10">
                      {m.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                      {m.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-300 font-mono">
                    Shared Master Pool
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleRevoke(m.id)}
                      className="text-red-400 hover:text-red-300 font-bold text-[11px]"
                    >
                      Revoke Seat
                    </button>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-6 text-slate-500">
                    No team members invited yet. Invite sales reps or canvassers to collaborate!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-elevated border border-glass-stroke rounded-2xl p-6 shadow-2xl space-y-4 text-left">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white text-sm">Invite Team Seat</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MEMBER EMAIL ADDRESS</label>
                <input
                  type="email"
                  placeholder="salesrep@solarcompany.com"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-xl p-3 text-white focus:outline-none focus:border-primary text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">WORKSPACE ROLE</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-xl p-3 text-white focus:outline-none focus:border-primary text-xs"
                >
                  <option value="sales_rep">Sales Rep (Search & Contact Leads)</option>
                  <option value="canvasser">Canvasser (Door-to-door Territory Scan)</option>
                  <option value="manager">Manager (Full Pipeline & Team Access)</option>
                </select>
              </div>

              {message && <p className="text-xs text-red-400 font-semibold">{message}</p>}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-white font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:brightness-110"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
