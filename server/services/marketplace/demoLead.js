/** Tag stored in enrichment_json / score_breakdown for seeded demo marketplace rows. */
export const MARKETPLACE_DEMO_TAG = 'marketplace_demo_v1';

const SQL_DEMO_LEAD_PREDICATE = `(
  enrichment_json LIKE ?
  OR score_breakdown LIKE ?
  OR email LIKE '%.demo@example.com'
  OR email = 'review.demo@example.com'
  OR homeowner_name = 'Review Pending Demo'
  OR project_details LIKE 'Demo pipeline lead%'
)`;

/** SQL fragment — append after WHERE (includes leading AND). */
export const SQL_EXCLUDE_DEMO_LEADS = `AND NOT ${SQL_DEMO_LEAD_PREDICATE}`;

/** SQL fragment — match demo rows only (no leading AND). */
export const SQL_MATCH_DEMO_LEADS = SQL_DEMO_LEAD_PREDICATE;

/** Prefix column names for JOIN queries, e.g. l.enrichment_json */
export function sqlExcludeDemoLeadsForAlias(alias) {
  const p = alias ? `${alias}.` : '';
  return `AND NOT (
  ${p}enrichment_json LIKE ?
  OR ${p}score_breakdown LIKE ?
  OR ${p}email LIKE '%.demo@example.com'
  OR ${p}email = 'review.demo@example.com'
  OR ${p}homeowner_name = 'Review Pending Demo'
  OR ${p}project_details LIKE 'Demo pipeline lead%'
)`;
}

export const SQL_DEMO_LEAD_BIND = [`%${MARKETPLACE_DEMO_TAG}%`, `%${MARKETPLACE_DEMO_TAG}%`];

function safeJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * True when a marketplace_leads row was seeded as demo/sample data (not a real homeowner inquiry).
 */
export function isDemoMarketplaceLead(lead) {
  if (!lead) return false;

  const email = String(lead.email || '').trim().toLowerCase();
  if (email.endsWith('.demo@example.com') || email === 'review.demo@example.com') {
    return true;
  }

  if (String(lead.homeowner_name || '').trim() === 'Review Pending Demo') {
    return true;
  }

  const projectDetails = String(lead.project_details || '');
  if (/^Demo pipeline lead\b/i.test(projectDetails)) {
    return true;
  }

  const enrichment = safeJson(lead.enrichment_json);
  if (enrichment?.demo === MARKETPLACE_DEMO_TAG) {
    return true;
  }

  const breakdown = safeJson(lead.score_breakdown);
  if (breakdown?.demo === MARKETPLACE_DEMO_TAG) {
    return true;
  }

  const enrichmentText = String(lead.enrichment_json || '');
  const breakdownText = String(lead.score_breakdown || '');
  if (
    enrichmentText.includes(MARKETPLACE_DEMO_TAG) ||
    breakdownText.includes(MARKETPLACE_DEMO_TAG)
  ) {
    return true;
  }

  return false;
}
