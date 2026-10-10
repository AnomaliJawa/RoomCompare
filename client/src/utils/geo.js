import { t } from '../i18n/index.js';

const EARTH_RADIUS_KM = 6371;

export const DEFAULT_CENTER = { lat: -7.9526, lng: 112.6148 };

/** Number(null) and Number('') are 0, so absence is rejected before the range check. */
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

/** Null, not 0: an unknown distance must not read as "next door". */
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

export function distanceBetween(a, b) {
  const km = haversineKm(a, b);
  return km === null ? null : Math.round(km * 10) / 10;
}

/** Six decimals is about 0.1 m. */
/** Google Maps' documented search URL: on a phone it opens the Maps app at the pin. */
export function googleMapsUrl(point) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${Number(point.lat)},${Number(point.lng)}`)}`;
}

export function formatCoordinate(point) {
  if (!isValidPoint(point)) return t('Not pinned');
  return `${Number(point.lat).toFixed(6)}, ${Number(point.lng).toFixed(6)}`;
}
