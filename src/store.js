import { ownSurveys } from './seed/ownSurveys.js';
import { communitySurveys } from './seed/communitySurveys.js';
import { MAX_COMPARE, MIN_COMPARE, DISTANCE_BASIS, STATUS } from './constants.js';
import { checkWeights, effectiveWeights, isDefault } from './utils/weights.js';
import * as storage from './storage.js';
import * as db from './db.js';

/** Every data mutation ends in commit(); UI-only state just notifies. */

const listeners = new Set();

const boot = storage.load();

/** Seed only on a first run: a stored empty list means the user deleted everything. */
const seeded = boot.status !== storage.LOAD_STATUS.OK;

const state = {
  /** In memory only: the session itself is an HttpOnly cookie. */
  user: null,
  ownerId: seeded ? null : boot.data.ownerId ?? null,
  surveys: seeded ? structuredClone(ownSurveys) : boot.data.surveys,
  communitySurveys: structuredClone(communitySurveys),
  starredIds: seeded ? ['com-kartika'] : boot.data.starredIds,
  /** The viewer's own likes of community kos, loaded with the account. */
  likedIds: [],
  /** Read through bestMatchWeights(), which never hands back an invalid set. */
  bestMatchWeights: null,
  compareSelection: [],
  compareShown: false,
  search: '',
  communityFilters: {
    location: '',
    minRent: '',
    maxRent: '',
    type: '',
    starredOnly: false,
    /** Section-scoped keys such as "room:AC": some facility names appear in two sections. */
    facilities: [],
  },
  /** One of: ok | unavailable | corrupt | quota | failed. */
  storageStatus: boot.status === storage.LOAD_STATUS.UNAVAILABLE ? 'unavailable' : 'ok',
  storageNotice:
    boot.status === storage.LOAD_STATUS.CORRUPT
      ? 'Saved surveys could not be read, so RoomCompare started fresh. The unreadable copy has been kept.'
      : boot.status === storage.LOAD_STATUS.UNAVAILABLE
        ? 'Saving is off in this browser mode. Your surveys will not be kept after you close this tab.'
        : null,
  syncNotice: null,
};

// A first run writes the seed at once, so the next visit loads it rather than re-seeding.
if (seeded && state.storageStatus === 'ok') {
  storage.save({ surveys: state.surveys, starredIds: state.starredIds, ownerId: null });
}

export function getState() {
  return state;
}

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

/** A failed write is reported, never silent, and the in-memory data stays intact. */
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

export function clearStorageNotice() {
  state.storageNotice = null;
  notify();
}

export function setUser(user) {
  state.user = user;
  // Each account's weights and likes wait on this device for its next login here.
  state.bestMatchWeights = user ? storage.loadWeights(user.id) : null;
  state.likedIds = user ? storage.loadLikes(user.id) : [];
  notify();
}

export function setSyncNotice(message) {
  if (state.syncNotice === message) return;
  state.syncNotice = message;
  notify();
}

/** Never the samples: those were never theirs. */
export function unclaimedSurveys() {
  if (state.ownerId !== null) return [];
  const samples = new Set(ownSurveys.map((survey) => survey.id));
  return state.surveys.filter((survey) => !samples.has(survey.id));
}

export function adoptSurveys(surveys, ownerId) {
  state.surveys = surveys;
  state.ownerId = ownerId;
  state.compareSelection = state.compareSelection.filter((id) => findSurvey(id));
  closeComparisonIfTooFew();
  commit();
}

/** A shared phone's next user must not see these; unsent changes wait for the next login. */
export function forgetAccount() {
  state.user = null;
  state.bestMatchWeights = null;
  state.likedIds = [];
  state.surveys = [];
  state.ownerId = null;
  state.compareSelection = [];
  state.compareShown = false;
  state.search = '';
  state.syncNotice = null;
  commit();
}

export function resetToSeed() {
  storage.clear();
  state.surveys = structuredClone(ownSurveys);
  state.starredIds = ['com-kartika'];
  state.compareSelection = [];
  state.search = '';
  commit();
}

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

export function isLiked(id) {
  return state.likedIds.includes(id);
}

