import { html, raw } from '../utils/dom.js';
import { MAX_COMPARE, MIN_COMPARE } from '../constants.js';

/** Equal slots with names only, so a long name cannot grow its card; Compare opens at two. */

/** Each button carries its words in aria-label and a tooltip, since an icon names nothing. */
const icon = (paths) =>
  '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="none" ' +
  `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const ADD_ICON = icon('<path d="M10 4.5v11M4.5 10h11"/>');

const CHANGE_ICON = icon('<path d="M4 7h11.5M12.5 4l3 3-3 3"/><path d="M16 13H4.5M7.5 10l-3 3 3 3"/>');

const REMOVE_ICON = icon('<path d="m5.5 5.5 9 9M14.5 5.5l-9 9"/>');

/** data-slot: the picker hands focus back to the slot it was opened from. */
function chip(survey, index) {
  return html`
    <li class="compare-chip">
      <button
        class="compare-chip__pick"
        type="button"
        data-action="change-compare"
        data-id="${survey.id}"
        data-slot="${index}"
        aria-haspopup="dialog"
        aria-label="Change ${survey.kos.name}"
      >
        <span class="compare-chip__name" title="${survey.kos.name}">${survey.kos.name}</span>
        <span class="compare-chip__hint" aria-hidden="true" title="Change">${raw(CHANGE_ICON)}</span>
      </button>
      <button
        class="compare-chip__remove"
        type="button"
        data-action="remove-compare"
        data-id="${survey.id}"
        aria-label="Remove ${survey.kos.name} from the comparison"
        title="Remove"
      >${raw(REMOVE_ICON)}</button>
    </li>
  `;
}

function emptySlot(index) {
  return html`<li class="compare-chip compare-chip--empty">
    <button
      class="compare-chip__pick"
      type="button"
      data-action="open-picker"
      data-slot="${index}"
      aria-haspopup="dialog"
      aria-label="Add kos ${index + 1}"
    >
      <span class="meta">Kos ${index + 1}</span>
      <span class="compare-chip__hint" aria-hidden="true" title="Add">${raw(ADD_ICON)}</span>
    </button>
  </li>`;
}

export function compareBar(selected, { shown }) {
  const slots = [];
  for (let i = selected.length; i < MAX_COMPARE; i += 1) slots.push(emptySlot(i));

  const ready = selected.length >= MIN_COMPARE;

  return html`
    <section class="compare-bar" aria-label="Selected for comparison">
      <ul class="compare-bar__chips" style="--slots: ${MAX_COMPARE}">
        ${selected.map((survey, index) => chip(survey, index))}
        ${slots}
      </ul>

      <div class="compare-bar__actions">
        <p class="meta" role="status" aria-live="polite">
          ${selected.length} of ${MAX_COMPARE} selected${ready ? '' : `, ${MIN_COMPARE - selected.length} more to compare`}.
        </p>
        ${shown
          ? raw(
              html`<button class="btn btn--quiet" type="button" data-action="clear-compare">
                Start over
              </button>`,
            )
          : ''}
        ${!shown
          ? raw(
              html`<button
                class="btn btn--primary"
                type="button"
                data-action="show-comparison"
                ${ready ? '' : raw('disabled')}
                ${ready ? '' : raw('title="Select at least two kos"')}
              >Compare</button>`,
            )
          : ''}
      </div>
    </section>
  `;
}
