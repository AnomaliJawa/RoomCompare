import { BEST_MATCH_CRITERIA } from '../constants.js';

/**
 * The rule for Best Match weights, in one place for everything that reads or
 * writes them: the score, the Dashboard, the dialog that sets them, and the
 * store that keeps them. It imports nothing but constants, so the store can
 * use it without importing the feature that imports the store.
 *
 * A set of weights gives every criterion a whole percentage from 0 to 100,
 * and they add up to exactly 100. Zero leaves a criterion out of the score.
 * Anything else, such as what an older build or a hand-edited localStorage
 * left behind, is never scored with: the defaults stand in, so a bad value
 * cannot produce a score out of 110.
 */

export const DEFAULT_WEIGHTS = Object.freeze(
  Object.fromEntries(BEST_MATCH_CRITERIA.map((criterion) => [criterion.key, criterion.defaultWeight])),
);

const KEYS = BEST_MATCH_CRITERIA.map((criterion) => criterion.key);

const isWeight = (value) => Number.isInteger(value) && value >= 0 && value <= 100;

/**
 * Check a set of weights. `invalid` names the criteria whose value is not a
 * whole number from 0 to 100, and `total` adds up the ones that are, so the
 * dialog can say how far off 100 the rest is.
 */
export function checkWeights(values) {
  const source = values !== null && typeof values === 'object' && !Array.isArray(values) ? values : {};
  const invalid = KEYS.filter((key) => !isWeight(source[key]));
  const total = KEYS.reduce((sum, key) => sum + (isWeight(source[key]) ? source[key] : 0), 0);
  const unknown = Object.keys(source).some((key) => !KEYS.includes(key));
  return { ok: invalid.length === 0 && !unknown && total === 100, total, invalid };
}

/** The weights to score with: `saved` when it is a valid set, the defaults otherwise. */
export function effectiveWeights(saved) {
  const source = checkWeights(saved).ok ? saved : DEFAULT_WEIGHTS;
  return Object.fromEntries(KEYS.map((key) => [key, source[key]]));
}

/** Whether a set of weights is the defaults, criterion for criterion. */
export function isDefault(weights) {
  return KEYS.every((key) => weights?.[key] === DEFAULT_WEIGHTS[key]);
}
