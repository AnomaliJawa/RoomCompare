/** Nominatim allows one request a second, so lookups run on a button press and are throttled. */

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

export function shortLabel(displayName) {
  if (!displayName) return '';
  const parts = displayName.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.join(', ');
  const town = parts.find((part, index) => index > 0 && /[A-Za-z]/.test(part) && !/^\d+$/.test(part));
  return [parts[0], town].filter(Boolean).join(', ');
}

/** Never rejects: an address that cannot be found is an ordinary outcome. */
export async function geocodeAddress(query, { signal } = {}) {
  const text = String(query ?? '').trim();
  if (!text) return { status: GEOCODE_STATUS.EMPTY };

  const since = Date.now() - lastRequestAt;
  if (since < MIN_INTERVAL_MS) {
    return { status: GEOCODE_STATUS.THROTTLED, retryInMs: MIN_INTERVAL_MS - since };
  }

  // A second search while one runs would breach the rate limit.
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
    return { status: GEOCODE_STATUS.UNAVAILABLE };
  } finally {
    clearTimeout(timer);
    if (inFlight === controller) inFlight = null;
  }
}
