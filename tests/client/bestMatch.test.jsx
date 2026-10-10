import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { computeBestMatch } from '../../client/src/utils/bestMatch.js';
import { AMENITY_COUNT, BEST_MATCH_CRITERIA, SURROUNDINGS, TOTAL_FACILITY_COUNT, WORSHIP_PLACES } from '../../client/src/constants.js';
import { DEFAULT_WEIGHTS } from '../../client/src/utils/weights.js';

function kos(id, over = {}) {
  return {
    id,
    kos: { name: id, rent: 1_000_000, distanceKm: 2, ...(over.kos ?? {}) },
    room: { facilities: [], cleanliness: 3, ...(over.room ?? {}) },
    bathroom: { type: null, toilet: null, waterHeater: null, ...(over.bathroom ?? {}) },
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
      bathroom: { type: 'indoor', toilet: 'sit', waterHeater: true },
      shared: { facilities: fill(6) },
      surroundings: [...SURROUNDINGS],
      additional: { security: 4 },
    });
    const worst = kos('worst', {
      kos: { rent: 2_000_000, distanceKm: 3 },
      room: { cleanliness: 1 },
      additional: { security: 1 },
    });

    const { scored } = computeBestMatch([best, worst]);

    // price 100, facilities 8 + 6 + heater + indoor = 16/21, cleanliness 100, location 100, distance 100, security 100.
    const expected = Math.round((100 * 25 + (16 / 21) * 100 * 20 + 100 * 15 + 100 * 15 + 100 * 13 + 100 * 12) / 100);
    expect(expected).toBe(95);
    expect(scored[0].total).toBe(95);
    expect(scored[1].total).toBe(0);
  });
});

