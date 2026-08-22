import db from '../../db.js';
import { fetchLeadForUser } from '../../utils/leadAccess.js';
import { buildCrmLeadPayload } from './leadPayload.js';
import { pushLeadToHubSpot } from './hubspotService.js';
import { pushLeadToSalesforce } from './salesforceService.js';

export const BULK_PUSH_MAX = 50;
const BULK_PUSH_DELAY_MS = 200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pushLeadToCrm({ userId, role, leadId, provider }) {
  const lead = await fetchLeadForUser(leadId, userId, role);
  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }

  const payload = buildCrmLeadPayload(lead);
  let result;

  switch (provider) {
    case 'hubspot':
      result = await pushLeadToHubSpot(userId, lead, payload);
      break;
    case 'salesforce':
      result = await pushLeadToSalesforce(userId, lead, payload);
      break;
    default: {
      const err = new Error('Unsupported CRM provider. Use hubspot or salesforce.');
      err.status = 400;
      throw err;
    }
  }

  await db.query(
    `INSERT INTO lead_crm_pushes (lead_id, user_id, provider, external_id, external_url, status)
     VALUES (?, ?, ?, ?, ?, 'success')`,
    [leadId, userId, provider, result.externalId || null, result.url || null],
  );

  await db.query(
    'INSERT INTO lead_activities (lead_id, user_id, type, content, meta) VALUES (?, ?, ?, ?, ?)',
    [
      leadId,
      userId,
      'crm_push',
      `Pushed to ${provider}`,
      JSON.stringify({ provider, externalId: result.externalId, url: result.url }),
    ],
  );

  return {
    success: true,
    provider,
    externalId: result.externalId,
    url: result.url,
    message: `Lead pushed to ${provider}.`,
  };
}

export async function pushBulkLeadsToCrm({ userId, role, leadIds, provider }) {
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    const err = new Error('leadIds array is required');
    err.status = 400;
    throw err;
  }
  if (leadIds.length > BULK_PUSH_MAX) {
    const err = new Error(`Maximum ${BULK_PUSH_MAX} leads per bulk push`);
    err.status = 400;
    throw err;
  }

  const ids = leadIds.map((id) => Number(id));
  if (ids.some((id) => !Number.isFinite(id) || id <= 0)) {
    const err = new Error('All leadIds must be positive numbers');
    err.status = 400;
    throw err;
  }

  const results = [];
  let success = 0;
  let failed = 0;

  for (let i = 0; i < ids.length; i++) {
    const leadId = ids[i];
    try {
      const result = await pushLeadToCrm({ userId, role, leadId, provider });
      results.push({ leadId, ok: true, externalId: result.externalId });
      success++;
    } catch (err) {
      results.push({ leadId, ok: false, error: err.message || 'Push failed' });
      failed++;
    }
    if (i < ids.length - 1 && BULK_PUSH_DELAY_MS > 0) {
      await sleep(BULK_PUSH_DELAY_MS);
    }
  }

  return { success, failed, results };
}
