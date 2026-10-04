import * as api from './api.js';
import * as store from '../data/store.js';
import * as storage from '../data/localStore.js';

/** Recording never waits on the network: changes queue in localStorage and are sent after. */

const QUEUE_PREFIX = 'roomcompare:v1:pending:';
const RETRY_MS = 15_000;

const OFFLINE_NOTICE =
  'You’re offline. Changes are saved on this device and will reach your account when you reconnect.';

let account = null;
/** Survey id → the JSON the server was last told. */
let told = new Map();
/** Survey id → { op: 'put', survey } | { op: 'delete' }, oldest first. */
let pending = new Map();
let unsubscribe = null;
let running = null;
let retryTimer = null;
let sessionEnded = () => {};

const queueKey = (userId) => `${QUEUE_PREFIX}${userId}`;

function loadQueue(userId) {
  try {
    const raw = window.localStorage.getItem(queueKey(userId));
    return new Map(raw ? JSON.parse(raw) : []);
  } catch {
    return new Map();
  }
}

function saveQueue() {
  if (!account) return;
  try {
    if (pending.size) window.localStorage.setItem(queueKey(account.id), JSON.stringify([...pending]));
    else window.localStorage.removeItem(queueKey(account.id));
  } catch {
    // The queue is also in memory; the store reports storage failures itself.
  }
}

function capture() {
  if (!account) return false;
  let queued = false;
  const present = new Set();
  for (const survey of store.getState().surveys) {
    present.add(survey.id);
    const json = JSON.stringify(survey);
    if (told.get(survey.id) === json) continue;
    told.set(survey.id, json);
    // Re-inserting moves the survey to the back: the latest change goes last.
    pending.delete(survey.id);
    pending.set(survey.id, { op: 'put', survey: JSON.parse(json) });
    queued = true;
  }
  for (const id of [...told.keys()]) {
    if (present.has(id)) continue;
    told.delete(id);
    pending.delete(id);
    pending.set(id, { op: 'delete' });
    queued = true;
  }
  if (queued) saveQueue();
  return queued;
}

// Most store notifications are not survey changes and must not cost a request.
function onStoreChange() {
  if (capture()) flush();
}

/** One flush at a time; callers share it. */
export function flush() {
  if (!running) running = send().finally(() => { running = null; });
  return running;
}

async function send() {
  clearTimeout(retryTimer);
  while (account && pending.size) {
    const [id, change] = pending.entries().next().value;
    try {
      if (change.op === 'put') await api.putSurvey(change.survey);
      else await api.deleteSurvey(id);
      // Only clear what was sent: a newer change made in flight still goes.
      if (pending.get(id) === change) pending.delete(id);
      saveQueue();
    } catch (error) {
      if (error.status === 401) {
        // The queue stays filed under the account for its next login.
        const ended = sessionEnded;
        stop();
        ended();
        return;
      }
      if (error.offline) {
        store.setSyncNotice(OFFLINE_NOTICE);
        retryTimer = setTimeout(flush, RETRY_MS);
        return;
      }
      // Refused for a reason retrying cannot fix: dropped and said, so it cannot block the queue.
      if (pending.get(id) === change) pending.delete(id);
      saveQueue();
      const name = change.survey?.kos?.name || 'A survey';
      store.setSyncNotice(`${name} could not be saved to your account: ${error.message}`);
    }
  }
  if (account && !pending.size && store.getState().syncNotice === OFFLINE_NOTICE) store.setSyncNotice(null);
}

const onOnline = () => flush();

export async function start(user, { claimSurveys = async () => false, onSessionEnded = () => {} } = {}) {
  stop();
  account = user;
  sessionEnded = onSessionEnded;
  pending = loadQueue(user.id);
  window.addEventListener('online', onOnline);

  await flush();
  if (!account) return false;

  let remote;
  try {
    ({ surveys: remote } = await api.listSurveys());
  } catch (error) {
    if (error.status === 401) {
      const ended = sessionEnded;
      stop();
      ended();
      return false;
    }
    if (error.offline && store.getState().ownerId === user.id) {
      // Offline, but this copy is already the account's: keep working and send later.
      told = new Map(store.getState().surveys.map((survey) => [survey.id, JSON.stringify(survey)]));
      for (const [id, change] of pending) {
        if (change.op === 'put') told.delete(id);
      }
      store.setSyncNotice(OFFLINE_NOTICE);
      unsubscribe = store.subscribe(onStoreChange);
      return true;
    }
    stop();
    throw error;
  }
  if (!account) return false;

  // Unsent changes are still this device's latest: lay them over the server's copy.
  let surveys = remote.filter((survey) => pending.get(survey.id)?.op !== 'delete');
  for (const [id, change] of pending) {
    if (change.op !== 'put') continue;
    surveys = [change.survey, ...surveys.filter((survey) => survey.id !== id)];
  }

  const onServer = new Set(remote.map((survey) => survey.id));
  const unclaimed = store.unclaimedSurveys().filter((survey) => !onServer.has(survey.id));
  if (unclaimed.length) {
    if (await claimSurveys(unclaimed.length)) surveys = [...unclaimed, ...surveys];
    else storage.keepUnclaimed(unclaimed);
  }
  if (!account) return false;

  // What the server holds; anything else in surveys is queued by capture().
  told = new Map(remote.map((survey) => [survey.id, JSON.stringify(survey)]));
  store.adoptSurveys(surveys, user.id);
  unsubscribe = store.subscribe(onStoreChange);
  capture();
  if (pending.size) flush();
  if (!pending.size && store.getState().syncNotice === OFFLINE_NOTICE) store.setSyncNotice(null);
  return true;
}

export function stop() {
  unsubscribe?.();
  unsubscribe = null;
  clearTimeout(retryTimer);
  window.removeEventListener('online', onOnline);
  account = null;
  told = new Map();
  pending = new Map();
  sessionEnded = () => {};
}

export function pendingCount() {
  return pending.size;
}
