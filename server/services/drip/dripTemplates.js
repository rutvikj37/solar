/** Template rendering for drip messages. */
import { BRAND_COMPANY_DEFAULT } from '../../config/brand.js';

export const MERGE_FIELDS = ['owner_name', 'address', 'estimated_savings', 'company_name'];

export function renderDripTemplate(template, lead, extras = {}) {
  const savings = lead.estimated_savings
    ? `$${Number(lead.estimated_savings).toLocaleString()}`
    : '$30,000';

  return String(template || '')
    .replace(/\{owner_name\}/g, lead.owner_name || 'Homeowner')
    .replace(/\{address\}/g, lead.address || 'your property')
    .replace(/\{estimated_savings\}/g, savings)
    .replace(/\{company_name\}/g, extras.companyName || BRAND_COMPANY_DEFAULT);
}

export const DEFAULT_DRIP_STEPS = [
  {
    order: 1,
    delayDays: 0,
    delayHours: 0,
    actionType: 'email',
    subject: 'Solar opportunity at {address}',
    templateContent:
      'Hi {owner_name},\n\nYour property at {address} has strong solar potential (~{estimated_savings} in 25-yr savings).\n\nWould you like a free site assessment?\n\n— {company_name}',
  },
  {
    order: 2,
    delayDays: 2,
    delayHours: 0,
    actionType: 'email',
    subject: 'Solar Savings Assessment for {address}',
    templateContent:
      'Hi {owner_name},\n\nWe analyzed {address} and estimated {estimated_savings} in 25-year bill savings.\n\nWould you like to book a 10-minute site audit?\n\n— {company_name}',
  },
];

export function stepDelayMs(step) {
  const days = Number(step.delay_days ?? step.delayDays ?? 0);
  const hours = Number(step.delay_hours ?? step.delayHours ?? 0);
  return (days * 24 + hours) * 60 * 60 * 1000;
}
