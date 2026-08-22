import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import { API_BASE } from '../config.js';
import { invoiceNumber, openInvoicePdf } from '../utils/invoicePdf.js';
import { setToken } from '../lib/auth.js';

import TeamWorkspacePanel from '../components/TeamWorkspacePanel';
import TerritoryAnalyticsPanel from '../components/TerritoryAnalyticsPanel';
import AdminMarketplacePanel from '../components/marketplace/AdminMarketplacePanel';
import AdminIntegrationsPanel from '../components/admin/AdminIntegrationsPanel';

function ActionBanner({ type, message }) {
  if (!message) return null;
  const ok = type === 'success';
  return (
    <div
      className={`rounded-lg px-3 py-2.5 text-xs font-semibold flex items-start gap-2 border ${
        ok
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          : 'bg-red-500/15 text-red-300 border-red-500/30'
      }`}
    >
      <span className="material-symbols-outlined text-base leading-none mt-0.5">
        {ok ? 'check_circle' : 'error'}
      </span>
      <span>{message}</span>
    </div>
  );
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'marketplace', label: 'Marketplace', icon: 'storefront' },
  { id: 'team', label: 'Team Workspace', icon: 'groups' },
  { id: 'territory', label: 'Territory Analytics', icon: 'analytics' },
  { id: 'users', label: 'Users', icon: 'group' },
  { id: 'subscriptions', label: 'Subscriptions', icon: 'card_membership' },
  { id: 'plans', label: 'Plans', icon: 'sell' },
  { id: 'apis', label: 'APIs', icon: 'api' },
  { id: 'integrations', label: 'Integrations', icon: 'extension' },
  { id: 'inquiries', label: 'Inquiries', icon: 'mail' },
  { id: 'tickets', label: 'Tickets', icon: 'support_agent' }
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [apis, setApis] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [userDetail, setUserDetail] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [creditAdjustAmount, setCreditAdjustAmount] = useState(10);
  const [creditNote, setCreditNote] = useState('');
  const [creditMode, setCreditMode] = useState('add');
  const [creditMsg, setCreditMsg] = useState('');
  const [creditMsgType, setCreditMsgType] = useState('success');
  const [creditBusy, setCreditBusy] = useState(false);
  const [assignPlanId, setAssignPlanId] = useState('');
  const [planNote, setPlanNote] = useState('');
  const [planInvoiceReason, setPlanInvoiceReason] = useState('manual grant');
  const [planComplimentary, setPlanComplimentary] = useState(false);
  const [planMsg, setPlanMsg] = useState('');
  const [planMsgType, setPlanMsgType] = useState('success');
  const [planBusy, setPlanBusy] = useState(false);
  const planBusyRef = useRef(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordMsgType, setPasswordMsgType] = useState('success');
  const [revealedPassword, setRevealedPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [planForm, setPlanForm] = useState({
    id: '',
    name: '',
    lead_limit: 25,
    price: 299,
    description: '',
    features: '["Lead unlocks/month","CSV export"]',
    is_active: true,
    stripe_price_id: '',
    razorpay_plan_id: '',
    billing_interval: 'month',
    is_subscription: true
  });
  const [ticketDetail, setTicketDetail] = useState(null);
  const [reply, setReply] = useState('');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('solar_token')}`,
    'Content-Type': 'application/json'
  });

  const loadTab = useCallback(async (active) => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      navigate('/login');
      return;
    }
    setError('');
    try {
      if (active === 'dashboard') {
        const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: authHeaders() });
        if (res.status === 403) {
          setError('Admin access required.');
          return;
        }
        if (!res.ok) throw new Error('Failed to load stats');
        setStats(await res.json());
      }
      if (active === 'users') {
        const [usersRes, plansRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/users?q=${encodeURIComponent(q)}`, { headers: authHeaders() }),
          fetch(`${API_BASE}/api/admin/plans`, { headers: authHeaders() })
        ]);
        if (!usersRes.ok) throw new Error('Failed to load users');
        setUsers(await usersRes.json());
        if (plansRes.ok) setPlans(await plansRes.json());
      }
      if (active === 'subscriptions') {
        const res = await fetch(`${API_BASE}/api/admin/subscriptions`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load subscriptions');
        setSubs(await res.json());
      }
      if (active === 'plans') {
        const res = await fetch(`${API_BASE}/api/admin/plans`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load plans');
        setPlans(await res.json());
      }
      if (active === 'apis') {
        const res = await fetch(`${API_BASE}/api/admin/apis?days=7`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load APIs');
        const data = await res.json();
        setApis(data.providers || []);
      }
      if (active === 'inquiries') {
        const res = await fetch(`${API_BASE}/api/admin/inquiries`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load inquiries');
        setInquiries(await res.json());
      }
      if (active === 'tickets') {
        const res = await fetch(`${API_BASE}/api/tickets`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load tickets');
        setTickets(await res.json());
      }
    } catch (err) {
      setError(err.message);
    }
  }, [navigate, q]);

  useEffect(() => {
    const t = searchParams.get('tab');
    const normalized = t === 'crm' || t === 'email' ? 'integrations' : t;
    if (normalized && TABS.some((x) => x.id === normalized)) setTab(normalized);
  }, [searchParams]);

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  const switchTab = (id) => {
    setTab(id);
    setSearchParams({ tab: id });
    setTicketDetail(null);
    setUserDetail(null);
    setSelectedUserId(null);
  };

  const bootstrapAdmin = async () => {
    const res = await fetch(`${API_BASE}/api/admin/bootstrap`, {
      method: 'POST',
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Bootstrap failed');
      return;
    }
    if (data.token) setToken(data.token);
    alert('You are now an admin');
    loadTab(tab);
  };

  const openUser = async (id, { keepFeedback = false } = {}) => {
    setSelectedUserId(id);
    if (!keepFeedback) {
      setCreditMsg('');
      setPlanMsg('');
      setPasswordMsg('');
      setRevealedPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    const res = await fetch(`${API_BASE}/api/admin/users/${id}`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setUserDetail(data);
      setAssignPlanId(data.package?.packageId || data.subscription?.packageId || '');
    } else {
      const data = await res.json().catch(() => ({}));
      const err = data.error || 'Failed to load user profile';
      setCreditMsg(err);
      setCreditMsgType('error');
      toast.error(err);
      setUserDetail(null);
    }
  };

  const viewUserInvoicePdf = async (invoiceId, { download = false } = {}) => {
    if (!invoiceId) return;
    try {
      await openInvoicePdf(invoiceId, { download });
    } catch (err) {
      toast.error(err.message || 'Could not open invoice PDF');
    }
  };

  const selectedPlanMeta = plans.find((p) => p.id === assignPlanId);
  const selectedPlanPrice = Number(selectedPlanMeta?.price || 0);
  const invoicePreviewAmount = planComplimentary ? 0 : selectedPlanPrice;

  const grantPlan = async (e) => {
    if (!selectedUserId || !assignPlanId || planBusyRef.current) return;
    planBusyRef.current = true;
    if (e?.currentTarget) e.currentTarget.disabled = true;
    setPlanBusy(true);
    setPlanMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${selectedUserId}/plan`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          packageId: assignPlanId,
          complimentary: planComplimentary,
          invoiceReason: planComplimentary ? 'comp' : planInvoiceReason,
          note: planNote.trim() || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data.error || 'Plan grant failed';
        setPlanMsgType('error');
        setPlanMsg(err);
        toast.error(err);
        return;
      }
      const successMsg =
        planComplimentary || data.complimentary
          ? 'Complimentary plan applied — $0 invoice created'
          : 'Plan added and invoice generated';
      setPlanMsgType('success');
      setPlanMsg(successMsg);
      toast.success(successMsg);
      setPlanNote('');
      await openUser(selectedUserId, { keepFeedback: true });
      loadTab('users');
    } catch {
      const err = 'Plan grant failed';
      setPlanMsgType('error');
      setPlanMsg(err);
      toast.error(err);
    } finally {
      planBusyRef.current = false;
      setPlanBusy(false);
    }
  };

  const restrictPlan = async (restrict) => {
    if (!selectedUserId || planBusyRef.current) return;
    planBusyRef.current = true;
    setPlanBusy(true);
    setPlanMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${selectedUserId}/restrict-plan`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          restrict,
          packageId: restrict ? assignPlanId || 'Free' : undefined,
          note: planNote.trim() || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data.error || 'Restrict plan failed';
        setPlanMsgType('error');
        setPlanMsg(err);
        toast.error(err);
        return;
      }
      const successMsg = restrict ? 'Plan restricted' : 'Restriction lifted';
      setPlanMsgType('success');
      setPlanMsg(successMsg);
      toast.success(successMsg);
      await openUser(selectedUserId, { keepFeedback: true });
      loadTab('users');
    } catch {
      const err = 'Restrict plan failed';
      setPlanMsgType('error');
      setPlanMsg(err);
      toast.error(err);
    } finally {
      planBusyRef.current = false;
      setPlanBusy(false);
    }
  };

  const resetUserPassword = async ({ generate = false } = {}) => {
    if (!selectedUserId || passwordBusy) return;
    setPasswordMsg('');
    setRevealedPassword('');

    if (!generate) {
      if (newPassword.length < 8) {
        const err = 'Password must be at least 8 characters';
        setPasswordMsgType('error');
        setPasswordMsg(err);
        toast.error(err);
        return;
      }
      if (newPassword !== confirmPassword) {
        const err = 'Passwords do not match';
        setPasswordMsgType('error');
        setPasswordMsg(err);
        toast.error(err);
        return;
      }
    }

    setPasswordBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${selectedUserId}/reset-password`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(generate ? { generate: true } : { password: newPassword, newPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data.error || 'Password reset failed';
        setPasswordMsgType('error');
        setPasswordMsg(err);
        toast.error(err);
        return;
      }
      const successMsg = generate
        ? 'Password reset successfully — copy the temporary password now'
        : 'Password reset successfully';
      setPasswordMsgType('success');
      setPasswordMsg(successMsg);
      toast.success(successMsg);
      setRevealedPassword(data.temporaryPassword || '');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      const err = 'Password reset failed';
      setPasswordMsgType('error');
      setPasswordMsg(err);
      toast.error(err);
    } finally {
      setPasswordBusy(false);
    }
  };

  const applyCredits = async () => {
    if (!selectedUserId || creditBusy) return;
    setCreditMsg('');
    setCreditBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${selectedUserId}/credits`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          amount: Number(creditAdjustAmount),
          mode: creditMode,
          note: creditNote.trim() || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data.error || 'Credit adjustment failed';
        setCreditMsgType('error');
        setCreditMsg(err);
        toast.error(err);
        return;
      }
      const applied = Math.abs(Number(data.applied ?? data.amount ?? creditAdjustAmount) || 0);
      let successMsg = `Credits updated — new balance: ${data.credits}`;
      if (creditMode === 'add' || data.mode === 'add') {
        successMsg = `${applied} credits added`;
      } else if (creditMode === 'subtract' || data.mode === 'subtract') {
        successMsg = `${applied} credits deducted`;
        if (data.clamped) successMsg += ' (balance floored at 0)';
      } else if (creditMode === 'set' || data.mode === 'set') {
        successMsg = `Credit balance set to ${data.credits}`;
      }
      setCreditMsgType('success');
      setCreditMsg(successMsg);
      toast.success(successMsg);
      setCreditNote('');
      await openUser(selectedUserId, { keepFeedback: true });
      loadTab('users');
    } catch {
      const err = 'Credit adjustment failed';
      setCreditMsgType('error');
      setCreditMsg(err);
      toast.error(err);
    } finally {
      setCreditBusy(false);
    }
  };

  const toggleStatus = async (userId, current) => {
    const status = current === 'suspended' ? 'active' : 'suspended';
    await fetch(`${API_BASE}/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status })
    });
    loadTab('users');
    if (selectedUserId === userId) openUser(userId);
  };

  const toggleStatusFromDetail = async () => {
    if (!userDetail?.user) return;
    await toggleStatus(userDetail.user.id, userDetail.user.account_status);
  };

  const createPlan = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/api/admin/plans`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(planForm)
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Create failed');
      return;
    }
    setPlanForm({
      id: '',
      name: '',
      lead_limit: 25,
      price: 299,
      description: '',
      features: '["Lead unlocks"]',
      is_active: true
    });
    loadTab('plans');
  };

  const togglePlan = async (plan) => {
    await fetch(`${API_BASE}/api/admin/plans/${plan.id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ is_active: !Number(plan.is_active) })
    });
    loadTab('plans');
  };

  const openTicket = async (id) => {
    const res = await fetch(`${API_BASE}/api/tickets/${id}`, { headers: authHeaders() });
    if (res.ok) setTicketDetail(await res.json());
  };

  const sendReply = async () => {
    if (!ticketDetail || !reply.trim()) return;
    await fetch(`${API_BASE}/api/tickets/${ticketDetail.ticket.id}/messages`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ body: reply })
    });
    setReply('');
    openTicket(ticketDetail.ticket.id);
  };

  const setTicketStatus = async (status) => {
    await fetch(`${API_BASE}/api/tickets/${ticketDetail.ticket.id}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status })
    });
    openTicket(ticketDetail.ticket.id);
    loadTab('tickets');
  };

  return (
    <>
      <Toaster theme="dark" position="top-center" richColors />
      <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-label-mono text-[9px] font-bold uppercase mb-2">
            SolarX.live Operator Console
          </div>
          <h2 className="font-headline-lg text-2xl font-bold text-white">Admin Control Center</h2>
          <p className="text-on-surface-variant text-sm mt-1">Users, plans, billing, API health, and support.</p>
        </div>
        <Link to="/support" className="text-xs text-primary font-semibold hover:underline">
          Open user support view →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
              tab === t.id ? 'bg-primary text-on-primary' : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs flex flex-wrap gap-3 items-center justify-between">
          <span>{error}</span>
          <button onClick={bootstrapAdmin} className="bg-primary text-on-primary px-3 py-1.5 rounded-lg font-bold">
            Become First Admin
          </button>
        </div>
      )}

      {tab === 'dashboard' && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {[
            ['TOTAL USERS', stats.totalUsers, `${stats.activeUsers} active`],
            ['REVENUE (PAID)', `$${(stats.revenueCents / 100).toLocaleString()}`, `${stats.paidOrders} orders`],
            ['ACTIVE SUBS', stats.activeSubscriptions, `${stats.remainingCredits} credits left`],
            ['OPEN TICKETS', stats.openTickets, `${stats.newUsers7d} new users / 7d`]
          ].map(([label, value, sub]) => (
            <div key={label} className="glass-card p-5 rounded-xl">
              <p className="font-label-mono text-[9px] text-on-surface-variant uppercase">{label}</p>
              <h3 className="text-2xl font-bold text-white mt-1.5 font-mono tabular-nums">{value}</h3>
              <p className="text-on-surface-variant text-[10px] mt-2">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'marketplace' && <AdminMarketplacePanel />}
      {tab === 'integrations' && <AdminIntegrationsPanel />}

      {tab === 'team' && <TeamWorkspacePanel />}

      {tab === 'territory' && <TerritoryAnalyticsPanel />}

      {tab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadTab('users')}
                placeholder="Search users…"
                className="bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-xs text-white w-64"
              />
              <button onClick={() => loadTab('users')} className="text-xs bg-white/10 px-3 py-2 rounded-lg">
                Search
              </button>
            </div>
            <div className="glass-card rounded-xl overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/5 text-on-surface-variant uppercase text-[9px] sticky top-0">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Credits</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass-stroke">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => openUser(u.id)}
                      className={`cursor-pointer hover:bg-white/5 ${
                        selectedUserId === u.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="text-white font-semibold">{u.name}</p>
                        <p className="text-on-surface-variant">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-white">{u.plan}</td>
                      <td className="px-4 py-3 font-mono text-white">{u.credits}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            u.account_status === 'suspended'
                              ? 'text-red-400'
                              : u.account_status === 'restricted'
                                ? 'text-amber-400'
                                : 'text-green-400'
                          }
                        >
                          {u.account_status || 'active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-on-surface-variant text-center">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card p-4 rounded-xl min-h-[420px] max-h-[85vh] overflow-y-auto flex flex-col">
            {!userDetail ? (
              <p className="text-on-surface-variant m-auto">Select a user to view profile</p>
            ) : (
              <>
                <div className="flex justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-white font-bold text-sm">{userDetail.user.name}</h3>
                    <p className="text-on-surface-variant mt-0.5">{userDetail.user.email}</p>
                  </div>
                  <button
                    onClick={toggleStatusFromDetail}
                    className="text-[10px] bg-white/10 px-2 py-1 rounded self-start"
                  >
                    {userDetail.user.account_status === 'suspended' ? 'Activate' : 'Suspend'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    ['Company', userDetail.user.company_name || '—'],
                    ['Role', userDetail.user.role || 'solar_company'],
                    ['Phone', userDetail.user.phone || '—'],
                    ['Joined', userDetail.user.created_at ? new Date(userDetail.user.created_at).toLocaleDateString() : '—'],
                    ['Account', userDetail.user.account_status || 'active'],
                    ['Credits', userDetail.credits]
                  ].map(([label, value]) => (
                    <div key={label} className="bg-white/5 rounded-lg p-2">
                      <p className="text-[9px] text-on-surface-variant uppercase">{label}</p>
                      <p className="text-white font-semibold mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mb-4 p-3 rounded-lg bg-white/5 space-y-2">
                  <p className="text-[9px] text-on-surface-variant uppercase">Package & Subscription</p>
                  <p className="text-white">
                    Plan: {userDetail.package?.packageName || 'None'}{' '}
                    {userDetail.package?.purchasedLeads != null && (
                      <span className="text-on-surface-variant">
                        · purchased {userDetail.package.purchasedLeads} · remaining {userDetail.package.remainingLeads}
                      </span>
                    )}
                  </p>
                  {userDetail.subscription ? (
                    <p className="text-on-surface-variant">
                      Sub: {userDetail.subscription.packageName || userDetail.subscription.packageId} ·{' '}
                      {userDetail.subscription.status}
                      {userDetail.subscription.currentPeriodEnd && (
                        <> · renews {new Date(userDetail.subscription.currentPeriodEnd).toLocaleDateString()}</>
                      )}
                      {userDetail.subscription.cancelAtPeriodEnd && (
                        <span className="text-amber-400"> · cancel pending</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-on-surface-variant">No active billing subscription record.</p>
                  )}
                  {userDetail.user.account_status === 'restricted' && (
                    <p className="text-amber-400 text-[10px]">Upgrades locked — plan is restricted.</p>
                  )}

                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <p className="text-[9px] text-on-surface-variant uppercase">Add plan & generate invoice</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <select
                        value={assignPlanId}
                        onChange={(e) => setAssignPlanId(e.target.value)}
                        className="flex-1 min-w-[140px] bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-white"
                      >
                        <option value="">Select plan…</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.id}) · ${Number(p.price || 0).toLocaleString()} · {p.lead_limit} credits
                          </option>
                        ))}
                      </select>
                      <select
                        value={planInvoiceReason}
                        onChange={(e) => {
                          setPlanInvoiceReason(e.target.value);
                          if (e.target.value === 'comp') setPlanComplimentary(true);
                          else if (planComplimentary && e.target.value !== 'comp') setPlanComplimentary(false);
                        }}
                        className="bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-white"
                      >
                        <option value="manual grant">manual grant</option>
                        <option value="paid offline">paid offline</option>
                        <option value="comp">comp</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-on-surface-variant">
                      <input
                        type="checkbox"
                        checked={planComplimentary}
                        onChange={(e) => {
                          setPlanComplimentary(e.target.checked);
                          if (e.target.checked) setPlanInvoiceReason('comp');
                          else if (planInvoiceReason === 'comp') setPlanInvoiceReason('manual grant');
                        }}
                      />
                      Complimentary (invoice $0)
                    </label>
                    <input
                      value={planNote}
                      onChange={(e) => setPlanNote(e.target.value)}
                      placeholder="Invoice note / reason (optional)"
                      className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-white"
                    />
                    <p className="text-[10px] text-on-surface-variant">
                      Invoice amount:{' '}
                      <span className="text-white font-semibold">
                        ${invoicePreviewAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {planComplimentary ? ' · comp' : ''}
                      {selectedPlanMeta ? ` · ${selectedPlanMeta.lead_limit} credits` : ''}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={planBusy || !assignPlanId}
                        onClick={grantPlan}
                        className="bg-primary text-on-primary px-3 py-1.5 rounded-lg font-bold disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {planBusy ? 'Saving…' : 'Add plan & generate invoice'}
                      </button>
                      {userDetail.user.account_status === 'restricted' ? (
                        <button
                          type="button"
                          disabled={planBusy}
                          onClick={() => restrictPlan(false)}
                          className="bg-white/10 text-white px-3 py-1.5 rounded-lg font-bold disabled:opacity-50 disabled:pointer-events-none"
                        >
                          Lift restriction
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={planBusy}
                          onClick={() => restrictPlan(true)}
                          className="bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-lg font-bold disabled:opacity-50 disabled:pointer-events-none"
                        >
                          Restrict plan
                        </button>
                      )}
                    </div>
                    <ActionBanner type={planMsgType} message={planMsg} />
                  </div>
                </div>

                <div className="mb-4 p-3 rounded-lg bg-white/5">
                  <p className="text-[9px] text-on-surface-variant uppercase mb-1">Leads & Support</p>
                  <p className="text-white">
                    {userDetail.leads?.total ?? 0} total leads
                    {userDetail.leads?.last7d > 0 && (
                      <span className="text-on-surface-variant"> · {userDetail.leads.last7d} in last 7 days</span>
                    )}
                  </p>
                  {userDetail.leads?.byStatus && Object.keys(userDetail.leads.byStatus).length > 0 && (
                    <p className="text-on-surface-variant mt-1">
                      {Object.entries(userDetail.leads.byStatus)
                        .map(([s, n]) => `${s}: ${n}`)
                        .join(' · ')}
                    </p>
                  )}
                  <p className="text-on-surface-variant mt-1">
                    {userDetail.tickets?.open ?? 0} open / {userDetail.tickets?.total ?? 0} support tickets
                  </p>
                </div>

                {userDetail.recentActivity?.length > 0 && (
                  <div className="mb-4 max-h-28 overflow-y-auto space-y-1">
                    <p className="text-[9px] text-on-surface-variant uppercase mb-1">Recent Activity</p>
                    {userDetail.recentActivity.map((a) => (
                      <div key={a.id} className="text-[10px] bg-white/5 rounded p-1.5">
                        <span className="text-primary">{a.type}</span>
                        {a.lead_address && <span className="text-on-surface-variant"> · {a.lead_address}</span>}
                        <span className="text-on-surface-variant"> · {new Date(a.created_at).toLocaleString()}</span>
                        {a.content && <p className="text-white mt-0.5 line-clamp-1">{a.content}</p>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-glass-stroke space-y-2">
                  <p className="text-[9px] text-on-surface-variant uppercase">Adjust Credits</p>
                  <p className="text-white font-mono text-sm">Current balance: {userDetail.credits}</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      value={creditMode}
                      onChange={(e) => setCreditMode(e.target.value)}
                      className="bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-white"
                    >
                      <option value="add">Add credits</option>
                      <option value="subtract">Subtract credits</option>
                      <option value="set">Set absolute balance</option>
                    </select>
                    <input
                      type="number"
                      value={creditAdjustAmount}
                      onChange={(e) => setCreditAdjustAmount(e.target.value)}
                      className="w-24 bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-white font-mono"
                    />
                    <input
                      value={creditNote}
                      onChange={(e) => setCreditNote(e.target.value)}
                      placeholder="Optional note…"
                      className="flex-1 min-w-[120px] bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-white"
                    />
                    <button
                      type="button"
                      disabled={creditBusy}
                      onClick={applyCredits}
                      className="bg-primary text-on-primary px-3 py-1.5 rounded-lg font-bold disabled:opacity-50"
                    >
                      {creditBusy ? 'Saving…' : 'Apply'}
                    </button>
                  </div>
                  <ActionBanner type={creditMsgType} message={creditMsg} />
                  {userDetail.creditHistory?.length > 0 && (
                    <div className="max-h-24 overflow-y-auto space-y-1 pt-1">
                      <p className="text-[9px] text-on-surface-variant uppercase">Credit history</p>
                      {userDetail.creditHistory.map((h) => (
                        <p key={h.id} className="text-[10px] text-on-surface-variant">
                          {new Date(h.created_at).toLocaleString()} · {h.mode === 'set' ? 'set' : h.amount > 0 ? '+' : ''}
                          {h.amount} → {h.balance_after}
                          {h.note && <> · {h.note}</>}
                          {h.admin_name && <> · by {h.admin_name}</>}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {userDetail.invoices?.length > 0 && (
                  <div className="pt-3 border-t border-glass-stroke space-y-1">
                    <p className="text-[9px] text-on-surface-variant uppercase">Invoices / billing history</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {userDetail.invoices.map((inv) => (
                        <div key={inv.id} className="text-[10px] bg-white/5 rounded p-1.5 flex justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-white">
                              {invoiceNumber(inv.id)} · {inv.package_name || inv.package_id || '—'} · $
                              {(Number(inv.amount_cents || 0) / 100).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                              <span className="text-on-surface-variant"> · {inv.status}</span>
                            </p>
                            <p className="text-on-surface-variant">
                              {inv.created_at ? new Date(inv.created_at).toLocaleString() : ''}
                              {inv.description ? ` · ${inv.description}` : ''}
                              {inv.admin_name ? ` · by ${inv.admin_name}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => viewUserInvoicePdf(inv.id)}
                            className="text-primary font-bold shrink-0 self-start hover:underline"
                          >
                            View PDF
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-glass-stroke space-y-2">
                  <p className="text-[9px] text-on-surface-variant uppercase">Reset Password</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min 8)"
                      minLength={8}
                      autoComplete="new-password"
                      className="flex-1 min-w-[140px] bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-white"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      minLength={8}
                      autoComplete="new-password"
                      className="flex-1 min-w-[140px] bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-white"
                    />
                    <button
                      type="button"
                      disabled={passwordBusy}
                      onClick={() => resetUserPassword({ generate: false })}
                      className="bg-primary text-on-primary px-3 py-1.5 rounded-lg font-bold disabled:opacity-50"
                    >
                      {passwordBusy ? 'Saving…' : 'Reset password'}
                    </button>
                    <button
                      type="button"
                      disabled={passwordBusy}
                      onClick={() => resetUserPassword({ generate: true })}
                      className="bg-white/10 text-white px-3 py-1.5 rounded-lg font-bold disabled:opacity-50"
                    >
                      {passwordBusy ? 'Saving…' : 'Generate temporary password'}
                    </button>
                  </div>
                  <ActionBanner type={passwordMsgType} message={passwordMsg} />
                  {revealedPassword && (
                    <div className="flex flex-wrap gap-2 items-center bg-white/5 rounded-lg p-2">
                      <code className="text-white font-mono text-xs break-all flex-1">{revealedPassword}</code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(revealedPassword).catch(() => {});
                        }}
                        className="text-[10px] bg-white/10 px-2 py-1 rounded"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'subscriptions' && (
        <div className="glass-card rounded-xl overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-white/5 text-on-surface-variant uppercase text-[9px]">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3">Purchased</th>
                <th className="px-4 py-3">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-stroke">
              {subs.map((s) => (
                <tr key={`${s.user_id}-${s.package_id}`}>
                  <td className="px-4 py-3">
                    <p className="text-white font-semibold">{s.name}</p>
                    <p className="text-on-surface-variant">{s.email}</p>
                  </td>
                  <td className="px-4 py-3 text-white">{s.package_name || s.package_id}</td>
                  <td className="px-4 py-3 font-mono text-white">{s.remaining_leads}</td>
                  <td className="px-4 py-3 font-mono text-on-surface-variant">{s.purchased_leads}</td>
                  <td className="px-4 py-3 text-white">${Number(s.price || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'plans' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={createPlan} className="glass-card p-5 rounded-xl space-y-3 text-xs">
            <h3 className="text-white font-bold text-sm">Create Plan</h3>
            <input required placeholder="id (e.g. Pro50)" value={planForm.id}
              onChange={(e) => setPlanForm({ ...planForm, id: e.target.value })}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-white" />
            <input required placeholder="Display name" value={planForm.name}
              onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-white" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Credits / month" value={planForm.lead_limit}
                onChange={(e) => setPlanForm({ ...planForm, lead_limit: e.target.value })}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-white" />
              <input type="number" step="0.01" placeholder="Price USD / month" value={planForm.price}
                onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-white" />
            </div>
            <input placeholder="Stripe Price ID (price_...) — optional if using Razorpay" value={planForm.stripe_price_id}
              onChange={(e) => setPlanForm({ ...planForm, stripe_price_id: e.target.value })}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-white font-mono text-[11px]" />
            <input placeholder="Razorpay Plan ID (plan_...) — auto-created if keys set" value={planForm.razorpay_plan_id}
              onChange={(e) => setPlanForm({ ...planForm, razorpay_plan_id: e.target.value })}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-white font-mono text-[11px]" />
            <div className="flex flex-wrap gap-4 items-center">
              <label className="flex items-center gap-2 text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={planForm.is_subscription}
                  onChange={(e) => setPlanForm({ ...planForm, is_subscription: e.target.checked })}
                />
                Monthly subscription
              </label>
              <select
                value={planForm.billing_interval}
                onChange={(e) => setPlanForm({ ...planForm, billing_interval: e.target.value })}
                className="bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-white"
              >
                <option value="month">Bill monthly</option>
                <option value="one_time">One-time pack</option>
              </select>
            </div>
            <textarea placeholder="Description" value={planForm.description}
              onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-white" rows={2} />
            <textarea placeholder='Features JSON array' value={planForm.features}
              onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-white font-mono" rows={3} />
            <button type="submit" className="bg-primary text-on-primary font-bold px-4 py-2 rounded-lg">
              Create Plan
            </button>
          </form>
          <div className="space-y-3">
            {plans.map((p) => (
              <div key={p.id} className="glass-card p-4 rounded-xl text-xs flex justify-between gap-3">
                <div>
                  <p className="text-white font-bold">{p.name} <span className="text-on-surface-variant font-normal">({p.id})</span></p>
                  <p className="text-on-surface-variant mt-1">
                    {p.lead_limit} credits/{Number(p.is_subscription) ? 'month' : 'pack'} · ${Number(p.price).toLocaleString()}
                    {Number(p.is_subscription) ? '/mo' : ''} ·{' '}
                    {Number(p.is_active) ? <span className="text-green-400">Active</span> : <span className="text-red-400">Inactive</span>}
                  </p>
                  {p.razorpay_plan_id && (
                    <p className="text-on-surface-variant mt-1 font-mono text-[10px]">RZP: {p.razorpay_plan_id}</p>
                  )}
                  {p.stripe_price_id && (
                    <p className="text-on-surface-variant mt-1 font-mono text-[10px]">Stripe: {p.stripe_price_id}</p>
                  )}
                </div>
                {p.id !== 'Free' && (
                  <button onClick={() => togglePlan(p)} className="text-primary font-semibold self-start">
                    {Number(p.is_active) ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'apis' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-xs">
          {apis.length === 0 && (
            <p className="text-on-surface-variant col-span-full">No API providers loaded.</p>
          )}
          {apis.map((a) => (
            <div key={a.id} className="glass-card p-5 rounded-xl">
              <div className="flex justify-between items-start">
                <h3 className="text-white font-bold">{a.label}</h3>
                <span className={`text-[10px] font-bold uppercase ${a.configured ? 'text-green-400' : 'text-red-400'}`}>
                  {a.configured ? 'Configured' : 'Missing key'}
                </span>
              </div>
              <p className="text-on-surface-variant mt-3">Calls (7d): <span className="text-white font-semibold">{a.calls ?? 0}</span></p>
              <p className="text-on-surface-variant">Success / Errors: <span className="text-white font-semibold">{a.success ?? 0}</span> / <span className="text-white font-semibold">{a.errors ?? 0}</span></p>
              <p className="text-on-surface-variant">Avg latency: <span className="text-white font-semibold">{a.avgMs ?? 0}</span> ms</p>
            </div>
          ))}
          {apis.length > 0 && apis.every((a) => !a.calls) && (
            <p className="text-on-surface-variant col-span-full text-[11px]">
              Usage starts at 0 until APIs are called (map search, lead generate, bulk scan, billing). Refresh this tab after using the app.
            </p>
          )}
        </div>
      )}

      {tab === 'inquiries' && (
        <div className="glass-card rounded-xl overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-on-surface-variant">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Intent</th>
                <th className="px-4 py-3 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((row) => (
                <tr key={row.id} className="border-t border-glass-stroke align-top">
                  <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                    {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-white font-semibold">{row.name}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{row.company || '—'}</td>
                  <td className="px-4 py-3 text-primary">{row.email}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{row.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-primary/15 px-2 py-0.5 text-primary uppercase tracking-wide text-[10px]">
                      {row.intent}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant max-w-xs">
                    <span className="line-clamp-3">{row.message || '—'}</span>
                  </td>
                </tr>
              ))}
              {inquiries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-on-surface-variant text-center">
                    No marketing inquiries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="glass-card rounded-xl divide-y divide-glass-stroke max-h-[70vh] overflow-y-auto">
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => openTicket(t.id)}
                className="w-full text-left px-4 py-3 hover:bg-white/5"
              >
                <p className="text-white font-semibold">{t.subject}</p>
                <p className="text-on-surface-variant mt-1">
                  #{t.id} · {t.user_email} · <span className="text-primary">{t.status}</span>
                </p>
              </button>
            ))}
            {tickets.length === 0 && <p className="p-6 text-on-surface-variant">No tickets yet.</p>}
          </div>
          <div className="glass-card p-4 rounded-xl min-h-[320px] flex flex-col">
            {!ticketDetail ? (
              <p className="text-on-surface-variant m-auto">Select a ticket</p>
            ) : (
              <>
                <div className="flex justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-white font-bold">{ticketDetail.ticket.subject}</h3>
                    <p className="text-on-surface-variant">Status: {ticketDetail.ticket.status}</p>
                  </div>
                  <div className="flex gap-2">
                    {['in_progress', 'resolved', 'closed'].map((s) => (
                      <button key={s} onClick={() => setTicketStatus(s)} className="text-[10px] bg-white/10 px-2 py-1 rounded">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-grow space-y-2 overflow-y-auto max-h-[40vh] mb-3">
                  {ticketDetail.messages.map((m) => (
                    <div key={m.id} className={`p-2 rounded-lg ${m.sender_role === 'admin' ? 'bg-primary/10' : 'bg-white/5'}`}>
                      <p className="text-[10px] text-on-surface-variant mb-1">
                        {m.sender_name || m.sender_role} · {new Date(m.created_at).toLocaleString()}
                      </p>
                      <p className="text-white whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply as admin…"
                    className="flex-1 bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-white"
                  />
                  <button onClick={sendReply} className="bg-primary text-on-primary px-3 py-2 rounded-lg font-bold">
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
