import { html, qs } from '../utils/dom.js';
import { getState, comparableSurveys, selectedForCompare } from '../store.js';
import { nothingSelected, needsOneMore } from '../components/emptyState.js';
import { incompleteDataBanner } from '../components/banner.js';
import { compareBar } from '../components/compareBar.js';
import { candidatePicker } from '../components/candidatePicker.js';
import { comparisonTable } from '../components/comparisonTable.js';
// The only line coupling the comparison to the optional score. Delete this
// import and the mount below to remove the feature entirely.
import { bestMatchPanel } from './bestMatch.js';
import { MIN_COMPARE } from '../constants.js';

/**
 * The comparison.
 *
 * Selection and the comparison itself are separate steps, as the requirement
 * describes: kos go into the bar, and Compare opens the table. Once it is
 * open, adding or removing updates it in place rather than sending the user
 * back to press Compare again after swapping one kos out.
 */

export function renderCompare() {
  const { compareSelection, compareShown } = getState();
  const candidates = comparableSurveys();
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
    result = html`${notice}${comparisonTable(selected)}${bestMatchPanel(selected)}`;
  }

  return html`
    <div class="page-head">
      <div class="page-head__text">
        <h1>Compare kos</h1>
        <p class="page-head__lede">
          The same criteria for every kos, in the same order. Nothing is scored
          and nothing is hidden — the decision stays yours.
        </p>
      </div>
    </div>

    ${compareBar(selected, { shown: compareShown })}

    <div class="compare-layout">
      <section class="panel">
        <div class="section__head">
          <h2>Add kos</h2>
        </div>
        ${candidatePicker(candidates, compareSelection)}
      </section>

      <div class="compare-result">${result}</div>
    </div>
  `;
}

/**
 * The one orchestrated moment in the interface: the columns resolve as the
 * comparison opens, so it reads as something arriving rather than the page
 * merely being different. Reduced motion skips it entirely.
 */
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
