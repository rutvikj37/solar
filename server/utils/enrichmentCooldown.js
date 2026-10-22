const DEFAULT_COOLDOWN_DAYS = 7;

export function enrichmentCooldownMs() {
  const days = Number(process.env.LEAD_ENRICHMENT_COOLDOWN_DAYS);
  return (Number.isFinite(days) && days >= 0 ? days : DEFAULT_COOLDOWN_DAYS) * 24 * 60 * 60 * 1000;
}

/** True when a lead was enriched recently enough that paid contact lookups should be skipped. */
export function isWithinEnrichmentCooldown(lastEnrichedAt, now = Date.now()) {
  if (!lastEnrichedAt) return false;
  const ts = new Date(lastEnrichedAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return now - ts < enrichmentCooldownMs();
}
