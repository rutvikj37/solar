import { isAdminRole } from './auth.js';

/**
 * Single source of truth for how the active plan and credit balance are shown
 * (top bar, sidebar widget, banner, dashboard).
 */
export function selectPlanDisplay({
  user,
  credits,
  activePackage,
  subscription,
  entitlements,
  unlimitedCredits,
} = {}) {
  const isAdmin = isAdminRole(user?.role || '');
  const unlimited = Boolean(isAdmin || unlimitedCredits || entitlements?.unlimited);
  const packageId = activePackage || 'Free';
  const isFree = !subscription && packageId === 'Free';
  const planName = isAdmin
    ? 'Admin'
    : isFree
      ? 'Free'
      : subscription?.packageName || entitlements?.packageName || packageId;
  const statusLabel = isAdmin
    ? 'Admin'
    : subscription?.status
      ? String(subscription.status).replace(/_/g, ' ')
      : isFree
        ? 'Trial'
        : 'Active';
  const creditCount = Number(credits);
  const creditBalance = Number.isFinite(creditCount) ? creditCount : 0;
  return {
    isAdmin,
    unlimited,
    isFree,
    planName,
    statusLabel,
    credits: creditBalance,
    creditsLabel: unlimited ? '∞' : creditBalance.toLocaleString(),
    creditsEmpty: !unlimited && creditBalance <= 0,
    creditsLow: !unlimited && creditBalance <= 2,
  };
}
