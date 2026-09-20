import { ownSurveys } from './seed/ownSurveys.js';
import { communitySurveys } from './seed/communitySurveys.js';
import { MAX_COMPARE } from './constants.js';

/**
 * Application state, with a subscribe/notify loop.
 *
 * Writes go through named actions so there is one place to add validation and
 * persistence. This phase keeps everything in memory: surveys still reset on
 * refresh until the storage layer lands, which is the next phase and the
 * single highest-value fix in the plan.
 *
 * Starring is kept as a separate id set rather than a flag on the survey,
 * because it is the viewer's opinion about someone else's record, not a
 * property of that record.
 */

const listeners = new Set();

const state = {
  surveys: structuredClone(ownSurveys),
  communitySurveys: structuredClone(communitySurveys),
  starredIds: ['com-kartika'],
  compareSelection: [],
  search: '',
  communityFilters: {
    location: '',
    minRent: '',
    maxRent: '',
    type: '',
    starredOnly: false,
  },
};

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
  notify();
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
  notify();
  return state.surveys[index];
}

export function deleteSurvey(id) {
  const index = state.surveys.findIndex((survey) => survey.id === id);
  if (index < 0) return null;
  const [removed] = state.surveys.splice(index, 1);
  // A deleted survey must not linger in a comparison.
  state.compareSelection = state.compareSelection.filter((item) => item !== id);
  notify();
  return removed;
}

export function toggleStar(id) {
  state.starredIds = state.starredIds.includes(id)
    ? state.starredIds.filter((item) => item !== id)
    : [...state.starredIds, id];
  notify();
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
