import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { API_BASE } from '../config.js';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'users', label: 'Users', icon: 'group' },
  { id: 'subscriptions', label: 'Subscriptions', icon: 'card_membership' },
  { id: 'plans', label: 'Plans', icon: 'sell' },
  { id: 'apis', label: 'APIs', icon: 'api' },
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
  const [creditAmount, setCreditAmount] = useState(10);
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
        const res = await fetch(`${API_BASE}/api/admin/users?q=${encodeURIComponent(q)}`, {
          headers: authHeaders()
        });
        if (!res.ok) throw new Error('Failed to load users');
        setUsers(await res.json());
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
    if (t && TABS.some((x) => x.id === t)) setTab(t);
  }, [searchParams]);

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  const switchTab = (id) => {
    setTab(id);
    setSearchParams({ tab: id });
    setTicketDetail(null);
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
    if (data.token) localStorage.setItem('solar_token', data.token);
    alert('You are now an admin');
    loadTab(tab);
  };

  const toggleStatus = async (userId, current) => {
    const status = current === 'suspended' ? 'active' : 'suspended';
    await fetch(`${API_BASE}/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status })
    });
    loadTab('users');
  };

  const addCredits = async (userId) => {
    await fetch(`${API_BASE}/api/admin/users/${userId}/credits`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ amount: Number(creditAmount) })
    });
    loadTab('users');
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
    <AppLayout>
      <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-label-mono text-[9px] font-bold uppercase mb-2">
            SollarX Operator Console
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
              <h3 className="text-2xl font-bold text-white mt-1.5">{value}</h3>
              <p className="text-on-surface-variant text-[10px] mt-2">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
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
            <label className="text-xs text-on-surface-variant flex items-center gap-2">
              Credit +/-
              <input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="w-20 bg-surface-container-low border border-glass-stroke rounded px-2 py-1 text-white"
              />
            </label>
          </div>
          <div className="glass-card rounded-xl overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white/5 text-on-surface-variant uppercase text-[9px]">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Credits</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-stroke">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      <p className="text-white font-semibold">{u.name}</p>
                      <p className="text-on-surface-variant">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-white">{u.plan}</td>
                    <td className="px-4 py-3 font-mono text-white">{u.credits}</td>
                    <td className="px-4 py-3">
                      <span className={u.account_status === 'suspended' ? 'text-red-400' : 'text-green-400'}>
                        {u.account_status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => addCredits(u.id)} className="text-primary font-semibold">
                        +Credits
                      </button>
                      <button onClick={() => toggleStatus(u.id, u.account_status)} className="text-on-surface-variant">
                        {u.account_status === 'suspended' ? 'Activate' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </AppLayout>
  );
}
