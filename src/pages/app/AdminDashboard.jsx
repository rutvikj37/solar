import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import { API_BASE } from '../../config.js';
import { invoiceNumber, openInvoicePdf } from '../../utils/invoicePdf.js';
import { useTheme } from '../../context/ThemeContext.jsx';

import TeamWorkspacePanel from '../../components/TeamWorkspacePanel';
import TerritoryAnalyticsPanel from '../../components/TerritoryAnalyticsPanel';
import AdminMarketplacePanel from '../../components/marketplace/AdminMarketplacePanel';
import AdminIntegrationsPanel from '../../components/admin/AdminIntegrationsPanel';
import AdminNav, { ADMIN_TABS } from '../../components/admin/AdminNav.jsx';
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminSectionCard,
  QueueCard,
  StatusPill,
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

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'solar_company', label: 'Company user' },
  { value: 'admin', label: 'Admin' },
  { value: 'platform_admin', label: 'Platform admin' },
  { value: 'super_admin', label: 'Super admin' },
];

const ASSIGNABLE_ROLES = ['solar_company', 'admin', 'platform_admin', 'super_admin'];
const USER_SECTIONS = [
  { id: 'profile', label: 'Profile', icon: 'person' },
  { id: 'billing', label: 'Billing', icon: 'receipt_long' },
  { id: 'security', label: 'Security', icon: 'lock' },
  { id: 'activity', label: 'Activity', icon: 'history' },
];
const isProdBuild = import.meta.env.PROD;
const TABS = ADMIN_TABS;

