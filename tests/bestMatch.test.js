import { describe, it, expect } from 'vitest';
import { computeBestMatch } from '../src/features/bestMatch.js';
import { BEST_MATCH_WEIGHTS, TOTAL_FACILITY_COUNT, SURROUNDINGS } from '../src/constants.js';

function kos(id, over = {}) {
  return {
    id,
    kos: { name: id, rent: 1_000_000, distanceKm: 2, ...(over.kos ?? {}) },
    room: { facilities: [], cleanliness: 3, ...(over.room ?? {}) },
    bathroom: { facilities: [], ...(over.bathroom ?? {}) },
    shared: { facilities: [], ...(over.shared ?? {}) },
    surroundings: over.surroundings ?? [],
    additional: { security: 3, ...(over.additional ?? {}) },
  };
}

const fill = (n) => new Array(n).fill('x');

describe('weights', () => {
  it('sum to exactly one, or every total is wrong', () => {
    const sum = BEST_MATCH_WEIGHTS.reduce((total, c) => total + c.weight, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('match the figures the requirement fixes', () => {
    expect(Object.fromEntries(BEST_MATCH_WEIGHTS.map((c) => [c.key, c.weight]))).toEqual({
      price: 0.25,
      facilities: 0.2,
      cleanliness: 0.15,
      location: 0.15,
      distance: 0.13,
      security: 0.12,
    });
  });
});

describe('the weighted total', () => {
  it('matches a hand computation', () => {
    const best = kos('best', {
      kos: { rent: 1_000_000, distanceKm: 1 },
      room: { facilities: fill(8), cleanliness: 4 },
      bathroom: { facilities: fill(4) },
      shared: { facilities: fill(6) },
      surroundings: fill(SURROUNDINGS.length),
      additional: { security: 4 },
    });
    const worst = kos('worst', {
      kos: { rent: 2_000_000, distanceKm: 3 },
      room: { cleanliness: 1 },
      additional: { security: 1 },
    });

    const { scored } = computeBestMatch([best, worst]);

    // price 100, facilities 18/24 = 75, cleanliness 100, location 100,
    // distance 100, security 100.
    const expected = Math.round(100 * 0.25 + 75 * 0.2 + 100 * 0.15 + 100 * 0.15 + 100 * 0.13 + 100 * 0.12);
    expect(expected).toBe(95);
    expect(scored[0].total).toBe(95);
    expect(scored[1].total).toBe(0);
  });
});

describe('sub-scores', () => {
  it('counts facilities across all three sections', () => {
    const a = kos('a', { room: { facilities: fill(4) }, bathroom: { facilities: fill(2) }, shared: { facilities: fill(6) } });
    const { scored } = computeBestMatch([a, kos('b')]);
    expect(scored[0].parts.facilities).toBeCloseTo((12 / TOTAL_FACILITY_COUNT) * 100, 6);
  });

  it('maps the 1-4 scale so that 1 scores zero, not a quarter', () => {
    const { scored } = computeBestMatch([
      kos('a', { room: { cleanliness: 1 }, additional: { security: 4 } }),
      kos('b'),
    ]);
    expect(scored[0].parts.cleanliness).toBe(0);
    expect(scored[0].parts.security).toBe(100);
  });

  it('reads Location as recorded surroundings', () => {
    const { scored } = computeBestMatch([kos('a', { surroundings: fill(7) }), kos('b', { surroundings: fill(0) })]);
    expect(scored[0].parts.location).toBe(100);
    expect(scored[1].parts.location).toBe(0);
  });

  it('treats an empty facility list as a recorded zero, not as missing', () => {
    const { scored } = computeBestMatch([kos('a'), kos('b')]);
    expect(scored[0].parts.facilities).toBe(0);
    expect(scored[0].total).not.toBeNull();
  });
});

describe('relative criteria', () => {
  it('gives every kos full marks when the values are identical', () => {
    const { scored } = computeBestMatch([kos('a'), kos('b')]);
    expect(scored[0].parts.price).toBe(100);
    expect(scored[1].parts.price).toBe(100);
  });

  it('scores against the set, so the same kos ranks differently in other company', () => {
    const target = kos('target', { kos: { rent: 900_000 } });
    const againstDearer = computeBestMatch([target, kos('rival', { kos: { rent: 3_000_000 } })]);
    const againstCheaper = computeBestMatch([target, kos('rival', { kos: { rent: 400_000 } })]);
    expect(againstDearer.scored[0].parts.price).toBe(100);
    expect(againstCheaper.scored[0].parts.price).toBe(0);
  });

  it('treats nearer as better for distance', () => {
    const { scored } = computeBestMatch([
      kos('near', { kos: { distanceKm: 0.5 } }),
      kos('far', { kos: { distanceKm: 5 } }),
    ]);
    expect(scored[0].parts.distance).toBe(100);
    expect(scored[1].parts.distance).toBe(0);
  });
});

describe('missing data', () => {
  it('suppresses that total rather than scoring zero', () => {
    const { scored } = computeBestMatch([kos('a', { room: { cleanliness: null } }), kos('b')]);
    expect(scored[0].total).toBeNull();
    expect(scored[0].missing).toEqual(['cleanliness']);
  });

  it('leaves the other kos scored', () => {
    const { scored } = computeBestMatch([kos('a', { kos: { rent: null } }), kos('b')]);
    expect(scored[0].total).toBeNull();
    expect(scored[1].total).not.toBeNull();
  });

  it('names every missing input', () => {
    const { scored } = computeBestMatch([
      kos('a', { kos: { rent: null }, additional: { security: null } }),
      kos('b'),
    ]);
    expect(scored[0].missing).toEqual(expect.arrayContaining(['monthly rent', 'security']));
  });

  it('suppresses when there is no campus pin, so no distance', () => {
    const { scored } = computeBestMatch([kos('a', { kos: { distanceKm: null } }), kos('b')]);
    expect(scored[0].total).toBeNull();
    expect(scored[0].missing).toEqual(['distance to campus']);
  });

  it('excludes a scoreless kos from the leaders', () => {
    const { leaders } = computeBestMatch([kos('a', { room: { cleanliness: null } }), kos('b')]);
    expect(leaders).toEqual(['b']);
  });
});

describe('leaders', () => {
  it('marks both when two tie exactly', () => {
    const { scored, leaders } = computeBestMatch([kos('a'), kos('b')]);
    expect(scored[0].total).toBe(scored[1].total);
    expect(leaders).toEqual(['a', 'b']);
  });

  it('marks one when there is a clear winner', () => {
    const { leaders } = computeBestMatch([
      kos('a', { room: { cleanliness: 4 }, additional: { security: 4 }, surroundings: fill(7) }),
      kos('b', { room: { cleanliness: 1 }, additional: { security: 1 } }),
    ]);
    expect(leaders).toEqual(['a']);
  });

  it('has no leader when nothing can be scored', () => {
    const { leaders, best } = computeBestMatch([
      kos('a', { room: { cleanliness: null } }),
      kos('b', { additional: { security: null } }),
    ]);
    expect(leaders).toEqual([]);
    expect(best).toBeNull();
  });
});
