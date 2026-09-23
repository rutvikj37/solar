import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config.js';

const PERMISSION_DEFINITIONS = [
  { key: 'leads_view', label: 'View Leads', category: 'Leads' },
  { key: 'leads_create', label: 'Search & Unlock Leads', category: 'Leads' },
  { key: 'leads_edit', label: 'Update Pipeline & Stages', category: 'Leads' },
  { key: 'leads_export', label: 'Export Leads to CSV/CRM', category: 'Leads' },
  { key: 'proposals_create', label: 'Create Solar Proposals', category: 'Proposals' },
  { key: 'proposals_edit', label: 'Edit Pricing & Equipment', category: 'Proposals' },
  { key: 'outreach_send', label: 'Email & SMS Outreach Campaigns', category: 'Outreach' },
  { key: 'analytics_view', label: 'View Territory Conversion & CPL', category: 'Analytics' },
  { key: 'team_manage', label: 'Manage Team & Invite Members', category: 'Team' },
];

const COLOR_CLASSES = {
  blue: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-500/30' },
  purple: { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-500/30' },
  emerald: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-500/30' },
  rose: { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-500/30' },
  cyan: { bg: 'bg-cyan-500/10 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-500/30' },
};

export default function TeamWorkspacePanel() {
  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'roles'
  const [members, setMembers] = useState([]);
  const [rolesData, setRolesData] = useState({ defaultRoles: [], customRoles: [], allRoles: [] });
  const [loading, setLoading] = useState(true);
  const [seatInfo, setSeatInfo] = useState(null);

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('sales_rep');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [lastGeneratedLink, setLastGeneratedLink] = useState('');

  // Create Role Modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('blue');
  const [newRolePermissions, setNewRolePermissions] = useState(['leads_view', 'leads_create', 'proposals_create']);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState('');

  // Copy Feedback
  const [copiedId, setCopiedId] = useState(null);

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('solar_token');
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/team/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.members || [];
        setMembers(list);
        if (!Array.isArray(data) && data.entitlements) {
          setSeatInfo(data.entitlements);
        }
      }
    } catch (err) {
      console.error('Fetch team error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('solar_token');
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/team/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRolesData(data);
      }
    } catch (err) {
      console.error('Fetch roles error:', err);
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchRoles();
  }, []);

  const handleInvite = async () => {
    if (!memberEmail.trim()) return;
    setInviteSending(true);
    setInviteError('');
    setInviteMessage('');
    setLastGeneratedLink('');

    try {
      const token = localStorage.getItem('solar_token');
      
      // Determine if selected role is custom role ID or string
      const isCustomId = !isNaN(Number(selectedRole));
      const payload = {
        memberEmail: memberEmail.trim(),
        role: isCustomId ? undefined : selectedRole,
        roleId: isCustomId ? Number(selectedRole) : undefined,
      };

      const res = await fetch(`${API_BASE}/api/team/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setInviteMessage(data.message || 'Invitation sent via Resend!');
        if (data.inviteLink) {
          setLastGeneratedLink(data.inviteLink);
        }
        setMemberEmail('');
        fetchMembers();
      } else {
        setInviteError(data.error || 'Failed to invite team member');
      }
    } catch (err) {
      setInviteError('Network error inviting member');
    } finally {
      setInviteSending(false);
    }
  };

  const handleResend = async (memberId) => {
    try {
      const token = localStorage.getItem('solar_token');
      const res = await fetch(`${API_BASE}/api/team/invite/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ memberId })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Invitation re-sent via Resend!');
        fetchMembers();
      } else {
        alert(data.error || 'Failed to resend invite');
      }
    } catch (err) {
      alert('Error resending invitation');
    }
  };

  const handleCopyLink = (link, id) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
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

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      setRoleError('Role name is required');
      return;
    }
    setRoleSaving(true);
    setRoleError('');

    try {
      const token = localStorage.getItem('solar_token');
      const res = await fetch(`${API_BASE}/api/team/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDescription.trim(),
          color: newRoleColor,
          permissions: newRolePermissions,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowRoleModal(false);
        setNewRoleName('');
        setNewRoleDescription('');
        setNewRolePermissions(['leads_view', 'leads_create', 'proposals_create']);
        fetchRoles();
      } else {
        setRoleError(data.error || 'Failed to create role');
      }
    } catch (err) {
      setRoleError('Network error saving role');
    } finally {
      setRoleSaving(false);
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm('Delete this custom workspace role?')) return;
    try {
      const token = localStorage.getItem('solar_token');
      const res = await fetch(`${API_BASE}/api/team/roles/${roleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchRoles();
    } catch (err) {
      console.error('Delete role error:', err);
    }
  };

  const togglePermission = (permKey) => {
    setNewRolePermissions((prev) =>
      prev.includes(permKey) ? prev.filter((k) => k !== permKey) : [...prev, permKey]
    );
  };

  return (
    <div className="space-y-6 text-xs text-slate-800 dark:text-slate-100">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Company Sub-Accounts & Multi-Seat Workspaces
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 text-[10px] font-mono font-semibold">
              Resend Powered
            </span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
            Invite sales reps, canvassers, and managers to share your company's master lead credit pool.
            {seatInfo ? (
              <span className="block mt-1 text-blue-600 dark:text-blue-400 font-semibold font-mono">
                Seats: {seatInfo.crmSeats || members.length + 1}
                {seatInfo.crmUserLimit ? ` / ${seatInfo.crmUserLimit}` : ''}
                {seatInfo.packageId ? ` · ${seatInfo.packageId}` : ''}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowRoleModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#121826] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 font-semibold text-xs flex items-center gap-1.5 shadow-xs transition"
          >
            <span className="material-symbols-outlined text-[18px]">badge</span>
            <span>+ Create Role</span>
          </button>

          <button
            onClick={() => {
              setShowInviteModal(true);
              setInviteMessage('');
              setInviteError('');
              setLastGeneratedLink('');
            }}
            disabled={
              seatInfo?.crmUserLimit != null &&
              (seatInfo.crmSeats || members.length + 1) >= seatInfo.crmUserLimit
            }
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Invite Team Member</span>
          </button>
        </div>
      </div>

      {/* Seat Limit Notice Banner */}
      {seatInfo?.crmUserLimit != null && (seatInfo.crmSeats || members.length + 1) >= seatInfo.crmUserLimit && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[18px] text-amber-600 dark:text-amber-400 shrink-0">info</span>
            <span className="text-xs">
              All <strong>{seatInfo.crmUserLimit} team seats</strong> included in your {seatInfo.packageId || 'current'} plan are in use. Upgrade your plan to unlock more seats.
            </span>
          </div>
          <a
            href="/billing#plans"
            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shrink-0 active:scale-95 flex items-center gap-1 shadow-xs"
          >
            <span className="material-symbols-outlined text-xs">rocket_launch</span>
            <span>Upgrade Plan</span>
          </a>
        </div>
      )}

      {/* Segmented Tab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-white/[0.08] pb-1">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 rounded-xl font-semibold text-xs transition flex items-center gap-2 ${
            activeTab === 'members'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">group</span>
          <span>Team Members ({members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 rounded-xl font-semibold text-xs transition flex items-center gap-2 ${
            activeTab === 'roles'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">shield_person</span>
          <span>Workspace Roles ({rolesData.allRoles?.length || 4})</span>
        </button>
      </div>

      {/* TAB 1: MEMBERS */}
      {activeTab === 'members' && (
        <div className="rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.02] font-mono text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-white/[0.08]">
                  <th className="px-5 py-3">Team Member</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Credit Access</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {members.map((m) => {
                  const roleColor = m.custom_role_color || (m.role === 'manager' ? 'purple' : m.role === 'canvasser' ? 'amber' : 'blue');
                  const roleStyle = COLOR_CLASSES[roleColor] || COLOR_CLASSES.blue;
                  const isPending = m.status === 'pending';

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 flex items-center justify-center font-bold text-xs font-mono">
                            {(m.name || m.member_email).substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-xs">
                              {m.name || (isPending ? 'Pending Invitee' : 'Workspace Member')}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                              {m.member_email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`capitalize font-semibold px-2.5 py-1 rounded-lg border text-[11px] ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                          {m.custom_role_name || m.role?.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        {isPending ? (
                          <span className="text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-500/20 text-[10px] uppercase font-mono inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            Pending Invite
                          </span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/20 text-[10px] uppercase font-mono inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                        Shared Master Pool
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && m.inviteLink && (
                            <button
                              onClick={() => handleCopyLink(m.inviteLink, m.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition flex items-center gap-1"
                              title="Copy direct invite link"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {copiedId === m.id ? 'check' : 'content_copy'}
                              </span>
                              <span>{copiedId === m.id ? 'Copied!' : 'Copy Link'}</span>
                            </button>
                          )}

                          {isPending && (
                            <button
                              onClick={() => handleResend(m.id)}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[11px] font-semibold transition flex items-center gap-1"
                              title="Resend email invitation via Resend"
                            >
                              <span className="material-symbols-outlined text-[14px]">send</span>
                              <span>Resend</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleRevoke(m.id)}
                            className="text-rose-600 hover:text-rose-700 font-semibold text-xs px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {members.length === 0 && !loading && (
                  <tr>
                    <td colSpan="5" className="text-center py-12 text-slate-500 dark:text-slate-400 text-xs">
                      No team members invited yet. Invite sales reps or canvassers to collaborate!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rolesData.allRoles?.map((r) => {
              const roleStyle = COLOR_CLASSES[r.color || 'blue'] || COLOR_CLASSES.blue;
              return (
                <div
                  key={r.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3 relative group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`capitalize font-bold px-2.5 py-0.5 rounded-lg border text-xs ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                          {r.name}
                        </span>
                        {r.isDefault && (
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Default</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                        {r.description || 'Custom workspace role with tailored permissions.'}
                      </p>
                    </div>

                    {!r.isDefault && (
                      <button
                        onClick={() => handleDeleteRole(r.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition"
                        title="Delete custom role"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    )}
                  </div>

                  {/* Permissions Chips */}
                  <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">
                      Granted Privileges ({r.permissions?.length || 0})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {r.permissions?.map((p) => {
                        const def = PERMISSION_DEFINITIONS.find((d) => d.key === p);
                        return (
                          <span
                            key={p}
                            className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 text-[10px] font-medium"
                          >
                            {def?.label || p}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 text-left">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[22px]">mail</span>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Invite Team Member</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              We'll send an invitation email via <strong>Resend</strong>. When the invited team member clicks the link, they will set their password and gain instant access to your workspace.
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Member Email Address
                </label>
                <input
                  type="email"
                  placeholder="salesrep@solarcompany.com"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="w-full mt-1.5 bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs transition"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Assigned Workspace Role
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setShowRoleModal(true);
                    }}
                    className="text-blue-600 dark:text-blue-400 text-[11px] font-semibold hover:underline"
                  >
                    + Create New Role
                  </button>
                </div>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs transition font-medium"
                >
                  <optgroup label="Standard Roles">
                    {rolesData.defaultRoles?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} — {r.description}
                      </option>
                    ))}
                  </optgroup>

                  {rolesData.customRoles?.length > 0 && (
                    <optgroup label="Your Custom Workspace Roles">
                      {rolesData.customRoles.map((cr) => (
                        <option key={cr.id} value={String(cr.id)}>
                          {cr.name} (Custom)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {inviteMessage && (
                <div className="space-y-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs">
                  <p className="font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    {inviteMessage}
                  </p>
                  {lastGeneratedLink && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        readOnly
                        value={lastGeneratedLink}
                        className="flex-1 bg-white dark:bg-black/40 border border-emerald-300 dark:border-emerald-500/30 rounded-lg p-1.5 text-[11px] font-mono"
                      />
                      <button
                        onClick={() => handleCopyLink(lastGeneratedLink, 'modal')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-[11px] shrink-0"
                      >
                        {copiedId === 'modal' ? 'Copied!' : 'Copy Link'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {inviteError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-xl border border-rose-200 dark:border-rose-500/20">
                  {inviteError}
                </p>
              )}
            </div>

            <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100 dark:border-white/10">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-semibold text-xs transition"
              >
                Close
              </button>
              <button
                onClick={handleInvite}
                disabled={inviteSending}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                {inviteSending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Sending via Resend...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    <span>Send Invite</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600 text-[22px]">verified_user</span>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Create Custom Workspace Role</h3>
              </div>
              <button
                onClick={() => setShowRoleModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4">
              {roleError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-xl border border-rose-200 dark:border-rose-500/20">
                  {roleError}
                </p>
              )}

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Role Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Solar Closer, Field Surveyor, Lead Qualifier"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full mt-1.5 bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Summary of responsibilities and permissions"
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  className="w-full mt-1.5 bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                  Badge Color
                </label>
                <div className="flex gap-2">
                  {Object.keys(COLOR_CLASSES).map((colorKey) => (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => setNewRoleColor(colorKey)}
                      className={`px-3 py-1.5 rounded-xl capitalize font-semibold text-xs border transition ${
                        newRoleColor === colorKey
                          ? 'ring-2 ring-blue-500 shadow-xs'
                          : 'opacity-70 hover:opacity-100'
                      } ${COLOR_CLASSES[colorKey].bg} ${COLOR_CLASSES[colorKey].text} ${COLOR_CLASSES[colorKey].border}`}
                    >
                      {colorKey}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permissions Checklist */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                  Role Privileges & Permissions
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 dark:bg-black/20 p-3 rounded-xl border border-slate-200/80 dark:border-white/10">
                  {PERMISSION_DEFINITIONS.map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/5 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={newRolePermissions.includes(perm.key)}
                        onChange={() => togglePermission(perm.key)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">
                        {perm.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-semibold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={roleSaving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition active:scale-95 disabled:opacity-50"
                >
                  {roleSaving ? 'Saving Role...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
