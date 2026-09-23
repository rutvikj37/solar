/** Shared copy for property / lead provider outages vs empty verified search. */
export const PROPERTY_DATA_UNAVAILABLE =
  'System update in progress. Please try again after some time.';
export const PROPERTY_DATA_NOT_FOUND =
  'No verified property data found for this search.';

export const PROPERTY_DATA_UNAVAILABLE_CODE = 'PROPERTY_DATA_UNAVAILABLE';
export const PROPERTY_DATA_NOT_FOUND_CODE = 'PROPERTY_DATA_NOT_FOUND';

/**
 * Resolve user-facing message from an API JSON body (or Error).
 * Prefers server `error` / `code`; falls back to system-update copy for 5xx.
 */
export function resolvePropertyDataMessage(data, { status } = {}) {
  if (!data && status >= 500) return PROPERTY_DATA_UNAVAILABLE;
  const code = data?.code;
  if (code === PROPERTY_DATA_UNAVAILABLE_CODE) {
    return data.error || PROPERTY_DATA_UNAVAILABLE;
  }
  if (code === PROPERTY_DATA_NOT_FOUND_CODE) {
    return data.error || PROPERTY_DATA_NOT_FOUND;
  }
  if (data?.mockBlocked && status >= 500) {
    return data.error || PROPERTY_DATA_UNAVAILABLE;
  }
  if (data?.error) return data.error;
  if (status === 503) return PROPERTY_DATA_UNAVAILABLE;
  if (status === 404) return PROPERTY_DATA_NOT_FOUND;
  return null;
}
