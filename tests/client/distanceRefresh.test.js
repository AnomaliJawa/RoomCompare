import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const CAMPUS = { lat: -7.9526, lng: 112.6148, label: 'Universitas Brawijaya' };

const survey = (id, kos = {}) => ({
  id,
  ownerId: 'u1',
  status: 'published',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  kos: {
    name: id,
    kosLocation: { lat: -7.9391, lng: 112.6167, label: 'Lowokwaru, Malang' },
    campusLocation: CAMPUS,
    distanceKm: 1.5,
    rent: 1_500_000,
    ...kos,
  },
  room: { facilities: [], photoIds: [] },
  bathroom: { facilities: [], photoIds: [] },
  shared: { facilities: [], photoIds: [] },
  surroundings: [],
  additional: { security: null, notes: '', videoIds: [] },
});

const routed = (metres) => ({
  ok: true,
  status: 200,
  json: async () => ({ code: 'Ok', routes: [{ distance: metres }], waypoints: [{ distance: 0 }, { distance: 0 }] }),
});

/** Fresh modules for each test: the store reads storage once, at import. */
async function load(surveys, fetch) {
  vi.resetModules();
  vi.stubGlobal('fetch', fetch);
  const store = await import('../../client/src/data/store.js');
  const refresh = await import('../../client/src/services/distanceRefresh.js');
  store.setUser({ id: 'u1', name: 'Rahma', email: 'rahma@example.com' });
  store.adoptSurveys(structuredClone(surveys), 'u1');
  return { store, refresh, find: (id) => store.getState().surveys.find((s) => s.id === id) };
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('bringing old distances up to walking routes', () => {
  it('walks each straight-line distance in turn, a second apart, and leaves the rest alone', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(routed(4300)).mockResolvedValueOnce(routed(2900));
    const { refresh, find } = await load(
      [
        survey('svy-old'),
        survey('svy-fallback', { distanceBasis: 'straight', kosLocation: { lat: -7.9333, lng: 112.6 } }),
        survey('svy-walked', { distanceKm: 2.8, distanceBasis: 'walking' }),
        survey('svy-no-campus', { campusLocation: null, distanceKm: null }),
      ],
      fetch,
    );

    refresh.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(find('svy-old').kos).toMatchObject({ distanceKm: 4.3, distanceBasis: 'walking' });
    expect(fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1100);
    expect(find('svy-fallback').kos).toMatchObject({ distanceKm: 2.9, distanceBasis: 'walking' });
    expect(fetch).toHaveBeenCalledTimes(2);

    expect(find('svy-walked').kos.distanceKm).toBe(2.8);
    expect(find('svy-no-campus').kos.distanceKm).toBeNull();
    // Not an edit: the dashboard's order by last update stays put.
    expect(find('svy-old').updatedAt).toBe('2026-09-01T08:00:00.000Z');
    refresh.stop();
  });

  it('leaves alone a survey open in the form, whose record Cancel promises not to touch', async () => {
    const fetch = vi.fn().mockResolvedValue(routed(4300));
    const { refresh, find } = await load([survey('svy-open')], fetch);
    refresh.setOpenSurvey('svy-open');

    refresh.start();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).not.toHaveBeenCalled();
    expect(find('svy-open').kos.distanceBasis).toBeUndefined();
    refresh.stop();
  });

  it('waits out an unreachable service, and goes again when the browser is back online', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(routed(4300));
    const { store, refresh, find } = await load([survey('svy-old')], fetch);

    refresh.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(find('svy-old').kos.distanceBasis).toBeUndefined();

    // Other changes do not cut the wait short.
    store.toggleStar('com-kartika');
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(1100);
    expect(find('svy-old').kos).toMatchObject({ distanceKm: 4.3, distanceBasis: 'walking' });
    refresh.stop();
  });

  it('does not put a route on pins that moved while it was being measured', async () => {
    let answer;
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
      .mockResolvedValueOnce(routed(5200));
    const { store, refresh, find } = await load([survey('svy-moving')], fetch);

    refresh.start();
    await vi.advanceTimersByTimeAsync(0);
    const moved = { ...find('svy-moving').kos, kosLocation: { lat: -7.9302, lng: 112.6221, label: 'Blimbing, Malang' } };
    store.updateSurvey('svy-moving', { kos: moved });
    answer(routed(4300));
    await vi.advanceTimersByTimeAsync(0);
    expect(find('svy-moving').kos.distanceBasis).toBeUndefined();

    // The move was itself a change with a straight line in it, so the new pins are walked soon after.
    await vi.advanceTimersByTimeAsync(3000);
    expect(find('svy-moving').kos).toMatchObject({ distanceKm: 5.2, distanceBasis: 'walking' });
    refresh.stop();
  });

  it('stops at logout', async () => {
    const fetch = vi.fn().mockResolvedValue(routed(4300));
    const { refresh } = await load([survey('svy-a'), survey('svy-b', { kosLocation: { lat: -7.93, lng: 112.6 } })], fetch);

    refresh.start();
    await vi.advanceTimersByTimeAsync(0);
    refresh.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
