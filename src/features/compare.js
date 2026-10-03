import { html, qs } from '../utils/dom.js';
import { getState, selectedForCompare } from '../store.js';
import { nothingSelected, needsOneMore } from '../components/emptyState.js';
import { incompleteDataBanner } from '../components/banner.js';
import { compareBar } from '../components/compareBar.js';
import { comparisonTable } from '../components/comparisonTable.js';
// Best Match feeds the panel under the table and the score section atop it (the user's request).
import { bestMatchPanel, bestMatchScores } from './bestMatch.js';
import { MIN_COMPARE } from '../constants.js';

/** The picker dialog lives outside #app-root: this view is rebuilt on every store change. */

export function renderCompare() {
  const { compareShown } = getState();
  const selected = selectedForCompare();
  const ready = selected.length >= MIN_COMPARE;

  let result;
  if (!ready) {
    result = selected.length === 0 ? nothingSelected() : needsOneMore(selected[0].kos.name);
  } else if (!compareShown) {
    result = html`
      <section class="empty">
        <p class="empty__title">Ready when you are</p>
        <p class="empty__body">
          ${selected.length} kos selected. Compare them on the same criteria, in
          the same order, with nothing left out.
        </p>
        <button class="btn btn--primary" type="button" data-action="show-comparison">
          Compare ${selected.length} kos
        </button>
      </section>
    `;
  } else {
    const incomplete = selected.filter((s) => s.room.internet == null || s.additional.security == null);
    const notice = incomplete.length ? incompleteDataBanner(incomplete.map((s) => s.kos.name)) : '';
    result = html`${notice}${comparisonTable(selected, { scores: bestMatchScores(selected) })}${bestMatchPanel(selected)}`;
  }

  return html`
    <div class="page-head">
      <div class="page-head__text">
        <h1>Compare kos</h1>
        <p class="page-head__lede">
          The same criteria for every kos, in the same order. Nothing is hidden,
          and the decision stays yours.
        </p>
      </div>
    </div>

    ${compareBar(selected, { shown: compareShown })}

    <div class="compare-result">${result}</div>
  `;
}

/** The columns resolve as the comparison opens; reduced motion skips it. */
export function mountCompare(root) {
  const table = qs('[data-reveal]', root);
  if (!table) return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  table.dataset.revealing = 'true';
  const timer = setTimeout(() => {
    delete table.dataset.revealing;
  }, 900);

  return {
    destroy() {
      clearTimeout(timer);
    },
  };
}
