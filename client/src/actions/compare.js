import * as store from '../data/store.js';
import { dismissToast, toast } from '../components/feedback/feedback.js';
import { t } from '../i18n/index.js';

let pendingCompareUndo = null;

function undoClearCompare() {
  if (!pendingCompareUndo) return;
  const { selection, shown } = pendingCompareUndo;
  pendingCompareUndo = null;
  store.restoreCompare(selection, shown);
  dismissToast();
  toast(t('Comparison restored'));
}

/** Undoable rather than confirmed: a slipped tap must not cost a shortlist. */
export function clearCompare() {
  const { compareSelection, compareShown } = store.getState();
  pendingCompareUndo = { selection: [...compareSelection], shown: compareShown };
  store.clearCompare();
  toast(t('Comparison cleared'), {
    action: { label: t('Undo'), onClick: undoClearCompare },
    onExpire: () => {
      pendingCompareUndo = null;
    },
  });
}
