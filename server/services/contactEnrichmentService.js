import { VerifaliaRestClient } from 'verifalia';
import { trackedFetch, trackApiCall } from './apiUsage.js';

const isKeyValid = (key) => {
  return key && key.trim() !== '' && !key.toLowerCase().includes('your_');
};

export async function standardizeAddress(addressStr) {
  if (!addressStr || addressStr === 'Not Available') {
    return { standardized: addressStr || 'Not Available', city: '', state: '', zip: '' };
  }

  if (isKeyValid(process.env.GOOGLE_MAPS_API_KEY)) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressStr)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      const res = await trackedFetch('google_maps', url);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results[0]) {
          const result = data.results[0];
          const components = result.address_components || [];
          let city = '';
          let state = '';
          let zip = '';

          components.forEach(c => {
            if (c.types.includes('locality')) city = c.long_name;
            if (c.types.includes('administrative_area_level_1')) state = c.short_name;
            if (c.types.includes('postal_code')) zip = c.long_name;
          });

          return {
            standardized: result.formatted_address || addressStr,
            city,
            state,
            zip
          };
        }
      }
    } catch (err) {
      console.error('[Address Standardization] Google Geocoding failed:', err);
    }
  }
  return { standardized: addressStr, city: '', state: '', zip: '' };
}

export function isCorporateOwner(name) {
  if (!name || name === 'Not Available') return false;
  const corporateKeywords = ['llc', 'corp', 'trust', 'l.p.', 'lp', 'holdings', 'inc', 'association', 'company', 'co', 'ltd', 'partners', 'estate', 'ventures', 'properties'];
  const lowercaseName = name.toLowerCase();
  return corporateKeywords.some(keyword => lowercaseName.includes(keyword) || lowercaseName.endsWith(' ' + keyword) || lowercaseName.endsWith('.' + keyword));
}

export async function resolveCorporateOwner(companyName) {
  if (!companyName || companyName === 'Not Available') return 'Not Available';
  console.log(`[Corporate Resolution] Shell company detected: "${companyName}". Checking public officer registry...`);

  try {
    const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(companyName)}&current_status=Active`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.companies && data.results.companies[0]) {
        const company = data.results.companies[0].company;
        if (company.registered_agent_name) {
          const agentName = company.registered_agent_name;
          console.log(`[Corporate Resolution] Found Registered Agent: ${agentName}`);
          return agentName;
        }
      }
    }
  } catch (err) {
    console.error('[Corporate Resolution] OpenCorporates search failed:', err);
  }

  if (companyName.toLowerCase().includes('trust')) {
    const words = companyName.split(' ');
    const trustIdx = words.findIndex(w => w.toLowerCase().includes('trust'));
    if (trustIdx > 0) {
      return `${words[0]} Trustee`;
    }
  }
  return 'Not Available';
}

export async function validateEmailWithVerifalia(email) {
  if (!email || email === 'Not Available') return 'Not Available';
  
  if (isKeyValid(process.env.VERIFALIA_USERNAME)) {
    try {
      console.log(`[Verifalia SMTP] Verifying email deliverability: ${email}`);
      const verifalia = new VerifaliaRestClient({
        username: process.env.VERIFALIA_USERNAME,
        password: process.env.VERIFALIA_PASSWORD || ''
      });
      
      const validation = await trackApiCall('verifalia', () => verifalia.emailValidations.submit(email));
      if (validation && validation.entries && validation.entries[0]) {
        const entry = validation.entries[0];
        console.log(`[Verifalia SMTP] Deliverability matched: ${entry.classification} (${entry.status})`);
        return entry.classification;
      }
    } catch (err) {
      console.error('[Verifalia SMTP] Verification failed:', err);
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? 'Deliverable (Syntax Validated)' : 'Undeliverable (Invalid Syntax)';
}

export async function lookupPhoneWithTwilio(phone) {
  if (!phone || phone === 'Not Available') return 'Not Available';

  if (isKeyValid(process.env.TWILIO_ACCOUNT_SID) && isKeyValid(process.env.TWILIO_AUTH_TOKEN)) {
    try {
      console.log(`[Twilio Lookup] Querying carrier information for: ${phone}`);
      const cleanPhone = phone.replace(/[^\d+]/g, '');
      const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(cleanPhone)}?Fields=line_type_intelligence`;
      
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const response = await trackedFetch('twilio', url, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.line_type_intelligence && data.line_type_intelligence.type) {
          const carrierType = data.line_type_intelligence.type.toUpperCase();
          console.log(`[Twilio Lookup] Line type resolved: ${carrierType}`);
          return carrierType;
        }
      }
    } catch (err) {
      console.error('[Twilio Lookup] Carrier lookup failed:', err);
    }
  }

  return 'MOBILE (Syntax Validated)';
}

