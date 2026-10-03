import { DISTANCE_BASIS } from '../constants.js';
import { distanceBetween, isValidPoint } from './geo.js';

/** Walking routes from FOSSGIS's OSRM: at most one request a second, OSM credit shown; never rejects. */

const ENDPOINT = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
const MIN_INTERVAL_MS = 1100;
const TIMEOUT_MS = 8000;

export const ROUTE_STATUS = {
  OK: 'ok',
  MISSING: 'missing',
  NO_ROUTE: 'no-route',
  UNAVAILABLE: 'unavailable',
};

/** OSRM's answers for pins it cannot route between, as opposed to a bad request. */
const NO_ROUTE_CODES = new Set(['NoRoute', 'NoSegment']);

/** Pins to result, for this session; failures are not kept, so they are retried. */
const routes = new Map();

let lastSentAt = -Infinity;

const pinKey = (point) => `${Number(point.lat).toFixed(6)},${Number(point.lng).toFixed(6)}`;
const routeKey = (from, to) => `${pinKey(from)};${pinKey(to)}`;

const toKm = (metres) => Math.round(metres / 100) / 10;

/** Only a request actually sent takes a turn, so abandoned ones do not delay the next. */
function takeTurn(signal) {
  return new Promise((resolve) => {
    let timer = null;
    const giveUp = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const attempt = () => {
      if (signal?.aborted) return giveUp();
      const wait = lastSentAt + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) {
        timer = setTimeout(attempt, wait);
        return;
      }
      lastSentAt = Date.now();
      signal?.removeEventListener('abort', giveUp);
      resolve(true);
    };
    signal?.addEventListener('abort', giveUp, { once: true });
    attempt();
  });
}

export async function walkingDistance(from, to, { signal } = {}) {
  if (!isValidPoint(from) || !isValidPoint(to)) return { status: ROUTE_STATUS.MISSING };

  const key = routeKey(from, to);
  const known = routes.get(key);
  if (known) return known;

  if (!(await takeTurn(signal))) return { status: ROUTE_STATUS.UNAVAILABLE };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const giveUp = () => controller.abort();
  signal?.addEventListener('abort', giveUp, { once: true });

  // OSRM takes longitude first.
  const url =
    `${ENDPOINT}${Number(from.lng)},${Number(from.lat)};${Number(to.lng)},${Number(to.lat)}` +
    '?overview=false&alternatives=false&steps=false';

  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    const body = await response.json().catch(() => null);

    if (response.ok && body?.code === 'Ok' && body.routes?.length) {
      const along = Number(body.routes[0].distance);
      const toTheRoad = (body.waypoints ?? []).reduce((sum, point) => sum + (Number(point.distance) || 0), 0);
      if (!Number.isFinite(along)) return { status: ROUTE_STATUS.UNAVAILABLE };
      const result = { status: ROUTE_STATUS.OK, km: toKm(along + toTheRoad) };
      routes.set(key, result);
      return result;
    }

    // A pin in the sea or far from any path: asking again will not help.
    if (NO_ROUTE_CODES.has(body?.code)) {
      const result = { status: ROUTE_STATUS.NO_ROUTE };
      routes.set(key, result);
      return result;
    }

    return { status: ROUTE_STATUS.UNAVAILABLE };
  } catch {
    return { status: ROUTE_STATUS.UNAVAILABLE };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', giveUp);
  }
}

export function knownWalkingKm(from, to) {
  if (!isValidPoint(from) || !isValidPoint(to)) return undefined;
  const known = routes.get(routeKey(from, to));
  return known?.status === ROUTE_STATUS.OK ? known.km : undefined;
}

/** Seeds a saved route, so reopening a survey neither asks again nor falls back offline. */
export function rememberWalkingKm(from, to, km) {
  if (!isValidPoint(from) || !isValidPoint(to) || !Number.isFinite(km)) return;
  routes.set(routeKey(from, to), { status: ROUTE_STATUS.OK, km });
}

/** The walking route if known for exactly these pins, else the straight line; synchronous for saving. */
export function distanceFor(from, to) {
  const straight = distanceBetween(from, to);
  if (straight === null) return { km: null, basis: null };
  const walking = knownWalkingKm(from, to);
  return walking === undefined
    ? { km: straight, basis: DISTANCE_BASIS.STRAIGHT }
    : { km: walking, basis: DISTANCE_BASIS.WALKING };
}

/** For tests: forget every route and the request timing. */
export function resetRoutes() {
  routes.clear();
  lastSentAt = -Infinity;
}
