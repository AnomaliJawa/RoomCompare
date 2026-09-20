import { html, raw } from '../utils/dom.js';
import { getState } from '../store.js';
import { surveyCard } from '../components/surveyCard.js';
import { noFilterResults } from '../components/emptyState.js';
import { textField, currencyField, selectField } from '../components/fields.js';
import { KOS_TYPES } from '../constants.js';

/**
 * Shared survey results from other users.
 *
 * Facility filters are deliberately AND: picking Wifi and Kitchen means both,
 * which is what someone narrowing a shortlist expects.
 */
export function filterCommunity(surveys, filters, starredIds) {
  const location = filters.location.trim().toLowerCase();
  const min = filters.minRent === '' ? null : Number(filters.minRent);
  const max = filters.maxRent === '' ? null : Number(filters.maxRent);

  return surveys.filter((survey) => {
    if (location && !(survey.kos.kosLocation?.label ?? '').toLowerCase().includes(location)) return false;
    if (filters.type && survey.kos.type !== filters.type) return false;
    if (filters.starredOnly && !starredIds.includes(survey.id)) return false;
    if (min !== null && Number.isFinite(min) && survey.kos.rent < min) return false;
    if (max !== null && Number.isFinite(max) && survey.kos.rent > max) return false;
    return true;
  });
}

export function renderCommunity() {
  const { communitySurveys, communityFilters, starredIds, compareSelection } = getState();
  const visible = filterCommunity(communitySurveys, communityFilters, starredIds);

  const body = visible.length
    ? html`<div class="grid-cards">
        ${raw(
          visible
            .map((survey) =>
              surveyCard(survey, {
                variant: 'community',
                starred: starredIds.includes(survey.id),
                inCompare: compareSelection.includes(survey.id),
              }),
            )
            .join(''),
        )}
      </div>`
    : noFilterResults();

  return html`
    <div class="page-head">
      <div class="page-head__text">
        <h1>Community surveys</h1>
        <p class="page-head__lede">
          Kos recorded by other people. Star one to keep it, and it becomes
          available when you compare.
        </p>
      </div>
    </div>

    <section class="panel section" aria-label="Filters">
      <div class="filter-grid">
        ${textField({
          name: 'f-location', id: 'f-location', label: 'Location', type: 'search',
          value: communityFilters.location, placeholder: 'e.g. Dinoyo', action: 'filter-location',
        })}
        ${currencyField({ name: 'f-min', id: 'f-min', label: 'Rent from', value: communityFilters.minRent, action: 'filter-min-rent' })}
        ${currencyField({ name: 'f-max', id: 'f-max', label: 'Rent up to', value: communityFilters.maxRent, action: 'filter-max-rent' })}
        ${selectField({
          name: 'f-type', id: 'f-type', label: 'Kos type', value: communityFilters.type, action: 'filter-type',
          options: [{ value: '', label: 'All types' }, ...KOS_TYPES],
        })}
        <label class="choice filter-grid__star">
          <input type="checkbox" data-action="filter-starred" ${communityFilters.starredOnly ? raw('checked') : ''} />
          Starred only
        </label>
      </div>
    </section>

    <p class="meta" style="margin-bottom: var(--space-4)">
      ${visible.length} of ${communitySurveys.length} shared surveys.
    </p>

    ${body}
  `;
}
