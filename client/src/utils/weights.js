import { BEST_MATCH_CRITERIA } from '../constants.js';

/** Weights are whole percentages totalling 100; anything else falls back to the defaults. */

export const DEFAULT_WEIGHTS = Object.freeze(
  Object.fromEntries(BEST_MATCH_CRITERIA.map((criterion) => [criterion.key, criterion.defaultWeight])),
);

const KEYS = BEST_MATCH_CRITERIA.map((criterion) => criterion.key);

const isWeight = (value) => Number.isInteger(value) && value >= 0 && value <= 100;

export function checkWeights(values) {
  const source = values !== null && typeof values === 'object' && !Array.isArray(values) ? values : {};
  const invalid = KEYS.filter((key) => !isWeight(source[key]));
  const total = KEYS.reduce((sum, key) => sum + (isWeight(source[key]) ? source[key] : 0), 0);
  const unknown = Object.keys(source).some((key) => !KEYS.includes(key));
  return { ok: invalid.length === 0 && !unknown && total === 100, total, invalid };
}

export function effectiveWeights(saved) {
  const source = checkWeights(saved).ok ? saved : DEFAULT_WEIGHTS;
  return Object.fromEntries(KEYS.map((key) => [key, source[key]]));
}

export function isDefault(weights) {
  return KEYS.every((key) => weights?.[key] === DEFAULT_WEIGHTS[key]);
}
