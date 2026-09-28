import { describe, it, expect } from 'vitest';
import { DEFAULT_WEIGHTS, checkWeights, effectiveWeights, isDefault } from '../src/utils/weights.js';
import { BEST_MATCH_CRITERIA } from '../src/constants.js';

const custom = { price: 35, facilities: 20, cleanliness: 15, location: 15, distance: 3, security: 12 };

describe('checking a set of weights', () => {
  it('accepts whole numbers from 0 to 100 that total exactly 100', () => {
    expect(checkWeights(DEFAULT_WEIGHTS)).toEqual({ ok: true, total: 100, invalid: [] });
    expect(checkWeights(custom).ok).toBe(true);
  });

  it('accepts 0%, which leaves a criterion out', () => {
    expect(checkWeights({ ...DEFAULT_WEIGHTS, security: 0, price: 37 }).ok).toBe(true);
    expect(checkWeights({ price: 100, facilities: 0, cleanliness: 0, location: 0, distance: 0, security: 0 }).ok).toBe(true);
  });

  it('adds up what is there, so the dialog can say how far off 100 it is', () => {
    expect(checkWeights({ ...DEFAULT_WEIGHTS, price: 15 })).toEqual({ ok: false, total: 90, invalid: [] });
    expect(checkWeights({ ...DEFAULT_WEIGHTS, price: 35 })).toEqual({ ok: false, total: 110, invalid: [] });
  });

  it('refuses fractions, negatives, more than 100, text and blanks, and names them', () => {
    const bad = { ...DEFAULT_WEIGHTS, price: 12.5, facilities: -5, cleanliness: 101, location: '15', distance: Number.NaN };
    const check = checkWeights(bad);
    expect(check.ok).toBe(false);
    expect(check.invalid).toEqual(['price', 'facilities', 'cleanliness', 'location', 'distance']);
    expect(check.total).toBe(DEFAULT_WEIGHTS.security);
  });

  it('refuses a set with a criterion missing', () => {
    const { security, ...five } = DEFAULT_WEIGHTS;
    expect(checkWeights({ ...five, price: 37 })).toEqual({ ok: false, total: 100, invalid: ['security'] });
  });

  it('refuses a criterion it does not know', () => {
    expect(checkWeights({ ...DEFAULT_WEIGHTS, internet: 0 }).ok).toBe(false);
  });

  it('refuses something that is not a set of weights at all', () => {
    for (const value of [null, undefined, 'weights', 100, [25, 20, 15, 15, 13, 12]]) {
      expect(checkWeights(value).ok).toBe(false);
    }
  });
});

describe('the weights in use', () => {
  it('are the saved ones when they are a valid set', () => {
    expect(effectiveWeights(custom)).toEqual(custom);
  });

  it('are the defaults for anything else, without throwing', () => {
    for (const value of [null, undefined, {}, 'x', { ...custom, price: 36 }, { ...custom, extra: 1 }]) {
      expect(effectiveWeights(value)).toEqual(DEFAULT_WEIGHTS);
    }
  });

  it('come in the criteria’s order, as a copy the caller may change', () => {
    const reversed = Object.fromEntries(Object.entries(custom).reverse());
    const weights = effectiveWeights(reversed);
    expect(Object.keys(weights)).toEqual(BEST_MATCH_CRITERIA.map((criterion) => criterion.key));
    weights.price = 0;
    expect(DEFAULT_WEIGHTS.price).toBe(25);
    expect(effectiveWeights(null).price).toBe(25);
  });
});

describe('telling the defaults apart', () => {
  it('matches the defaults criterion for criterion, whatever the order', () => {
    expect(isDefault(DEFAULT_WEIGHTS)).toBe(true);
    expect(isDefault(Object.fromEntries(Object.entries(DEFAULT_WEIGHTS).reverse()))).toBe(true);
    expect(isDefault(custom)).toBe(false);
    expect(isDefault(null)).toBe(false);
  });
});
