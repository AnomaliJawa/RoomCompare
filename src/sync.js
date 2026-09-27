import * as api from './api.js';
import * as store from './store.js';
import * as storage from './storage.js';

/**
 * Keeps the account's copy on the server in step with this device's.
 *
 * This device's copy is still the one the app works on: localStorage, written
 * synchronously, exactly as before accounts existed. A survey is filled in
 * standing in someone else's room, often on a weak signal, so recording must
 * never wait on the network. Every change is kept here first and sent to the
 * account after.
 *
 * Changes are found by comparing the store with what the server was last
 * told, rather than by hooking each store action: a write from any feature is
 * caught the same way, including ones added later. What has not reached the
 * server yet waits in a queue in localStorage, filed under the account, so a
 * closed tab or a dropped connection loses nothing. The queue is sent again
 * on the next change, when the browser comes back online, and at the next
 * login — before the account is read back, so the server's copy that is about
 * to replace this device's already has it.
 */

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

/**
 * Queue whatever differs between the store and what the server was told.
 * Returns whether anything was queued.
 */
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

// Most store notifications are not survey changes — a search keystroke, a
// compare selection — and must not cost a network request. Offline, the
// retry timer and the browser's `online` event do the retrying.
function onStoreChange() {
  if (capture()) flush();
}

/** Send the queue, oldest first. One flush at a time; callers share it. */
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
      // Only clear what was sent. A newer change to the same survey, made
      // while this request was in flight, is a different entry and still goes.
      if (pending.get(id) === change) pending.delete(id);
      saveQueue();
    } catch (error) {
      if (error.status === 401) {
        // The session ended. The queue stays filed under the account for its
        // next login.
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
      // Refused for a reason retrying cannot fix. Holding it would block every
      // change behind it, so it is dropped — and said, since it is not saved.
      if (pending.get(id) === change) pending.delete(id);
      saveQueue();
      const name = change.survey?.kos?.name || 'A survey';
      store.setSyncNotice(`${name} could not be saved to your account: ${error.message}`);
    }
  }
  if (account && !pending.size && store.getState().syncNotice === OFFLINE_NOTICE) store.setSyncNotice(null);
}

const onOnline = () => flush();

/**
 * Begin syncing for an account: send what this device still holds for it,
 * read the account back, and make that the working copy.
 *
 * `claimSurveys(count)` asks whether surveys recorded here before accounts
 * existed should join the account; it resolves true or false. `onSessionEnded`
 * runs if the server stops accepting the session. Resolves true once the
 * account's surveys are on screen.
 */
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
      // The account cannot be read right now, but this device's copy is
      // already its own: keep working from it and send changes later.
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

  // Changes that could not be sent just now are still this device's latest:
  // lay them over what the server returned.
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

  // What the server holds; anything else in `surveys` is queued by capture().
  told = new Map(remote.map((survey) => [survey.id, JSON.stringify(survey)]));
  store.adoptSurveys(surveys, user.id);
  unsubscribe = store.subscribe(onStoreChange);
  capture();
  if (pending.size) flush();
  if (!pending.size && store.getState().syncNotice === OFFLINE_NOTICE) store.setSyncNotice(null);
  return true;
}

/** Stop syncing. The queue stays in localStorage for the account's next login. */
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

/** Changes made on this device that the account does not have yet. */
export function pendingCount() {
  return pending.size;
}
