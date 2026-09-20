import { ownSurveys } from './seed/ownSurveys.js';
import { communitySurveys } from './seed/communitySurveys.js';
import { MAX_COMPARE } from './constants.js';
import * as storage from './storage.js';

/**
 * Application state, with a subscribe/notify loop.
 *
 * Writes go through named actions, so persistence has exactly one place to
 * hook in: every data mutation ends in commit(), which saves and then
 * notifies. UI-only state such as the search term and the community filters
 * calls notify() alone, because it is not worth writing to disk and is not
 * meant to outlive the session.
 *
 * Community surveys are never persisted. They are static reference data, so
 * keeping them out of storage means they cannot be corrupted and do not
 * consume the user's quota.
 *
 * Starring is kept as a separate id set rather than a flag on the survey,
 * because it is the viewer's opinion about someone else's record, not a
 * property of that record.
 */

const listeners = new Set();

const boot = storage.load();

/**
 * Seed only on a genuinely first run. A stored empty array means the user
 * deleted everything, and re-seeding then would resurrect surveys they
 * deliberately removed.
 */
const seeded = boot.status !== storage.LOAD_STATUS.OK;

const state = {
  surveys: seeded ? structuredClone(ownSurveys) : boot.data.surveys,
  communitySurveys: structuredClone(communitySurveys),
  starredIds: seeded ? ['com-kartika'] : boot.data.starredIds,
  compareSelection: [],
  search: '',
  communityFilters: {
    location: '',
    minRent: '',
    maxRent: '',
    type: '',
    starredOnly: false,
  },
  /**
   * How storage behaved, so the shell can say so plainly rather than
   * letting the user believe work is being saved when it is not.
   * One of: ok | unavailable | corrupt | quota | failed
   */
  storageStatus: boot.status === storage.LOAD_STATUS.UNAVAILABLE ? 'unavailable' : 'ok',
  storageNotice:
    boot.status === storage.LOAD_STATUS.CORRUPT
      ? 'Saved surveys could not be read, so RoomCompare started fresh. The unreadable copy has been kept.'
      : boot.status === storage.LOAD_STATUS.UNAVAILABLE
        ? 'Saving is off in this browser mode. Your surveys will not be kept after you close this tab.'
        : null,
};

// A first run writes the seed immediately, so the next visit loads from
// storage rather than re-seeding.
if (seeded && state.storageStatus === 'ok') {
  storage.save({ surveys: state.surveys, starredIds: state.starredIds });
}

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener(state));
}

/**
 * Persist, then notify. A failed write must not be silent: the status goes
 * into state so the shell can show it, and the in-memory data is left intact
 * so nothing the user typed is lost.
 */
function commit() {
  if (state.storageStatus !== 'unavailable') {
    const result = storage.save({
      surveys: state.surveys,
      starredIds: state.starredIds,
    });

    if (result === storage.SAVE_RESULT.OK) {
      state.storageStatus = 'ok';
      state.storageNotice = null;
    } else if (result === storage.SAVE_RESULT.QUOTA) {
      state.storageStatus = 'quota';
      state.storageNotice =
        'Storage is full, so the last change was not saved. Delete a survey you no longer need to free space.';
    } else {
      state.storageStatus = 'failed';
      state.storageNotice = 'The last change could not be saved.';
    }
  }
  notify();
}

/** Dismiss the storage notice without changing what it reported. */
export function clearStorageNotice() {
  state.storageNotice = null;
  notify();
}

/** Discard stored data and return to the sample surveys. */
export function resetToSeed() {
  storage.clear();
  state.surveys = structuredClone(ownSurveys);
  state.starredIds = ['com-kartika'];
  state.compareSelection = [];
  state.search = '';
  commit();
}

/* --- Reads -------------------------------------------------------------- */

/** Own surveys and community surveys share a shape, so one lookup covers both. */
export function findSurvey(id) {
  return (
    state.surveys.find((survey) => survey.id === id) ??
    state.communitySurveys.find((survey) => survey.id === id) ??
    null
  );
}

export function isOwnSurvey(id) {
  return state.surveys.some((survey) => survey.id === id);
}

export function isStarred(id) {
  return state.starredIds.includes(id);
}

/** Everything eligible for comparison: the user's own surveys plus starred ones. */
export function comparableSurveys() {
  const starredCommunity = state.communitySurveys.filter((survey) =>
    state.starredIds.includes(survey.id),
  );
  return [...state.surveys, ...starredCommunity];
}

export function selectedForCompare() {
  return state.compareSelection
    .map((id) => findSurvey(id))
    .filter(Boolean);
}

/* --- Writes ------------------------------------------------------------- */

export function addSurvey(survey) {
  state.surveys.unshift(survey);
  commit();
  return survey;
}

export function updateSurvey(id, changes) {
  const index = state.surveys.findIndex((survey) => survey.id === id);
  if (index < 0) return null;
  state.surveys[index] = {
    ...state.surveys[index],
    ...changes,
    updatedAt: new Date().toISOString(),
  };
  commit();
  return state.surveys[index];
}

export function deleteSurvey(id) {
  const index = state.surveys.findIndex((survey) => survey.id === id);
  if (index < 0) return null;
  const [removed] = state.surveys.splice(index, 1);
  // A deleted survey must not linger in a comparison.
  state.compareSelection = state.compareSelection.filter((item) => item !== id);
  commit();
  return removed;
}

export function toggleStar(id) {
  state.starredIds = state.starredIds.includes(id)
    ? state.starredIds.filter((item) => item !== id)
    : [...state.starredIds, id];
  commit();
}

/** Returns false when the selection is already full, so the caller can explain why. */
export function toggleCompare(id) {
  if (state.compareSelection.includes(id)) {
    state.compareSelection = state.compareSelection.filter((item) => item !== id);
    notify();
    return true;
  }
  if (state.compareSelection.length >= MAX_COMPARE) return false;
  state.compareSelection = [...state.compareSelection, id];
  notify();
  return true;
}

export function removeFromCompare(id) {
  state.compareSelection = state.compareSelection.filter((item) => item !== id);
  notify();
}

export function setSearch(value) {
  state.search = value;
  notify();
}

export function setCommunityFilter(key, value) {
  state.communityFilters = { ...state.communityFilters, [key]: value };
  notify();
}
