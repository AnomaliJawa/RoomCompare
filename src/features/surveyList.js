import { html, raw } from '../utils/dom.js';
import { getState } from '../store.js';
import { surveyCard } from '../components/surveyCard.js';
import { noSurveysYet, noSearchResults } from '../components/emptyState.js';
import { textField } from '../components/fields.js';

/**
 * Partial match on the kos name, ignoring case and accents.
 *
 * Someone who recorded "Kos Sejahtera" while typing on a phone keyboard may
 * well search for "sejahtera" in either form, and a search that misses a kos
 * the user knows they saved reads as data loss.
 */
function searchKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function filterSurveys(surveys, query) {
  const term = searchKey(query).trim();
  if (!term) return surveys;
  return surveys.filter((survey) => searchKey(survey.kos.name).includes(term));
}

export function renderSurveyList() {
  const { surveys, search, compareSelection } = getState();
  const visible = filterSurveys(surveys, search);

  let body;
  if (!surveys.length) {
    body = noSurveysYet();
  } else if (!visible.length) {
    body = noSearchResults(search);
  } else {
    body = html`<div class="grid-cards">
      ${raw(
        visible
          .map((survey) =>
            surveyCard(survey, {
              variant: 'own',
              inCompare: compareSelection.includes(survey.id),
            }),
          )
          .join(''),
      )}
    </div>`;
  }

  return html`
    <div class="page-head">
      <div class="page-head__text">
        <h1>My surveys</h1>
        <p class="page-head__lede">
          ${surveys.length} kos recorded${search ? `, ${visible.length} matching` : ''}.
        </p>
      </div>
    </div>

    <div class="search-row">
      ${textField({
        name: 'survey-search',
        id: 'survey-search',
        label: 'Search by kos name',
        type: 'search',
        value: search,
        placeholder: 'e.g. Melati',
        action: 'search-surveys',
      })}
    </div>

    ${body}
  `;
}
