import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  walkingDistance,
  knownWalkingKm,
  rememberWalkingKm,
  distanceFor,
  resetRoutes,
  ROUTE_STATUS,
} from '../src/utils/route.js';

const KOS = { lat: -7.9391, lng: 112.6167 };
const CAMPUS = { lat: -7.9526, lng: 112.6148 };
const ELSEWHERE = { lat: -7.9487, lng: 112.6077 };

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const routed = (metres, snaps = [0, 0]) =>
  reply(200, { code: 'Ok', routes: [{ distance: metres }], waypoints: snaps.map((distance) => ({ distance })) });

function serve(...replies) {
  const fetch = vi.fn();
  replies.forEach((value) => (value instanceof Error ? fetch.mockRejectedValueOnce(value) : fetch.mockResolvedValueOnce(value)));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/** A connection that stays open until the request gives up on it. */
const neverSettles = (url, { signal }) =>
  new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
  });

beforeEach(() => resetRoutes());

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the walking distance between two pins', () => {
  it('asks the FOSSGIS foot router, longitude first, for the route alone', async () => {
    const fetch = serve(routed(4204.8, [113, 16.8]));
    const result = await walkingDistance(KOS, CAMPUS);

    expect(fetch.mock.calls[0][0]).toBe(
      'https://routing.openstreetmap.de/routed-foot/route/v1/foot/112.6167,-7.9391;112.6148,-7.9526' +
        '?overview=false&alternatives=false&steps=false',
    );
    // The route, plus the walk from each pin out to the road, to one decimal.
    expect(result).toEqual({ status: ROUTE_STATUS.OK, km: 4.3 });
  });

  it('routes a pair of pins once a session, however their numbers are written', async () => {
    const fetch = serve(routed(1000));
    await walkingDistance(KOS, CAMPUS);
    expect(await walkingDistance({ lat: '-7.939100', lng: '112.6167' }, CAMPUS)).toEqual({ status: ROUTE_STATUS.OK, km: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(knownWalkingKm(KOS, CAMPUS)).toBe(1);
  });

  it('measures nothing until both pins are set', async () => {
    const fetch = serve();
    expect(await walkingDistance(KOS, { lat: '', lng: '' })).toEqual({ status: ROUTE_STATUS.MISSING });
    expect(await walkingDistance(null, CAMPUS)).toEqual({ status: ROUTE_STATUS.MISSING });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('says when there is no walking route between the pins, and does not ask again', async () => {
    const fetch = serve(reply(400, { code: 'NoSegment', message: 'Could not find a matching segment.' }));
    expect(await walkingDistance(KOS, CAMPUS)).toEqual({ status: ROUTE_STATUS.NO_ROUTE });
    expect(await walkingDistance(KOS, CAMPUS)).toEqual({ status: ROUTE_STATUS.NO_ROUTE });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(knownWalkingKm(KOS, CAMPUS)).toBeUndefined();
  });

  it('treats offline, a refusal and an odd answer alike, as unavailable, and asks again next time', async () => {
    vi.useFakeTimers();
    const fetch = serve(new TypeError('Failed to fetch'), reply(429, null), reply(200, { code: 'InvalidQuery' }), routed(2000));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const pending = walkingDistance(KOS, CAMPUS);
      await vi.advanceTimersByTimeAsync(1100);
      expect(await pending).toEqual({ status: ROUTE_STATUS.UNAVAILABLE });
    }
    const pending = walkingDistance(KOS, CAMPUS);
    await vi.advanceTimersByTimeAsync(1100);
    expect(await pending).toEqual({ status: ROUTE_STATUS.OK, km: 2 });
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('gives up on a route that takes longer than 8 seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(neverSettles));
    const pending = walkingDistance(KOS, CAMPUS);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toEqual({ status: ROUTE_STATUS.UNAVAILABLE });
  });

  // The service's usage policy: one request a second at most.
  it('keeps requests more than a second apart', async () => {
    vi.useFakeTimers();
    const fetch = serve(routed(1000), routed(2000));
    const first = walkingDistance(KOS, CAMPUS);
    const second = walkingDistance(ELSEWHERE, CAMPUS);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1099);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((await first).km).toBe(1);
    expect((await second).km).toBe(2);
  });

  it('sends nothing for a request abandoned while it waits, and does not delay the next for it', async () => {
    vi.useFakeTimers();
    const fetch = serve(routed(1000), routed(3000));
    await walkingDistance(KOS, CAMPUS);

    const controller = new AbortController();
    const abandoned = walkingDistance(ELSEWHERE, CAMPUS, { signal: controller.signal });
    controller.abort();
    expect(await abandoned).toEqual({ status: ROUTE_STATUS.UNAVAILABLE });

    const next = walkingDistance({ lat: -7.96, lng: 112.62 }, CAMPUS);
    await vi.advanceTimersByTimeAsync(1100);
    expect(await next).toEqual({ status: ROUTE_STATUS.OK, km: 3 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('the distance a survey is saved with', () => {
  it('is the walking route when one is known for exactly these pins', () => {
    rememberWalkingKm(KOS, CAMPUS, 4.3);
    expect(distanceFor(KOS, CAMPUS)).toEqual({ km: 4.3, basis: 'walking' });
  });

  it('is the straight line, saying so, when no route is known for these pins', () => {
    expect(distanceFor(KOS, CAMPUS)).toEqual({ km: 1.5, basis: 'straight' });
    rememberWalkingKm(ELSEWHERE, CAMPUS, 1.9);
    expect(distanceFor(KOS, CAMPUS).basis).toBe('straight');
  });

  it('is nothing without both pins', () => {
    expect(distanceFor(KOS, null)).toEqual({ km: null, basis: null });
    expect(distanceFor({ lat: null, lng: null }, CAMPUS)).toEqual({ km: null, basis: null });
  });
});
