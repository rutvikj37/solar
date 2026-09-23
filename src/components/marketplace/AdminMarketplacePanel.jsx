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
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
        ok
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          : 'bg-red-500/20 text-red-300 border-red-500/30'
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
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-on-surface-variant">
        Approve homeowner submissions under <strong className="text-on-surface">Review &amp; approve</strong>,
        then manage bidding, installers, claims, and wallets from the subtabs below.
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {SUBTABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSub(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                sub === t.id ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t.label}
              {t.id === 'leads' && pendingLeadCount > 0 && (
                <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${
                  sub === t.id ? 'bg-black/20' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {pendingLeadCount}
                </span>
              )}
            </button>
          ))}
        </div>
        {loading && <span className="text-xs text-on-surface/45">Loading…</span>}
      </div>

      {sub === 'overview' && metrics && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Total leads" value={metrics.counts?.total_leads} />
            <Stat label="Active bidding" value={metrics.counts?.active_bidding} />
            <Stat label="Winners" value={metrics.counts?.won_count} />
            <Stat label="Avg score" value={Number(metrics.counts?.avg_score || 0).toFixed(0)} />
            <Stat label="Converted won" value={metrics.counts?.converted_won} />
            <Stat label="Converted lost" value={metrics.counts?.converted_lost} />
            <Stat label="Unsold" value={metrics.counts?.unsold} />
            <Stat label="Refunded" value={metrics.counts?.refunded} />
            <Stat label="Total bids" value={metrics.bidStats?.total_bids} />
            <Stat
              label="Avg winning bid"
              value={formatMoney(metrics.counts?.avg_winning_bid)}
            />
            <Stat label="Pending claims" value={metrics.disputeStats?.pending_disputes} />
            <Stat label="Approved claims" value={metrics.disputeStats?.approved_disputes} />
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            <h3 className="text-xs font-semibold text-on-surface/60 mb-2">By status</h3>
            <ul className="grid sm:grid-cols-3 gap-1 text-xs">
              {(metrics.byStatus || []).map((row) => (
                <li key={row.status} className="flex justify-between gap-2 border-b border-white/5 py-1">
                  <span>{row.status}</span>
                  <span className="font-mono">{row.cnt}</span>
                </li>
              ))}
            </ul>
          </div>
          {canShowPurgeDemos && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-xs text-on-surface/60 space-y-2">
              <p className="font-semibold text-red-200/90">Danger zone</p>
              <p>
                Marketplace uses real homeowner inquiries. Only use this if old demo seed rows are still
                in the database. Hidden in production builds.
              </p>
              <button
                type="button"
                onClick={clearDemoData}
                disabled={clearingDemos}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-200 hover:bg-red-500/30 disabled:opacity-50"
              >
                {clearingDemos ? 'Removing demo leads…' : 'Purge demo marketplace leads'}
              </button>
            </div>
          )}
        </div>
      )}

      {sub === 'overview' && !metrics && loading && (
        <p className="text-sm text-on-surface/50">Loading overview…</p>
      )}

      {sub === 'settings' && (
        <form
          onSubmit={saveSettings}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4 max-w-lg"
        >
          <div>
            <h3 className="text-sm font-semibold text-on-surface">Bidding window</h3>
            <p className="text-xs text-on-surface/50 mt-1">
              Applies to new homeowner leads and leads reopened after a no-bid cycle.
            </p>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface/60">Bid window (hours)</span>
            <input
              type="number"
              min="1"
              max="720"
              step="1"
              required
              className="w-full bg-surface-container border border-white/15 rounded-lg px-3 py-2 text-sm text-on-surface"
              value={settingsForm.defaultBidWindowHours}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, defaultBidWindowHours: e.target.value }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface/60">Minimum bid (USD)</span>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              className="w-full bg-surface-container border border-white/15 rounded-lg px-3 py-2 text-sm text-on-surface"
              value={settingsForm.defaultMinBid}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, defaultMinBid: e.target.value }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface/60">Max expansion stages (no-bid cycles)</span>
            <input
              type="number"
              min="1"
              max="10"
              required
              className="w-full bg-surface-container border border-white/15 rounded-lg px-3 py-2 text-sm text-on-surface"
              value={settingsForm.maxExpansionStages}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, maxExpansionStages: e.target.value }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface/60">Expansion radii (miles, comma-separated)</span>
            <input
              type="text"
              required
              placeholder="25,50,100"
              className="w-full bg-surface-container border border-white/15 rounded-lg px-3 py-2 text-sm text-on-surface"
              value={settingsForm.expansionRadii}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, expansionRadii: e.target.value }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface/60">Min bid reduction per stage (%)</span>
            <input
              type="number"
              min="0"
              max="90"
              step="0.1"
              required
              className="w-full bg-surface-container border border-white/15 rounded-lg px-3 py-2 text-sm text-on-surface"
              value={settingsForm.minBidReductionPct}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, minBidReductionPct: e.target.value }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface/60">Low-price floor min bid (USD)</span>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              className="w-full bg-surface-container border border-white/15 rounded-lg px-3 py-2 text-sm text-on-surface"
              value={settingsForm.lowPriceMinBid}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, lowPriceMinBid: e.target.value }))
              }
            />
          </label>
          {settings?.updated_at && (
            <p className="text-[10px] text-on-surface/40">
              Last updated {formatWhen(settings.updated_at)}
            </p>
          )}
          <button
            type="submit"
            disabled={savingSettings}
            className="rounded-lg bg-primary text-black text-xs font-bold px-4 py-2 disabled:opacity-50"
          >
            {savingSettings ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      )}

      {sub === 'leads' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-100/90">
            Homeowner form → pending review here → bulk approve → installer marketplace bidding.
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="flex flex-wrap gap-2 items-center flex-1">
              <input
                type="text"
                placeholder="Search by code, name, phone, city, ZIP..."
                className="bg-surface-container border border-white/15 rounded-lg px-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface/40 min-w-[240px] flex-1 outline-none focus:border-primary/50"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
              />
              <select
                className="bg-surface-container border border-white/15 rounded-lg px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary/50"
                value={leadFilter}
                onChange={(e) => {
                  setLeadFilter(e.target.value);
                  setSelectedLeadIds([]);
                }}
              >
                <option value="pending">
                  Awaiting approval ({leads.filter((l) => PENDING_STATUSES.includes(l.status)).length})
                </option>
                <option value="all">All Statuses ({leads.length})</option>
                <option value="pending_admin">Pending Admin</option>
                <option value="new">New</option>
                <option value="ai_qualified">AI Qualified (review)</option>
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
                  className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] text-on-surface/70 hover:bg-white/10"
                  onClick={() => {
                    setLeadFilter('pending');
                    setLeadSearch('');
                    setSelectedLeadIds([]);
                  }}
                >
                  Reset to awaiting
                </button>
              ) : null}
            </div>
            <div className="text-xs text-on-surface/50">
              Showing {visibleLeads.length} of {leads.length} leads
            </div>
          </div>

          {pendingVisibleIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
              <label className="flex items-center gap-2 text-xs text-on-surface/80">
                <input
                  type="checkbox"
                  checked={pendingVisibleIds.length > 0 && pendingVisibleIds.every((id) => selectedLeadIds.includes(id))}
                  onChange={(e) => toggleSelectVisiblePending(e.target.checked)}
                />
                Select all pending ({pendingVisibleIds.length})
              </label>
              <button
                type="button"
                disabled={bulkApproving || selectedLeadIds.length === 0}
                className="rounded-lg bg-emerald-500 text-black text-xs font-bold px-3 py-1.5 disabled:opacity-50"
                onClick={bulkApproveLeads}
              >
                {bulkApproving
                  ? 'Approving…'
                  : `Approve ${selectedLeadIds.length || ''} selected → Marketplace`}
              </button>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {visibleLeads.map((l) => (
                  <div
                    key={l.id}
                    className={`w-full rounded-xl border p-3 text-xs transition-all flex gap-2 ${
                      selected?.id === l.id
                        ? 'border-primary bg-primary/10 shadow-lg'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    {PENDING_STATUSES.includes(l.status) ? (
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0"
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
                      <span className="font-mono text-on-surface/45 text-[11px]">{l.leadCode}</span>
                      <div className="flex flex-col items-end gap-1.5">
                        {isBiddingOpen(l.status) && l.biddingClosesAt && (
                          <BiddingCountdown closesAt={l.biddingClosesAt} compact />
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            l.status === 'bidding'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : PENDING_STATUSES.includes(l.status)
                                ? 'bg-amber-500/20 text-amber-200 border-amber-500/30'
                                : l.status === 'won' || l.status === 'lead_unlocked'
                                  ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                  : l.status === 'invalid_refunded'
                                    ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                    : 'bg-white/10 text-on-surface/70 border-white/15'
                          }`}
                        >
                          {l.status}
                        </span>
                      </div>
                    </div>
                    <div className="font-bold text-sm text-on-surface mt-1">{l.homeownerName}</div>
                    <div className="text-on-surface/60 text-[11px] mt-1 flex flex-wrap gap-2">
                      <span>ZIP: {l.zip || '—'}</span>
                      <span>·</span>
                      <span>
                        Lead: {l.leadScore ?? l.opportunityScore}
                        {l.solarPotentialScore != null && l.solarPotentialScore > 0
                          ? ` · Solar: ${l.solarPotentialScore}`
                          : ''}
                      </span>
                      <span>·</span>
                      <span>Min Bid: {formatMoney(l.minBid ?? l.winningAmount)}</span>
                    </div>
                    </button>
                  </div>
                ))}
              {visibleLeads.length === 0 && !loading && (
                <div className="text-center py-8 text-on-surface/40 text-xs space-y-2">
                  <p>
                    {leadFilter === 'pending'
                      ? 'No leads waiting for approval.'
                      : 'No marketplace leads found.'}
                  </p>
                  {leadFilter !== 'pending' && (
                    <button
                      type="button"
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-on-surface/70 hover:bg-white/10"
                      onClick={() => {
                        setLeadFilter('pending');
                        setLeadSearch('');
                      }}
                    >
                      Show awaiting approval
                    </button>
                  )}
                </div>
              )}
              {loading && leads.length === 0 && (
                <div className="text-center py-8 text-on-surface/40 text-xs">Loading leads…</div>
              )}
            </div>

            {selected ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                <div className="flex justify-between items-start border-b border-white/10 pb-3 gap-3">
                  <div>
                    <span className="font-mono text-xs text-on-surface/45">{selected.leadCode}</span>
                    <h3 className="text-base font-bold text-on-surface">{selected.homeownerName}</h3>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {isBiddingOpen(selected.status) && selected.biddingClosesAt && (
                      <BiddingCountdown closesAt={selected.biddingClosesAt} />
                    )}
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                        selected.status === 'bidding'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : selected.status === 'won' || selected.status === 'lead_unlocked'
                            ? 'bg-green-500/20 text-green-300 border-green-500/30'
                            : selected.status === 'invalid_refunded'
                              ? 'bg-red-500/20 text-red-300 border-red-500/30'
                              : 'bg-white/10 text-on-surface/80 border-white/20'
                      }`}
                    >
                      {selected.status}
                    </span>
                  </div>
                </div>

                {/* Visual Marketplace Workflow Tracker */}
                <div className="bg-surface-container border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-on-surface/50 tracking-wider">
                    Marketplace Workflow Pipeline Stage
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[11px] text-center">
                    <div
                      className={`p-2 rounded-lg border font-semibold ${
                        ['bidding', 'no_bid_expanding'].includes(selected.status)
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-white/5 border-white/10 text-on-surface/40'
                      }`}
                    >
                      1. Bidding / Open
                    </div>
                    <div
                      className={`p-2 rounded-lg border font-semibold ${
                        ['lead_unlocked', 'closed_unsold', 'won', 'lost', 'contacted', 'interested', 'appointment', 'proposal'].includes(selected.status)
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-on-surface/40'
                      }`}
                    >
                      2. Winner Selected
                    </div>
                    <div
                      className={`p-2 rounded-lg border font-semibold ${
                        ['won', 'lead_unlocked'].includes(selected.status)
                          ? 'bg-green-500/20 border-green-500 text-green-300'
                          : selected.status === 'invalid_refunded'
                            ? 'bg-red-500/20 border-red-500 text-red-300'
                            : 'bg-white/5 border-white/10 text-on-surface/40'
                      }`}
                    >
                      3. Converted / Final
                    </div>
                  </div>
                </div>

                {isBiddingOpen(selected.status) && (
                  <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-on-surface/50 tracking-wider">
                        Bidding window
                      </div>
                      <div className="text-lg font-bold text-primary mt-1">
                        <BiddingCountdown closesAt={selected.biddingClosesAt} />
                      </div>
                    </div>
                    <div className="text-xs text-on-surface/55 text-right">
                      <div>Opens {formatWhen(selected.biddingOpensAt)}</div>
                      <div>Closes {formatWhen(selected.biddingClosesAt)}</div>
                    </div>
                  </div>
                )}

                {/* Admin Status Override Form */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-on-surface/50 tracking-wider">
                    Admin actions
                  </div>
                  {['new', 'ai_qualified', 'pending_admin'].includes(selected.status) && (
                    <div className="flex flex-wrap gap-2 items-center pb-2 border-b border-white/10">
                      <button
                        type="button"
                        className="rounded-lg bg-emerald-500 text-black text-xs font-bold px-3 py-1.5 hover:bg-emerald-400"
                        onClick={() => approveLead(selected.id)}
                      >
                        Approve → Marketplace
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-cyan-500/20 text-cyan-200 text-xs font-semibold px-3 py-1.5 hover:bg-cyan-500/30"
                        onClick={() => verifyLeadContact(selected.id)}
                      >
                        Re-check email & phone
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-white/10 text-on-surface/80 text-xs font-semibold px-3 py-1.5 hover:bg-white/15"
                        onClick={() => reQualifyLead(selected.id)}
                      >
                        Re-qualify
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      className="bg-surface-container-high border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-on-surface flex-1 outline-none"
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
                      className="rounded-lg bg-white/15 text-on-surface text-xs font-semibold px-3 py-1.5 hover:bg-white/25"
                      onClick={() => updateLeadStatus(selected.id, statusDraft)}
                    >
                      Update Status
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-white/10 text-on-surface text-xs font-semibold px-3 py-1.5 hover:bg-white/20"
                      onClick={() => closeBidding(selected.id)}
                    >
                      Close Bidding
                    </button>
                  </div>
                </div>

                {/* Admin contact verification (Verifalia + Twilio Lookup — no OTP to homeowner) */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-on-surface/50 tracking-wider">
                    Contact verification (admin)
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-on-surface/45">Email status: </span>
                      <span className="text-on-surface font-semibold">{selected.emailStatus || selected.email_status || 'Not checked'}</span>
                    </div>
                    <div>
                      <span className="text-on-surface/45">Phone type: </span>
                      <span className="text-on-surface font-semibold">{selected.phoneType || selected.phone_type || 'Not checked'}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {contactCheckBadge(
                      /deliverable/i.test(String(selected.emailStatus || selected.email_status || '')) &&
                        !/undeliverable/i.test(String(selected.emailStatus || selected.email_status || '')),
                      'Email deliverable',
                    )}
                    {contactCheckBadge(
                      /mobile|landline|fixed/i.test(String(selected.phoneType || selected.phone_type || '')),
                      'Real phone number',
                    )}
                  </div>
                </div>

                {/* Homeowner & Property Details */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-on-surface/50 tracking-wider">
                    Homeowner & Property Info
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-on-surface/45">Phone: </span>
                      <span className="text-on-surface font-semibold">{selected.phone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-on-surface/45">Email: </span>
                      <span className="text-on-surface font-semibold">{selected.email || '—'}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-on-surface/45">Address: </span>
                      <span className="text-on-surface font-semibold">{selected.address || '—'}</span>
                    </div>
                    <div>
                      <span className="text-on-surface/45">Monthly Bill: </span>
                      <span className="text-on-surface font-semibold">{selected.electricityBillRange || selected.monthlyBill || '—'}</span>
                    </div>
                    <div>
                      <span className="text-on-surface/45">Timeline: </span>
                      <span className="text-on-surface font-semibold">{selected.installationTimeline || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Bids & Winner Details */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-on-surface/50 tracking-wider">
                    Bids ({bids.length}) & Winning Installer
                  </div>
                  <ul className="space-y-1.5">
                    {bids.map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-2 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs bg-surface-container-low"
                      >
                        <div>
                          <span className="font-semibold text-on-surface">{b.installerName || b.installerEmail}</span>
                          <span className="text-on-surface/45"> · {formatMoney(b.amount)} · </span>
                          <span
                            className={
                              b.status === 'won'
                                ? 'text-emerald-400 font-bold'
                                : b.status === 'active'
                                  ? 'text-sky-300'
                                  : 'text-on-surface/40'
                            }
                          >
                            {b.status}
                          </span>
                        </div>
                        {b.status === 'active' && (
                          <button
                            type="button"
                            className="rounded bg-primary text-black font-bold px-2 py-0.5 text-[11px]"
                            onClick={() => selectWinner(selected.id, b.id)}
                          >
                            Pick Winner
                          </button>
                        )}
                      </li>
                    ))}
                    {!bids.length && <li className="text-on-surface/40 italic">No bids submitted yet for this lead.</li>}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-on-surface/40 text-xs">
                Select any lead on the left to view full workflow, homeowner details, and bids.
              </div>
            )}
          </div>
        </div>
      )}

      {sub === 'disputes' && (
        <div className="space-y-2">
          {disputes.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs space-y-2"
            >
              <div className="flex justify-between gap-2">
                <span className="font-mono">{d.lead_code}</span>
                <span className="font-semibold">{d.status}</span>
              </div>
              <div>
                {d.claim_type} · {d.installer_name || d.installer_email}
              </div>
              <div className="text-on-surface/50">{d.details || 'No details'}</div>
              {d.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-500/20 text-emerald-300 px-3 py-1"
                    onClick={() => reviewDispute(d.id, 'approved')}
                  >
                    Approve refund
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-red-500/20 text-red-300 px-3 py-1"
                    onClick={() => reviewDispute(d.id, 'denied')}
                  >
                    Deny
                  </button>
                </div>
              )}
            </div>
          ))}
          {!disputes.length && <p className="text-sm text-on-surface/50">No disputes.</p>}
        </div>
      )}

      {sub === 'installers' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/5 text-left text-on-surface/50">
                <tr>
                  <th className="p-3">Installer</th>
                  <th className="p-3">Verification</th>
                  <th className="p-3">Coverage Service Areas</th>
                  <th className="p-3">Wallet Balance</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {installers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02]">
                    <td className="p-3 align-top">
                      <div className="font-bold text-on-surface text-sm">{u.name}</div>
                      <div className="text-on-surface/45 text-[11px] font-mono">{u.email}</div>
                      {u.company_name && (
                        <div className="text-primary/80 text-[11px] font-semibold mt-0.5">{u.company_name}</div>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                          u.verification_status === 'verified'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : u.verification_status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-white/10 text-on-surface/50 border-white/15'
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
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300"
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
                              className="text-emerald-400/70 hover:text-red-400 font-bold ml-0.5"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        {(!u.areas || u.areas.length === 0) && (
                          <span className="text-amber-400/80 text-[11px] italic">No service areas</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 align-top font-bold text-on-surface font-mono">{formatMoney(u.wallet_balance)}</td>
                    <td className="p-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className="rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 px-2 py-1 text-[11px] font-semibold"
                          onClick={() => setVerification(u.id, 'verified')}
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          className="rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-2 py-1 text-[11px] font-semibold"
                          onClick={() => setVerification(u.id, 'pending')}
                        >
                          Pending
                        </button>
                        <button
                          type="button"
                          className="rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 px-2 py-1 text-[11px] font-semibold"
                          onClick={() => loadAreas(u.id)}
                        >
                          Manage Areas
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {areaUserId && (
            <div className="rounded-xl border border-white/10 p-4 space-y-3 bg-white/5">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-on-surface">
                  Service Areas for{' '}
                  {installers.find((u) => Number(u.id) === Number(areaUserId))?.name ||
                    installers.find((u) => Number(u.id) === Number(areaUserId))?.email ||
                    `User #${areaUserId}`}
                </h4>
                <button
                  type="button"
                  onClick={() => setAreaUserId(null)}
                  className="text-xs text-on-surface/40 hover:text-on-surface"
                >
                  Close
                </button>
              </div>
              <ul className="text-xs space-y-1.5 max-h-48 overflow-y-auto">
                {areas.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 border border-white/10 rounded-lg px-3 py-1.5 bg-surface-container-low">
                    <span className="text-on-surface/80">
                      {[a.zip && `ZIP: ${a.zip}`, a.state && `State: ${a.state}`, a.radius_miles && `${a.radius_miles} mi`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteArea(a.id)}
                      className="text-red-400 font-bold hover:underline text-[11px] px-2 py-0.5 rounded hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </li>
                ))}
                {!areas.length && (
                  <li className="text-on-surface/40 italic">No service areas set for this installer yet.</li>
                )}
              </ul>
              <form onSubmit={addArea} className="flex flex-wrap gap-2 items-end pt-2 border-t border-white/10">
                <label className="text-[11px] text-on-surface/60">
                  ZIP
                  <input
                    className={inputCls}
                    placeholder="e.g. 90210"
                    value={areaForm.zip || ''}
                    onChange={(e) => setAreaForm((f) => ({ ...f, zip: e.target.value }))}
                  />
                </label>
                <label className="text-[11px] text-on-surface/60">
                  State
                  <input
                    className={inputCls}
                    placeholder="e.g. CA"
                    value={areaForm.state || ''}
                    onChange={(e) => setAreaForm((f) => ({ ...f, state: e.target.value }))}
                  />
                </label>
                <label className="text-[11px] text-on-surface/60">
                  Radius (mi)
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="25"
                    value={areaForm.radiusMiles || ''}
                    onChange={(e) => setAreaForm((f) => ({ ...f, radiusMiles: e.target.value }))}
                  />
                </label>
                <button type="submit" className="rounded-lg bg-primary text-black text-xs px-4 py-2 font-bold hover:bg-primary/90">
                  Add Area
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {sub === 'wallets' && (
        <div className="space-y-4">
          <form
            onSubmit={adjustWallet}
            className="rounded-xl border border-white/10 p-4 flex flex-wrap gap-2 items-end"
          >
            <label className="text-xs">
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
            <label className="text-xs">
              Amount
              <input
                className={inputCls}
                value={walletForm.amount}
                onChange={(e) => setWalletForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </label>
            <label className="text-xs">
              Mode
              <select
                className={inputCls}
                value={walletForm.mode}
                onChange={(e) => setWalletForm((f) => ({ ...f, mode: e.target.value }))}
              >
                <option value="add">Add</option>
                <option value="subtract">Subtract</option>
                <option value="set">Set</option>
              </select>
            </label>
            <label className="text-xs grow">
              Note
              <input
                className={inputCls}
                value={walletForm.note}
                onChange={(e) => setWalletForm((f) => ({ ...f, note: e.target.value }))}
              />
            </label>
            <button type="submit" className="rounded-lg bg-primary text-black text-xs font-bold px-4 py-2">
              Adjust
            </button>
          </form>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/5 text-left text-on-surface/50">
                <tr>
                  <th className="p-2">User</th>
                  <th className="p-2">Balance</th>
                  <th className="p-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => (
                  <tr key={w.user_id} className="border-t border-white/5">
                    <td className="p-2">
                      #{w.user_id} {w.name} <span className="text-on-surface/40">{w.email}</span>
                    </td>
                    <td className="p-2 font-semibold">{formatMoney(w.balance)}</td>
                    <td className="p-2">{formatWhen(w.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-on-surface/50 mb-2">Recent ledger</h4>
            <ul className="text-xs space-y-1 max-h-60 overflow-y-auto">
              {ledger.map((row) => (
                <li key={row.id} className="border-b border-white/5 py-1 flex justify-between gap-2">
                  <span>
                    {row.user_name || row.user_id} · {row.entry_type} · {formatMoney(row.amount)}
                  </span>
                  <span className="text-on-surface/40">{formatWhen(row.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] uppercase tracking-wide text-on-surface/45">{label}</div>
      <div className="text-xl font-bold mt-1">{value ?? '—'}</div>
    </div>
  );
}

const inputCls =
  'mt-1 block w-full rounded-lg border border-white/10 bg-surface-container px-2.5 py-2 text-sm text-on-surface outline-none';
