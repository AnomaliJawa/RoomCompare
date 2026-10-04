import * as store from '../data/store.js';
import { walkingDistance, ROUTE_STATUS } from './walkingRoute.js';
import { isValidPoint } from '../utils/geo.js';
import { DISTANCE_BASIS } from '../constants.js';

/** Walks own straight-line distances in the background, one at a time, skipping a survey open in the form. */

const RETRY_MS = 10 * 60_000;
const NUDGE_MS = 2000;

let active = false;
let current = null;
/** A change came in while a pass was running, so look again once it ends. */
let again = false;
let retryTimer = null;
let nudgeTimer = null;
let unsubscribe = null;

/** The survey open in the form, which the form itself measures. */
let openSurveyId = null;

export function setOpenSurvey(id) {
  openSurveyId = id;
}

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
  // Each survey once a pass, so one with no route is not asked about over and over.
  const tried = new Set();
  for (;;) {
    if (signal.aborted || !store.getState().user) return;
    const openId = openSurveyId;
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

    // The survey may have been edited, opened or deleted while its route was fetched.
    const now = store.getState().surveys.find((s) => s.id === survey.id);
    if (!now || now.id === openSurveyId) continue;
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

// Only a change that leaves a straight line costs a request; an outage is waited out.
function onStoreChange() {
  if (retryTimer) return;
  if (!store.getState().surveys.some(needsWalking)) return;
  if (current) {
    again = true;
    return;
  }
  nudge();
}

export function start() {
  stop();
  active = true;
  unsubscribe = store.subscribe(onStoreChange);
  window.addEventListener('online', schedule);
  schedule();
}

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
