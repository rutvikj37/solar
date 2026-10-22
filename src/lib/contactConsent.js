/**
 * Homeowner contact consent wording. Must match server/services/compliance/consent.js
 * for the same version — the server rejects unknown versions and stores its own copy.
 */
export const CONTACT_CONSENT_VERSION = '2026-10-v1';

export const CONTACT_CONSENT_TEXT =
  'By checking this box and submitting this form, I agree that SpaceToRoof and its partner solar installers ' +
  'may contact me at the phone number and email address I provided about solar products and services, ' +
  'including by calls and text messages sent using automated technology and artificial or prerecorded voice, ' +
  'and by email. Consent is not a condition of any purchase. Message frequency varies. Message and data rates ' +
  'may apply. Reply STOP to opt out of texts, reply HELP for help, and use the unsubscribe link in any email ' +
  'to stop emails.';

export function consentPayload(agreed) {
  return {
    consent: Boolean(agreed),
    consentVersion: CONTACT_CONSENT_VERSION,
    consentPageUrl: typeof window !== 'undefined' ? window.location.href : null,
  };
}
