import { html, raw } from '../utils/dom.js';
import { numberToCurrency, formatDistance } from '../utils/format.js';
import { MAX_COMPARE } from '../constants.js';

/**
 * What can be compared: the user's own surveys, plus any community survey
 * they starred. Starring is how someone else's kos enters their shortlist,
 * so the two sources are listed together rather than in separate tabs.
 */

export function candidatePicker(candidates, selection) {
  if (!candidates.length) {
    return html`<p class="meta">
      Nothing to compare yet. Record a survey, or star a community survey to bring it in.
    </p>`;
  }

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
              ${numberToCurrency(survey.kos.rent)} · ${formatDistance(survey.kos.distanceKm)}
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