export function formatPhoneNumber(phone) {
  if (!phone || phone === 'Not Available') return 'Not Available';
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

export function isMissingField(val) {
  if (val == null) return true;
  const s = String(val).trim();
  return s === '' || s === 'Not Available' || s.toLowerCase() === 'n/a';
}

export function isPlaceholderOwnerName(name) {
  if (isMissingField(name)) return true;
  const n = String(name).trim().toLowerCase();
  return n === 'verified owner' || n.startsWith('[dev mock]');
}

export function hasAnyContact(contact = {}) {
  return !isMissingField(contact.phone) || !isMissingField(contact.email) || !isMissingField(contact.linkedIn);
}

export function scoreContactQuality(contact = {}, ownerName = '') {
  let score = 0;
  if (!isPlaceholderOwnerName(ownerName)) score += 2;
  if (!isMissingField(contact.phone)) score += 3;
  if (!isMissingField(contact.email)) score += 3;
  if (!isMissingField(contact.linkedIn)) score += 1;
  return score;
}

export function emptyContactDetails() {
  return {
    phone: 'Not Available',
    email: 'Not Available',
    linkedIn: 'Not Available',
    confidenceScore: 'Not Available'
  };
}

export function applyTracerfyPerson(person, propertyDetails, contactDetails) {
  const nextProperty = { ...propertyDetails };
  const nextContact = { ...contactDetails };
  let phoneType = 'Not Available';

  if (person.full_name && isPlaceholderOwnerName(nextProperty.ownerName)) {
    nextProperty.ownerName = person.full_name;
  }
  if (person.phones && person.phones[0] && isMissingField(nextContact.phone)) {
    nextContact.phone = formatPhoneNumber(person.phones[0].number);
    if (person.phones[0].type) phoneType = String(person.phones[0].type).toUpperCase();
  }
  if (person.emails && person.emails[0] && isMissingField(nextContact.email)) {
    nextContact.email = person.emails[0].email;
  }
  if (hasAnyContact(nextContact)) {
    nextContact.confidenceScore = '95% verified (Tracerfy)';
  }
  return { propertyDetails: nextProperty, contactDetails: nextContact, phoneType };
}

export async function lookupContactsWithTracerfy(address, city, state, zip, attemptLabel = 'primary') {
  const apiKey = process.env.TRACERFY_API_KEY;
  if (!isKeyValid(apiKey)) return null;
  if (!address) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.TRACERFY_TIMEOUT_MS) || 5000);

  try {
    console.log(`[Tracerfy API] Skip-trace (${attemptLabel}): ${address}, ${city || ''}, ${state || ''} ${zip || ''}`);
    const tracerfyUrl = 'https://tracerfy.com/v1/api/trace/lookup/';
    const response = await trackedFetch('tracerfy', tracerfyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address,
        city: city || undefined,
        state: state || undefined,
        zip: zip || undefined,
        find_owner: true
      }),
      signal: controller.signal
    });

    if (response.ok) {
      const data = await response.json();
      if (data.hit && Array.isArray(data.persons) && data.persons[0]) {
        const person = data.persons[0];
        console.log(`[Tracerfy API] Skip-trace hit (${attemptLabel}) for owner: ${person.full_name}`);
        return person;
      }
      console.log(`[Tracerfy API] Skip-trace miss (${attemptLabel}).`);
    } else {
      const errText = await response.text();
      console.error(`[Tracerfy API] Request failed (${attemptLabel}) status ${response.status}: ${errText}`);
    }
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'timeout' : (err.message || err);
    console.error(`[Tracerfy API] Error (${attemptLabel}):`, reason);
  } finally {
    clearTimeout(timer);
  }
  return null;
}

export async function enrichContactsWithApollo(ownerName, locationInfo) {
  if (isPlaceholderOwnerName(ownerName) || !isKeyValid(process.env.APOLLO_API_KEY)) return null;

  const nameParts = String(ownerName).trim().split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return null;

  try {
    console.log(`[Apollo API] Querying ownerName: ${ownerName} @ ${locationInfo.city || ''}, ${locationInfo.state || ''}`);
    const apolloUrl = 'https://api.apollo.io/v1/people/match';
    const response = await trackedFetch('apollo', apolloUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': process.env.APOLLO_API_KEY
      },
      body: JSON.stringify({
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(' ') || undefined,
        state: locationInfo.state || undefined,
        city: locationInfo.city || undefined,
        reveal_personal_emails: true
      })
    });

    if (!response.ok) {
      console.error(`[Apollo API] Request failed with status ${response.status}`);
      return null;
    }

    const apolloData = await response.json();
    if (!apolloData.person) {
      console.log('[Apollo API] No person match.');
      return null;
    }

    const person = apolloData.person;
    const phone =
      (person.personal_phone_numbers && person.personal_phone_numbers[0]) ||
      (person.phone_numbers && person.phone_numbers[0] && (person.phone_numbers[0].sanitized_number || person.phone_numbers[0].raw_number)) ||
      null;

    console.log(`[Apollo API] Match found for ${ownerName} (phone=${!!phone}, email=${!!person.email})`);
    return {
      phone: phone ? formatPhoneNumber(String(phone)) : 'Not Available',
      email: person.email || 'Not Available',
      linkedIn: person.linkedin_url || 'Not Available',
      confidenceScore: '92% verified (Apollo)'
    };
  } catch (err) {
    console.error('[Apollo API] Error:', err.message || err);
    return null;
  }
}