export default function AdminDashboard() {
  const { theme } = useTheme();
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [apis, setApis] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [roleBusy, setRoleBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
  const [ticketDetail, setTicketDetail] = useState(null);
  const [reply, setReply] = useState('');
  const [userSection, setUserSection] = useState('profile');
  const [ticketFilter, setTicketFilter] = useState('open');
  const [ticketBusy, setTicketBusy] = useState(false);
  const [inquirySearch, setInquirySearch] = useState('');
  const [inquiryIntent, setInquiryIntent] = useState('');
  const [selectedInquiryId, setSelectedInquiryId] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('solar_token')}`,
    'Content-Type': 'application/json'
  });

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

  const loadTab = useCallback(async (active) => {
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
          fetch(`${API_BASE}/api/admin/users?q=${encodeURIComponent(q)}${roleQs}`, { headers: authHeaders() }),
          fetch(`${API_BASE}/api/admin/plans`, { headers: authHeaders() })
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
        const res = await fetch(`${API_BASE}/api/admin/subscriptions`, { headers: authHeaders() });
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
        const res = await fetch(`${API_BASE}/api/admin/audit-log?limit=100`, { headers: authHeaders() });
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
  }, [navigate, q, roleFilter]);

  useEffect(() => {
    const t = searchParams.get('tab');
    const normalized = t === 'crm' || t === 'email' ? 'integrations' : t;
    if (normalized && TABS.some((x) => x.id === normalized)) setTab(normalized);
  }, [searchParams]);

  const marketplaceSub = searchParams.get('mkt') || 'leads';

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  // Keep nav badges fresh even when not on dashboard
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: authHeaders() });
        if (!cancelled && res.ok) setStats(await res.json());
      } catch {
        /* ignore badge prefetch errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    setUserSection('profile');
  };

  const setMarketplaceSub = (mkt) => {
    setTab('marketplace');
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'marketplace');
    next.set('mkt', mkt);
    setSearchParams(next);
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
    if (
      !confirmDanger(
        restrict
          ? 'Restrict this user\'s plan and lock self-serve upgrades?'
          : 'Lift the plan restriction for this user?',
      )
    ) {
      return;
    }
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

    if (
      !confirmDanger(
        generate
          ? 'Generate a temporary password for this user? Their current password will stop working immediately.'
          : 'Reset this user\'s password now? Their current password will stop working immediately.',
      )
    ) {
      return;
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

  const toggleStatusFromDetail = async () => {
    if (!userDetail?.user || statusBusy) return;
    await toggleStatus(userDetail.user.id, userDetail.user.account_status);
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
    loadTab('plans');
  };

  const togglePlan = async (plan) => {
    const nextActive = !Number(plan.is_active);
    if (
      !confirmDanger(
        nextActive ? `Activate plan "${plan.name || plan.id}"?` : `Deactivate plan "${plan.name || plan.id}"?`,
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
      return tickets.filter((t) => ['open', 'in_progress'].includes(String(t.status || '').toLowerCase()));
    }
    return tickets.filter((t) => String(t.status || '').toLowerCase() === ticketFilter);
  }, [tickets, ticketFilter]);

  const filteredInquiries = useMemo(() => {
    const q = inquirySearch.trim().toLowerCase();
    return inquiries.filter((row) => {
      if (inquiryIntent && String(row.intent || '') !== inquiryIntent) return false;
      if (!q) return true;
      return (
        String(row.name || '').toLowerCase().includes(q) ||
        String(row.email || '').toLowerCase().includes(q) ||
        String(row.company || '').toLowerCase().includes(q) ||
        String(row.message || '').toLowerCase().includes(q)
      );
    });
  }, [inquiries, inquirySearch, inquiryIntent]);

  const selectedInquiry = filteredInquiries.find((r) => r.id === selectedInquiryId)
    || inquiries.find((r) => r.id === selectedInquiryId)
    || null;

  const navBadges = {
    pendingMarketplace: Number(stats?.pendingMarketplace || 0),
    openTickets: Number(stats?.openTickets || 0),
    inquiries: Number(stats?.inquiryCount || 0),
  };

  return (
    <>
      <Toaster theme={theme === 'light' ? 'light' : 'dark'} position="top-center" richColors />
      <div className="mb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-label-mono text-[9px] font-bold uppercase mb-2">
            Operator console
          </div>
          <h2 className="font-headline-lg text-2xl font-bold text-on-surface">Admin Control Center</h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Platform users, marketplace approvals, billing, and support — separate from your company workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <Link to="/ai-calling" className="text-xs text-on-surface-variant font-semibold hover:text-primary">
            AI Calling →
          </Link>
          <Link to="/support" className="text-xs text-primary font-semibold hover:underline">
            User support view →
          </Link>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <AdminNav activeTab={tab} onSelect={switchTab} badges={navBadges} />

        <div className="flex-1 min-w-0 w-full">
      {error && (
        <div className="mb-4 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs flex flex-wrap gap-3 items-center justify-between">
          <span>{error}</span>
          {error === 'Admin access required.' && !isProdBuild && (
            <p className="text-[10px] text-on-surface-variant max-w-md">
              First-admin bootstrap is disabled in the UI. Enable ALLOW_ADMIN_BOOTSTRAP with ADMIN_BOOTSTRAP_SECRET only in non-prod, or promote via SQL.
            </p>
          )}
        </div>
      )}

      {loading && !['marketplace', 'integrations', 'team', 'territory'].includes(tab) && (
        <div className="mb-4 text-xs text-on-surface-variant animate-pulse">Loading…</div>
      )}

      {tab === 'dashboard' && !loading && !stats && !error && (
        <AdminEmptyState icon="dashboard" title="No stats yet" description="Stats will appear once the admin API responds." />
      )}

      {tab === 'dashboard' && stats && (
        <div className="space-y-6">
          <AdminPageHeader
            eyebrow="Home"
            title="Operator dashboard"
            description="Queues that need attention, plus platform health at a glance."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <QueueCard
              icon="fact_check"
              label="Marketplace pending"
              value={stats.pendingMarketplace ?? 0}
              hint="Leads waiting for approve"
              accent="amber"
              onClick={() => setMarketplaceSub('leads')}
            />
            <QueueCard
              icon="support_agent"
              label="Open tickets"
              value={stats.openTickets}
              hint="Open + in progress"
              accent="primary"
              onClick={() => switchTab('tickets')}
            />
            <QueueCard
              icon="mail"
              label="Marketing inquiries"
              value={stats.inquiryCount ?? 0}
              hint="Contact form submissions"
              onClick={() => switchTab('inquiries')}
            />
            <QueueCard
              icon="gavel"
              label="Pending claims"
              value={stats.pendingDisputes ?? 0}
              hint="Marketplace disputes"
              accent="red"
              onClick={() => setMarketplaceSub('disputes')}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {[
              ['TOTAL USERS', stats.totalUsers, `${stats.activeUsers} active · ${stats.newUsers7d} new / 7d`],
              ['REVENUE (PAID)', `$${(stats.revenueCents / 100).toLocaleString()}`, `${stats.paidOrders} paid invoices`],
              ['ACTIVE PLANS', stats.activeSubscriptions, `${stats.remainingCredits} credits left`],
              ['CRM LEADS', stats.totalLeads ?? 0, 'Company lead records'],
            ].map(([label, value, sub]) => (
              <div key={label} className="glass-card p-5 rounded-xl">
                <p className="font-label-mono text-[9px] text-on-surface-variant uppercase">{label}</p>
                <h3 className="text-2xl font-bold text-on-surface mt-1.5 font-mono tabular-nums">{value}</h3>
                <p className="text-on-surface-variant text-[10px] mt-2">{sub}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['Users', 'users', 'group'],
              ['Plans', 'plans', 'sell'],
              ['Audit log', 'audit', 'history'],
              ['API health', 'apis', 'api'],
            ].map(([label, id, icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => switchTab(id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-container-low text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-sm">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'marketplace' && (
        <AdminMarketplacePanel
          activeSub={
            ['overview', 'settings', 'leads', 'disputes', 'installers', 'wallets'].includes(marketplaceSub)
              ? marketplaceSub
              : 'leads'
          }
          onSubChange={setMarketplaceSub}
        />
      )}
      {tab === 'integrations' && <AdminIntegrationsPanel />}

      {tab === 'team' && (
        <div className="space-y-3">
          <AdminPageHeader
            eyebrow="Your company"
            title="Team workspace"
            description="Team members for the account you are signed in as — not platform-wide ops."
          />
          <TeamWorkspacePanel />
        </div>
      )}

      {tab === 'territory' && (
        <div className="space-y-3">
          <AdminPageHeader
            eyebrow="Your company"
            title="Territory analytics"
            description="Territory analytics for the signed-in account — not a platform-wide map."
          />
          <TerritoryAnalyticsPanel />
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-4">
          <AdminPageHeader
            eyebrow="Users & billing"
            title="Users"
            description="Search accounts, then manage profile, billing, security, and activity in the workspace on the right."
          />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadTab('users')}
                placeholder="Search users…"
                className="bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-xs text-on-surface w-64"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-xs text-on-surface"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button onClick={() => loadTab('users')} className="text-xs bg-surface-container-high text-on-surface px-3 py-2 rounded-lg">
                Search
              </button>
            </div>
            <div className="glass-card rounded-xl overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[9px] sticky top-0">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
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
                        <p className="text-on-surface font-semibold">{u.name}</p>
                        <p className="text-on-surface-variant">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-on-surface font-mono text-[10px]">{roleLabel(u.role)}</td>
                      <td className="px-4 py-3 text-on-surface">{u.plan}</td>
                      <td className="px-4 py-3 font-mono text-on-surface">{u.credits}</td>
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
                      <td colSpan={5} className="px-4 py-8 text-on-surface-variant text-center">
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
              <AdminEmptyState
                icon="person_search"
                title="Select a user"
                description="Search the list and open a profile to manage role, billing, security, and activity."
              />
            ) : (
              <>
                <div className="flex justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="text-on-surface font-bold text-sm truncate">{userDetail.user.name}</h3>
                    <p className="text-on-surface-variant mt-0.5 text-[11px] truncate">{userDetail.user.email}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <StatusPill status={userDetail.user.account_status || 'active'} />
                      <StatusPill status={roleLabel(userDetail.user.role)} tone="warn" />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={statusBusy}
                    onClick={toggleStatusFromDetail}
                    className="text-[10px] font-bold bg-white/10 px-2.5 py-1.5 rounded-lg self-start disabled:opacity-50"
                  >
                    {userDetail.user.account_status === 'suspended' ? 'Activate' : 'Suspend'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1 mb-4 border-b border-glass-stroke pb-2">
                  {USER_SECTIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setUserSection(s.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                        userSection === s.id
                          ? 'bg-primary text-on-primary'
                          : 'text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
                      {s.label}
                    </button>
                  ))}
                </div>

                {userSection === 'profile' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ['Company', userDetail.user.company_name || '—'],
                        ['Phone', userDetail.user.phone || '—'],
                        ['Joined', userDetail.user.created_at ? new Date(userDetail.user.created_at).toLocaleDateString() : '—'],
                        ['Credits', userDetail.credits],
                        ['Stripe customer', userDetail.user.stripe_customer_id || '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-surface-container-low rounded-lg p-2">
                          <p className="text-[9px] text-on-surface-variant uppercase">{label}</p>
                          <p className="text-on-surface font-semibold mt-0.5 break-all">{value}</p>
                        </div>
                      ))}
                    </div>

                    <AdminSectionCard title="Role" hint="Last super_admin cannot be demoted. Only super_admin can grant super_admin.">
                      <div className="flex flex-wrap gap-2 items-center">
                        <select
                          value={userDetail.user.role || 'solar_company'}
                          disabled={roleBusy}
                          onChange={(e) => updateUserRole(e.target.value)}
                          className="bg-surface-container border border-glass-stroke rounded-lg px-2 py-1.5 text-on-surface"
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{roleLabel(r)}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={roleBusy || (userDetail.user.role || 'solar_company') === 'admin'}
                          onClick={() => updateUserRole('admin')}
                          className="bg-primary text-on-primary px-3 py-1.5 rounded-lg font-bold text-[10px] disabled:opacity-50"
                        >
                          Promote to admin
                        </button>
                        <button
                          type="button"
                          disabled={roleBusy || (userDetail.user.role || 'solar_company') === 'solar_company'}
                          onClick={() => updateUserRole('solar_company')}
                          className="bg-surface-container-high text-on-surface px-3 py-1.5 rounded-lg font-bold text-[10px] disabled:opacity-50"
                        >
                          Demote to user
                        </button>
                      </div>
                    </AdminSectionCard>

                    <AdminSectionCard title="Leads & support snapshot">
                      <p className="text-on-surface">
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
                    </AdminSectionCard>
                  </div>
                )}

                {userSection === 'billing' && (
                  <div className="space-y-4">
                    <AdminSectionCard title="Package & subscription">
                      <p className="text-on-surface">
                        Plan: {userDetail.package?.packageName || 'None'}{' '}
                        {userDetail.package?.purchasedLeads != null && (
                          <span className="text-on-surface-variant">
                            · purchased {userDetail.package.purchasedLeads} · remaining {userDetail.package.remainingLeads}
                          </span>
                        )}
                      </p>
                      {userDetail.subscription ? (
                        <p className="text-on-surface-variant mt-1">
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
                        <p className="text-on-surface-variant mt-1">No active billing subscription record.</p>
                      )}
                      {userDetail.user.account_status === 'restricted' && (
                        <p className="text-amber-400 text-[10px] mt-1">Upgrades locked — plan is restricted.</p>
                      )}
                    </AdminSectionCard>

                    <AdminSectionCard title="Add plan & generate invoice" hint="Creates an app invoice and updates the active package.">
                      <div className="flex flex-wrap gap-2 items-center">
                        <select
                          value={assignPlanId}
                          onChange={(e) => setAssignPlanId(e.target.value)}
                          className="flex-1 min-w-[140px] bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-on-surface"
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
                          className="bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-on-surface"
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
                        className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-on-surface"
                      />
                      <p className="text-[10px] text-on-surface-variant">
                        Invoice amount:{' '}
                        <span className="text-on-surface font-semibold">
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
                            className="bg-white/10 text-on-surface px-3 py-1.5 rounded-lg font-bold disabled:opacity-50 disabled:pointer-events-none"
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
                    </AdminSectionCard>

                    <AdminSectionCard title="Adjust credits">
                      <p className="text-on-surface font-mono text-sm">Current balance: {userDetail.credits}</p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <select
                          value={creditMode}
                          onChange={(e) => setCreditMode(e.target.value)}
                          className="bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-on-surface"
                        >
                          <option value="add">Add credits</option>
                          <option value="subtract">Subtract credits</option>
                          <option value="set">Set absolute balance</option>
                        </select>
                        <input
                          type="number"
                          value={creditAdjustAmount}
                          onChange={(e) => setCreditAdjustAmount(e.target.value)}
                          className="w-24 bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-on-surface font-mono"
                        />
                        <input
                          value={creditNote}
                          onChange={(e) => setCreditNote(e.target.value)}
                          placeholder="Optional note…"
                          className="flex-1 min-w-[120px] bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-on-surface"
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
                        <div className="max-h-28 overflow-y-auto space-y-1 pt-1">
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
                    </AdminSectionCard>

                    <AdminSectionCard title="Invoices">
                      {userDetail.invoices?.length > 0 ? (
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {userDetail.invoices.map((inv) => (
                            <div key={inv.id} className="text-[10px] bg-white/5 rounded p-1.5 flex justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-on-surface">
                                  {invoiceNumber(inv.id)} · {inv.package_name || inv.package_id || '—'} · $
                                  {(Number(inv.amount_cents || 0) / 100).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
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
                      ) : (
                        <p className="text-on-surface-variant text-[11px]">No invoices yet.</p>
                      )}
                    </AdminSectionCard>
                  </div>
                )}

                {userSection === 'security' && (
                  <AdminSectionCard
                    title="Reset password"
                    hint="Temporary passwords are shown once — copy and share securely. The user's current password stops working immediately."
                  >
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password (min 8)"
                        minLength={8}
                        autoComplete="new-password"
                        className="flex-1 min-w-[140px] bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-on-surface"
                      />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        minLength={8}
                        autoComplete="new-password"
                        className="flex-1 min-w-[140px] bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-on-surface"
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
                        className="bg-white/10 text-on-surface px-3 py-1.5 rounded-lg font-bold disabled:opacity-50"
                      >
                        {passwordBusy ? 'Saving…' : 'Generate temporary password'}
                      </button>
                    </div>
                    <ActionBanner type={passwordMsgType} message={passwordMsg} />
                    {revealedPassword && (
                      <div className="flex flex-wrap gap-2 items-center bg-amber-500/10 border border-amber-500/25 rounded-lg p-2">
                        <code className="text-on-surface font-mono text-xs break-all flex-1">{revealedPassword}</code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(revealedPassword).catch(() => {});
                            toast.success('Copied');
                          }}
                          className="text-[10px] bg-white/10 px-2 py-1 rounded font-bold"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </AdminSectionCard>
                )}

                {userSection === 'activity' && (
                  <div className="space-y-3">
                    {userDetail.recentActivity?.length > 0 ? (
                      <div className="max-h-80 overflow-y-auto space-y-1">
                        {userDetail.recentActivity.map((a) => (
                          <div key={a.id} className="text-[10px] bg-white/5 rounded p-2">
                            <span className="text-primary font-semibold">{a.type}</span>
                            {a.lead_address && <span className="text-on-surface-variant"> · {a.lead_address}</span>}
                            <span className="text-on-surface-variant"> · {new Date(a.created_at).toLocaleString()}</span>
                            {a.content && <p className="text-on-surface mt-0.5">{a.content}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <AdminEmptyState icon="history" title="No recent activity" description="Lead and CRM activity for this user will show here." />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-4">
          <AdminPageHeader
            eyebrow="Platform"
            title="Audit log"
            description="Password resets, role changes, credit adjusts, plan grants, and marketplace approve/verify actions."
            actions={
              <button type="button" onClick={() => loadTab('audit')} className="text-xs bg-surface-container-high px-3 py-1.5 rounded-lg text-on-surface">
                Refresh
              </button>
            }
          />
          <div className="glass-card rounded-xl overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[9px]">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-stroke">
                {auditEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                      {e.created_at ? new Date(e.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-on-surface">{e.admin_name || e.admin_id || '—'}</p>
                      <p className="text-on-surface-variant text-[10px]">{e.admin_email || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-primary font-semibold text-[11px]">{formatAuditAction(e.action)}</td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {e.target_type || '—'}{e.target_id != null ? ` #${e.target_id}` : ''}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant max-w-md" title={typeof e.details === 'string' ? e.details : JSON.stringify(e.details || {})}>
                      <span className="line-clamp-2">{formatAuditDetails(e.details)}</span>
                    </td>
                  </tr>
                ))}
                {auditEntries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8">
                      <AdminEmptyState icon="history" title="No audit entries yet" description="Sensitive admin actions will appear here." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'subscriptions' && (
        <div className="space-y-4">
          <AdminPageHeader
            eyebrow="Users & billing"
            title="Active packages"
            description="Users with an active package. Click a row to open the user billing workspace."
          />
          <div className="glass-card rounded-xl overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white/5 text-on-surface-variant uppercase text-[9px]">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Remaining</th>
                  <th className="px-4 py-3">Purchased</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-stroke">
                {subs.map((s) => (
                  <tr
                    key={`${s.user_id}-${s.package_id}`}
                    className="cursor-pointer hover:bg-white/5"
                    onClick={() => {
                      switchTab('users');
                      openUser(s.user_id, { section: 'billing' });
                    }}
                  >
                    <td className="px-4 py-3">
                      <p className="text-on-surface font-semibold">{s.name}</p>
                      <p className="text-on-surface-variant">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 text-on-surface">{s.package_name || s.package_id}</td>
                    <td className="px-4 py-3 font-mono text-on-surface">{s.remaining_leads}</td>
                    <td className="px-4 py-3 font-mono text-on-surface-variant">{s.purchased_leads}</td>
                    <td className="px-4 py-3 text-on-surface">${Number(s.price || 0).toLocaleString()}</td>
                    <td className="px-4 py-3"><StatusPill status={s.account_status || s.package_status || 'active'} /></td>
                  </tr>
                ))}
                {subs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8">
                      <AdminEmptyState icon="card_membership" title="No active packages" description="Paid or granted packages will list here." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'plans' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <form onSubmit={createPlan} className="glass-card p-5 rounded-xl space-y-3 text-xs">
            <h3 className="text-on-surface font-bold text-sm">Create Plan</h3>
            <p className="text-on-surface-variant text-[11px]">
              Founding Launch style — monthly usage limits + 1 / 6 / 12 month pricing. Editable anytime.
            </p>
            <input required placeholder="id (e.g. Scout)" value={planForm.id}
              onChange={(e) => setPlanForm({ ...planForm, id: e.target.value })}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface" />
            <input required placeholder="Display name" value={planForm.name}
              onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface" />
            <textarea placeholder="Tagline / description" value={planForm.description}
              onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface" rows={2} />

            <p className="text-on-surface font-semibold pt-1">Monthly usage limits</p>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="AI opportunities / mo" value={planForm.lead_limit}
                onChange={(e) => setPlanForm({ ...planForm, lead_limit: e.target.value })}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface" />
              <input type="number" placeholder="Emails / mo" value={planForm.email_limit}
                onChange={(e) => setPlanForm({ ...planForm, email_limit: e.target.value })}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface" />
              <input type="number" placeholder="WhatsApp / mo" value={planForm.whatsapp_limit}
                onChange={(e) => setPlanForm({ ...planForm, whatsapp_limit: e.target.value })}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface" />
              <input type="number" placeholder="CRM users" value={planForm.crm_user_limit}
                onChange={(e) => setPlanForm({ ...planForm, crm_user_limit: e.target.value })}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface" />
              <input type="number" placeholder="Email automations" value={planForm.email_automation_limit}
                onChange={(e) => setPlanForm({ ...planForm, email_automation_limit: e.target.value })}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface" />
              <input type="number" placeholder="Sort order" value={planForm.sort_order}
                onChange={(e) => setPlanForm({ ...planForm, sort_order: e.target.value })}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface" />
            </div>

            <p className="text-on-surface font-semibold pt-1">Price per month by commitment</p>
            <div className="grid grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="text-on-surface-variant">1 mo</span>
                <input type="number" step="0.01" value={planForm.price_1mo}
                  onChange={(e) => setPlanForm({ ...planForm, price_1mo: e.target.value })}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface" />
              </label>
              <label className="space-y-1">
                <span className="text-on-surface-variant">6 mo</span>
                <input type="number" step="0.01" value={planForm.price_6mo}
                  onChange={(e) => setPlanForm({ ...planForm, price_6mo: e.target.value })}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface" />
              </label>
              <label className="space-y-1">
                <span className="text-on-surface-variant">12 mo</span>
                <input type="number" step="0.01" value={planForm.price_12mo}
                  onChange={(e) => setPlanForm({ ...planForm, price_12mo: e.target.value })}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface" />
              </label>
            </div>

            <p className="text-on-surface font-semibold pt-1">Modules</p>
            <div className="space-y-2">
              {planForm.modules.map((mod, idx) => (
                <div key={`${mod}-${idx}`} className="flex gap-2 items-center">
                  <input
                    value={mod}
                    onChange={(e) => {
                      const next = [...planForm.modules];
                      next[idx] = e.target.value;
                      setPlanForm({ ...planForm, modules: next });
                    }}
                    className="flex-1 bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface"
                  />
                  <button
                    type="button"
                    onClick={() => setPlanForm({
                      ...planForm,
                      modules: planForm.modules.filter((_, i) => i !== idx),
                    })}
                    className="text-red-400 font-bold px-2 py-1 rounded border border-red-400/30"
                    title="Remove module"
                  >
                    −
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  placeholder="New module…"
                  value={planForm.moduleDraft}
                  onChange={(e) => setPlanForm({ ...planForm, moduleDraft: e.target.value })}
                  className="flex-1 bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface"
                />
                <button
                  type="button"
                  onClick={() => {
                    const text = String(planForm.moduleDraft || '').trim();
                    if (!text) return;
                    setPlanForm({
                      ...planForm,
                      modules: [...planForm.modules, text],
                      moduleDraft: '',
                    });
                  }}
                  className="text-primary font-bold px-3 py-1 rounded border border-primary/40"
                >
                  +
                </button>
              </div>
            </div>

            <input placeholder="Stripe Price ID 1mo (optional)" value={planForm.stripe_price_id}
              onChange={(e) => setPlanForm({ ...planForm, stripe_price_id: e.target.value })}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface font-mono text-[11px]" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Stripe Price 6mo" value={planForm.stripe_price_id_6mo}
                onChange={(e) => setPlanForm({ ...planForm, stripe_price_id_6mo: e.target.value })}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface font-mono text-[11px]" />
              <input placeholder="Stripe Price 12mo" value={planForm.stripe_price_id_12mo}
                onChange={(e) => setPlanForm({ ...planForm, stripe_price_id_12mo: e.target.value })}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface font-mono text-[11px]" />
            </div>
            <label className="flex items-center gap-2 text-on-surface-variant">
              <input
                type="checkbox"
                checked={planForm.is_subscription}
                onChange={(e) => setPlanForm({ ...planForm, is_subscription: e.target.checked })}
              />
              Monthly usage subscription
            </label>
            <button type="submit" className="bg-primary text-on-primary font-bold px-4 py-2 rounded-lg">
              Create Plan
            </button>
          </form>

          <div className="space-y-3">
            {loading && plans.length === 0 && (
              <p className="text-xs text-on-surface-variant animate-pulse">Loading plans…</p>
            )}
            {!loading && plans.length === 0 && (
              <p className="text-xs text-on-surface-variant">No plans yet. Create one on the left.</p>
            )}
            {plans.map((p) => {
              const modules = parseModules(p.features);
              const isEditing = editingPlanId === p.id && editPlan;
              return (
                <div key={p.id} className="glass-card p-4 rounded-xl text-xs space-y-3">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-on-surface font-bold">
                        {p.name}{' '}
                        <span className="text-on-surface-variant font-normal">({p.id})</span>
                      </p>
                      {!isEditing && (
                        <>
                          <p className="text-on-surface-variant mt-1">
                            {p.lead_limit} opps · {Number(p.email_limit) || 0} emails ·{' '}
                            {Number(p.whatsapp_limit) || 0} WA · CRM {Number(p.crm_user_limit) || 0}
                          </p>
                          <p className="text-on-surface-variant mt-0.5">
                            ${Number(p.price_1mo ?? p.price).toLocaleString()}/mo · 6mo $
                            {Number(p.price_6mo ?? p.price_1mo ?? p.price).toLocaleString()} · 12mo $
                            {Number(p.price_12mo ?? p.price_6mo ?? p.price).toLocaleString()}
                            {' · '}
                            {Number(p.is_active) ? (
                              <span className="text-green-400">Active</span>
                            ) : (
                              <span className="text-red-400">Inactive</span>
                            )}
                          </p>
                          {modules.length > 0 && (
                            <ul className="mt-2 space-y-0.5 text-on-surface-variant">
                              {modules.slice(0, 4).map((m) => (
                                <li key={m}>• {m}</li>
                              ))}
                              {modules.length > 4 && (
                                <li>+{modules.length - 4} more modules</li>
                              )}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 items-end shrink-0">
                      {p.id !== 'Free' && (
                        <button onClick={() => togglePlan(p)} className="text-primary font-semibold">
                          {Number(p.is_active) ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                      {!isEditing ? (
                        <button onClick={() => startEditPlan(p)} className="text-on-surface font-semibold">
                          Edit
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlanId(null);
                            setEditPlan(null);
                          }}
                          className="text-on-surface-variant"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="border-t border-glass-stroke pt-3 space-y-3">
                      <input
                        value={editPlan.name}
                        onChange={(e) => setEditPlan({ ...editPlan, name: e.target.value })}
                        className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface"
                      />
                      <textarea
                        value={editPlan.description}
                        onChange={(e) => setEditPlan({ ...editPlan, description: e.target.value })}
                        rows={2}
                        className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['lead_limit', 'Opportunities/mo'],
                          ['email_limit', 'Emails/mo'],
                          ['whatsapp_limit', 'WhatsApp/mo'],
                          ['crm_user_limit', 'CRM users'],
                          ['email_automation_limit', 'Email automations'],
                          ['sort_order', 'Sort'],
                        ].map(([key, label]) => (
                          <label key={key} className="space-y-1">
                            <span className="text-on-surface-variant">{label}</span>
                            <input
                              type="number"
                              value={editPlan[key]}
                              onChange={(e) => setEditPlan({ ...editPlan, [key]: e.target.value })}
                              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-on-surface"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          ['price_1mo', '1 mo $'],
                          ['price_6mo', '6 mo $'],
                          ['price_12mo', '12 mo $'],
                        ].map(([key, label]) => (
                          <label key={key} className="space-y-1">
                            <span className="text-on-surface-variant">{label}</span>
                            <input
                              type="number"
                              step="0.01"
                              value={editPlan[key]}
                              onChange={(e) => setEditPlan({ ...editPlan, [key]: e.target.value })}
                              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-on-surface"
                            />
                          </label>
                        ))}
                      </div>

                      <p className="font-semibold text-on-surface">Modules (+/−)</p>
                      {editPlan.modules.map((mod, idx) => (
                        <div key={`${idx}-${mod}`} className="flex gap-2">
                          <input
                            value={mod}
                            onChange={(e) => {
                              const next = [...editPlan.modules];
                              next[idx] = e.target.value;
                              setEditPlan({ ...editPlan, modules: next });
                            }}
                            className="flex-1 bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-on-surface"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setEditPlan({
                                ...editPlan,
                                modules: editPlan.modules.filter((_, i) => i !== idx),
                              })
                            }
                            className="text-red-400 font-bold px-2"
                          >
                            −
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          placeholder="Add module…"
                          value={editPlan.moduleDraft}
                          onChange={(e) => setEditPlan({ ...editPlan, moduleDraft: e.target.value })}
                          className="flex-1 bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 text-on-surface"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const text = String(editPlan.moduleDraft || '').trim();
                            if (!text) return;
                            setEditPlan({
                              ...editPlan,
                              modules: [...editPlan.modules, text],
                              moduleDraft: '',
                            });
                          }}
                          className="text-primary font-bold px-3"
                        >
                          +
                        </button>
                      </div>

                      <input
                        placeholder="Stripe 1mo price id"
                        value={editPlan.stripe_price_id}
                        onChange={(e) => setEditPlan({ ...editPlan, stripe_price_id: e.target.value })}
                        className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 font-mono text-[10px] text-on-surface"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          placeholder="Stripe 6mo"
                          value={editPlan.stripe_price_id_6mo}
                          onChange={(e) => setEditPlan({ ...editPlan, stripe_price_id_6mo: e.target.value })}
                          className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 font-mono text-[10px] text-on-surface"
                        />
                        <input
                          placeholder="Stripe 12mo"
                          value={editPlan.stripe_price_id_12mo}
                          onChange={(e) => setEditPlan({ ...editPlan, stripe_price_id_12mo: e.target.value })}
                          className="w-full bg-surface-container-low border border-glass-stroke rounded-lg px-2 py-1.5 font-mono text-[10px] text-on-surface"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={planSaveBusy}
                        onClick={saveEditPlan}
                        className="bg-primary text-on-primary font-bold px-4 py-2 rounded-lg disabled:opacity-60"
                      >
                        {planSaveBusy ? 'Saving…' : 'Save plan'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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
                <h3 className="text-on-surface font-bold">{a.label}</h3>
                <span className={`text-[10px] font-bold uppercase ${a.configured ? 'text-green-400' : 'text-red-400'}`}>
                  {a.configured ? 'Configured' : 'Missing key'}
                </span>
              </div>
              <p className="text-on-surface-variant mt-3">Calls (7d): <span className="text-on-surface font-semibold">{a.calls ?? 0}</span></p>
              <p className="text-on-surface-variant">Success / Errors: <span className="text-on-surface font-semibold">{a.success ?? 0}</span> / <span className="text-on-surface font-semibold">{a.errors ?? 0}</span></p>
              <p className="text-on-surface-variant">Avg latency: <span className="text-on-surface font-semibold">{a.avgMs ?? 0}</span> ms</p>
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
        <div className="space-y-4">
          <AdminPageHeader
            eyebrow="Support"
            title="Marketing inquiries"
            description="Contact-form submissions from the marketing site. Search and open a row to reply via email."
          />
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={inquirySearch}
              onChange={(e) => setInquirySearch(e.target.value)}
              placeholder="Search name, email, company…"
              className="bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-xs text-on-surface w-64"
            />
            <select
              value={inquiryIntent}
              onChange={(e) => setInquiryIntent(e.target.value)}
              className="bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-xs text-on-surface"
            >
              <option value="">All intents</option>
              {[...new Set(inquiries.map((i) => i.intent).filter(Boolean))].map((intent) => (
                <option key={intent} value={intent}>{intent}</option>
              ))}
            </select>
            <span className="text-[11px] text-on-surface-variant">{filteredInquiries.length} shown</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="glass-card rounded-xl overflow-hidden max-h-[70vh] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-on-surface-variant sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Intent</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInquiries.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedInquiryId(row.id)}
                      className={`border-t border-glass-stroke cursor-pointer hover:bg-white/5 ${
                        selectedInquiryId === row.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-on-surface font-semibold">{row.name}</p>
                        <p className="text-on-surface-variant text-[10px]">{row.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-primary/15 px-2 py-0.5 text-primary uppercase tracking-wide text-[10px]">
                          {row.intent}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredInquiries.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8">
                        <AdminEmptyState icon="mail" title="No inquiries" description="Marketing contact submissions will appear here." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="glass-card p-4 rounded-xl min-h-[280px]">
              {!selectedInquiry ? (
                <AdminEmptyState icon="forward_to_inbox" title="Select an inquiry" description="Open a row to see the full message and reply via email." />
              ) : (
                <div className="space-y-3 text-xs">
                  <div>
                    <h3 className="text-on-surface font-bold text-sm">{selectedInquiry.name}</h3>
                    <p className="text-on-surface-variant mt-0.5">{selectedInquiry.company || 'No company'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-surface-container-low rounded-lg p-2">
                      <p className="text-[9px] uppercase text-on-surface-variant">Email</p>
                      <a className="text-primary break-all" href={`mailto:${selectedInquiry.email}`}>{selectedInquiry.email}</a>
                    </div>
                    <div className="bg-surface-container-low rounded-lg p-2">
                      <p className="text-[9px] uppercase text-on-surface-variant">Phone</p>
                      <p className="text-on-surface">{selectedInquiry.phone || '—'}</p>
                    </div>
                  </div>
                  <StatusPill status={selectedInquiry.intent} />
                  <div className="rounded-lg bg-white/5 p-3 whitespace-pre-wrap text-on-surface">
                    {selectedInquiry.message || 'No message'}
                  </div>
                  <a
                    href={`mailto:${selectedInquiry.email}?subject=${encodeURIComponent('Re: your SpaceToRoof inquiry')}`}
                    className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-3 py-2 rounded-lg font-bold text-xs"
                  >
                    <span className="material-symbols-outlined text-sm">reply</span>
                    Reply by email
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="space-y-4">
          <AdminPageHeader
            eyebrow="Support"
            title="Support tickets"
            description="Reply to users and update ticket status. Filter to focus on open work."
          />
          <div className="flex flex-wrap gap-2">
            {[
              ['open', 'Open'],
              ['in_progress', 'In progress'],
              ['resolved', 'Resolved'],
              ['closed', 'Closed'],
              ['all', 'All'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTicketFilter(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  ticketFilter === id ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            <div className="glass-card rounded-xl divide-y divide-glass-stroke max-h-[70vh] overflow-y-auto">
              {filteredTickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTicket(t.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-white/5 ${
                    ticketDetail?.ticket?.id === t.id ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-on-surface font-semibold">{t.subject}</p>
                    <StatusPill status={t.status} />
                  </div>
                  <p className="text-on-surface-variant mt-1">
                    #{t.id} · {t.user_email}
                    {t.user_id ? (
                      <>
                        {' · '}
                        <span
                          role="link"
                          tabIndex={0}
                          className="text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            switchTab('users');
                            openUser(t.user_id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              switchTab('users');
                              openUser(t.user_id);
                            }
                          }}
                        >
                          Open user
                        </span>
                      </>
                    ) : null}
                  </p>
                </button>
              ))}
              {filteredTickets.length === 0 && (
                <div className="p-6">
                  <AdminEmptyState icon="support_agent" title="No tickets in this filter" description="Try All or Open." />
                </div>
              )}
            </div>
            <div className="glass-card p-4 rounded-xl min-h-[320px] flex flex-col">
              {!ticketDetail ? (
                <AdminEmptyState icon="chat" title="Select a ticket" description="Pick a ticket to read the thread and reply." />
              ) : (
                <>
                  <div className="flex justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-on-surface font-bold">{ticketDetail.ticket.subject}</h3>
                      <p className="text-on-surface-variant mt-1 flex items-center gap-2">
                        Status: <StatusPill status={ticketDetail.ticket.status} />
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {['in_progress', 'resolved', 'closed', 'open'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={ticketBusy}
                          onClick={() => setTicketStatus(s)}
                          className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded disabled:opacity-50"
                        >
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
                        <p className="text-on-surface whitespace-pre-wrap">{m.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendReply()}
                      placeholder="Reply as admin…"
                      className="flex-1 bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2 text-on-surface"
                    />
                    <button
                      type="button"
                      disabled={ticketBusy || !reply.trim()}
                      onClick={sendReply}
                      className="bg-primary text-on-primary px-3 py-2 rounded-lg font-bold disabled:opacity-50"
                    >
                      {ticketBusy ? '…' : 'Send'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </>
  );
}
