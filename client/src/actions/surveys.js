import * as store from '../data/store.js';
import { loadSurveyMedia, restoreMedia } from '../data/media.js';
import { confirmDialog, dismissToast, toast } from '../components/feedback/feedback.js';
import { navigate } from '../router.js';
import { requireAccount } from './account.js';
import { MAX_COMPARE } from '../constants.js';
import { msg, t } from '../i18n/index.js';

/** What a person does to a survey from a card or its page, with the toast that answers it. */

let pendingUndo = null;

async function undoDelete() {
  if (!pendingUndo) return;
  const { survey, index, media } = pendingUndo;
  pendingUndo = null;
  await restoreMedia(media);
  store.restoreSurvey(survey, index);
  dismissToast();
  toast(t('{name} restored', { name: survey.kos.name }));
}

/** `leaveTo`: where to go once it is gone, when the page was the survey's own. */
export async function askDelete(id, { leaveTo = null } = {}) {
  const survey = store.findSurvey(id);
  if (!survey) return;

  const photoCount = (await loadSurveyMedia(id)).length;
  const name = survey.kos.name;
  let body = t('{name} will be removed from your surveys.', { name });
  if (photoCount === 1) body = t('{name} and its 1 photo will be removed from your surveys.', { name });
  else if (photoCount > 1) body = t('{name} and its {count} photos will be removed from your surveys.', { name, count: photoCount });
  if (!(await confirmDialog({ title: t('Delete this survey?'), body, confirmLabel: t('Delete') }))) return;

  // Capture the media before the delete cascades, so undo restores the photos too.
  const captured = await loadSurveyMedia(id);
  const { removed, index, mediaCleanup } = store.deleteSurvey(id) ?? {};
  if (!removed) return;

  // Wait for the cleanup before offering undo, or a quick undo's photos would be deleted again.
  await mediaCleanup;

  pendingUndo = { survey: removed, index, media: captured };
  toast(t('{name} deleted', { name }), {
    action: { label: t('Undo'), onClick: undoDelete },
    onExpire: () => {
      pendingUndo = null;
    },
  });
  if (leaveTo) navigate(leaveTo);
}

export function toggleStar(id) {
  store.toggleStar(id);
  const { kos } = store.findSurvey(id);
  toast(store.isStarred(id) ? t('{name} starred', { name: kos.name }) : t('{name} unstarred', { name: kos.name }));
}

// No toast: the filled heart and the count already say so.
export function toggleLike(id) {
  if (!store.getState().user) {
    requireAccount(msg('Log in to like a kos.'));
    return;
  }
  store.toggleLike(id);
}

/** `go`: after adding, open Compare, so a kos picked from Community lands where it is compared. */
export function toggleCompare(id, { go = false } = {}) {
  if (!store.getState().user) {
    requireAccount(msg('Log in to compare kos.'));
    return;
  }
  const survey = store.findSurvey(id);
  if (!store.toggleCompare(id)) {
    toast(
      store.canCompare(id)
        ? t('Remove one kos before adding another. You can compare up to {max}.', { max: MAX_COMPARE })
        : t('Publish {name} to compare it. Drafts are left out of comparisons.', { name: survey.kos.name }),
    );
    return;
  }
  // Adding needs no toast: the pressed button already says so.
  if (!store.getState().compareSelection.includes(id)) toast(t('{name} removed from comparison', { name: survey.kos.name }));
  else if (go) navigate('/compare');
}
