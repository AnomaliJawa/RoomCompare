import { html, raw } from '../utils/dom.js';
import { numberToCurrency, formatKosDistance } from '../utils/format.js';
import { MAX_COMPARE } from '../constants.js';

/**
 * What can be compared: the user's own surveys and every community survey,
 * each under its source's name, so a kos's origin is clear without a column
 * to say it. A community survey no longer has to be starred first: a new
 * account has no surveys of its own, and was offered a single kos.
 */

function candidateList(candidates, selection) {
  const full = selection.length >= MAX_COMPARE;

  return html`
    <ul class="stack">
      ${candidates.map((survey) => {
        const picked = selection.includes(survey.id);
        const blocked = !picked && full;
        return html`<li class="listing">
          <div>
            <span class="listing__title">${survey.kos.name}</span>
            <p class="meta">
              ${survey.kos.kosLocation?.label ?? 'Location not recorded'} ·
              ${numberToCurrency(survey.kos.rent)} · ${formatKosDistance(survey.kos)}
            </p>
          </div>
          <button
            class="btn ${picked ? 'btn--primary' : 'btn--secondary'} btn--small"
            type="button"
            data-action="toggle-compare"
            data-id="${survey.id}"
            ${blocked ? raw('disabled') : ''}
          >${picked ? 'Selected' : blocked ? `Maximum of ${MAX_COMPARE}` : 'Add'}</button>
        </li>`;
      })}
    </ul>
  `;
}

/** One source: its name, then its kos, or what to do when it has none. */
function candidateGroup({ id, title, candidates, selection, empty }) {
  return html`
    <section class="picker-group" aria-labelledby="${id}">
      <h3 class="picker-group__title" id="${id}">${title}</h3>
      ${candidates.length ? candidateList(candidates, selection) : empty}
    </section>
  `;
}

/**
 * The picker as a dialog, opened from Add kos above the comparison. Same
 * shape as the filter dialog: a scrolling body between a fixed head and foot,
 * with the count in the foot updating as kos are picked.
 */
export function candidatePickerDialog({ own, community }, selection) {
  return html`
    <div class="picker-dialog">
      <div class="picker-dialog__head">
        <h2 class="dialog__title" id="picker-dialog-title">Add kos</h2>
        <button class="btn btn--quiet btn--small" type="button" data-action="close-picker">Close</button>
      </div>

      <div class="picker-dialog__body">
        <p class="meta">Your own surveys and the community’s. Up to ${MAX_COMPARE} at once.</p>
        ${candidateGroup({
          id: 'picker-own',
          title: 'My surveys',
          candidates: own,
          selection,
          // The link leaves the Compare page, so it closes the dialog too.
          empty: html`<div class="picker-group__empty">
            <p class="meta">You have not recorded a kos yet.</p>
            <a class="btn btn--secondary btn--small" href="#/surveys/new" data-action="close-picker">Add survey</a>
          </div>`,
        })}
        ${candidateGroup({
          id: 'picker-community',
          title: 'Community',
          candidates: community,
          selection,
          empty: html`<p class="meta">No community surveys to show right now.</p>`,
        })}
      </div>

      <div class="picker-dialog__foot">
        <p class="meta" role="status" aria-live="polite">${selection.length} of ${MAX_COMPARE} selected.</p>
        <button class="btn btn--primary" type="button" data-action="close-picker">Done</button>
      </div>
    </div>
  `;
}
