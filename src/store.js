import { ownSurveys } from './seed/ownSurveys.js';
import { communitySurveys } from './seed/communitySurveys.js';
import { MAX_COMPARE, MIN_COMPARE } from './constants.js';
import * as storage from './storage.js';
import * as db from './db.js';

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
  /**
   * The logged-in account, or null. Held in memory only: the session itself
   * is an HttpOnly cookie that script cannot read.
   */
  user: null,
  /**
   * Whose account the surveys below belong to. Null for a copy recorded
   * before accounts existed, and after a logout.
   */
  ownerId: seeded ? null : boot.data.ownerId ?? null,
  surveys: seeded ? structuredClone(ownSurveys) : boot.data.surveys,
  communitySurveys: structuredClone(communitySurveys),
  starredIds: seeded ? ['com-kartika'] : boot.data.starredIds,
  compareSelection: [],
  /**
   * Whether the comparison has been opened. Selection and comparison are
   * separate steps, so the table is something the user asks for rather than
   * something that appears while they are still choosing.
   */
  compareShown: false,
  search: '',
  communityFilters: {
    location: '',
    minRent: '',
    maxRent: '',
    type: '',
    starredOnly: false,
    /**
     * Section-scoped keys such as "room:AC". Scoping matters: Refrigerator
     * and Dispenser exist in both the room and shared lists, and Laundry in
     * both shared and surroundings, so a bare name would be ambiguous.
     */
    facilities: [],
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
  /**
   * How the account's copy is doing, when that is worth saying: offline, or
   * a change the server refused. Separate from storageNotice, which every
   * successful local save clears.
   */
  syncNotice: null,
};

// A first run writes the seed immediately, so the next visit loads from
// storage rather than re-seeding.
if (seeded && state.storageStatus === 'ok') {
  storage.save({ surveys: state.surveys, starredIds: state.starredIds, ownerId: null });
}

export function getState() {
  return state;
}

/** True when this boot created the sample surveys rather than loading saved ones. */
export function wasSeeded() {
  return seeded;
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
      ownerId: state.ownerId,
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

/* --- Account ------------------------------------------------------------- */

export function setUser(user) {
  state.user = user;
  notify();
}

export function setSyncNotice(message) {
  if (state.syncNotice === message) return;
  state.syncNotice = message;
  notify();
}

/**
 * Surveys recorded on this device before accounts existed, which the user
 * can add to their account. Never the samples: those were never theirs.
 */
export function unclaimedSurveys() {
  if (state.ownerId !== null) return [];
  const samples = new Set(ownSurveys.map((survey) => survey.id));
  return state.surveys.filter((survey) => !samples.has(survey.id));
}

/**
 * Make the account's surveys this device's working copy. sync.js has already
 * sent anything this device held back, so the account's list is complete.
 */
export function adoptSurveys(surveys, ownerId) {
  state.surveys = surveys;
  state.ownerId = ownerId;
  // A selection can only point at surveys this copy still holds.
  state.compareSelection = state.compareSelection.filter((id) => findSurvey(id));
  closeComparisonIfTooFew();
  commit();
}

/**
 * Logging out. The account's surveys leave the screen and this device's
 * cache — on a shared phone, the next person must not see them. Changes not
 * yet sent wait in sync.js's queue, under the account, for its next login.
 */
export function forgetAccount() {
  state.user = null;
  state.surveys = [];
  state.ownerId = null;
  state.compareSelection = [];
  state.compareShown = false;
  state.search = '';
  state.syncNotice = null;
  commit();
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

/**
 * Remove a survey and its media.
 *
 * Returns the removed record, where it sat, and the media cleanup promise.
 * The promise is handed back rather than awaited because the record is
 * already gone from the user's view and a slow database must not hold up the
 * UI — but undo needs to wait for it, or a fast undo would restore the photos
 * just before the cleanup deletes them again.
 */
export function deleteSurvey(id) {
  const index = state.surveys.findIndex((survey) => survey.id === id);
  if (index < 0) return null;
  const [removed] = state.surveys.splice(index, 1);
  // A deleted survey must not linger in a comparison.
  state.compareSelection = state.compareSelection.filter((item) => item !== id);
  closeComparisonIfTooFew();
  commit();

  const mediaCleanup = db.deleteMediaForSurvey(id).catch(() => null);

  return { removed, index, mediaCleanup };
}

/** Put a deleted survey back where it was. */
export function restoreSurvey(survey, index = 0) {
  const at = Math.max(0, Math.min(index, state.surveys.length));
  state.surveys.splice(at, 0, survey);
  commit();
  return survey;
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
    closeComparisonIfTooFew();
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
  closeComparisonIfTooFew();
  notify();
}

/** An open comparison that drops below two kos has nothing left to show. */
function closeComparisonIfTooFew() {
  if (state.compareSelection.length < MIN_COMPARE) state.compareShown = false;
}

export function showComparison() {
  if (state.compareSelection.length < MIN_COMPARE) return false;
  state.compareShown = true;
  notify();
  return true;
}

export function clearCompare() {
  state.compareSelection = [];
  state.compareShown = false;
  notify();
}

/**
 * Put back a selection that Start over cleared. Only kos that can still be
 * compared come back — one may have been deleted or unstarred in the
 * seconds since — and the table reopens only if it still has two.
 */
export function restoreCompare(selection, shown) {
  const comparable = new Set(comparableSurveys().map((survey) => survey.id));
  state.compareSelection = selection.filter((id) => comparable.has(id)).slice(0, MAX_COMPARE);
  state.compareShown = Boolean(shown) && state.compareSelection.length >= MIN_COMPARE;
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

/** Add or remove one section-scoped facility requirement. */
export function toggleCommunityFacility(key) {
  const current = state.communityFilters.facilities;
  const next = current.includes(key)
    ? current.filter((item) => item !== key)
    : [...current, key];
  state.communityFilters = { ...state.communityFilters, facilities: next };
  notify();
}

export function clearCommunityFilters() {
  state.communityFilters = {
    location: '',
    minRent: '',
    maxRent: '',
    type: '',
    starredOnly: false,
    facilities: [],
  };
  notify();
}
