import { DISTANCE_BASIS } from '../constants.js';
import { distanceBetween, isValidPoint } from './geo.js';

/**
 * Walking distance along the road, via the FOSSGIS routing service.
 *
 * routing.openstreetmap.de runs OSRM over OpenStreetMap data with a foot
 * profile, the same service openstreetmap.org's own directions use. It needs
 * no API key and no billing account, and answers browsers on any origin.
 *
 * Its usage policy asks for at most one request a second, no heavy use, and
 * the OpenStreetMap attribution with a link to fix the map. The survey form
 * shows the attribution under the distance. The "Fix the map" link beside it
 * was removed at the user's request (2026-10-03), told the policy asks for
 * it. Requests are kept apart here, whoever makes them, and a pair of pins is
 * only ever routed once a session.
 *
 * The distance is the route along roads and paths plus the short walk from
 * each pin to the nearest of them, so a pin on a doorstep set back from the
 * street still counts the steps out to it.
 *
 * Every failure resolves rather than throwing. Recording a survey must never
 * depend on a third party: without a route, the straight line between the
 * pins is used instead, and saved as such.
 */

const ENDPOINT = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
const MIN_INTERVAL_MS = 1100;
const TIMEOUT_MS = 8000;

export const ROUTE_STATUS = {
  OK: 'ok',
  /** A pin is not set, so there is nothing to route. */
  MISSING: 'missing',
  /** The service answered: there is no walking route between these pins. */
  NO_ROUTE: 'no-route',
  /** Offline, blocked, too slow, refused, or abandoned by the caller. */
  UNAVAILABLE: 'unavailable',
};

/** OSRM's answers for pins it cannot route between, as opposed to a bad request. */
const NO_ROUTE_CODES = new Set(['NoRoute', 'NoSegment']);

/** Pins → result, for this session. Failures are not kept, so they are retried. */
const routes = new Map();

let lastSentAt = -Infinity;

const pinKey = (point) => `${Number(point.lat).toFixed(6)},${Number(point.lng).toFixed(6)}`;
const routeKey = (from, to) => `${pinKey(from)};${pinKey(to)}`;

/** Rounded to one decimal, the precision the interface displays. */
const toKm = (metres) => Math.round(metres / 100) / 10;

/**
 * Wait for this request's turn, so requests leave at least MIN_INTERVAL_MS
 * apart. Resolves false if the caller gave up while waiting.
 *
 * Only a request actually sent takes a turn. Reserving one per caller let a
 * burst of abandoned requests — a pin dragged about, coordinates typed — push
 * the one that mattered seconds back.
 */
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

/**
 * The walking distance between two pins, in kilometres.
 * Resolves { status, km } — km only when the status is OK. Never rejects.
 */
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
    // Aborted, offline, or blocked — all the same to the caller.
    return { status: ROUTE_STATUS.UNAVAILABLE };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', giveUp);
  }
}

/** The walking distance already known for these pins this session, or undefined. */
export function knownWalkingKm(from, to) {
  if (!isValidPoint(from) || !isValidPoint(to)) return undefined;
  const known = routes.get(routeKey(from, to));
  return known?.status === ROUTE_STATUS.OK ? known.km : undefined;
}

/**
 * Remember a walking distance measured earlier for these pins — the one a
 * survey was saved with — so reopening it neither asks the service again nor,
 * offline, falls back to the straight line.
 */
export function rememberWalkingKm(from, to, km) {
  if (!isValidPoint(from) || !isValidPoint(to) || !Number.isFinite(km)) return;
  routes.set(routeKey(from, to), { status: ROUTE_STATUS.OK, km });
}

/**
 * The distance to save for two pins, and how it was measured: the walking
 * route when it is known for exactly these pins, the straight line otherwise.
 * Synchronous, so a survey can be saved the moment it is asked to be, and
 * keyed by the pins, so the saved distance can never belong to other ones.
 */
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
