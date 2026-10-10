import * as store from '../data/store.js';
import { loadSurveyMedia, restoreMedia } from '../data/media.js';
import { confirmDialog, dismissToast, toast } from '../components/feedback/feedback.js';
import { navigate } from '../router.js';
import { MAX_COMPARE } from '../constants.js';

/** What a person does to a survey from a card or its page, with the toast that answers it. */

let pendingUndo = null;

async function undoDelete() {
  if (!pendingUndo) return;
  const { survey, index, media } = pendingUndo;
  pendingUndo = null;
  await restoreMedia(media);
  store.restoreSurvey(survey, index);
  dismissToast();
  toast(`${survey.kos.name} restored`);
}

/** `leaveTo`: where to go once it is gone, when the page was the survey's own. */
export async function askDelete(id, { leaveTo = null } = {}) {
  const survey = store.findSurvey(id);
  if (!survey) return;

  const photoCount = (await loadSurveyMedia(id)).length;
  const body = photoCount
    ? `${survey.kos.name} and its ${photoCount} photo${photoCount === 1 ? '' : 's'} will be removed from your surveys.`
    : `${survey.kos.name} will be removed from your surveys.`;
  if (!(await confirmDialog({ title: 'Delete this survey?', body, confirmLabel: 'Delete' }))) return;

  // Capture the media before the delete cascades, so undo restores the photos too.
  const captured = await loadSurveyMedia(id);
  const { removed, index, mediaCleanup } = store.deleteSurvey(id) ?? {};
  if (!removed) return;

  // Wait for the cleanup before offering undo, or a quick undo's photos would be deleted again.
  await mediaCleanup;

  pendingUndo = { survey: removed, index, media: captured };
  toast(`${survey.kos.name} deleted`, {
    action: { label: 'Undo', onClick: undoDelete },
    onExpire: () => {
      pendingUndo = null;
    },
  });
  if (leaveTo) navigate(leaveTo);
}

export function toggleStar(id) {
  store.toggleStar(id);
  const { kos } = store.findSurvey(id);
  toast(store.isStarred(id) ? `${kos.name} starred` : `${kos.name} unstarred`);
}

// No toast: the filled heart and the count already say so.
export const toggleLike = (id) => store.toggleLike(id);

/** `go`: after adding, open Compare, so a kos picked from Community lands where it is compared. */
export function toggleCompare(id, { go = false } = {}) {
  const survey = store.findSurvey(id);
  if (!store.toggleCompare(id)) {
    toast(
      store.canCompare(id)
        ? `Remove one kos before adding another. You can compare up to ${MAX_COMPARE}.`
        : `Publish ${survey.kos.name} to compare it. Drafts are left out of comparisons.`,
    );
    return;
  }
  // Adding needs no toast: the pressed button already says so.
  if (!store.getState().compareSelection.includes(id)) toast(`${survey.kos.name} removed from comparison`);
  else if (go) navigate('/compare');
}
