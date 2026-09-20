/**
 * Address lookup, via OpenStreetMap's Nominatim service.
 *
 * Chosen because it needs no API key and no billing account, and because it
 * searches the same data the map tiles are drawn from — an address that
 * resolves here lands where the user expects on the map.
 *
 * Nominatim's usage policy asks for no more than one request per second and
 * for the application to be identifiable. Lookups therefore run on an
 * explicit action rather than as the user types, and a throttle enforces the
 * gap even if someone presses the button repeatedly.
 *
 * Every failure resolves rather than throwing: an address that cannot be
 * found is an ordinary outcome, and the map remains usable by tapping.
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const MIN_INTERVAL_MS = 1100;
const TIMEOUT_MS = 8000;

export const GEOCODE_STATUS = {
  OK: 'ok',
  EMPTY: 'empty',
  NOT_FOUND: 'not-found',
  THROTTLED: 'throttled',
  UNAVAILABLE: 'unavailable',
};

let lastRequestAt = 0;
let inFlight = null;

/** Shorten a Nominatim display name to something that fits a card. */
export function shortLabel(displayName) {
  if (!displayName) return '';
  const parts = displayName.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.join(', ');
  // The first element plus the town reads better than the full postal chain.
  const town = parts.find((part, index) => index > 0 && /[A-Za-z]/.test(part) && !/^\d+$/.test(part));
  return [parts[0], town].filter(Boolean).join(', ');
}

/**
 * Look up one address.
 * Resolves { status, lat, lng, displayName } — never rejects.
 */
export async function geocodeAddress(query, { signal } = {}) {
  const text = String(query ?? '').trim();
  if (!text) return { status: GEOCODE_STATUS.EMPTY };

  const since = Date.now() - lastRequestAt;
  if (since < MIN_INTERVAL_MS) {
    return { status: GEOCODE_STATUS.THROTTLED, retryInMs: MIN_INTERVAL_MS - since };
  }

  // A second search while one is running would breach the rate limit.
  if (inFlight) inFlight.abort();
  const controller = new AbortController();
  inFlight = controller;
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  lastRequestAt = Date.now();

  const url = new URL(ENDPOINT);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', text);
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return { status: GEOCODE_STATUS.UNAVAILABLE };

    const results = await response.json();
    if (!Array.isArray(results) || !results.length) {
      return { status: GEOCODE_STATUS.NOT_FOUND };
    }

    const [first] = results;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { status: GEOCODE_STATUS.NOT_FOUND };
    }

    return {
      status: GEOCODE_STATUS.OK,
      lat,
      lng,
      displayName: first.display_name ?? text,
    };
  } catch {
    // Aborted, offline, or blocked — all the same to the caller.
    return { status: GEOCODE_STATUS.UNAVAILABLE };
  } finally {
    clearTimeout(timer);
    if (inFlight === controller) inFlight = null;
  }
}
