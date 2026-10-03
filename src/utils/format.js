import { DISTANCE_BASIS } from '../constants.js';

/**
 * Formatting helpers.
 *
 * Indonesian convention groups thousands with a period: 1.500.000.
 * The separator is fixed rather than read from Intl, because a live input
 * must never change shape between engines while someone is typing.
 */

export const GROUP_SEPARATOR = '.';

/** Rent is recorded as whole rupiah, so 12 digits is far beyond any real value. */
export const MAX_RENT_DIGITS = 12;

/** Everything that is not 0-9, discarded. Handles pasted "Rp 1.500.000". */
export function digitsOnly(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\D+/g, '');
}

/** "007" -> "7", "000" -> "0", "" -> "". */
export function stripLeadingZeros(digits) {
  if (!digits) return '';
  const trimmed = digits.replace(/^0+/, '');
  return trimmed === '' ? '0' : trimmed;
}

/** "1500000" -> "1.500.000". Expects digits only. */
export function groupDigits(digits) {
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
}

/**
 * Anything a user can type or paste -> the canonical digit string.
 * Returns '' for input with no digits at all.
 */
export function normalizeRentInput(value, maxDigits = MAX_RENT_DIGITS) {
  return stripLeadingZeros(digitsOnly(value)).slice(0, maxDigits);
}

/** "1.500.000" or "Rp 1.500.000" -> 1500000. Returns null when there is no number. */
export function parseRent(value) {
  const digits = normalizeRentInput(value);
  return digits === '' ? null : Number(digits);
}

/** 1500000 -> "1.500.000". Returns '' for null/undefined/NaN. */
export function formatRent(value) {
  if (value === null || value === undefined) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return groupDigits(String(Math.trunc(Math.abs(n))));
}

/**
 * 1500000 -> "Rp 1.500.000".
 * Missing or unusable values read "Not recorded" — distinct from absent,
 * and never "Rp NaN", which is what the prototype rendered.
 */
export function numberToCurrency(value) {
  if (value === null || value === undefined) return 'Not recorded';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Not recorded';
  return `Rp ${groupDigits(String(Math.trunc(Math.abs(n))))}`;
}

/** 1.8 -> "1,8 km". Indonesian decimal comma. Null-safe. */
export function formatDistance(value) {
  if (value === null || value === undefined) return 'Not recorded';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Not recorded';
  return `${n.toFixed(1).replace('.', ',')} km`;
}

/**
 * Whether a kos's distance is only the straight line between its pins: the
 * walking route could not be had when it was saved, or it was saved before
 * distances were walked. A record without a basis predates the field.
 */
export function isStraightLineDistance(kos) {
  return Number.isFinite(kos?.distanceKm) && kos.distanceBasis !== DISTANCE_BASIS.WALKING;
}

/**
 * A kos's distance to campus, as every list, page and table shows it. Walking
 * is the measure, so only the exception is marked: a straight line passed off
 * as a walk would flatter that kos beside the others. The mark's two words
 * are joined, so a narrow card wraps it whole onto the next line rather than
 * splitting it.
 */
export function formatKosDistance(kos) {
  const text = formatDistance(kos?.distanceKm);
  return isStraightLineDistance(kos) ? `${text} (straight\u00a0line)` : text;
}
