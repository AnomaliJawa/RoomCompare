import { html, raw } from '../utils/dom.js';
import { getState } from '../store.js';
import { surveyCard } from '../components/surveyCard.js';

/** Case-insensitive partial match on the kos name, per the search requirement. */
export function filterSurveys(surveys, query) {
  const term = query.trim().toLowerCase();
  if (!term) return surveys;
  return surveys.filter((survey) => survey.kos.name.toLowerCase().includes(term));
}

function firstRunState() {
  return html`
    <section class="empty">
      <p class="empty__title">No kos recorded yet</p>
      <p class="empty__body">
        Add the first kos you visited. Once you have two, you can compare them
        side by side.
      </p>
      <a class="btn btn--primary" href="#/surveys/new">Add survey</a>
    </section>
  `;
}

function noResultsState(query) {
  return html`
    <section class="empty">
      <p class="empty__title">No surveys match &ldquo;${query}&rdquo;</p>
      <p class="empty__body">Check the spelling, or clear the search to see everything.</p>
      <button class="btn btn--secondary" type="button" data-action="clear-search">Clear search</button>
    </section>
  `;
}

export function renderSurveyList() {
  const { surveys, search, compareSelection } = getState();
  const visible = filterSurveys(surveys, search);

  let body;
  if (!surveys.length) {
    body = firstRunState();
  } else if (!visible.length) {
    body = noResultsState(search);
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
      <div class="page-head__actions">
        <a class="btn btn--primary" href="#/surveys/new">Add survey</a>
      </div>
    </div>

    <div class="field" style="margin-bottom: var(--space-5); max-width: 420px">
      <label class="field__label" for="survey-search">Search by kos name</label>
      <input
        class="field__control"
        id="survey-search"
        type="search"
        value="${search}"
        placeholder="e.g. Melati"
        data-action="search-surveys"
        autocomplete="off"
      />
    </div>

    ${raw(body)}
  `;
}
