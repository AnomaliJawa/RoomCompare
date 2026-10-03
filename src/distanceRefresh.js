import * as store from './store.js';
import { walkingDistance, ROUTE_STATUS } from './utils/route.js';
import { isValidPoint } from './utils/geo.js';
import { DISTANCE_BASIS } from './constants.js';

/**
 * Brings the account's straight-line distances up to walking routes.
 *
 * Distances were straight lines until 2026-10-03, and a survey saved while
 * the routing service could not be reached still has one. At the user's
 * request they are replaced without anyone editing them: once the account's
 * surveys are on screen, whenever the browser comes back online, and soon
 * after a change that leaves a straight line, each such survey is routed in
 * turn — utils/route.js keeps requests a second apart, as the service asks —
 * and its distance updated. sync.js sends that to the account like any other
 * change.
 *
 * A survey open in the form is left alone: the form measures its own route,
 * and Cancel there promises the stored record is untouched. A route is
 * applied only while the survey still has the pins it was measured for. When
 * the service cannot be reached, the pass stops and tries again once the
 * browser is back online, or after a while.
 */

const RETRY_MS = 10 * 60_000;
const NUDGE_MS = 2000;

let active = false;
let current = null;
/** A change came in while a pass was running, so look again once it ends. */
let again = false;
let retryTimer = null;
let nudgeTimer = null;
let unsubscribe = null;

const openFormSurveyId = () => document.querySelector('#survey-form')?.dataset.surveyId ?? null;

function needsWalking(survey) {
  const kos = survey?.kos;
  return (
    Boolean(kos) &&
    kos.distanceBasis !== DISTANCE_BASIS.WALKING &&
    isValidPoint(kos.kosLocation) &&
    isValidPoint(kos.campusLocation)
  );
}

const samePin = (a, b) => Number(a?.lat) === Number(b?.lat) && Number(a?.lng) === Number(b?.lng);

async function pass(signal) {
  // Each survey once a pass, so one with no walking route between its pins
  // is not asked about over and over.
  const tried = new Set();
  for (;;) {
    if (signal.aborted || !store.getState().user) return;
    const openId = openFormSurveyId();
    const survey = store.getState().surveys.find((s) => needsWalking(s) && s.id !== openId && !tried.has(s.id));
    if (!survey) return;
    tried.add(survey.id);

    const { kosLocation, campusLocation } = survey.kos;
    const result = await walkingDistance(kosLocation, campusLocation, { signal });
    if (signal.aborted) return;
    if (result.status === ROUTE_STATUS.UNAVAILABLE) {
      retryTimer = setTimeout(schedule, RETRY_MS);
      return;
    }
    if (result.status !== ROUTE_STATUS.OK) continue;

    // The survey may have been edited, opened or deleted while its route was
    // being fetched.
    const now = store.getState().surveys.find((s) => s.id === survey.id);
    if (!now || now.id === openFormSurveyId()) continue;
    if (!samePin(now.kos?.kosLocation, kosLocation) || !samePin(now.kos?.campusLocation, campusLocation)) continue;
    store.setWalkingDistance(survey.id, result.km);
  }
}

function schedule() {
  clearTimeout(retryTimer);
  retryTimer = null;
  clearTimeout(nudgeTimer);
  nudgeTimer = null;
  if (!active || current) return;
  const run = { controller: new AbortController() };
  current = run;
  again = false;
  pass(run.controller.signal).finally(() => {
    if (current !== run) return;
    current = null;
    if (again && active && !retryTimer) nudge();
  });
}

function nudge() {
  clearTimeout(nudgeTimer);
  nudgeTimer = setTimeout(schedule, NUDGE_MS);
}

// A survey saved while the route could not be measured arrives as a store
// change, as does a pin moved while its old route was being measured. Most
// changes are neither, and cost nothing: no request is made unless some
// survey still has a straight line. While an outage is being waited out,
// changes do not cut the wait short.
function onStoreChange() {
  if (retryTimer) return;
  if (!store.getState().surveys.some(needsWalking)) return;
  if (current) {
    again = true;
    return;
  }
  nudge();
}

/** Begin, for the account whose surveys are now on screen. */
export function start() {
  stop();
  active = true;
  unsubscribe = store.subscribe(onStoreChange);
  window.addEventListener('online', schedule);
  schedule();
}

/** Stop, at logout or when the session ends. A route being fetched is abandoned. */
export function stop() {
  active = false;
  current?.controller.abort();
  current = null;
  again = false;
  clearTimeout(retryTimer);
  retryTimer = null;
  clearTimeout(nudgeTimer);
  nudgeTimer = null;
  unsubscribe?.();
  unsubscribe = null;
  window.removeEventListener('online', schedule);
}