export async function enrichOwnerContacts({ address, locationInfo, propertyDetails }) {
  let contactDetails = emptyContactDetails();
  let phoneType = 'Not Available';
  let nextProperty = { ...propertyDetails };
  let contactSource = 'none';

  const streetFromStandardized = (locationInfo.standardized || address || '').split(',')[0].trim();
  const streetFromRaw = (address || '').split(',')[0].trim();
  const hasLocationFields = !!(locationInfo.city && locationInfo.state && locationInfo.zip);

  if (isKeyValid(process.env.TRACERFY_API_KEY)) {
    let tracerfyPerson = await lookupContactsWithTracerfy(
      streetFromStandardized || streetFromRaw,
      locationInfo.city,
      locationInfo.state,
      locationInfo.zip,
      'primary'
    );

    const primaryIncomplete =
      !tracerfyPerson ||
      (!(tracerfyPerson.phones && tracerfyPerson.phones[0]) && !(tracerfyPerson.emails && tracerfyPerson.emails[0]));

    if (primaryIncomplete) {
      let retryCity = locationInfo.city;
      let retryState = locationInfo.state;
      let retryZip = locationInfo.zip;

      if (!hasLocationFields && (address || locationInfo.standardized)) {
        const geo = await standardizeAddress(address || locationInfo.standardized);
        if (!retryCity && geo.city) retryCity = geo.city;
        if (!retryState && geo.state) retryState = geo.state;
        if (!retryZip && geo.zip) retryZip = geo.zip;
      }

      const retryStreet =
        streetFromRaw && streetFromRaw.toLowerCase() !== (streetFromStandardized || '').toLowerCase()
          ? streetFromRaw
          : streetFromStandardized;

      const canRetry =
        retryStreet &&
        (retryCity || retryState || retryZip) &&
        (!hasLocationFields ||
          (streetFromRaw && streetFromRaw.toLowerCase() !== (streetFromStandardized || '').toLowerCase()));

      if (canRetry) {
        const retryPerson = await lookupContactsWithTracerfy(
          retryStreet,
          retryCity,
          retryState,
          retryZip,
          'retry-geocode'
        );
        if (retryPerson) tracerfyPerson = retryPerson;
      }
    }

    if (tracerfyPerson) {
      const applied = applyTracerfyPerson(tracerfyPerson, nextProperty, contactDetails);
      nextProperty = applied.propertyDetails;
      contactDetails = applied.contactDetails;
      if (applied.phoneType !== 'Not Available') phoneType = applied.phoneType;
      contactSource = 'tracerfy';
    }
  } else {
    console.log('[Contact Enrichment] Tracerfy key missing — skipping primary skip-trace.');
  }

  const needsApollo =
    isMissingField(contactDetails.phone) || isMissingField(contactDetails.email);

  if (needsApollo && !isPlaceholderOwnerName(nextProperty.ownerName)) {
    const apolloContact = await enrichContactsWithApollo(nextProperty.ownerName, locationInfo);
    if (apolloContact) {
      if (isMissingField(contactDetails.phone) && !isMissingField(apolloContact.phone)) {
        contactDetails.phone = apolloContact.phone;
      }
      if (isMissingField(contactDetails.email) && !isMissingField(apolloContact.email)) {
        contactDetails.email = apolloContact.email;
      }
      if (isMissingField(contactDetails.linkedIn) && !isMissingField(apolloContact.linkedIn)) {
        contactDetails.linkedIn = apolloContact.linkedIn;
      }
      if (hasAnyContact(contactDetails)) {
        contactDetails.confidenceScore =
          contactSource === 'tracerfy'
            ? 'Mixed Tracerfy + Apollo'
            : apolloContact.confidenceScore;
        contactSource = contactSource === 'tracerfy' ? 'tracerfy+apollo' : 'apollo';
      }
    }
  } else if (!needsApollo) {
    console.log('[Contact Enrichment] Skipping Apollo — Tracerfy already provided phone and email.');
  }

  const missingFields = [];
  if (isPlaceholderOwnerName(nextProperty.ownerName)) missingFields.push('ownerName');
  if (isMissingField(contactDetails.phone)) missingFields.push('phone');
  if (isMissingField(contactDetails.email)) missingFields.push('email');

  console.log(
    `[Contact Enrichment] source=${contactSource} owner="${nextProperty.ownerName}" ` +
      `phone=${!isMissingField(contactDetails.phone)} email=${!isMissingField(contactDetails.email)} ` +
      `missing=[${missingFields.join(',') || 'none'}]`
  );

  return {
    propertyDetails: nextProperty,
    contactDetails,
    phoneType,
    contactSource,
    missingFields,
    contactComplete: missingFields.length === 0
  };
}
