/** Founding Launch duration pricing helpers (1 / 6 / 12 months). */

export const BILLING_MONTH_OPTIONS = [1, 6, 12];

export function normalizeBillingMonths(raw) {
  const n = Number(raw);
  return BILLING_MONTH_OPTIONS.includes(n) ? n : 1;
}

export function parsePlanModules(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((t) => String(t).trim()).filter(Boolean);
      }
    } catch {
      /* treat as newline/comma list */
    }
    return raw
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function modulesToJson(modules) {
  return JSON.stringify(parsePlanModules(modules));
}

/**
 * Resolve per-month and total price for a package + commitment length.
 * Falls back: price_Nmo → price_1mo → price
 */
export function resolveDurationPricing(pkg, billingMonths = 1) {
  const months = normalizeBillingMonths(billingMonths);
  const price1 = Number(pkg?.price_1mo ?? pkg?.price) || 0;
  const price6 = Number(pkg?.price_6mo ?? price1) || price1;
  const price12 = Number(pkg?.price_12mo ?? price6) || price6;
  const perMonth = months === 12 ? price12 : months === 6 ? price6 : price1;
  const total = Math.round(perMonth * months * 100) / 100;
  return {
    months,
    perMonth,
    total,
    amountCents: Math.round(total * 100),
    price1,
    price6,
    price12,
  };
}

export function stripePriceIdForMonths(pkg, billingMonths = 1) {
  const months = normalizeBillingMonths(billingMonths);
  if (months === 12 && pkg?.stripe_price_id_12mo) return pkg.stripe_price_id_12mo;
  if (months === 6 && pkg?.stripe_price_id_6mo) return pkg.stripe_price_id_6mo;
  if (months === 1 && pkg?.stripe_price_id) return pkg.stripe_price_id;
  return null;
}

export const FOUNDING_LAUNCH_PLANS = [
  {
    id: 'Scout',
    name: 'Scout',
    lead_limit: 50,
    email_limit: 2000,
    whatsapp_limit: 25,
    crm_user_limit: 2,
    email_automation_limit: 2,
    price: 299,
    price_1mo: 299,
    price_6mo: 249,
    price_12mo: 199,
    sort_order: 10,
    description: 'Find opportunities',
    features: [
      '50 AI-identified opportunities / month',
      'Property + roof intelligence Data',
      'Opportunity score',
      'Homeowner contact details',
      'CRM — 2 users',
      '2 email automations',
      '25 WhatsApp messages',
      'Lead & follow-up tracking',
      'CSV export',
    ],
  },
  {
    id: 'Pioneer',
    name: 'Pioneer',
    lead_limit: 150,
    email_limit: 5000,
    whatsapp_limit: 50,
    crm_user_limit: 5,
    email_automation_limit: 5,
    price: 399,
    price_1mo: 399,
    price_6mo: 349,
    price_12mo: 299,
    sort_order: 20,
    description: 'Find + automate + marketplace',
    features: [
      '150 AI-identified opportunities / month',
      'Advanced property + roof intelligence',
      'Advanced scoring & filters',
      'Verified homeowner contact data',
      'CRM — 5 users',
      '5 email automations',
      '50 WhatsApp messages',
      'Proposal maker',
      'Marketplace access',
      'Lead & follow-up tracking',
      'CSV export',
    ],
  },
  {
    id: 'MissionControl',
    name: 'Mission Control',
    lead_limit: 400,
    email_limit: 10000,
    whatsapp_limit: 100,
    crm_user_limit: 10,
    email_automation_limit: 10,
    price: 499,
    price_1mo: 499,
    price_6mo: 449,
    price_12mo: 399,
    sort_order: 30,
    description: 'Scale + priority marketplace',
    features: [
      '400 AI-identified opportunities / month',
      '7 days territory intelligence lock',
      'Advanced scoring & analytics',
      'Verified homeowner contact data',
      'CRM — 10 users',
      '10 email automations',
      '100 WhatsApp messages',
      'Proposal maker',
      'Appointment setter',
      'Marketplace access',
      'Early access to new marketplace leads',
    ],
  },
];
