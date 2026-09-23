/**
 * Offline-dev / demo property fallbacks (Beverly Hills streets, [DEV MOCK] owners).
 * Fail-closed everywhere unless explicitly opted in via ALLOW_MOCK_PROPERTIES=1.
 * Never enable for real user-facing environments.
 */
export function allowMockProperties() {
  const flag = String(process.env.ALLOW_MOCK_PROPERTIES || '').trim().toLowerCase();
  return flag === '1' || flag === 'true';
}

/** API / provider down or misconfigured — user should retry later. */
export const PROPERTY_DATA_UNAVAILABLE =
  'System update in progress. Please try again after some time.';

/** Provider responded OK but no verified matches for this search. */
export const PROPERTY_DATA_NOT_FOUND =
  'No verified property data found for this search.';

export const PROPERTY_DATA_UNAVAILABLE_CODE = 'PROPERTY_DATA_UNAVAILABLE';
export const PROPERTY_DATA_NOT_FOUND_CODE = 'PROPERTY_DATA_NOT_FOUND';

export function propertyDataUnavailableError(message = PROPERTY_DATA_UNAVAILABLE) {
  const err = new Error(message);
  err.code = PROPERTY_DATA_UNAVAILABLE_CODE;
  err.mockBlocked = true;
  err.statusCode = 503;
  return err;
}
