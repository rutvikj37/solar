/**
 * Homeowner contact consent (TCPA-style express written consent).
 * The server stores its own canonical text for the submitted version — never the client copy.
 * When wording changes, add a new version key and update the frontend constant to match.
 */

export const CURRENT_CONSENT_VERSION = '2026-10-v1';

export const CONSENT_TEXTS = {
  '2026-10-v1':
    'By checking this box and submitting this form, I agree that SpaceToRoof and its partner solar installers ' +
    'may contact me at the phone number and email address I provided about solar products and services, ' +
    'including by calls and text messages sent using automated technology and artificial or prerecorded voice, ' +
    'and by email. Consent is not a condition of any purchase. Message frequency varies. Message and data rates ' +
    'may apply. Reply STOP to opt out of texts, reply HELP for help, and use the unsubscribe link in any email ' +
    'to stop emails.',
};

export function getConsentText(version) {
  return CONSENT_TEXTS[version] || null;
}

/**
 * Validate the consent payload from the public inquiry form.
 * @returns {{ ok: true, record: object } | { ok: false, error: string }}
 */
export function buildConsentRecord(req, body = {}) {
  const given = body.consent === true || body.consent === 'true' || body.consent === 1;
  if (!given) {
    return { ok: false, error: 'You must agree to be contacted before submitting this form.' };
  }
  const version = String(body.consentVersion || '').trim();
  const text = getConsentText(version);
  if (!text) {
    return {
      ok: false,
      error: 'The consent wording has changed. Please refresh the page and submit again.',
    };
  }
  const pageUrl = String(body.consentPageUrl || req.get('referer') || '').slice(0, 1024) || null;
  return {
    ok: true,
    record: {
      text,
      version,
      at: new Date(),
      ip: String(req.ip || req.socket?.remoteAddress || '').slice(0, 64) || null,
      userAgent: String(req.get('user-agent') || '').slice(0, 512) || null,
      pageUrl,
    },
  };
}