/** Community kos only: the sample count, plus 1 for the viewer's own like. */
export function likeCount(id) {
  const survey = state.communitySurveys.find((item) => item.id === id);
  if (!survey) return null;
  return (survey.likes ?? 0) + (isLiked(id) ? 1 : 0);
}

/** Community surveys, and own ones once published: drafts are not comparable. */
export function canCompare(id) {
  if (state.communitySurveys.some((survey) => survey.id === id)) return true;
  return state.surveys.some((survey) => survey.id === id && survey.status === STATUS.PUBLISHED);
}

/** Stars do not decide what can be compared; drafts are counted so the picker can say so. */
export function compareCandidates() {
  const own = state.surveys.filter((survey) => survey.status === STATUS.PUBLISHED);
  return { own, community: state.communitySurveys, drafts: state.surveys.length - own.length };
}

export function comparableSurveys() {
  const { own, community } = compareCandidates();
  return [...own, ...community];
}

export function selectedForCompare() {
  return state.compareSelection
    .map((id) => findSurvey(id))
    .filter(Boolean);
}

export function bestMatchWeights() {
  return effectiveWeights(state.bestMatchWeights);
}

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

/** Not an edit, so updatedAt stays: the dashboard orders visits by it. */
export function setWalkingDistance(id, km) {
  const index = state.surveys.findIndex((survey) => survey.id === id);
  if (index < 0) return null;
  const survey = state.surveys[index];
  state.surveys[index] = {
    ...survey,
    kos: { ...survey.kos, distanceKm: km, distanceBasis: DISTANCE_BASIS.WALKING },
  };
  commit();
  return state.surveys[index];
}

/** The cleanup promise is returned, not awaited: undo must wait for it, the UI must not. */
export function deleteSurvey(id) {
  const index = state.surveys.findIndex((survey) => survey.id === id);
  if (index < 0) return null;
  const [removed] = state.surveys.splice(index, 1);
  state.compareSelection = state.compareSelection.filter((item) => item !== id);
  closeComparisonIfTooFew();
  commit();

  const mediaCleanup = db.deleteMediaForSurvey(id).catch(() => null);

  return { removed, index, mediaCleanup };
}

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

/** Only a community kos can be liked: your own surveys are shared with no one. */
export function toggleLike(id) {
  if (!state.user || !state.communitySurveys.some((survey) => survey.id === id)) return false;
  state.likedIds = state.likedIds.includes(id) ? state.likedIds.filter((item) => item !== id) : [...state.likedIds, id];
  storage.saveLikes(state.user.id, state.likedIds);
  notify();
  return true;
}

/** A set equal to the defaults is saved as null, so it follows the defaults if they change. */
export function setBestMatchWeights(weights) {
  if (!state.user) return { ok: false, kept: false };
  if (weights !== null && !checkWeights(weights).ok) return { ok: false, kept: false };
  const next = weights === null || isDefault(weights) ? null : effectiveWeights(weights);
  state.bestMatchWeights = next;
  const result = storage.saveWeights(state.user.id, next);
  notify();
  return { ok: true, kept: result === storage.SAVE_RESULT.OK };
}

/** Returns false when the selection is full or the kos is a draft, so the caller can explain. */
export function toggleCompare(id) {
  if (state.compareSelection.includes(id)) {
    state.compareSelection = state.compareSelection.filter((item) => item !== id);
    closeComparisonIfTooFew();
    notify();
    return true;
  }
  if (!canCompare(id)) return false;
  if (state.compareSelection.length >= MAX_COMPARE) return false;
  state.compareSelection = [...state.compareSelection, id];
  notify();
  return true;
}

/** In place, so the other kos keep their columns; false when the new one cannot be compared or is already in. */
export function replaceInCompare(oldId, newId) {
  if (!state.compareSelection.includes(oldId) || state.compareSelection.includes(newId)) return false;
  if (!canCompare(newId)) return false;
  state.compareSelection = state.compareSelection.map((id) => (id === oldId ? newId : id));
  notify();
  return true;
}

export function removeFromCompare(id) {
  state.compareSelection = state.compareSelection.filter((item) => item !== id);
  closeComparisonIfTooFew();
  notify();
}

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

/** Only kos that can still be compared come back; the table reopens only with two. */
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
