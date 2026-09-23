import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { API_BASE } from '../../config.js';
import BiddingCountdown from './BiddingCountdown.jsx';
import { formatMoney, formatWhen, isBiddingOpen } from '../../lib/marketplace.js';

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('solar_token')}`,
    'Content-Type': 'application/json',
  };
}

const SUBTABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'settings', label: 'Settings' },
  { id: 'leads', label: 'Review & approve' },
  { id: 'disputes', label: 'Claims' },
  { id: 'installers', label: 'Installers' },
  { id: 'wallets', label: 'Wallets' },
];

const PENDING_STATUSES = ['new', 'ai_qualified', 'pending_admin'];
const canShowPurgeDemos = !import.meta.env.PROD;

function leadMatchesSearch(l, query) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    (l.leadCode || '').toLowerCase().includes(q) ||
    (l.homeownerName || '').toLowerCase().includes(q) ||
    (l.phone || '').toLowerCase().includes(q) ||
    (l.zip || '').toLowerCase().includes(q) ||
    (l.address || '').toLowerCase().includes(q)
  );
}

export default function AdminMarketplacePanel({
  activeSub,
  initialSub = 'leads',
  onSubChange,
}) {
  const [sub, setSubInternal] = useState(activeSub || initialSub);

  const setSub = (id) => {
    setSubInternal(id);
    onSubChange?.(id);
  };
  const [metrics, setMetrics] = useState(null);
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [bids, setBids] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [installers, setInstallers] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [areaUserId, setAreaUserId] = useState(null);
  const [areas, setAreas] = useState([]);
  const [walletForm, setWalletForm] = useState({ userId: '', amount: '100', mode: 'add', note: '' });
  const [areaForm, setAreaForm] = useState({ zip: '', state: '' });
  const [leadFilter, setLeadFilter] = useState('pending');
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    defaultBidWindowHours: '48',
    defaultMinBid: '25',
    maxExpansionStages: '3',
    expansionRadii: '25,50,100',
    minBidReductionPct: '20',
    lowPriceMinBid: '10',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusDraft, setStatusDraft] = useState('bidding');
  const [clearingDemos, setClearingDemos] = useState(false);

  const clearDemoData = async () => {
    if (
      !window.confirm(
        'Remove all seeded marketplace demo leads from the database? Real homeowner inquiries are kept.',
      )
    ) {
      return;
    }
    setClearingDemos(true);
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/admin/clear-demo`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear demo data');
      toast.success(data.summary?.message || 'Demo marketplace data removed');
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to clear demo data');
    } finally {
      setClearingDemos(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (sub === 'overview') {
        const res = await fetch(`${API_BASE}/api/marketplace/admin/metrics`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMetrics(data);
      } else if (sub === 'settings') {
        const res = await fetch(`${API_BASE}/api/marketplace/admin/settings`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const s = data.settings || {};
        setSettings(s);
        setSettingsForm({
          defaultBidWindowHours: String(s.default_bid_window_hours ?? 48),
          defaultMinBid: String(s.default_min_bid ?? 25),
          maxExpansionStages: String(s.max_expansion_stages ?? 3),
          expansionRadii: (() => {
            try {
              const arr = typeof s.expansion_radius_miles_json === 'string'
                ? JSON.parse(s.expansion_radius_miles_json)
                : s.expansion_radius_miles_json;
              return Array.isArray(arr) ? arr.join(',') : '25,50,100';
            } catch {
              return '25,50,100';
            }
          })(),
          minBidReductionPct: String(s.min_bid_reduction_pct ?? 20),
          lowPriceMinBid: String(s.low_price_min_bid ?? 10),
        });
      } else if (sub === 'leads') {
        const res = await fetch(`${API_BASE}/api/marketplace/admin/leads`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setLeads(data.leads || []);
        setSelectedLeadIds([]);
      } else if (sub === 'disputes') {
        const res = await fetch(`${API_BASE}/api/marketplace/admin/disputes`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setDisputes(data.disputes || []);
      } else if (sub === 'installers') {
        const res = await fetch(`${API_BASE}/api/marketplace/admin/installers`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setInstallers(data.installers || []);
      } else if (sub === 'wallets') {
        const res = await fetch(`${API_BASE}/api/marketplace/admin/wallets`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setWallets(data.wallets || []);
        setLedger(data.recentLedger || []);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [sub]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const next = activeSub || initialSub;
    if (next && next !== sub) {
      setSubInternal(next);
    }
    // Only react to parent URL / prop changes — not local sub flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSub, initialSub]);

  const openLead = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/admin/leads/${id}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelected(data.lead);
      setBids(data.bids || []);
      setStatusDraft(data.lead?.status || 'bidding');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const closeBidding = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/admin/leads/${id}/close-bidding`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Close result: ${data.result?.action}`);
      load();
      openLead(id);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const selectWinner = async (leadId, bidId) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/marketplace/admin/leads/${leadId}/select-winner`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ bidId }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Winner selected');
      load();
      openLead(leadId);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/admin/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      toast.success(`Lead status updated to: ${newStatus}`);
      load();
      openLead(leadId);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const reQualifyLead = async (leadId) => {
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/admin/leads/${leadId}/re-qualify`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Re-qualify failed');
      toast.success(`Re-qualified — status: ${data.lead?.status || 'updated'}`);
      load();
      openLead(leadId);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const verifyLeadContact = async (leadId) => {
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/admin/leads/${leadId}/verify-contact`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      toast.success('Contact verification complete');
      setSelected(data.lead);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const approveLead = async (leadId) => {
    if (!window.confirm('Approve this lead and send it to the installer marketplace for bids?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/admin/leads/${leadId}/approve`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approve failed');
      toast.success(`Approved — now ${data.lead?.status || 'bidding'} in marketplace`);
      setSelected(data.lead);
      load();
      openLead(leadId);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const visibleLeads = leads.filter((l) => {
    if (leadFilter === 'pending') {
      if (!PENDING_STATUSES.includes(l.status)) return false;
    } else if (leadFilter !== 'all' && l.status !== leadFilter) {
      return false;
    }
    return leadMatchesSearch(l, leadSearch);
  });

  const pendingVisibleIds = visibleLeads.filter((l) => PENDING_STATUSES.includes(l.status)).map((l) => l.id);

  const toggleLeadSelected = (id, checked) => {
    setSelectedLeadIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const toggleSelectVisiblePending = (checked) => {
    setSelectedLeadIds(checked ? pendingVisibleIds : []);
  };

  const bulkApproveLeads = async () => {
    const ids = selectedLeadIds.filter((id) => pendingVisibleIds.includes(id));
    if (!ids.length) {
      toast.error('Select pending leads to approve');
      return;
    }
    if (!window.confirm(`Approve ${ids.length} lead${ids.length === 1 ? '' : 's'} and send them to the marketplace for bidding?`)) {
      return;
    }
    setBulkApproving(true);
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/admin/leads/bulk-approve`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ leadIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk approve failed');
      const okCount = Number(data.approvedCount) || 0;
      const skipCount = Number(data.skippedCount) || 0;
      const failCount = Number(data.failedCount) || 0;
      toast.success(
        `Approved ${okCount} → marketplace` +
          (skipCount || failCount ? ` · skipped ${skipCount} · failed ${failCount}` : ''),
      );
      setSelectedLeadIds([]);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBulkApproving(false);
    }
  };

  const contactCheckBadge = (ok, label) => (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
        ok
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30'
      }`}
    >
      {ok ? '✓' : '✗'} {label}
    </span>
  );

  const reviewDispute = async (id, decision) => {
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/admin/disputes/${id}/review`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Dispute ${decision}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setVerification = async (userId, verificationStatus) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/marketplace/admin/installers/${userId}/verification`,
        {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ verificationStatus }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Updated');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const loadAreas = async (userId) => {
    setAreaUserId(userId);
    const res = await fetch(
      `${API_BASE}/api/marketplace/admin/installers/${userId}/service-areas`,
      { headers: authHeaders() },
    );
    const data = await res.json();
    if (res.ok) setAreas(data.areas || []);
  };

  const addArea = async (e) => {
    e.preventDefault();
    if (!areaUserId) return;
    const res = await fetch(
      `${API_BASE}/api/marketplace/admin/installers/${areaUserId}/service-areas`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(areaForm),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Failed');
      return;
    }
    toast.success('Area added');
    setAreaForm({ zip: '', state: '', radiusMiles: '25' });
    loadAreas(areaUserId);
    load();
  };

  const deleteArea = async (areaId) => {
    if (!areaUserId) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/marketplace/admin/installers/${areaUserId}/service-areas/${areaId}`,
        {
          method: 'DELETE',
          headers: authHeaders(),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove area');
      toast.success('Service area removed');
      loadAreas(areaUserId);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const adjustWallet = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(
        `${API_BASE}/api/marketplace/admin/wallets/${walletForm.userId}/adjust`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            amount: Number(walletForm.amount),
            mode: walletForm.mode,
            note: walletForm.note,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Balance now ${formatMoney(data.balance)}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const radii = settingsForm.expansionRadii
        .split(',')
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);

      const res = await fetch(`${API_BASE}/api/marketplace/admin/settings`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          defaultBidWindowHours: Number(settingsForm.defaultBidWindowHours),
          defaultMinBid: Number(settingsForm.defaultMinBid),
          maxExpansionStages: Number(settingsForm.maxExpansionStages),
          expansionRadiusMilesJson: radii.length ? radii : [25, 50, 100],
          minBidReductionPct: Number(settingsForm.minBidReductionPct),
          lowPriceMinBid: Number(settingsForm.lowPriceMinBid),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      setSettings(data.settings);
      toast.success('Marketplace bidding settings saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const pendingLeadCount = leads.filter((l) => PENDING_STATUSES.includes(l.status)).length;

  return (
    <div className="space-y-5">
      {/* Information Banner */}
      <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/5 px-4 py-3 text-xs text-amber-900 dark:text-amber-300 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-lg">info</span>
          <span>
            Review homeowner submissions under <strong className="font-bold underline decoration-amber-400">Review &amp; approve</strong>, then orchestrate live bidding, verified installers, dispute claims, and escrow wallets.
          </span>
        </div>
      </div>

      {/* Segmented Subtabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="p-1 rounded-2xl bg-slate-200/60 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 inline-flex flex-wrap gap-1 shadow-xs">
          {SUBTABS.map((t) => {
            const active = sub === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSub(t.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-all ${
                  active
                    ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t.label}
                {t.id === 'leads' && pendingLeadCount > 0 && (
                  <span
                    className={`text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.2 rounded-full ${
                      active
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300'
                        : 'bg-amber-200/80 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300'
                    }`}
                  >
                    {pendingLeadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {loading && (
          <span className="text-xs text-slate-500 dark:text-slate-400 animate-pulse font-mono">
            Loading…
          </span>
        )}
      </div>

      {/* ── Subtab 1: Overview ── */}
      {sub === 'overview' && metrics && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Total Leads" value={metrics.counts?.total_leads} />
            <Stat label="Active Bidding" value={metrics.counts?.active_bidding} />
            <Stat label="Won Leads" value={metrics.counts?.won_count} />
            <Stat label="Avg Quality Score" value={Number(metrics.counts?.avg_score || 0).toFixed(0)} />
            <Stat label="Converted Won" value={metrics.counts?.converted_won} />
            <Stat label="Converted Lost" value={metrics.counts?.converted_lost} />
            <Stat label="Closed Unsold" value={metrics.counts?.unsold} />
            <Stat label="Refunded / Claims" value={metrics.counts?.refunded} />
            <Stat label="Total Bids Placed" value={metrics.bidStats?.total_bids} />
            <Stat
              label="Avg Winning Bid"
              value={formatMoney(metrics.counts?.avg_winning_bid)}
            />
            <Stat label="Pending Claims" value={metrics.disputeStats?.pending_disputes} />
            <Stat label="Approved Claims" value={metrics.disputeStats?.approved_disputes} />
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] p-5 shadow-xs">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Distribution by Pipeline Status
            </h3>
            <ul className="grid sm:grid-cols-3 gap-2 text-xs">
              {(metrics.byStatus || []).map((row) => (
                <li key={row.status} className="flex justify-between items-center gap-2 border-b border-slate-100 dark:border-white/5 py-1.5 px-1">
                  <span className="text-slate-700 dark:text-slate-300 font-medium capitalize">{row.status.replace(/_/g, ' ')}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                    {row.cnt}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {canShowPurgeDemos && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50/70 dark:bg-rose-500/5 p-4 text-xs text-rose-900 dark:text-rose-300 space-y-2.5 shadow-xs">
              <p className="font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-rose-600 text-base">warning</span>
                Demo Data Cleanup (Non-Prod Utility)
              </p>
              <p className="text-rose-800 dark:text-rose-400">
                Marketplace uses real homeowner inquiries. Only click this if legacy demo seed leads need purging from development database.
              </p>
              <button
                type="button"
                onClick={clearDemoData}
                disabled={clearingDemos}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 transition active:scale-95 shadow-xs"
              >
                {clearingDemos ? 'Removing demo leads…' : 'Purge demo marketplace leads'}
              </button>
            </div>
          )}
        </div>
      )}

      {sub === 'overview' && !metrics && loading && (
        <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] animate-pulse">
          Loading overview telemetry…
        </div>
      )}

      {/* ── Subtab 2: Settings ── */}
      {sub === 'settings' && (
        <form
          onSubmit={saveSettings}
          className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] p-6 space-y-4 max-w-xl shadow-xs"
        >
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bidding Window &amp; Dynamic Expansion Rules</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Applies to incoming qualified homeowner leads and automatic geo-expansion cycles.
            </p>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bid window (hours)</span>
            <input
              type="number"
              min="1"
              max="720"
              step="1"
              required
              className={inputCls}
              value={settingsForm.defaultBidWindowHours}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, defaultBidWindowHours: e.target.value }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Minimum bid floor (USD)</span>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              className={inputCls}
              value={settingsForm.defaultMinBid}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, defaultMinBid: e.target.value }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Max expansion stages (no-bid cycles)</span>
            <input
              type="number"
              min="1"
              max="10"
              required
              className={inputCls}
              value={settingsForm.maxExpansionStages}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, maxExpansionStages: e.target.value }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Expansion radii (miles, comma-separated)</span>
            <input
              type="text"
              required
              placeholder="25,50,100"
              className={inputCls}
              value={settingsForm.expansionRadii}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, expansionRadii: e.target.value }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Min bid reduction per stage (%)</span>
            <input
              type="number"
              min="0"
              max="90"
              step="0.1"
              required
              className={inputCls}
              value={settingsForm.minBidReductionPct}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, minBidReductionPct: e.target.value }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Low-price absolute floor (USD)</span>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              className={inputCls}
              value={settingsForm.lowPriceMinBid}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, lowPriceMinBid: e.target.value }))
              }
            />
          </label>
          {settings?.updated_at && (
            <p className="text-xs font-mono text-slate-400 dark:text-slate-500">
              Last saved: {formatWhen(settings.updated_at)}
            </p>
          )}
          <button
            type="submit"
            disabled={savingSettings}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 shadow-xs transition active:scale-95 disabled:opacity-50"
          >
            {savingSettings ? 'Saving…' : 'Save Marketplace Settings'}
          </button>
        </form>
      )}

      {sub === 'leads' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-500/5 px-4 py-3 text-xs text-blue-900 dark:text-blue-300 shadow-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-base">checklist</span>
            <span>Homeowner form inquiries → pending review below → approve to open live competitive installer bidding.</span>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap gap-2.5 items-center justify-between bg-white dark:bg-[#121826] p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
            <div className="flex flex-wrap gap-2.5 items-center flex-1">
              <div className="relative flex-1 min-w-[240px]">
                <span className="material-symbols-outlined absolute left-3 top-2 text-slate-400 text-base pointer-events-none">search</span>
                <input
                  type="text"
                  placeholder="Search by lead code, homeowner, phone, city, ZIP..."
                  className="w-full bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                />
              </div>
              <select
                className="bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-medium"
                value={leadFilter}
                onChange={(e) => {
                  setLeadFilter(e.target.value);
                  setSelectedLeadIds([]);
                }}
              >
                <option value="pending">
                  Awaiting Approval ({leads.filter((l) => PENDING_STATUSES.includes(l.status)).length})
                </option>
                <option value="all">All Statuses ({leads.length})</option>
                <option value="pending_admin">Pending Admin</option>
                <option value="new">New</option>
                <option value="ai_qualified">AI Qualified (Review)</option>
                <option value="bidding">Bidding Active</option>
                <option value="no_bid_expanding">Expanding Radius</option>
                <option value="lead_unlocked">Lead Unlocked (Won)</option>
                <option value="closed_unsold">Closed Unsold</option>
                <option value="won">Won / Converted</option>
                <option value="lost">Lost</option>
                <option value="contacted">Contacted</option>
                <option value="interested">Interested</option>
                <option value="appointment">Appointment</option>
                <option value="proposal">Proposal</option>
                <option value="invalid_refunded">Invalid / Refunded</option>
              </select>
              {((leadFilter !== 'all' && leadFilter !== 'pending') || leadSearch.trim()) ? (
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 dark:border-white/10 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 transition"
                  onClick={() => {
                    setLeadFilter('pending');
                    setLeadSearch('');
                    setSelectedLeadIds([]);
                  }}
                >
                  Reset Filter
                </button>
              ) : null}
            </div>
            <div className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
              Showing {visibleLeads.length} of {leads.length} leads
            </div>
          </div>

          {/* Bulk Approval Banner */}
          {pendingVisibleIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/80 dark:bg-emerald-500/10 px-4 py-3 shadow-xs">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-emerald-950 dark:text-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  checked={pendingVisibleIds.length > 0 && pendingVisibleIds.every((id) => selectedLeadIds.includes(id))}
                  onChange={(e) => toggleSelectVisiblePending(e.target.checked)}
                />
                <span>Select all pending ({pendingVisibleIds.length})</span>
              </label>
              <button
                type="button"
                disabled={bulkApproving || selectedLeadIds.length === 0}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 disabled:opacity-50 transition active:scale-95 shadow-xs"
                onClick={bulkApproveLeads}
              >
                {bulkApproving
                  ? 'Approving…'
                  : `Approve ${selectedLeadIds.length || ''} Selected → Live Bidding`}
              </button>
            </div>
          )}

          {/* Split View: Lead List & Selected Detail */}
          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="space-y-2.5 max-h-[72vh] overflow-y-auto pr-1">
              {visibleLeads.map((l) => (
                <div
                  key={l.id}
                  className={`w-full rounded-2xl border p-4 text-xs transition-all flex gap-3 ${
                    selected?.id === l.id
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-500/10 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] hover:border-slate-300 dark:hover:border-white/20 shadow-xs'
                  }`}
                >
                  {PENDING_STATUSES.includes(l.status) ? (
                    <input
                      type="checkbox"
                      className="mt-1 shrink-0 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={selectedLeadIds.includes(l.id)}
                      onChange={(e) => toggleLeadSelected(l.id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={() => openLead(l.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-mono text-slate-500 dark:text-slate-400 text-xs font-medium">
                        {l.leadCode}
                      </span>
                      <div className="flex flex-col items-end gap-1.5">
                        {isBiddingOpen(l.status) && l.biddingClosesAt && (
                          <BiddingCountdown closesAt={l.biddingClosesAt} compact />
                        )}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                            l.status === 'bidding'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                              : PENDING_STATUSES.includes(l.status)
                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                                : l.status === 'won' || l.status === 'lead_unlocked'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30'
                                  : l.status === 'invalid_refunded'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/15'
                          }`}
                        >
                          {l.status}
                        </span>
                      </div>
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                      {l.homeownerName}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 text-xs mt-1.5 flex flex-wrap gap-2">
                      <span>ZIP: <strong className="text-slate-800 dark:text-slate-200 font-medium">{l.zip || '—'}</strong></span>
                      <span>·</span>
                      <span>
                        Quality: <strong className="text-slate-800 dark:text-slate-200 font-medium">{l.leadScore ?? l.opportunityScore ?? '—'}</strong>
                        {l.solarPotentialScore != null && l.solarPotentialScore > 0
                          ? ` · Solar: ${l.solarPotentialScore}`
                          : ''}
                      </span>
                      <span>·</span>
                      <span>Floor: <strong className="text-slate-800 dark:text-slate-200 font-medium">{formatMoney(l.minBid ?? l.winningAmount)}</strong></span>
                    </div>
                  </button>
                </div>
              ))}
              {visibleLeads.length === 0 && !loading && (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-xs space-y-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826]">
                  <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">inbox</span>
                  <p>
                    {leadFilter === 'pending'
                      ? 'No leads currently waiting for approval.'
                      : 'No marketplace leads found matching filters.'}
                  </p>
                  {leadFilter !== 'pending' && (
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 dark:border-white/15 px-3.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 font-semibold"
                      onClick={() => {
                        setLeadFilter('pending');
                        setLeadSearch('');
                      }}
                    >
                      Show Awaiting Approval
                    </button>
                  )}
                </div>
              )}
              {loading && leads.length === 0 && (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-xs rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] animate-pulse">
                  Loading marketplace leads…
                </div>
              )}
            </div>

            {/* Selected Lead Detailed Inspection Card */}
            {selected ? (
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto shadow-xs">
                <div className="flex justify-between items-start border-b border-slate-100 dark:border-white/10 pb-3 gap-3">
                  <div>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{selected.leadCode}</span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{selected.homeownerName}</h3>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {isBiddingOpen(selected.status) && selected.biddingClosesAt && (
                      <BiddingCountdown closesAt={selected.biddingClosesAt} />
                    )}
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${
                        selected.status === 'bidding'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                          : selected.status === 'won' || selected.status === 'lead_unlocked'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30'
                            : selected.status === 'invalid_refunded'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                              : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/20'
                      }`}
                    >
                      {selected.status}
                    </span>
                  </div>
                </div>

                {/* Workflow Pipeline Tracker */}
                <div className="bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/[0.06] rounded-xl p-3.5 space-y-2">
                  <div className="text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    Marketplace Pipeline Stage
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] text-center">
                    <div
                      className={`p-2 rounded-lg border font-semibold ${
                        ['bidding', 'no_bid_expanding'].includes(selected.status)
                          ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500 text-blue-700 dark:text-blue-300'
                          : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      1. Open Bidding
                    </div>
                    <div
                      className={`p-2 rounded-lg border font-semibold ${
                        ['lead_unlocked', 'closed_unsold', 'won', 'lost', 'contacted', 'interested', 'appointment', 'proposal'].includes(selected.status)
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300'
                          : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      2. Winner Chosen
                    </div>
                    <div
                      className={`p-2 rounded-lg border font-semibold ${
                        ['won', 'lead_unlocked'].includes(selected.status)
                          ? 'bg-purple-50 dark:bg-purple-500/20 border-purple-300 dark:border-purple-500 text-purple-700 dark:text-purple-300'
                          : selected.status === 'invalid_refunded'
                            ? 'bg-rose-50 dark:bg-rose-500/20 border-rose-300 dark:border-rose-500 text-rose-700 dark:text-rose-300'
                            : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      3. Closed / Final
                    </div>
                  </div>
                </div>

                {isBiddingOpen(selected.status) && (
                  <div className="bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                        Bidding Window Countdown
                      </div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                        <BiddingCountdown closesAt={selected.biddingClosesAt} />
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 text-right">
                      <div>Opens: {formatWhen(selected.biddingOpensAt)}</div>
                      <div>Closes: {formatWhen(selected.biddingClosesAt)}</div>
                    </div>
                  </div>
                )}

                {/* Admin Actions */}
                <div className="bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/[0.06] rounded-xl p-3.5 space-y-2.5">
                  <div className="text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    Admin Actions &amp; Overrides
                  </div>
                  {['new', 'ai_qualified', 'pending_admin'].includes(selected.status) && (
                    <div className="flex flex-wrap gap-2 items-center pb-2.5 border-b border-slate-200 dark:border-white/10">
                      <button
                        type="button"
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-1.5 transition active:scale-95 shadow-xs"
                        onClick={() => approveLead(selected.id)}
                      >
                        Approve → Live Marketplace
                      </button>
                      <button
                        type="button"
                        className="rounded-xl bg-cyan-100 hover:bg-cyan-200 text-cyan-900 dark:bg-cyan-500/20 dark:text-cyan-200 text-xs font-semibold px-3 py-1.5 transition"
                        onClick={() => verifyLeadContact(selected.id)}
                      >
                        Re-check email &amp; phone
                      </button>
                      <button
                        type="button"
                        className="rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-white/10 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 transition"
                        onClick={() => reQualifyLead(selected.id)}
                      >
                        Re-qualify
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      className="bg-white dark:bg-black/30 border border-slate-300 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white flex-1 outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value)}
                    >
                      <option value="bidding">bidding (Open for Bids)</option>
                      <option value="no_bid_expanding">no_bid_expanding (Expanding Radius)</option>
                      <option value="lead_unlocked">lead_unlocked (Winner Selected)</option>
                      <option value="closed_unsold">closed_unsold (No Bids / Expired)</option>
                      <option value="contacted">contacted (Installer Reached Out)</option>
                      <option value="interested">interested (Interested)</option>
                      <option value="appointment">appointment (Site Visit)</option>
                      <option value="proposal">proposal (Proposal Sent)</option>
                      <option value="won">won (Contract Signed)</option>
                      <option value="lost">lost (Lead Declined)</option>
                      <option value="pending_admin">pending_admin (Awaiting Approval)</option>
                      <option value="new">new</option>
                      <option value="ai_qualified">ai_qualified (Needs Review)</option>
                      <option value="invalid_refunded">invalid_refunded (Refunded / Fake)</option>
                    </select>
                    <button
                      type="button"
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-1.5 transition active:scale-95 shadow-xs"
                      onClick={() => updateLeadStatus(selected.id, statusDraft)}
                    >
                      Update Status
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-white/10 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 transition"
                      onClick={() => closeBidding(selected.id)}
                    >
                      Close Bidding
                    </button>
                  </div>
                </div>

                {/* Contact Verification Telemetry */}
                <div className="bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/[0.06] rounded-xl p-3.5 space-y-2">
                  <div className="text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    Contact Verification Telemetry
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Email Status: </span>
                      <span className="text-slate-900 dark:text-white font-semibold">
                        {selected.emailStatus || selected.email_status || 'Not checked'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Phone Type: </span>
                      <span className="text-slate-900 dark:text-white font-semibold">
                        {selected.phoneType || selected.phone_type || 'Not checked'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {contactCheckBadge(
                      /deliverable/i.test(String(selected.emailStatus || selected.email_status || '')) &&
                        !/undeliverable/i.test(String(selected.emailStatus || selected.email_status || '')),
                      'Email Deliverable',
                    )}
                    {contactCheckBadge(
                      /mobile|landline|fixed/i.test(String(selected.phoneType || selected.phone_type || '')),
                      'Real Phone Number',
                    )}
                  </div>
                </div>

                {/* Homeowner & Property Details */}
                <div className="bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/[0.06] rounded-xl p-3.5 space-y-2">
                  <div className="text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    Homeowner &amp; Property Info
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Phone: </span>
                      <span className="text-slate-900 dark:text-white font-semibold">{selected.phone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Email: </span>
                      <span className="text-slate-900 dark:text-white font-semibold">{selected.email || '—'}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-500 dark:text-slate-400">Address: </span>
                      <span className="text-slate-900 dark:text-white font-semibold">{selected.address || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Monthly Bill: </span>
                      <span className="text-slate-900 dark:text-white font-semibold">
                        {selected.electricityBillRange || selected.monthlyBill || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Timeline: </span>
                      <span className="text-slate-900 dark:text-white font-semibold">{selected.installationTimeline || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Bids List */}
                <div className="bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/[0.06] rounded-xl p-3.5 space-y-2">
                  <div className="text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    Installer Bids ({bids.length})
                  </div>
                  <ul className="space-y-2">
                    {bids.map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-2 border border-slate-200/80 dark:border-white/10 rounded-xl px-3 py-2 text-xs bg-white dark:bg-black/30 shadow-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">{b.installerName || b.installerEmail}</span>
                          <span className="text-slate-500 dark:text-slate-400"> · </span>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{formatMoney(b.amount)}</span>
                          <span className="text-slate-500 dark:text-slate-400"> · </span>
                          <span
                            className={
                              b.status === 'won'
                                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                : b.status === 'active'
                                  ? 'text-sky-600 dark:text-sky-300 font-medium'
                                  : 'text-slate-400 dark:text-slate-500'
                            }
                          >
                            {b.status}
                          </span>
                        </div>
                        {b.status === 'active' && (
                          <button
                            type="button"
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1 text-xs shadow-xs transition active:scale-95"
                            onClick={() => selectWinner(selected.id, b.id)}
                          >
                            Pick Winner
                          </button>
                        )}
                      </li>
                    ))}
                    {!bids.length && (
                      <li className="text-slate-400 dark:text-slate-500 italic py-1">No bids submitted yet for this lead.</li>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/15 p-12 text-center text-slate-500 dark:text-slate-400 text-xs bg-white/50 dark:bg-white/[0.02]">
                <span className="material-symbols-outlined text-3xl mb-1 text-slate-400 block">touch_app</span>
                Select any lead on the left to view full workflow stages, contact verification, and installer bids.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Subtab 4: Disputes / Claims ── */}
      {sub === 'disputes' && (
        <div className="space-y-3">
          {disputes.map((d) => (
            <div
              key={d.id}
              className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] p-4 text-xs space-y-2.5 shadow-xs"
            >
              <div className="flex justify-between items-center gap-2">
                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{d.lead_code}</span>
                <span className={`font-mono font-bold uppercase text-[10px] px-2.5 py-0.5 rounded-full border ${
                  d.status === 'pending'
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                    : d.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                }`}>
                  {d.status}
                </span>
              </div>
              <div className="text-slate-700 dark:text-slate-300 font-semibold">
                Claim Type: {d.claim_type} · Installer: {d.installer_name || d.installer_email}
              </div>
              <div className="text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-black/20 p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5">
                {d.details || 'No additional details provided by installer.'}
              </div>
              {d.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 font-semibold text-xs transition active:scale-95 shadow-xs"
                    onClick={() => reviewDispute(d.id, 'approved')}
                  >
                    Approve Refund
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 font-semibold text-xs transition active:scale-95 shadow-xs"
                    onClick={() => reviewDispute(d.id, 'denied')}
                  >
                    Deny Claim
                  </button>
                </div>
              )}
            </div>
          ))}
          {!disputes.length && (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826]">
              No active or historical dispute claims.
            </div>
          )}
        </div>
      )}

      {/* ── Subtab 5: Installers ── */}
      {sub === 'installers' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] shadow-xs">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] text-left text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200/80 dark:border-white/[0.08]">
                <tr>
                  <th className="p-3">Installer</th>
                  <th className="p-3">Verification</th>
                  <th className="p-3">Service Areas</th>
                  <th className="p-3">Wallet Balance</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {installers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 align-top">
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{u.name}</div>
                      <div className="text-slate-500 dark:text-slate-400 text-xs font-mono">{u.email}</div>
                      {u.company_name && (
                        <div className="text-blue-600 dark:text-blue-400 text-xs font-semibold mt-0.5">
                          {u.company_name}
                        </div>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border uppercase tracking-wider ${
                          u.verification_status === 'verified'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                            : u.verification_status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/10 dark:text-slate-400 dark:border-white/15'
                        }`}
                      >
                        {u.verification_status || 'unverified'}
                      </span>
                    </td>
                    <td className="p-3 align-top max-w-xs">
                      <div className="flex flex-wrap gap-1.5">
                        {(u.areas || []).map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300"
                          >
                            <span>
                              {[a.zip, a.state, a.radius_miles ? `${a.radius_miles}mi` : null]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                            <button
                              type="button"
                              title="Remove service area"
                              onClick={async () => {
                                setAreaUserId(u.id);
                                await deleteArea(a.id);
                              }}
                              className="text-emerald-600 hover:text-rose-600 font-bold ml-0.5"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        {(!u.areas || u.areas.length === 0) && (
                          <span className="text-slate-400 dark:text-slate-500 text-xs italic">No service areas set</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 align-top font-bold text-slate-900 dark:text-white font-mono text-sm">
                      {formatMoney(u.wallet_balance)}
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className="rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30 px-2.5 py-1 text-xs font-semibold transition"
                          onClick={() => setVerification(u.id, 'verified')}
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          className="rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30 px-2.5 py-1 text-xs font-semibold transition"
                          onClick={() => setVerification(u.id, 'pending')}
                        >
                          Pending
                        </button>
                        <button
                          type="button"
                          className="rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-900 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30 px-2.5 py-1 text-xs font-semibold transition"
                          onClick={() => loadAreas(u.id)}
                        >
                          Areas
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {areaUserId && (
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] p-5 space-y-3 bg-white dark:bg-[#121826] shadow-xs">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  Service Areas for{' '}
                  {installers.find((u) => Number(u.id) === Number(areaUserId))?.name ||
                    installers.find((u) => Number(u.id) === Number(areaUserId))?.email ||
                    `User #${areaUserId}`}
                </h4>
                <button
                  type="button"
                  onClick={() => setAreaUserId(null)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  Close
                </button>
              </div>
              <ul className="text-xs space-y-1.5 max-h-48 overflow-y-auto">
                {areas.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 bg-slate-50 dark:bg-black/20">
                    <span className="text-slate-800 dark:text-slate-200 font-medium">
                      {[a.zip && `ZIP: ${a.zip}`, a.state && `State: ${a.state}`, a.radius_miles && `${a.radius_miles} mi`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteArea(a.id)}
                      className="text-rose-600 font-bold hover:underline text-xs px-2 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      Remove
                    </button>
                  </li>
                ))}
                {!areas.length && (
                  <li className="text-slate-400 dark:text-slate-500 italic">No service areas set for this installer yet.</li>
                )}
              </ul>
              <form onSubmit={addArea} className="flex flex-wrap gap-2.5 items-end pt-3 border-t border-slate-100 dark:border-white/10">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ZIP
                  <input
                    className={inputCls}
                    placeholder="e.g. 90210"
                    value={areaForm.zip || ''}
                    onChange={(e) => setAreaForm((f) => ({ ...f, zip: e.target.value }))}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  State
                  <input
                    className={inputCls}
                    placeholder="e.g. CA"
                    value={areaForm.state || ''}
                    onChange={(e) => setAreaForm((f) => ({ ...f, state: e.target.value }))}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Radius (mi)
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="25"
                    value={areaForm.radiusMiles || ''}
                    onChange={(e) => setAreaForm((f) => ({ ...f, radiusMiles: e.target.value }))}
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 font-semibold shadow-xs transition active:scale-95"
                >
                  Add Area
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ── Subtab 6: Wallets ── */}
      {sub === 'wallets' && (
        <div className="space-y-4">
          <form
            onSubmit={adjustWallet}
            className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] p-5 flex flex-wrap gap-3 items-end shadow-xs"
          >
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Installer
              <select
                className={inputCls}
                value={walletForm.userId}
                onChange={(e) => setWalletForm((f) => ({ ...f, userId: e.target.value }))}
                required
              >
                <option value="">Select installer…</option>
                {wallets.map((w) => (
                  <option key={w.user_id} value={w.user_id}>
                    #{w.user_id} {w.name || '—'} ({w.email || 'no email'}) — {formatMoney(w.balance)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Amount ($)
              <input
                className={inputCls}
                value={walletForm.amount}
                onChange={(e) => setWalletForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </label>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Action Mode
              <select
                className={inputCls}
                value={walletForm.mode}
                onChange={(e) => setWalletForm((f) => ({ ...f, mode: e.target.value }))}
              >
                <option value="add">Credit (+)</option>
                <option value="subtract">Debit (-)</option>
                <option value="set">Set Fixed Balance (=)</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 grow">
              Admin Note
              <input
                className={inputCls}
                placeholder="Audit reason (e.g. manual wire, dispute refund)"
                value={walletForm.note}
                onChange={(e) => setWalletForm((f) => ({ ...f, note: e.target.value }))}
              />
            </label>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 shadow-xs transition active:scale-95"
            >
              Adjust Balance
            </button>
          </form>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] shadow-xs">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] text-left text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200/80 dark:border-white/[0.08]">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Current Balance</th>
                  <th className="p-3">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {wallets.map((w) => (
                  <tr key={w.user_id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-white">
                        #{w.user_id} {w.name}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 text-xs font-mono">{w.email}</div>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {formatMoney(w.balance)}
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{formatWhen(w.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] p-5 shadow-xs">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Recent Marketplace Escrow Ledger
            </h4>
            <ul className="text-xs space-y-2 max-h-60 overflow-y-auto">
              {ledger.map((row) => (
                <li key={row.id} className="border-b border-slate-100 dark:border-white/5 py-1.5 flex justify-between items-center gap-2">
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    {row.user_name || row.user_id} · <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{row.entry_type}</span> · {formatMoney(row.amount)}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">{formatWhen(row.created_at)}</span>
                </li>
              ))}
              {!ledger.length && (
                <li className="text-slate-400 dark:text-slate-500 italic py-1">No ledger entries recorded yet.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] p-4 shadow-xs">
      <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5 tabular-nums">
        {value ?? '—'}
      </div>
    </div>
  );
}

const inputCls =
  'mt-1 block w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all';
