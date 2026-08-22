/** Build normalized CRM payload from a lead row. */
export function buildCrmLeadPayload(lead) {
  let solar = null;
  let propertyExtra = null;
  try {
    solar = lead.solar_json ? JSON.parse(lead.solar_json) : null;
  } catch {
    solar = null;
  }
  try {
    propertyExtra = lead.property_json ? JSON.parse(lead.property_json) : null;
  } catch {
    propertyExtra = null;
  }

  const fullName = String(lead.owner_name || '').trim() || 'Unknown';
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] || 'Unknown';
  const lastName = nameParts.slice(1).join(' ') || 'Lead';

  return {
    event: 'lead.created',
    timestamp: new Date().toISOString(),
    lead: {
      id: lead.id,
      ownerName: fullName,
      firstName,
      lastName,
      address: lead.address,
      latitude: lead.latitude,
      longitude: lead.longitude,
      phone: lead.phone,
      phoneType: lead.phone_type,
      email: lead.email,
      emailStatus: lead.email_status,
      linkedIn: lead.linkedin,
      status: lead.status,
      leadScore: lead.lead_score,
      propertyValue: lead.property_value,
      roofSize: lead.roof_size,
      estimatedSavings: lead.estimated_savings,
      solarDetails: solar,
      propertyDetails: propertyExtra,
      imageUrl: lead.image_url,
      notes: lead.notes,
    },
  };
}

export function parseAddressParts(address) {
  const raw = String(address || '').trim();
  if (!raw) return { street: '', city: '', state: '', zip: '' };
  const zipMatch = raw.match(/\b(\d{5}(?:-\d{4})?)\b/);
  const zip = zipMatch ? zipMatch[1] : '';
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  return {
    street: parts[0] || raw,
    city: parts[1] || '',
    state: parts[2]?.replace(/\d{5}.*/, '').trim() || '',
    zip,
  };
}
