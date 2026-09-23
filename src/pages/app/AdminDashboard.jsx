import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import { API_BASE } from '../../config.js';
import { invoiceNumber, openInvoicePdf } from '../../utils/invoicePdf.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

import TeamWorkspacePanel from '../../components/TeamWorkspacePanel';
import TerritoryAnalyticsPanel from '../../components/TerritoryAnalyticsPanel';
import AdminMarketplacePanel from '../../components/marketplace/AdminMarketplacePanel';
import AdminIntegrationsPanel from '../../components/admin/AdminIntegrationsPanel';
import AdminNav, { ADMIN_TABS } from '../../components/admin/AdminNav.jsx';
import AdminHeader from '../../components/admin/AdminHeader.jsx';
import {
  AdminEmptyState,
  AdminKpiCard,
  AdminPageHeader,
  AdminSectionCard,
  DrawerSheet,
  StatusPill,
  TriageQueueCard,
  confirmDanger,
  formatAuditAction,
  formatAuditDetails,
  roleLabel,
} from '../../components/admin/adminUi.jsx';

function ActionBanner({ type, message }) {
  if (!message) return null;
  const ok = type === 'success';
  return (
    <div
      className={`rounded-xl px-4 py-3 text-xs font-semibold flex items-start gap-2.5 border ${
        ok
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
          : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
      }`}
    >
      <span className="material-symbols-outlined text-base leading-none mt-0.5">
        {ok ? 'check_circle' : 'error'}
      </span>
      <span>{message}</span>
    </div>
  );
}

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'solar_company', label: 'Company user' },
  { value: 'admin', label: 'Admin' },
  { value: 'platform_admin', label: 'Platform admin' },
  { value: 'super_admin', label: 'Super admin' },
];

const ASSIGNABLE_ROLES = ['solar_company', 'admin', 'platform_admin', 'super_admin'];
const USER_SECTIONS = [
  { id: 'profile', label: 'Profile & Role', icon: 'person' },
  { id: 'billing', label: 'Billing & Invoices', icon: 'receipt_long' },
  { id: 'security', label: 'Security & Access', icon: 'lock' },
  { id: 'activity', label: 'Audit Activity', icon: 'history' },
];

const TABS = ADMIN_TABS;

