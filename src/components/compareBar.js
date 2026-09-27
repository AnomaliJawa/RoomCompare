import { html, raw } from '../utils/dom.js';
import { MAX_COMPARE, MIN_COMPARE } from '../constants.js';

/**
 * The selection, and the way into the comparison.
 *
 * The requirement describes a bar holding the chosen kos with a Compare
 * action that becomes available at two, so the comparison is something the
 * user asks for rather than something that appears mid-selection. Once it is
 * open, adding and removing update it in place — nobody wants to press
 * Compare again after swapping one kos out.
 *
 * Add kos lives here too, beside the selection it changes. It opens the
 * picker in a dialog (see main.js); Compare stays last, as the primary action.
 *
 * Every slot, filled or empty, is one equal card: the name alone, no rent
 * (the comparison's first rows carry it), on a single line, so a long name
 * cannot make its card bigger than the others. The full name stays in the
 * title, the table header and the picker.
 */

function chip(survey) {
  return html`
    <li class="compare-chip">
      <span class="compare-chip__name" title="${survey.kos.name}">${survey.kos.name}</span>
      <button
        class="compare-chip__remove"
        type="button"
        data-action="remove-compare"
        data-id="${survey.id}"
        aria-label="Remove ${survey.kos.name} from the comparison"
      >Remove</button>
    </li>
  `;
}

function emptySlot(index) {
  return html`<li class="compare-chip compare-chip--empty" aria-hidden="true">
    <span class="meta">Kos ${index}</span>
  </li>`;
}

export function compareBar(selected, { shown }) {
  const slots = [];
  for (let i = selected.length; i < MAX_COMPARE; i += 1) slots.push(emptySlot(i + 1));

  const ready = selected.length >= MIN_COMPARE;

  return html`
    <section class="compare-bar" aria-label="Selected for comparison">
      <ul class="compare-bar__chips" style="--slots: ${MAX_COMPARE}">
        ${selected.map((survey) => chip(survey))}
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
        <button class="btn btn--secondary compare-bar__add" type="button" data-action="open-picker" aria-haspopup="dialog">
          Add kos
        </button>
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
