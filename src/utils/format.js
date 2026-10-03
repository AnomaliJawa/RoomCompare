import { DISTANCE_BASIS } from '../constants.js';

/** The thousands separator is fixed, not Intl's, so a live input never changes shape. */

export const GROUP_SEPARATOR = '.';

export const MAX_RENT_DIGITS = 12;

export function digitsOnly(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\D+/g, '');
}

export function stripLeadingZeros(digits) {
  if (!digits) return '';
  const trimmed = digits.replace(/^0+/, '');
  return trimmed === '' ? '0' : trimmed;
}

export function groupDigits(digits) {
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
}

export function normalizeRentInput(value, maxDigits = MAX_RENT_DIGITS) {
  return stripLeadingZeros(digitsOnly(value)).slice(0, maxDigits);
}

export function parseRent(value) {
  const digits = normalizeRentInput(value);
  return digits === '' ? null : Number(digits);
}

export function formatRent(value) {
  if (value === null || value === undefined) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return groupDigits(String(Math.trunc(Math.abs(n))));
}

/** Missing values read "Not recorded", never "Rp NaN". */
export function numberToCurrency(value) {
  if (value === null || value === undefined) return 'Not recorded';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Not recorded';
  return `Rp ${groupDigits(String(Math.trunc(Math.abs(n))))}`;
}

export function formatDistance(value) {
  if (value === null || value === undefined) return 'Not recorded';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Not recorded';
  return `${n.toFixed(1).replace('.', ',')} km`;
}

/** A record without distanceBasis predates walking routes, so it is a straight line. */
export function isStraightLineDistance(kos) {
  return Number.isFinite(kos?.distanceKm) && kos.distanceBasis !== DISTANCE_BASIS.WALKING;
}

/** Only straight lines are marked; the no-break space keeps the mark whole when it wraps. */
export function formatKosDistance(kos) {
  const text = formatDistance(kos?.distanceKm);
  return isStraightLineDistance(kos) ? `${text} (straight\u00a0line)` : text;
}
