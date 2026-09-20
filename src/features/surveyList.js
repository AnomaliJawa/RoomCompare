import { html, raw } from '../utils/dom.js';
import { getState } from '../store.js';
import { surveyCard } from '../components/surveyCard.js';
import { noSurveysYet, noSearchResults } from '../components/emptyState.js';
import { textField } from '../components/fields.js';

/** Case-insensitive partial match on the kos name, per the search requirement. */
export function filterSurveys(surveys, query) {
  const term = query.trim().toLowerCase();
  if (!term) return surveys;
  return surveys.filter((survey) => survey.kos.name.toLowerCase().includes(term));
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
