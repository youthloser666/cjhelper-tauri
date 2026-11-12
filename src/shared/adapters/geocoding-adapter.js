const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Resolves free-form Indonesian location or address queries via OpenStreetMap Nominatim.
 */
export function createGeocodingAdapter({ fetchFn = globalThis.fetch } = {}) {
  async function searchLocation(query) {
    const trimmedQuery = String(query ?? '').trim();
    if (!trimmedQuery) return [];
    if (typeof fetchFn !== 'function') {
      throw new Error('Fetch implementation is unavailable for geocoding.');
    }

    const requestUrl = `${NOMINATIM_SEARCH_URL}?format=json&q=${encodeURIComponent(trimmedQuery)}`;
    const response = await fetchFn(requestUrl);
    if (!response?.ok) {
      throw new Error(`Geocoding request failed with status ${response?.status ?? 'unknown'}.`);
    }

    const results = await response.json();
    return Array.isArray(results) ? results : [];
  }

  return {
    searchLocation,
  };
}

export const geocodingAdapter = createGeocodingAdapter();

