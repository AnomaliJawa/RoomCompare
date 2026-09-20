/**
 * Coordinates and distance.
 *
 * Distance to campus is one of the criteria every respondent weighed, and the
 * requirement asks for it to be calculated from the two pinned points rather
 * than typed. Haversine over a spherical earth is accurate to a few metres at
 * city scale, which is far beyond what "1.8 km to campus" needs.
 */

const EARTH_RADIUS_KM = 6371;

/** Malang, where the sample surveys are. Used as an initial map view only. */
export const DEFAULT_CENTER = { lat: -7.9526, lng: 112.6148 };

/**
 * Number(null) and Number('') are both 0, so an unpinned coordinate would
 * otherwise read as a valid zero and measure distance to the prime meridian.
 * Absence is rejected before the range check.
 */
function toNumber(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'string' && value.trim() === '') return NaN;
  return Number(value);
}

export function isValidLat(value) {
  const n = toNumber(value);
  return Number.isFinite(n) && n >= -90 && n <= 90;
}

export function isValidLng(value) {
  const n = toNumber(value);
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

export function isValidPoint(point) {
  return Boolean(point) && isValidLat(point.lat) && isValidLng(point.lng);
}

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance in kilometres, or null when either point is missing.
 * Null rather than 0: an unknown distance and a zero distance are different
 * facts, and 0 would read as "next door".
 */
export function haversineKm(a, b) {
  if (!isValidPoint(a) || !isValidPoint(b)) return null;

  const lat1 = toRadians(Number(a.lat));
  const lat2 = toRadians(Number(b.lat));
  const deltaLat = toRadians(Number(b.lat) - Number(a.lat));
  const deltaLng = toRadians(Number(b.lng) - Number(a.lng));

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rounded to one decimal, which is the precision the interface displays. */
export function distanceBetween(a, b) {
  const km = haversineKm(a, b);
  return km === null ? null : Math.round(km * 10) / 10;
}

/** Six decimals is roughly 0.1 m — more than enough to find a building. */
export function formatCoordinate(point) {
  if (!isValidPoint(point)) return 'Not pinned';
  return `${Number(point.lat).toFixed(6)}, ${Number(point.lng).toFixed(6)}`;
}
