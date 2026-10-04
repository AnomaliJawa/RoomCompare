import * as store from '../data/store.js';
import { dismissToast, toast } from '../components/feedback/feedback.js';

let pendingCompareUndo = null;

function undoClearCompare() {
  if (!pendingCompareUndo) return;
  const { selection, shown } = pendingCompareUndo;
  pendingCompareUndo = null;
  store.restoreCompare(selection, shown);
  dismissToast();
  toast('Comparison restored');
}

/** Undoable rather than confirmed: a slipped tap must not cost a shortlist. */
export function clearCompare() {
  const { compareSelection, compareShown } = store.getState();
  pendingCompareUndo = { selection: [...compareSelection], shown: compareShown };
  store.clearCompare();
  toast('Comparison cleared', {
    action: { label: 'Undo', onClick: undoClearCompare },
    onExpire: () => {
      pendingCompareUndo = null;
    },
  });
}
