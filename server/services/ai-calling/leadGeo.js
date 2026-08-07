/**
 * Parse ZIP / state from a US mailing address when leads table has no dedicated columns.
 */
export function parseAddressParts(address = '') {
  const text = String(address || '');
  const zipMatch = text.match(/\b(\d{5})(?:-\d{4})?\b/);
  const stateMatch = text.match(/\b([A-Z]{2})\s+\d{5}\b/) || text.match(/,\s*([A-Z]{2})\s*,/i);
  return {
    zip: zipMatch ? zipMatch[1] : null,
    state: stateMatch ? String(stateMatch[1]).toUpperCase() : null,
  };
}

export function enrichLeadGeo(lead = {}) {
  if (!lead) return lead;
  const fromAddress = parseAddressParts(lead.address || lead.mailing_address || '');
  let fromJson = {};
  if (lead.property_json) {
    try {
      const pj = typeof lead.property_json === 'string' ? JSON.parse(lead.property_json) : lead.property_json;
      fromJson = {
        zip: pj.zip || pj.zipCode || pj.postalCode || null,
        state: pj.state || pj.stateCode || null,
      };
    } catch {
      /* ignore */
    }
  }
  return {
    ...lead,
    zip: lead.zip || fromJson.zip || fromAddress.zip || null,
    state: lead.state || fromJson.state || fromAddress.state || null,
  };
}