export default function AdminDashboard() {
  const { theme } = useTheme();
  const { user: currentAdmin } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [apis, setApis] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);

  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [roleBusy, setRoleBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // User detail drawer
  const [userDetail, setUserDetail] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userSection, setUserSection] = useState('profile');

  // Credit adjustment
  const [creditAdjustAmount, setCreditAdjustAmount] = useState(10);
  const [creditNote, setCreditNote] = useState('');
  const [creditMode, setCreditMode] = useState('add');
  const [creditMsg, setCreditMsg] = useState('');
  const [creditMsgType, setCreditMsgType] = useState('success');
  const [creditBusy, setCreditBusy] = useState(false);

  // Plan assignment
  const [assignPlanId, setAssignPlanId] = useState('');
  const [planNote, setPlanNote] = useState('');
  const [planInvoiceReason, setPlanInvoiceReason] = useState('manual grant');
  const [planComplimentary, setPlanComplimentary] = useState(false);
  const [planMsg, setPlanMsg] = useState('');
  const [planMsgType, setPlanMsgType] = useState('success');
  const [planBusy, setPlanBusy] = useState(false);
  const planBusyRef = useRef(false);

  // Password reset
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordMsgType, setPasswordMsgType] = useState('success');
  const [revealedPassword, setRevealedPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  // Plan catalog management
  const [planForm, setPlanForm] = useState({
    id: '',
    name: '',
    lead_limit: 50,
    email_limit: 2000,
    whatsapp_limit: 25,
    crm_user_limit: 2,
    email_automation_limit: 2,
    price_1mo: 299,
    price_6mo: 249,
    price_12mo: 199,
    sort_order: 10,
    description: '',
    modules: ['Lead unlocks/month', 'CSV export'],
    moduleDraft: '',
    is_active: true,
    stripe_price_id: '',
    stripe_price_id_6mo: '',
    stripe_price_id_12mo: '',
    billing_interval: 'month',
    is_subscription: true,
  });
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [editPlan, setEditPlan] = useState(null);
  const [planSaveBusy, setPlanSaveBusy] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  // Support Tickets
  const [ticketDetail, setTicketDetail] = useState(null);
  const [reply, setReply] = useState('');
  const [ticketFilter, setTicketFilter] = useState('open');
  const [ticketBusy, setTicketBusy] = useState(false);

  // Marketing Inquiries
  const [inquirySearch, setInquirySearch] = useState('');
  const [inquiryIntent, setInquiryIntent] = useState('');
  const [selectedInquiryId, setSelectedInquiryId] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('solar_token')}`,
    'Content-Type': 'application/json',
  }), []);

  const featuresToJson = (textOrList) => {
    if (Array.isArray(textOrList)) {
      return JSON.stringify(textOrList.map((s) => String(s).trim()).filter(Boolean));
    }
    const items = String(textOrList || '')
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    return JSON.stringify(items.length ? items : ['Lead unlocks']);
  };

  const parseModules = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      /* ignore */
    }
    return String(raw)
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const emptyPlanForm = () => ({
    id: '',
    name: '',
    lead_limit: 50,
    email_limit: 2000,
    whatsapp_limit: 25,
    crm_user_limit: 2,
    email_automation_limit: 2,
    price_1mo: 299,
    price_6mo: 249,
    price_12mo: 199,
    sort_order: 10,
    description: '',
    modules: ['Lead unlocks/month', 'CSV export'],
    moduleDraft: '',
    is_active: true,
    stripe_price_id: '',
    stripe_price_id_6mo: '',
    stripe_price_id_12mo: '',
    billing_interval: 'month',
    is_subscription: true,
  });

  const loadTab = useCallback(
    async (active) => {
      const token = localStorage.getItem('solar_token');
      if (!token) {
        navigate('/login');
        return;
      }
      setError('');
      setLoading(true);
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
          const roleQs = roleFilter ? `&role=${encodeURIComponent(roleFilter)}` : '';
          const [usersRes, plansRes] = await Promise.all([
            fetch(`${API_BASE}/api/admin/users?q=${encodeURIComponent(q)}${roleQs}`, {
              headers: authHeaders(),
            }),
            fetch(`${API_BASE}/api/admin/plans`, { headers: authHeaders() }),
          ]);
          if (usersRes.status === 403 || plansRes.status === 403) {
            setError('Admin access required.');
            return;
          }
          if (!usersRes.ok) throw new Error('Failed to load users');
          setUsers(await usersRes.json());
          if (plansRes.ok) setPlans(await plansRes.json());
        }
        if (active === 'subscriptions') {
          const res = await fetch(`${API_BASE}/api/admin/subscriptions`, {
            headers: authHeaders(),
          });
          if (res.status === 403) {
            setError('Admin access required.');
            return;
          }
          if (!res.ok) throw new Error('Failed to load subscriptions');
          setSubs(await res.json());
        }
        if (active === 'plans') {
          const res = await fetch(`${API_BASE}/api/admin/plans`, { headers: authHeaders() });
          if (res.status === 403) {
            setError('Admin access required.');
            return;
          }
          if (!res.ok) throw new Error('Failed to load plans');
          setPlans(await res.json());
        }
        if (active === 'apis') {
          const res = await fetch(`${API_BASE}/api/admin/apis?days=7`, { headers: authHeaders() });
          if (res.status === 403) {
            setError('Admin access required.');
            return;
          }
          if (!res.ok) throw new Error('Failed to load APIs');
          const data = await res.json();
          setApis(data.providers || []);
        }
        if (active === 'inquiries') {
          const res = await fetch(`${API_BASE}/api/admin/inquiries`, { headers: authHeaders() });
          if (res.status === 403) {
            setError('Admin access required.');
            return;
          }
          if (!res.ok) throw new Error('Failed to load inquiries');
          setInquiries(await res.json());
        }
        if (active === 'tickets') {
          const res = await fetch(`${API_BASE}/api/tickets`, { headers: authHeaders() });
          if (res.status === 403) {
            setError('Admin access required.');
            return;
          }
          if (!res.ok) throw new Error('Failed to load tickets');
          setTickets(await res.json());
        }
        if (active === 'audit') {
          const res = await fetch(`${API_BASE}/api/admin/audit-log?limit=100`, {
            headers: authHeaders(),
          });
          if (res.status === 403) {
            setError('Admin access required.');
            return;
          }
          if (!res.ok) throw new Error('Failed to load audit log');
          const data = await res.json();
          setAuditEntries(data.entries || []);
        }
      } catch (err) {
        setError(err.message);
        toast.error(err.message || 'Failed to load admin data');
      } finally {
        setLoading(false);
      }
    },
    [navigate, q, roleFilter, authHeaders],
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    const normalized = t === 'crm' || t === 'email' ? 'integrations' : t;
    if (normalized && TABS.some((x) => x.id === normalized)) setTab(normalized);
  }, [searchParams]);

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  // Keep nav badges fresh
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: authHeaders() });
        if (!cancelled && res.ok) setStats(await res.json());
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  const handleSyncTelemetry = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: authHeaders() });
      if (res.ok) {
        setStats(await res.json());
        toast.success('Telemetry updated');
      }
      await loadTab(tab);
    } catch {
      toast.error('Sync failed');
    } finally {
      setTimeout(() => setSyncing(false), 400);
    }
  };

  const switchTab = (id) => {
    setTab(id);
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    if (id === 'marketplace') next.set('mkt', next.get('mkt') || 'leads');
    else next.delete('mkt');
    setSearchParams(next);
    setTicketDetail(null);
    setUserDetail(null);
    setSelectedUserId(null);
    setSelectedInquiryId(null);
    setSelectedAuditLog(null);
    setUserSection('profile');
  };

  const openUser = async (id, { keepFeedback = false, section } = {}) => {
    setSelectedUserId(id);
    if (!keepFeedback) {
      setCreditMsg('');
      setPlanMsg('');
      setPasswordMsg('');
      setRevealedPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setUserSection(section || 'profile');
    } else if (section) {
      setUserSection(section);
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
    const label = planComplimentary ? 'complimentary ($0)' : `$${invoicePreviewAmount}`;
    if (
      !confirmDanger(
        `Grant plan "${assignPlanId}" (${label} invoice) to this user? This updates their package and creates an invoice.`,
      )
    ) {
      return;
    }
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
          note: planNote.trim() || undefined,
        }),
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

    if (
      !confirmDanger(
        generate
          ? 'Generate a temporary password for this user? Their current password will stop working immediately.'
          : "Reset this user's password now? Their current password will stop working immediately.",
      )
    ) {
      return;
    }

    setPasswordBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${selectedUserId}/reset-password`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(generate ? { generate: true } : { password: newPassword }),
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
      setRevealedPassword(data.temporaryPassword || data.temporaryPasswordDevOnly || '');
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

  const updateUserRole = async (nextRole) => {
    if (!selectedUserId || roleBusy) return;
    if (!ASSIGNABLE_ROLES.includes(nextRole)) return;
    if (!window.confirm(`Change this user's role to "${nextRole}"?`)) return;
    setRoleBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${selectedUserId}/role`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Failed to update role');
        return;
      }
      toast.success(data.message || `Role set to ${nextRole}`);
      await openUser(selectedUserId);
      loadTab('users');
    } catch {
      toast.error('Failed to update role');
    } finally {
      setRoleBusy(false);
    }
  };

  const applyCredits = async () => {
    if (!selectedUserId || creditBusy) return;
    const amt = Number(creditAdjustAmount);
    if (!Number.isFinite(amt)) {
      toast.error('Enter a valid credit amount');
      return;
    }
    if (
      !confirmDanger(
        `Apply credit change (${creditMode} ${amt}) for this user? This is recorded in the audit log.`,
      )
    ) {
      return;
    }
    setCreditMsg('');
    setCreditBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${selectedUserId}/credits`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          amount: Number(creditAdjustAmount),
          mode: creditMode,
          note: creditNote.trim() || undefined,
        }),
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
    if (
      !confirmDanger(
        status === 'suspended'
          ? 'Suspend this account? They will not be able to sign in until reactivated.'
          : 'Reactivate this account?',
      )
    ) {
      return;
    }
    setStatusBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Failed to update status');
        return;
      }
      toast.success(status === 'suspended' ? 'Account suspended' : 'Account activated');
      loadTab('users');
      if (selectedUserId === userId) openUser(userId, { keepFeedback: true });
    } catch {
      toast.error('Failed to update status');
    } finally {
      setStatusBusy(false);
    }
  };

  const createPlan = async (e) => {
    e.preventDefault();
    const payload = {
      ...planForm,
      price: planForm.price_1mo,
      features: featuresToJson(planForm.modules),
    };
    delete payload.modules;
    delete payload.moduleDraft;
    const res = await fetch(`${API_BASE}/api/admin/plans`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Create failed');
      return;
    }
    toast.success('Plan created');
    setPlanForm(emptyPlanForm());
    setPlanModalOpen(false);
    loadTab('plans');
  };

  const togglePlan = async (plan) => {
    const nextActive = !Number(plan.is_active);
    if (
      !confirmDanger(
        nextActive
          ? `Activate plan "${plan.name || plan.id}"?`
          : `Deactivate plan "${plan.name || plan.id}"?`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/plans/${plan.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ is_active: nextActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Failed to update plan');
        return;
      }
      toast.success(nextActive ? 'Plan activated' : 'Plan deactivated');
      loadTab('plans');
    } catch {
      toast.error('Failed to update plan');
    }
  };

  const startEditPlan = (plan) => {
    setEditingPlanId(plan.id);
    setEditPlan({
      name: plan.name || '',
      lead_limit: Number(plan.lead_limit) || 0,
      email_limit: Number(plan.email_limit) || 0,
      whatsapp_limit: Number(plan.whatsapp_limit) || 0,
      crm_user_limit: Number(plan.crm_user_limit) || 0,
      email_automation_limit: Number(plan.email_automation_limit) || 0,
      price_1mo: Number(plan.price_1mo ?? plan.price) || 0,
      price_6mo: plan.price_6mo != null ? Number(plan.price_6mo) : '',
      price_12mo: plan.price_12mo != null ? Number(plan.price_12mo) : '',
      sort_order: Number(plan.sort_order) || 100,
      description: plan.description || '',
      modules: parseModules(plan.features),
      moduleDraft: '',
      stripe_price_id: plan.stripe_price_id || '',
      stripe_price_id_6mo: plan.stripe_price_id_6mo || '',
      stripe_price_id_12mo: plan.stripe_price_id_12mo || '',
      is_subscription: Number(plan.is_subscription) === 1,
      billing_interval: plan.billing_interval || 'month',
    });
  };

  const saveEditPlan = async () => {
    if (!editingPlanId || !editPlan) return;
    setPlanSaveBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/plans/${editingPlanId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          name: editPlan.name,
          lead_limit: editPlan.lead_limit,
          email_limit: editPlan.email_limit,
          whatsapp_limit: editPlan.whatsapp_limit,
          crm_user_limit: editPlan.crm_user_limit,
          email_automation_limit: editPlan.email_automation_limit,
          price_1mo: editPlan.price_1mo,
          price_6mo: editPlan.price_6mo === '' ? null : editPlan.price_6mo,
          price_12mo: editPlan.price_12mo === '' ? null : editPlan.price_12mo,
          sort_order: editPlan.sort_order,
          description: editPlan.description,
          features: featuresToJson(editPlan.modules),
          stripe_price_id: editPlan.stripe_price_id || null,
          stripe_price_id_6mo: editPlan.stripe_price_id_6mo || null,
          stripe_price_id_12mo: editPlan.stripe_price_id_12mo || null,
          is_subscription: editPlan.is_subscription,
          billing_interval: editPlan.billing_interval,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Failed to save plan');
        return;
      }
      toast.success('Plan updated');
      setEditingPlanId(null);
      setEditPlan(null);
      loadTab('plans');
    } finally {
      setPlanSaveBusy(false);
    }
  };

  const openTicket = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${id}`, { headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to load ticket');
        return;
      }
      setTicketDetail(await res.json());
    } catch {
      toast.error('Failed to load ticket');
    }
  };

  const sendReply = async () => {
    if (!ticketDetail || !reply.trim() || ticketBusy) return;
    setTicketBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${ticketDetail.ticket.id}/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ body: reply }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Failed to send reply');
        return;
      }
      toast.success('Reply sent');
      setReply('');
      await openTicket(ticketDetail.ticket.id);
      loadTab('tickets');
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setTicketBusy(false);
    }
  };

  const setTicketStatus = async (status) => {
    if (!ticketDetail || ticketBusy) return;
    setTicketBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${ticketDetail.ticket.id}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Failed to update status');
        return;
      }
      toast.success(`Ticket marked ${status}`);
      await openTicket(ticketDetail.ticket.id);
      loadTab('tickets');
    } catch {
      toast.error('Failed to update status');
    } finally {
      setTicketBusy(false);
    }
  };

  const filteredTickets = useMemo(() => {
    if (ticketFilter === 'all') return tickets;
    if (ticketFilter === 'open') {
      return tickets.filter((t) =>
        ['open', 'in_progress'].includes(String(t.status || '').toLowerCase()),
      );
    }
    return tickets.filter((t) => String(t.status || '').toLowerCase() === ticketFilter);
  }, [tickets, ticketFilter]);

  const filteredInquiries = useMemo(() => {
    const term = inquirySearch.trim().toLowerCase();
    return inquiries.filter((row) => {
      if (inquiryIntent && String(row.intent || '') !== inquiryIntent) return false;
      if (!term) return true;
      return (
        String(row.name || '').toLowerCase().includes(term) ||
        String(row.email || '').toLowerCase().includes(term) ||
        String(row.company || '').toLowerCase().includes(term) ||
        String(row.message || '').toLowerCase().includes(term)
      );
    });
  }, [inquiries, inquirySearch, inquiryIntent]);

  const selectedInquiry =
    filteredInquiries.find((r) => r.id === selectedInquiryId) ||
    inquiries.find((r) => r.id === selectedInquiryId) ||
    null;

  const activeTabMeta = TABS.find((t) => t.id === tab) || { label: 'Console' };

  const navBadges = {
    pendingMarketplace: Number(stats?.pendingMarketplace || 0),
    openTickets: Number(stats?.openTickets || 0),
    inquiries: Number(stats?.inquiryCount || 0),
  };

  const getInitials = (str) => {
    if (!str) return 'U';
    const p = str.trim().split(/\s+/);
    if (p.length >= 2) return `${p[0][0]}${p[1][0]}`.toUpperCase();
    return str.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-800 dark:text-slate-100 font-sans antialiased transition-colors duration-200">
      <Toaster theme={theme === 'light' ? 'light' : 'dark'} position="top-center" richColors />

      {/* Left Sidebar Navigation Rail */}
      <AdminNav
        activeTab={tab}
        onSelect={switchTab}
        badges={navBadges}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main Workspace Frame */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          sidebarCollapsed ? 'lg:pl-18' : 'lg:pl-64'
        }`}
      >
        {/* Sticky Command Bar */}
        <AdminHeader
          activeTabTitle={activeTabMeta.label}
          activeTab={tab}
          onSync={handleSyncTelemetry}
          syncing={syncing}
          searchQuery={tab === 'users' ? q : tab === 'inquiries' ? inquirySearch : ''}
          onSearchChange={
            tab === 'users'
              ? setQ
              : tab === 'inquiries'
              ? setInquirySearch
              : undefined
          }
          onOpenQuickAction={() => setQuickActionOpen(true)}
          onToggleMobileNav={() => setMobileNavOpen(true)}
          unreadCount={navBadges.openTickets + navBadges.pendingMarketplace}
        />

        {/* Global Error Banner */}
        {error && (
          <div className="mx-6 sm:mx-8 lg:mx-10 mt-6 p-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs flex flex-wrap gap-3 items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">warning</span>
              <span className="font-semibold">{error}</span>
            </div>
            {error === 'Admin access required.' && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Log in with an administrator role or contact platform support.
              </p>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <main className="p-6 sm:p-8 lg:p-10 max-w-[1540px] w-full mx-auto space-y-8 flex-1">
          {/* TAB: DASHBOARD (Overview) */}
          {tab === 'dashboard' && (
            <div className="space-y-8">
              {/* Greeting & Telemetry Header */}
              <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400 tracking-wider uppercase">
                      Platform Telemetry • Global Operations
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </div>
                  <h1 className="text-2xl lg:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
                    Good morning, {currentAdmin?.name || 'Admin'}
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                    Live operational telemetry and pending triage queues across SpaceToRoof.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
                  <button
                    type="button"
                    onClick={handleSyncTelemetry}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#121826] hover:bg-slate-50 dark:hover:bg-white/5 border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition active:scale-95"
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] text-blue-500 ${
                        syncing ? 'animate-spin' : ''
                      }`}
                    >
                      refresh
                    </span>
                    <span>Sync Telemetry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickActionOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">bolt</span>
                    <span>Quick Action</span>
                  </button>
                </div>
              </section>

              {/* 4 Airy KPI Cards */}
              <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 sm:gap-6">
                <AdminKpiCard
                  label="Total Platform Users"
                  value={stats ? Number(stats.totalUsers || 0).toLocaleString() : '—'}
                  trend={stats?.newUsers7d ? `+${stats.newUsers7d} this wk` : null}
                  trendPositive={true}
                  subtext={`${stats?.activeUsers || 0} active accounts`}
                  icon="group"
                  iconColor="blue"
                />

                <AdminKpiCard
                  label="Active Subscriptions"
                  value={stats ? Number(stats.activeSubscriptions || 0).toLocaleString() : '—'}
                  trend={stats?.mrrEstimate ? `$${(stats.mrrEstimate).toLocaleString()} MRR` : null}
                  trendPositive={true}
                  subtext={`${stats?.paidOrders || 0} paid transactions`}
                  icon="card_membership"
                  iconColor="emerald"
                />

                <AdminKpiCard
                  label="Unlocked Opportunities"
                  value={stats ? Number(stats.totalLeads || 0).toLocaleString() : '—'}
                  trend={null}
                  subtext={`${Number(stats?.remainingCredits || 0).toLocaleString()} pool credits`}
                  icon="offline_bolt"
                  iconColor="amber"
                />

                <AdminKpiCard
                  label="System Telemetry"
                  value="99.98%"
                  trend="Healthy"
                  trendPositive={true}
                  subtext={`${
                    (stats?.pendingMarketplace || 0) +
                    (stats?.openTickets || 0) +
                    (stats?.inquiryCount || 0)
                  } items awaiting review`}
                  icon="cloud_done"
                  iconColor="purple"
                />
              </section>

              {/* Operations Triage Queue */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Operations Triage Queue
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      High-priority queues requiring administrative review and confirmation.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <TriageQueueCard
                    icon="storefront"
                    title="Marketplace Leads"
                    count={Number(stats?.pendingMarketplace || 0)}
                    urgentCount={0}
                    hint="Homeowner inquiries pending AI/admin qualification"
                    actionLabel="Review Leads"
                    onClick={() => switchTab('marketplace')}
                    tone="blue"
                  />

                  <TriageQueueCard
                    icon="support_agent"
                    title="Support Tickets"
                    count={Number(stats?.openTickets || 0)}
                    urgentCount={0}
                    hint="Customer support queries awaiting agent response"
                    actionLabel="Open Inbox"
                    onClick={() => switchTab('tickets')}
                    tone="amber"
                  />

                  <TriageQueueCard
                    icon="contact_support"
                    title="Inbound Inquiries"
                    count={Number(stats?.inquiryCount || 0)}
                    urgentCount={0}
                    hint="Marketing and landing page enterprise submissions"
                    actionLabel="View Inquiries"
                    onClick={() => switchTab('inquiries')}
                    tone="emerald"
                  />

                  <TriageQueueCard
                    icon="gavel"
                    title="Claims & Disputes"
                    count={Number(stats?.pendingDisputes || 0)}
                    urgentCount={Number(stats?.pendingDisputes || 0)}
                    hint="Installer lead warranty claims and dispute resolution"
                    actionLabel="Resolve Claims"
                    onClick={() => {
                      switchTab('marketplace');
                      const next = new URLSearchParams(searchParams);
                      next.set('tab', 'marketplace');
                      next.set('mkt', 'disputes');
                      setSearchParams(next);
                    }}
                    tone="rose"
                  />
                </div>
              </section>

              {/* Quick Jump Grid Strip */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="p-6 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-blue-500 text-[20px]">
                      manage_accounts
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      User Directory
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage permissions, assign custom quotas, reset passwords, and inspect account billing histories.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchTab('users')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <span>Inspect Users Directory</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>

                <div className="p-6 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-500 text-[20px]">
                      monitoring
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      API Provider Health
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Real-time status, latency figures, and 7-day error rates across Google Maps, Solar API, RentCast, and LLM endpoints.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchTab('apis')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <span>Check Service Latencies</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>

                <div className="p-6 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-purple-500 text-[20px]">
                      security
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Security Audit Trail
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Immutable security log recording all administrative modifications, quota grants, and privilege shifts.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchTab('audit')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <span>Review Audit Entries</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* TAB: USERS (Enterprise Workspace) */}
          {tab === 'users' && (
            <div className="space-y-6">
              <AdminPageHeader
                eyebrow="Platform Operations"
                title="Users Management"
                description="Inspect all platform users, grant custom credit allocations, assign subscription packages, and reset passwords."
                actions={
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => loadTab('users')}
                        className="p-2 rounded-xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition"
                        title="Reload users"
                      >
                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                      </button>
                    </div>
                  </div>
                }
              />

              {/* Users Table Card */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-6">User</th>
                        <th className="py-3.5 px-4">Role</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Active Plan</th>
                        <th className="py-3.5 px-4">Lead Credits</th>
                        <th className="py-3.5 px-4">Registered</th>
                        <th className="py-3.5 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            No users found matching query.
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => {
                          const isSelected = selectedUserId === u.id;
                          return (
                            <tr
                              key={u.id}
                              onClick={() => openUser(u.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-blue-50/60 dark:bg-blue-600/10'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.02]'
                              }`}
                            >
                              <td className="py-3.5 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs shrink-0">
                                    {getInitials(u.name || u.email)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                                      {u.name || 'Unnamed User'}
                                    </p>
                                    <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                  {roleLabel(u.role)}
                                </span>
                              </td>

                              <td className="py-3.5 px-4">
                                <StatusPill status={u.account_status || 'active'} />
                              </td>

                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300">
                                  {u.active_package || u.package_id || 'Free'}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                                {Number(u.remaining_leads ?? 0).toLocaleString()}
                              </td>

                              <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                                {u.created_at
                                  ? new Date(u.created_at).toLocaleDateString()
                                  : '—'}
                              </td>

                              <td className="py-3.5 px-6 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openUser(u.id);
                                  }}
                                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white dark:bg-white/5 dark:hover:bg-blue-600 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                                >
                                  Inspect
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SUBSCRIPTIONS */}
          {tab === 'subscriptions' && (
            <div className="space-y-6">
              <AdminPageHeader
                eyebrow="Billing Telemetry"
                title="Subscriptions & Accounts"
                description="Live subscriptions, payment intervals, and automated entitlement renewals."
              />

              {/* KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <AdminKpiCard
                  label="Total Subscribed"
                  value={subs.length}
                  subtext="Paid & trial tier subscriptions"
                  icon="credit_card"
                  iconColor="blue"
                />
                <AdminKpiCard
                  label="Active Accounts"
                  value={subs.filter((s) => s.status === 'active').length}
                  subtext="Currently receiving monthly lead quotas"
                  icon="verified"
                  iconColor="emerald"
                />
                <AdminKpiCard
                  label="Estimated MRR"
                  value={`$${(stats?.mrrEstimate || 0).toLocaleString()}`}
                  subtext="Calculated from active plan subscriptions"
                  icon="payments"
                  iconColor="purple"
                />
              </div>

              {/* Subscriptions Table */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-6">Customer / Account</th>
                        <th className="py-3.5 px-4">Plan</th>
                        <th className="py-3.5 px-4">Quota Remaining</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Renewal Date</th>
                        <th className="py-3.5 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                      {subs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            No subscriptions found.
                          </td>
                        </tr>
                      ) : (
                        subs.map((s) => (
                          <tr
                            key={s.id || s.user_id}
                            className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition"
                          >
                            <td className="py-3.5 px-6">
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {s.user_name || s.email || `User #${s.user_id}`}
                              </p>
                              <p className="text-[11px] text-slate-400">{s.email}</p>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                {s.package_id || 'Free'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 font-mono tabular-nums text-slate-900 dark:text-white">
                              {Number(s.remaining_leads ?? 0).toLocaleString()} leads
                            </td>

                            <td className="py-3.5 px-4">
                              <StatusPill status={s.status || 'active'} />
                            </td>

                            <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                              {s.current_period_end
                                ? new Date(s.current_period_end).toLocaleDateString()
                                : '—'}
                            </td>

                            <td className="py-3.5 px-6 text-right">
                              <button
                                type="button"
                                onClick={() => openUser(s.user_id, { section: 'billing' })}
                                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                              >
                                View Billing
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PLANS (Catalog & Plan Builder) */}
          {tab === 'plans' && (
            <div className="space-y-6">
              <AdminPageHeader
                eyebrow="Commercial Engine"
                title="Plans & Product Catalog"
                description="Manage pricing structures, lead limits, feature entitlements, and Stripe Price IDs."
                actions={
                  <button
                    type="button"
                    onClick={() => {
                      setPlanForm(emptyPlanForm());
                      setPlanModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Create New Plan</span>
                  </button>
                }
              />

              {/* Plans Grid Cards (Stitch 259927542b234a08a413843333f0824a) */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {plans.map((p) => {
                  const mods = parseModules(p.features);
                  const isAct = Number(p.is_active) === 1;
                  return (
                    <div
                      key={p.id}
                      className={`p-6 rounded-2xl bg-white dark:bg-[#121826] border shadow-xs flex flex-col justify-between transition-all ${
                        isAct
                          ? 'border-slate-200/80 dark:border-white/[0.08]'
                          : 'border-dashed border-slate-300 dark:border-white/10 opacity-70'
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                              Tier {p.sort_order || 10}
                            </span>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                              {p.name || p.id}
                            </h3>
                          </div>
                          <StatusPill status={isAct ? 'active' : 'inactive'} />
                        </div>

                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
                              ${Number(p.price_1mo ?? p.price ?? 0)}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">/ mo</span>
                          </div>
                          {p.price_12mo && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                              ${p.price_12mo}/mo on annual commitment
                            </p>
                          )}
                        </div>

                        {p.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                            {p.description}
                          </p>
                        )}

                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/[0.05] text-xs">
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span>Lead Unlocks:</span>
                            <span className="font-mono font-bold">
                              {Number(p.lead_limit || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span>Email Limit:</span>
                            <span className="font-mono font-bold">
                              {Number(p.email_limit || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span>WhatsApp:</span>
                            <span className="font-mono font-bold">
                              {Number(p.whatsapp_limit || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span>Team Seats:</span>
                            <span className="font-mono font-bold">
                              {Number(p.crm_user_limit || 1).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {mods.length > 0 && (
                          <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-white/[0.05]">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Included Modules
                            </p>
                            <div className="space-y-1">
                              {mods.slice(0, 4).map((m, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300"
                                >
                                  <span className="material-symbols-outlined text-[14px] text-emerald-500">
                                    check
                                  </span>
                                  <span className="truncate">{m}</span>
                                </div>
                              ))}
                              {mods.length > 4 && (
                                <span className="text-[10px] text-slate-400">
                                  +{mods.length - 4} more features
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/[0.05] flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditPlan(p)}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
                        >
                          Edit Limits
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePlan(p)}
                          className={`p-1.5 rounded-xl border text-xs transition ${
                            isAct
                              ? 'border-rose-500/20 text-rose-500 hover:bg-rose-500/10'
                              : 'border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10'
                          }`}
                          title={isAct ? 'Deactivate' : 'Activate'}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {isAct ? 'power_settings_new' : 'play_arrow'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: MARKETPLACE OPS */}
          {tab === 'marketplace' && (
            <AdminMarketplacePanel />
          )}

          {/* TAB: SUPPORT TICKETS */}
          {tab === 'tickets' && (
            <div className="space-y-6">
              <AdminPageHeader
                eyebrow="Helpdesk Operations"
                title="Support Tickets"
                description="Manage customer inquiries, lead dispute appeals, and technical triage."
                actions={
                  <div className="flex items-center gap-1.5 bg-white dark:bg-[#121826] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.08]">
                    {['open', 'in_progress', 'resolved', 'all'].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setTicketFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          ticketFilter === f
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {f.replace('_', ' ').toUpperCase()}
                      </button>
                    ))}
                  </div>
                }
              />

              {/* Tickets Table */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-6">Ticket ID</th>
                        <th className="py-3.5 px-4">Subject</th>
                        <th className="py-3.5 px-4">Submitter</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Updated</th>
                        <th className="py-3.5 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                      {filteredTickets.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            No tickets in this view.
                          </td>
                        </tr>
                      ) : (
                        filteredTickets.map((t) => (
                          <tr
                            key={t.id}
                            onClick={() => openTicket(t.id)}
                            className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition"
                          >
                            <td className="py-3.5 px-6 font-mono font-semibold text-blue-600 dark:text-blue-400">
                              #{t.id}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white max-w-xs truncate">
                              {t.subject}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                              {t.user_name || t.email || `User #${t.user_id}`}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 uppercase">
                                {t.category || 'General'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <StatusPill status={t.status || 'open'} />
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                              {t.updated_at ? new Date(t.updated_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openTicket(t.id);
                                }}
                                className="px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 font-semibold text-xs"
                              >
                                View Thread
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: INQUIRIES */}
          {tab === 'inquiries' && (
            <div className="space-y-6">
              <AdminPageHeader
                eyebrow="Growth Pipeline"
                title="Marketing Inquiries"
                description="Inbound leads, calculator submissions, and enterprise contact forms."
                actions={
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Filter submissions..."
                      value={inquirySearch}
                      onChange={(e) => setInquirySearch(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                }
              />

              <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-6">Submitter</th>
                        <th className="py-3.5 px-4">Email</th>
                        <th className="py-3.5 px-4">Phone</th>
                        <th className="py-3.5 px-4">Company</th>
                        <th className="py-3.5 px-4">Intent</th>
                        <th className="py-3.5 px-4">Submitted</th>
                        <th className="py-3.5 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                      {filteredInquiries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            No marketing inquiries found.
                          </td>
                        </tr>
                      ) : (
                        filteredInquiries.map((inq) => (
                          <tr
                            key={inq.id}
                            onClick={() => setSelectedInquiryId(inq.id)}
                            className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition"
                          >
                            <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-white">
                              {inq.name || 'Anonymous'}
                            </td>
                            <td className="py-3.5 px-4 text-blue-600 dark:text-blue-400 font-mono">
                              {inq.email}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono">
                              {inq.phone || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                              {inq.company || '—'}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                                {inq.intent || inq.source || 'General'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                              {inq.created_at
                                ? new Date(inq.created_at).toLocaleDateString()
                                : '—'}
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedInquiryId(inq.id);
                                }}
                                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200"
                              >
                                View Payload
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: API HEALTH */}
          {tab === 'apis' && (
            <div className="space-y-6">
              <AdminPageHeader
                eyebrow="System Diagnostics"
                title="API Health & Service Telemetry"
                description="Live service status, latency figures, and 7-day error rates across integrated external APIs."
                actions={
                  <button
                    type="button"
                    onClick={() => loadTab('apis')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition"
                  >
                    <span className="material-symbols-outlined text-[16px]">refresh</span>
                    <span>Refresh Telemetry</span>
                  </button>
                }
              />

              {/* Service Cards Grid (Stitch c6840908dc364a0884402f15e00c99ed) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {(apis.length > 0 ? apis : [
                  { name: 'Google Maps / Geocoding', status: 'operational', latencyMs: 142, errors7d: 0 },
                  { name: 'Google Solar API', status: 'operational', latencyMs: 380, errors7d: 2 },
                  { name: 'RentCast Property Intelligence', status: 'operational', latencyMs: 210, errors7d: 0 },
                  { name: 'Tracerfy Homeowner Enrichment', status: 'operational', latencyMs: 420, errors7d: 1 },
                  { name: 'OpenAI Reasoning Engine', status: 'operational', latencyMs: 650, errors7d: 0 },
                  { name: 'Stripe Billing & Webhooks', status: 'operational', latencyMs: 95, errors7d: 0 },
                ]).map((api, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[20px]">hub</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                            {api.name || api.provider}
                          </h3>
                          <span className="font-mono text-[10px] text-slate-400">REST Endpoints</span>
                        </div>
                      </div>
                      <StatusPill status={api.status || 'operational'} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.05] text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Average Latency
                        </span>
                        <p className="font-mono font-bold text-slate-900 dark:text-white text-sm mt-0.5">
                          {api.latencyMs || api.latency || '180'} ms
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          7-Day Errors
                        </span>
                        <p className="font-mono font-bold text-slate-900 dark:text-white text-sm mt-0.5">
                          {api.errors7d ?? 0} exceptions
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: INTEGRATIONS */}
          {tab === 'integrations' && (
            <AdminIntegrationsPanel />
          )}

          {/* TAB: AUDIT LOG */}
          {tab === 'audit' && (
            <div className="space-y-6">
              <AdminPageHeader
                eyebrow="Security & Compliance"
                title="Administrative Audit Log"
                description="Chronological record of sensitive operator mutations, role elevations, and credit modifications."
              />

              <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-6">Timestamp</th>
                        <th className="py-3.5 px-4">Actor</th>
                        <th className="py-3.5 px-4">Action</th>
                        <th className="py-3.5 px-4">Target Entity</th>
                        <th className="py-3.5 px-4">IP Address</th>
                        <th className="py-3.5 px-6 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                      {auditEntries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            No audit log entries recorded.
                          </td>
                        </tr>
                      ) : (
                        auditEntries.map((log) => (
                          <tr
                            key={log.id}
                            onClick={() => setSelectedAuditLog(log)}
                            className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition"
                          >
                            <td className="py-3.5 px-6 font-mono text-slate-400 text-[11px]">
                              {log.created_at
                                ? new Date(log.created_at).toLocaleString()
                                : '—'}
                            </td>

                            <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                              {log.admin_email || log.admin_name || `Admin #${log.admin_id}`}
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-blue-600 dark:text-blue-400">
                                {formatAuditAction(log.action)}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                              {log.target_email || log.target_id || '—'}
                            </td>

                            <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                              {log.ip || log.ip_address || '127.0.0.1'}
                            </td>

                            <td className="py-3.5 px-6 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAuditLog(log);
                                }}
                                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TEAM WORKSPACE */}
          {tab === 'team' && (
            <div className="space-y-6">
              <AdminPageHeader
                eyebrow="Account Context"
                title="Team Workspace"
                description="Multi-seat member invitations, shared quota pools, and seat management."
              />
              <TeamWorkspacePanel />
            </div>
          )}

          {/* TAB: TERRITORY ANALYTICS */}
          {tab === 'territory' && (
            <div className="space-y-6">
              <AdminPageHeader
                eyebrow="Market Intelligence"
                title="Territory Analytics"
                description="Conversion and cost-per-lead telemetry across solar corridors."
              />
              <TerritoryAnalyticsPanel />
            </div>
          )}
        </main>
      </div>

      {/* USER INSPECTION DRAWER (Stitch Alex Morgan layout) */}
      <DrawerSheet
        isOpen={Boolean(userDetail && selectedUserId)}
        onClose={() => {
          setUserDetail(null);
          setSelectedUserId(null);
        }}
        title={userDetail?.user?.name || userDetail?.user?.email || 'User Details'}
        subtitle={`User #${userDetail?.user?.id} • Registered ${
          userDetail?.user?.created_at
            ? new Date(userDetail.user.created_at).toLocaleDateString()
            : '—'
        }`}
        maxWidth="max-w-2xl"
      >
        {userDetail && (
          <div className="space-y-6">
            {/* Top User Header Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-base ring-4 ring-blue-500/10">
                  {getInitials(userDetail.user?.name || userDetail.user?.email)}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {userDetail.user?.name || 'Unnamed User'}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{userDetail.user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <StatusPill status={userDetail.user?.account_status || 'active'} />
                <button
                  type="button"
                  onClick={() =>
                    toggleStatus(userDetail.user.id, userDetail.user.account_status)
                  }
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
                >
                  {userDetail.user?.account_status === 'suspended'
                    ? 'Reactivate'
                    : 'Suspend'}
                </button>
              </div>
            </div>

            {/* Navigation Tabs inside Drawer */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-2 overflow-x-auto">
              {USER_SECTIONS.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setUserSection(sec.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                    userSection === sec.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{sec.icon}</span>
                  <span>{sec.label}</span>
                </button>
              ))}
            </div>

            {/* DRAWER SECTION: PROFILE & ROLE */}
            {userSection === 'profile' && (
              <div className="space-y-6">
                {/* Role Switcher */}
                <AdminSectionCard
                  title="Role & Access Permissions"
                  hint="Select user privilege level across the platform."
                >
                  <div className="flex items-center gap-3">
                    <select
                      value={userDetail.user?.role || 'solar_company'}
                      onChange={(e) => updateUserRole(e.target.value)}
                      disabled={roleBusy}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white font-semibold"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                  </div>
                </AdminSectionCard>

                {/* Credit Adjustment Form */}
                <AdminSectionCard
                  title="Lead Credits Allocation"
                  hint={`Current pool balance: ${
                    userDetail.package?.remaining_leads ?? userDetail.credits ?? 0
                  } credits.`}
                >
                  <ActionBanner type={creditMsgType} message={creditMsg} />

                  <div className="flex gap-2">
                    {['add', 'subtract', 'set'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setCreditMode(m)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold uppercase ${
                          creditMode === m
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={creditAdjustAmount}
                      onChange={(e) => setCreditAdjustAmount(e.target.value)}
                      placeholder="Amount"
                      className="w-32 px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                    />
                    <div className="flex gap-1.5">
                      {[10, 50, 100].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setCreditAdjustAmount(num)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition"
                        >
                          +{num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={creditNote}
                    onChange={(e) => setCreditNote(e.target.value)}
                    placeholder="Audit reason (e.g. VIP onboarding credit grant)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200"
                  />

                  <button
                    type="button"
                    onClick={applyCredits}
                    disabled={creditBusy}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
                  >
                    {creditBusy ? 'Applying...' : 'Apply Credit Adjustment'}
                  </button>
                </AdminSectionCard>

                {/* Plan Granting */}
                <AdminSectionCard
                  title="Plan Assignment"
                  hint={`Current Package: ${
                    userDetail.package?.packageId || userDetail.subscription?.packageId || 'Free'
                  }`}
                >
                  <ActionBanner type={planMsgType} message={planMsg} />

                  <select
                    value={assignPlanId}
                    onChange={(e) => setAssignPlanId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-semibold"
                  >
                    <option value="">Select a package...</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.id} (${p.price_1mo ?? p.price ?? 0}/mo)
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={planComplimentary}
                      onChange={(e) => setPlanComplimentary(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Complimentary plan ($0 invoice grant)</span>
                  </label>

                  <button
                    type="button"
                    onClick={grantPlan}
                    disabled={planBusy || !assignPlanId}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 text-xs font-bold shadow-xs transition disabled:opacity-50"
                  >
                    {planBusy ? 'Granting...' : 'Grant Plan & Record Invoice'}
                  </button>
                </AdminSectionCard>
              </div>
            )}

            {/* DRAWER SECTION: BILLING & INVOICES */}
            {userSection === 'billing' && (
              <div className="space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  User Invoices & Receipts
                </h4>
                {userDetail.invoices?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    No recorded invoices for this customer.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {userDetail.invoices?.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between"
                      >
                        <div>
                          <p className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                            {invoiceNumber(inv)}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {inv.created_at
                              ? new Date(inv.created_at).toLocaleDateString()
                              : '—'}{' '}
                            · {inv.description || inv.package_id || 'Subscription'}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                            ${(Number(inv.amount_cents || 0) / 100).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => viewUserInvoicePdf(inv.id, { download: false })}
                            className="p-1.5 rounded-lg bg-white dark:bg-white/10 hover:bg-blue-600 hover:text-white transition"
                            title="View invoice PDF"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              picture_as_pdf
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* DRAWER SECTION: SECURITY */}
            {userSection === 'security' && (
              <div className="space-y-5">
                <AdminSectionCard
                  title="Password Management"
                  hint="Set a new password or generate a one-time temporary password."
                >
                  <ActionBanner type={passwordMsgType} message={passwordMsg} />

                  {revealedPassword && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-amber-500">
                        Temporary Password:
                      </span>
                      <p className="font-mono text-sm font-bold text-slate-900 dark:text-white select-all">
                        {revealedPassword}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Copy and share this securely with the user.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min 8 characters)"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs"
                    />

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => resetUserPassword({ generate: false })}
                        disabled={passwordBusy || !newPassword}
                        className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50"
                      >
                        Set Password
                      </button>
                      <button
                        type="button"
                        onClick={() => resetUserPassword({ generate: true })}
                        disabled={passwordBusy}
                        className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-bold transition"
                      >
                        Generate Temporary
                      </button>
                    </div>
                  </div>
                </AdminSectionCard>
              </div>
            )}

            {/* DRAWER SECTION: ACTIVITY */}
            {userSection === 'activity' && (
              <div className="space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  Recent User Activity
                </h4>
                <div className="space-y-2">
                  {(userDetail.recentAudits || []).length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      No recorded audit logs for this user.
                    </p>
                  ) : (
                    userDetail.recentAudits.map((a) => (
                      <div
                        key={a.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatAuditAction(a.action)}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {formatAuditDetails(a.details)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DrawerSheet>

      {/* PLAN BUILDER MODAL */}
      <DrawerSheet
        isOpen={planModalOpen || Boolean(editingPlanId && editPlan)}
        onClose={() => {
          setPlanModalOpen(false);
          setEditingPlanId(null);
          setEditPlan(null);
        }}
        title={editingPlanId ? `Edit Plan: ${editPlan?.name || editingPlanId}` : 'Create New Plan'}
        subtitle="Configure feature gates, monthly lead quotas, and billing intervals."
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          {editingPlanId && editPlan ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editPlan.name}
                onChange={(e) => setEditPlan({ ...editPlan, name: e.target.value })}
                placeholder="Plan Name"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-bold"
              />
              <textarea
                value={editPlan.description}
                onChange={(e) => setEditPlan({ ...editPlan, description: e.target.value })}
                placeholder="Description"
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">Leads / Mo</label>
                  <input
                    type="number"
                    value={editPlan.lead_limit}
                    onChange={(e) => setEditPlan({ ...editPlan, lead_limit: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">Emails / Mo</label>
                  <input
                    type="number"
                    value={editPlan.email_limit}
                    onChange={(e) => setEditPlan({ ...editPlan, email_limit: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">WhatsApp / Mo</label>
                  <input
                    type="number"
                    value={editPlan.whatsapp_limit}
                    onChange={(e) => setEditPlan({ ...editPlan, whatsapp_limit: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">Team Seats</label>
                  <input
                    type="number"
                    value={editPlan.crm_user_limit}
                    onChange={(e) => setEditPlan({ ...editPlan, crm_user_limit: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">1 Mo ($)</label>
                  <input
                    type="number"
                    value={editPlan.price_1mo}
                    onChange={(e) => setEditPlan({ ...editPlan, price_1mo: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">6 Mo ($)</label>
                  <input
                    type="number"
                    value={editPlan.price_6mo}
                    onChange={(e) => setEditPlan({ ...editPlan, price_6mo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">12 Mo ($)</label>
                  <input
                    type="number"
                    value={editPlan.price_12mo}
                    onChange={(e) => setEditPlan({ ...editPlan, price_12mo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={saveEditPlan}
                disabled={planSaveBusy}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition"
              >
                {planSaveBusy ? 'Saving...' : 'Save Plan Changes'}
              </button>
            </div>
          ) : (
            <form onSubmit={createPlan} className="space-y-3">
              <input
                required
                placeholder="Plan ID (e.g. Pioneer)"
                value={planForm.id}
                onChange={(e) => setPlanForm({ ...planForm, id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-bold"
              />
              <input
                required
                placeholder="Display Name"
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs"
              />
              <textarea
                placeholder="Tagline or description"
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs"
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Leads / Mo"
                  value={planForm.lead_limit}
                  onChange={(e) => setPlanForm({ ...planForm, lead_limit: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-mono"
                />
                <input
                  type="number"
                  placeholder="Monthly Price ($)"
                  value={planForm.price_1mo}
                  onChange={(e) => setPlanForm({ ...planForm, price_1mo: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition"
              >
                Create Plan
              </button>
            </form>
          )}
        </div>
      </DrawerSheet>

      {/* SUPPORT TICKET CONVERSATION THREAD DRAWER */}
      <DrawerSheet
        isOpen={Boolean(ticketDetail)}
        onClose={() => setTicketDetail(null)}
        title={ticketDetail?.ticket?.subject || 'Support Ticket'}
        subtitle={`Ticket #${ticketDetail?.ticket?.id} · ${
          ticketDetail?.ticket?.user_name || ticketDetail?.ticket?.email || 'User'
        }`}
        maxWidth="max-w-2xl"
      >
        {ticketDetail && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <StatusPill status={ticketDetail.ticket.status} />
                <span className="font-mono text-xs text-slate-400">
                  Priority: {ticketDetail.ticket.priority || 'Normal'}
                </span>
              </div>

              <select
                value={ticketDetail.ticket.status}
                onChange={(e) => setTicketStatus(e.target.value)}
                disabled={ticketBusy}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#121826] border border-slate-200 dark:border-white/10 text-xs font-semibold"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Conversation Thread */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">
                Conversation History
              </h4>
              {(ticketDetail.messages || []).map((m, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl text-xs space-y-1 ${
                    m.sender_role === 'admin'
                      ? 'bg-blue-500/10 border border-blue-500/20 ml-6'
                      : 'bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 mr-6'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {m.sender_name || (m.sender_role === 'admin' ? 'Support Agent' : 'Customer')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {m.created_at ? new Date(m.created_at).toLocaleString() : '—'}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {m.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Reply Composer */}
            <div className="space-y-2 pt-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type official response to customer..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs"
              />
              <button
                type="button"
                onClick={sendReply}
                disabled={ticketBusy || !reply.trim()}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition disabled:opacity-50"
              >
                {ticketBusy ? 'Sending...' : 'Send Reply as Support Agent'}
              </button>
            </div>
          </div>
        )}
      </DrawerSheet>

      {/* MARKETING INQUIRY DETAIL DRAWER */}
      <DrawerSheet
        isOpen={Boolean(selectedInquiry)}
        onClose={() => setSelectedInquiryId(null)}
        title={selectedInquiry?.name || 'Inbound Submission'}
        subtitle={selectedInquiry?.email}
        maxWidth="max-w-lg"
      >
        {selectedInquiry && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Phone:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {selectedInquiry.phone || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Company:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedInquiry.company || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Intent:</span>
                <span className="font-mono text-blue-500 font-bold uppercase">
                  {selectedInquiry.intent || selectedInquiry.source || 'General'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Submitted At:</span>
                <span className="font-mono text-slate-400">
                  {selectedInquiry.created_at
                    ? new Date(selectedInquiry.created_at).toLocaleString()
                    : '—'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Message</span>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {selectedInquiry.message || 'No written message attached.'}
              </div>
            </div>

            <a
              href={`mailto:${selectedInquiry.email}`}
              className="block text-center py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition"
            >
              Reply via Email
            </a>
          </div>
        )}
      </DrawerSheet>

      {/* AUDIT LOG EVENT DRAWER */}
      <DrawerSheet
        isOpen={Boolean(selectedAuditLog)}
        onClose={() => setSelectedAuditLog(null)}
        title="Audit Event Detail"
        subtitle={`Event #${selectedAuditLog?.id} · ${
          selectedAuditLog?.created_at
            ? new Date(selectedAuditLog.created_at).toLocaleString()
            : '—'
        }`}
        maxWidth="max-w-lg"
      >
        {selectedAuditLog && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Actor:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedAuditLog.admin_email || selectedAuditLog.admin_id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Action:</span>
                <span className="font-mono font-bold text-blue-500">
                  {selectedAuditLog.action}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Entity:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {selectedAuditLog.target_email || selectedAuditLog.target_id || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Client IP:</span>
                <span className="font-mono text-slate-400">
                  {selectedAuditLog.ip || '127.0.0.1'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Event Details</span>
              <pre className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto">
                {JSON.stringify(
                  typeof selectedAuditLog.details === 'string'
                    ? JSON.parse(selectedAuditLog.details || '{}')
                    : selectedAuditLog.details || {},
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        )}
      </DrawerSheet>

      {/* QUICK ACTION DOCK MODAL */}
      <DrawerSheet
        isOpen={quickActionOpen}
        onClose={() => setQuickActionOpen(false)}
        title="Quick Operations Dock"
        subtitle="Trigger administrative workflows across platform systems."
        maxWidth="max-w-md"
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setQuickActionOpen(false);
              switchTab('users');
            }}
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] hover:border-blue-500 text-left transition flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">person_add</span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Adjust Credits / Plan</h4>
                <p className="text-[11px] text-slate-400">Inspect user and modify quota</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[18px] text-slate-400">arrow_forward</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickActionOpen(false);
              switchTab('marketplace');
            }}
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] hover:border-blue-500 text-left transition flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">storefront</span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Review Pending Leads</h4>
                <p className="text-[11px] text-slate-400">Marketplace triage queue</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[18px] text-slate-400">arrow_forward</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickActionOpen(false);
              switchTab('tickets');
            }}
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] hover:border-blue-500 text-left transition flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">support_agent</span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Answer Support Tickets</h4>
                <p className="text-[11px] text-slate-400">Customer helpdesk queue</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[18px] text-slate-400">arrow_forward</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickActionOpen(false);
              switchTab('apis');
            }}
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] hover:border-blue-500 text-left transition flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">monitoring</span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">API Health Telemetry</h4>
                <p className="text-[11px] text-slate-400">Inspect endpoint latencies</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[18px] text-slate-400">arrow_forward</span>
          </button>
        </div>
      </DrawerSheet>
    </div>
  );
}
