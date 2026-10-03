import { describe, it, expect } from 'vitest';
import { computeBestMatch, bestMatchPanel } from '../src/features/bestMatch.js';
import { BEST_MATCH_CRITERIA, TOTAL_FACILITY_COUNT, SURROUNDINGS } from '../src/constants.js';
import { DEFAULT_WEIGHTS } from '../src/utils/weights.js';

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

describe('the default weights', () => {
  it('total exactly 100, or every total is wrong', () => {
    const sum = BEST_MATCH_CRITERIA.reduce((total, c) => total + c.defaultWeight, 0);
    expect(sum).toBe(100);
  });

  it('are the figures the requirement gives', () => {
    expect(DEFAULT_WEIGHTS).toEqual({
      price: 25,
      facilities: 20,
      cleanliness: 15,
      location: 15,
      distance: 13,
      security: 12,
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

    // price 100, facilities 18/24 = 75, cleanliness 100, location 100, distance 100, security 100.
    const expected = Math.round((100 * 25 + 75 * 20 + 100 * 15 + 100 * 15 + 100 * 13 + 100 * 12) / 100);
    expect(expected).toBe(95);
    expect(scored[0].total).toBe(95);
    expect(scored[1].total).toBe(0);
  });
});

describe('weights of the user’s own', () => {
  const onlyPriceAndFacilities = { price: 50, facilities: 50, cleanliness: 0, location: 0, distance: 0, security: 0 };

  it('score with the user’s percentages instead of the defaults', () => {
    const best = kos('best', { kos: { rent: 1_000_000 }, room: { facilities: fill(8) }, bathroom: { facilities: fill(4) }, shared: { facilities: fill(6) } });
    const worst = kos('worst', { kos: { rent: 2_000_000 } });

    const { scored } = computeBestMatch([best, worst], onlyPriceAndFacilities);

    // price 100 × 50 + facilities 75 × 50, over 100.
    expect(scored[0].total).toBe(Math.round((100 * 50 + 75 * 50) / 100));
    expect(scored[0].total).toBe(88);
    expect(scored[1].total).toBe(0);
  });

  it('leave a criterion at 0% out, so its missing data no longer blocks a score', () => {
    const unrated = kos('unrated', { additional: { security: null } });
    expect(computeBestMatch([unrated, kos('b')]).scored[0].total).toBeNull();

    const withoutSecurity = { ...DEFAULT_WEIGHTS, security: 0, price: 37 };
    const { scored } = computeBestMatch([unrated, kos('b')], withoutSecurity);
    expect(scored[0].total).not.toBeNull();
    expect(scored[0].missing).toEqual([]);
    // The sub-score is still worked out where it can be; it is only not counted.
    expect(scored[0].parts.security).toBeNull();
  });

  it('still name what is missing among the criteria that count', () => {
    const withoutSecurity = { ...DEFAULT_WEIGHTS, security: 0, price: 37 };
    const { scored } = computeBestMatch(
      [kos('a', { kos: { rent: null }, additional: { security: null } }), kos('b')],
      withoutSecurity,
    );
    expect(scored[0].total).toBeNull();
    expect(scored[0].missing).toEqual(['monthly rent']);
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

describe('the breakdown', () => {
  it('names the kos beside each score, and the weight beside the weight', () => {
    const surveys = [kos('Kos Pelangi'), kos('Casa Hijau', { room: { cleanliness: null } })];
    document.body.innerHTML = String(bestMatchPanel(surveys));
    const { scored } = computeBestMatch(surveys);
    const figure = (value) => (value === null ? '—' : String(Math.round(value)));

    const rows = [...document.querySelectorAll('.bestmatch__table tbody tr')];
    expect(rows).toHaveLength(BEST_MATCH_CRITERIA.length);
    rows.forEach((row, index) => {
      const criterion = BEST_MATCH_CRITERIA[index];
      const cells = [...row.querySelectorAll('td')].map((td) => [
        td.querySelector('.ledger__cell-label').textContent,
        td.querySelector('.ledger__cell-value').textContent,
      ]);
      expect(cells).toEqual([
        ['Weight:', `${criterion.defaultWeight}%`],
        ...scored.map((item) => [`${item.survey.kos.name}:`, figure(item.parts[criterion.key])]),
      ]);
    });
  });

  it('leaves naming each cell to its column header for assistive technology', () => {
    document.body.innerHTML = String(bestMatchPanel([kos('Kos Pelangi'), kos('Casa Hijau')]));
    const table = document.querySelector('.bestmatch__table');

    // The narrow layout turns the table into blocks; explicit roles keep it a table.
    expect(table.getAttribute('role')).toBe('table');
    expect([...table.querySelectorAll('[role="columnheader"]')].map((th) => th.textContent.trim())).toEqual([
      'Criterion',
      'Weight',
      'Kos Pelangi',
      'Casa Hijau',
    ]);
    expect(table.querySelectorAll('[role="rowheader"]')).toHaveLength(BEST_MATCH_CRITERIA.length);
    expect(table.querySelectorAll('[role="cell"]')).toHaveLength(BEST_MATCH_CRITERIA.length * 3);
    // So the name shown beside a figure is not read out a second time.
    for (const label of table.querySelectorAll('.ledger__cell-label')) {
      expect(label.getAttribute('aria-hidden')).toBe('true');
    }
  });
});

describe('the panel', () => {
  const custom = { price: 35, facilities: 20, cleanliness: 15, location: 15, distance: 15, security: 0 };
  const text = (node) => node.textContent.replace(/\s+/g, ' ').trim();

  it('shows the weights in use, and keeps a 0% criterion listed, quieter', () => {
    document.body.innerHTML = String(bestMatchPanel([kos('Kos Pelangi'), kos('Casa Hijau')], custom));
    const rows = [...document.querySelectorAll('.bestmatch__table tbody tr')];
    expect(rows).toHaveLength(BEST_MATCH_CRITERIA.length);
    expect(rows.map((row) => row.querySelector('.bestmatch__weight .ledger__cell-value').textContent)).toEqual(
      BEST_MATCH_CRITERIA.map((criterion) => `${custom[criterion.key]}%`),
    );
    const off = rows.filter((row) => row.classList.contains('bestmatch__row--off'));
    expect(off.map((row) => text(row.querySelector('th')))).toEqual(['Security']);
  });

  it('says whose weights they are, and offers to change them', () => {
    document.body.innerHTML = String(bestMatchPanel([kos('a'), kos('b')], DEFAULT_WEIGHTS));
    expect(text(document.querySelector('.bestmatch__note'))).toContain('The weights are the defaults.');
    const edit = document.querySelector('.bestmatch [data-action="open-criteria"]');
    expect(text(edit)).toBe('Edit criteria');
    expect(edit.getAttribute('aria-haspopup')).toBe('dialog');

    document.body.innerHTML = String(bestMatchPanel([kos('a'), kos('b')], custom));
    expect(text(document.querySelector('.bestmatch__note'))).toContain('The weights are your own.');
    expect(text(document.querySelector('.bestmatch__note'))).not.toMatch(/fixed/i);
  });

  it('starts closed, and marks itself to be kept open across a re-render', () => {
    document.body.innerHTML = String(bestMatchPanel([kos('a'), kos('b')], DEFAULT_WEIGHTS));
    const panel = document.querySelector('details.bestmatch');
    expect(panel.open).toBe(false);
    expect(panel.dataset.keepOpen).toBe('bestmatch');
    expect(text(panel.querySelector('.bestmatch__summary-title'))).toBe('Optional: weighted score');
  });
});
