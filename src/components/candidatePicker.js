import { html, raw } from '../utils/dom.js';
import { numberToCurrency, formatKosDistance } from '../utils/format.js';
import { MAX_COMPARE } from '../constants.js';

/** Own published surveys and every community survey; drafts are left out and counted. */

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

function candidateGroup({ id, title, candidates, selection, empty, note = null }) {
  return html`
    <section class="picker-group" aria-labelledby="${id}">
      <h3 class="picker-group__title" id="${id}">${title}</h3>
      ${candidates.length ? html`${note ?? ''}${candidateList(candidates, selection)}` : empty}
    </section>
  `;
}

const draftCount = (drafts) => (drafts === 1 ? 'One draft isn’t' : `${drafts} drafts aren’t`);

/** Both links leave the Compare page, so they close the dialog too. */
function ownEmpty(drafts) {
  return drafts
    ? html`<div class="picker-group__empty">
        <p class="meta">${draftCount(drafts)} listed: only published surveys can be compared.</p>
        <a class="btn btn--secondary btn--small" href="#/surveys" data-action="close-picker">Go to my surveys</a>
      </div>`
    : html`<div class="picker-group__empty">
        <p class="meta">You have not recorded a kos yet.</p>
        <a class="btn btn--secondary btn--small" href="#/surveys/new" data-action="close-picker">Add survey</a>
      </div>`;
}

export function candidatePickerDialog({ own, community, drafts = 0 }, selection) {
  return html`
    <div class="picker-dialog">
      <div class="picker-dialog__head">
        <h2 class="dialog__title" id="picker-dialog-title">Add kos</h2>
        <button class="btn btn--quiet btn--small" type="button" data-action="close-picker">Close</button>
      </div>

      <div class="picker-dialog__body">
        <p class="meta">Your published surveys and the community’s. Up to ${MAX_COMPARE} at once.</p>
        ${candidateGroup({
          id: 'picker-own',
          title: 'My surveys',
          candidates: own,
          selection,
          note: drafts
            ? html`<p class="meta picker-group__note">${draftCount(drafts)} listed. Publish a survey to compare it.</p>`
            : null,
          empty: ownEmpty(drafts),
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