describe('weights of the user’s own', () => {
  const onlyPriceAndFacilities = { price: 50, facilities: 50, cleanliness: 0, location: 0, distance: 0, security: 0 };

  it('score with the user’s percentages instead of the defaults', () => {
    const best = kos('best', { kos: { rent: 1_000_000 }, room: { facilities: fill(8) }, bathroom: { type: 'indoor', waterHeater: true }, shared: { facilities: fill(6) } });
    const worst = kos('worst', { kos: { rent: 2_000_000 } });

    const { scored } = computeBestMatch([best, worst], onlyPriceAndFacilities);

    // price 100 × 50 + facilities 16/21 × 50, over 100.
    expect(scored[0].total).toBe(Math.round((100 * 50 + (16 / 21) * 100 * 50) / 100));
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
  it('counts room and shared facilities, a working water heater and an indoor bathroom, out of 21', () => {
    expect(TOTAL_FACILITY_COUNT).toBe(21);
    const full = kos('full', { room: { facilities: fill(4) }, bathroom: { type: 'indoor', toilet: 'squat', waterHeater: true }, shared: { facilities: fill(6) } });
    const plain = kos('plain', { room: { facilities: fill(4) }, bathroom: { type: 'outdoor', toilet: 'sit', waterHeater: false }, shared: { facilities: fill(6) } });
    const { scored } = computeBestMatch([full, plain]);
    expect(scored[0].parts.facilities).toBeCloseTo((12 / TOTAL_FACILITY_COUNT) * 100, 6);
    // The toilet type is a preference, not a facility: squat and sitting score alike.
    expect(scored[1].parts.facilities).toBeCloseTo((10 / TOTAL_FACILITY_COUNT) * 100, 6);
  });

  it('counts any place of worship once among the surroundings, out of 7', () => {
    expect(AMENITY_COUNT).toBe(7);
    const faiths = kos('faiths', { kos: { distanceKm: 2 }, surroundings: [SURROUNDINGS[0], ...WORSHIP_PLACES] });
    const one = kos('one', { kos: { distanceKm: 2 }, surroundings: [SURROUNDINGS[0], WORSHIP_PLACES[2]] });
    const { scored } = computeBestMatch([faiths, one]);
    // Both are at the same distance (nearness 100) with two amenities: (100 + 2/7) / 2.
    expect(scored[0].parts.location).toBeCloseTo((100 + (2 / 7) * 100) / 2, 6);
    expect(scored[1].parts.location).toBeCloseTo(scored[0].parts.location, 6);
  });

  it('maps the 1-4 scale so that 1 scores zero, not a quarter', () => {
    const { scored } = computeBestMatch([
      kos('a', { room: { cleanliness: 1 }, additional: { security: 4 } }),
      kos('b'),
    ]);
    expect(scored[0].parts.cleanliness).toBe(0);
    expect(scored[0].parts.security).toBe(100);
  });

  it('reads Location as half nearness to campus, half surroundings', () => {
    const { scored } = computeBestMatch([
      kos('near-full', { kos: { distanceKm: 1 }, surroundings: fill(7) }),
      kos('near-empty', { kos: { distanceKm: 1 }, surroundings: fill(0) }),
      kos('far-full', { kos: { distanceKm: 3 }, surroundings: fill(7) }),
      kos('far-empty', { kos: { distanceKm: 3 }, surroundings: fill(0) }),
    ]);
    expect(scored.map((item) => item.parts.location)).toEqual([100, 50, 50, 0]);
  });

  it('ranks Location’s nearness against the set, as Distance is', () => {
    const { scored } = computeBestMatch([
      kos('a', { kos: { distanceKm: 1 } }),
      kos('b', { kos: { distanceKm: 2 } }),
      kos('c', { kos: { distanceKm: 3 } }),
    ]);
    expect(scored.map((item) => item.parts.distance)).toEqual([100, 50, 0]);
    expect(scored.map((item) => item.parts.location)).toEqual([50, 25, 0]);
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

  it('suppresses when there is no campus pin, so no distance, naming it once', () => {
    const { scored } = computeBestMatch([kos('a', { kos: { distanceKm: null } }), kos('b')]);
    expect(scored[0].total).toBeNull();
    expect(scored[0].missing).toEqual(['distance to campus']);
  });

  it('still needs the distance for Location when Distance is at 0%', () => {
    const withoutDistance = { ...DEFAULT_WEIGHTS, distance: 0, price: 38 };
    const { scored } = computeBestMatch([kos('a', { kos: { distanceKm: null } }), kos('b')], withoutDistance);
    expect(scored[0].total).toBeNull();
    expect(scored[0].missing).toEqual(['distance to campus']);
    const withoutLocationEither = { ...withoutDistance, location: 0, price: 53 };
    expect(computeBestMatch([kos('a', { kos: { distanceKm: null } }), kos('b')], withoutLocationEither).scored[0].total).not.toBeNull();
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

/** A fresh store for each render: it reads storage once, at import. `weights`, when given, are the account's own. */
async function panelFor(surveys, weights = null) {
  vi.resetModules();
  const store = await import('../../client/src/data/store.js');
  const { BestMatchPanel } = await import('../../client/src/components/compare/BestMatchPanel.jsx');
  store.setUser({ id: 'u1', email: 'a@example.test', name: 'A' });
  if (weights) store.setBestMatchWeights(weights);
  const view = render(<BestMatchPanel surveys={surveys} />);
  return { ...view, store };
}

const text = (node) => node.textContent.replace(/\s+/g, ' ').trim();
const rowsOf = (container) => [...container.querySelectorAll('[data-breakdown] tbody tr')];

beforeEach(() => localStorage.clear());

describe('the breakdown', () => {
  it('names the kos beside each score, and the weight beside the weight', async () => {
    const surveys = [kos('Kos Pelangi'), kos('Casa Hijau', { room: { cleanliness: null } })];
    const { container } = await panelFor(surveys);
    const { scored } = computeBestMatch(surveys);
    const figure = (value) => (value === null ? '—' : String(Math.round(value)));

    const rows = rowsOf(container);
    expect(rows).toHaveLength(BEST_MATCH_CRITERIA.length);
    rows.forEach((row, index) => {
      const criterion = BEST_MATCH_CRITERIA[index];
      const cells = [...row.querySelectorAll('td')].map((td) => [
        td.querySelector('[data-cell-label]').textContent,
        td.querySelector('[data-cell-value]').textContent,
      ]);
      expect(cells).toEqual([
        ['Weight:', `${criterion.defaultWeight}%`],
        ...scored.map((item) => [`${item.survey.kos.name}:`, figure(item.parts[criterion.key])]),
      ]);
    });
  });

  it('leaves naming each cell to its column header for assistive technology', async () => {
    const { container } = await panelFor([kos('Kos Pelangi'), kos('Casa Hijau')]);
    const table = container.querySelector('[data-breakdown]');

    // The narrow layout turns the table into blocks; explicit roles keep it a table.
    expect(table.getAttribute('role')).toBe('table');
    expect([...table.querySelectorAll('[role="columnheader"]')].map(text)).toEqual(['Criterion', 'Weight', 'Kos Pelangi', 'Casa Hijau']);
    expect(table.querySelectorAll('[role="rowheader"]')).toHaveLength(BEST_MATCH_CRITERIA.length);
    expect(table.querySelectorAll('[role="cell"]')).toHaveLength(BEST_MATCH_CRITERIA.length * 3);
    // So the name shown beside a figure is not read out a second time.
    for (const label of table.querySelectorAll('[data-cell-label]')) expect(label.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('the panel', () => {
  const custom = { price: 35, facilities: 20, cleanliness: 15, location: 15, distance: 15, security: 0 };

  it('shows the weights in use, and keeps a 0% criterion listed, quieter', async () => {
    const { container } = await panelFor([kos('Kos Pelangi'), kos('Casa Hijau')], custom);
    const rows = rowsOf(container);
    expect(rows).toHaveLength(BEST_MATCH_CRITERIA.length);
    expect(rows.map((row) => row.querySelector('[data-weight] [data-cell-value]').textContent)).toEqual(
      BEST_MATCH_CRITERIA.map((criterion) => `${custom[criterion.key]}%`),
    );
    const off = rows.filter((row) => row.dataset.off === 'true');
    expect(off.map((row) => text(row.querySelector('th')))).toEqual(['Security']);
  });

  it('says whose weights they are, and offers to change them', async () => {
    const first = await panelFor([kos('a'), kos('b')]);
    expect(text(first.container.querySelector('[data-best-match-note]'))).toContain('The weights are the defaults.');
    const edit = screen.getByRole('button', { name: 'Edit criteria' });
    expect(edit.getAttribute('aria-haspopup')).toBe('dialog');
    first.unmount();

    const own = await panelFor([kos('a'), kos('b')], custom);
    const note = text(own.container.querySelector('[data-best-match-note]'));
    expect(note).toContain('The weights are your own.');
    expect(note).not.toMatch(/fixed/i);
  });

  it('starts closed, under its plain title', async () => {
    const { container } = await panelFor([kos('a'), kos('b')]);
    const panel = container.querySelector('details');
    expect(panel.open).toBe(false);
    expect(text(panel.querySelector('summary'))).toBe('Optional: weighted score A guide, not a recommendation. The decision stays yours.');
  });

  it('stays open when new weights change what it shows', async () => {
    const { container, store } = await panelFor([kos('Kos Pelangi'), kos('Casa Hijau', { room: { cleanliness: 4 } })]);
    const panel = container.querySelector('details');
    panel.open = true;
    fireEvent(panel, new Event('toggle'));
    store.setBestMatchWeights(custom);
    await screen.findByText(/The weights are your own/);
    expect(container.querySelector('details').open).toBe(true);
  });

  it('marks every tied leader, and says the tie aloud', async () => {
    const { container } = await panelFor([kos('Kos Pelangi'), kos('Casa Hijau')]);
    expect(screen.getAllByText('Best match')).toHaveLength(2);
    expect(text(container.querySelector('[data-best-match-note]'))).toContain('Two kos scored the same, so both are marked.');
  });

  it('says which input is missing instead of scoring a kos at zero', async () => {
    await panelFor([kos('Kos Pelangi'), kos('Casa Hijau', { additional: { security: null } })]);
    expect(screen.getByText('Score unavailable — security not recorded')).toBeTruthy();
  });
});
