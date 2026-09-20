import { html, raw } from '../utils/dom.js';
import { getState } from '../store.js';
import { surveyCard } from '../components/surveyCard.js';
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
    : html`<section class="empty">
        <p class="empty__title">No shared surveys match these filters</p>
        <p class="empty__body">Widen the rent range or clear the filters to see everything.</p>
        <button class="btn btn--secondary" type="button" data-action="clear-community-filters">Clear filters</button>
      </section>`;

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
        <div class="field">
          <label class="field__label" for="f-location">Location</label>
          <input class="field__control" id="f-location" type="search" placeholder="e.g. Dinoyo"
            value="${communityFilters.location}" data-action="filter-location" autocomplete="off" />
        </div>
        <div class="field">
          <label class="field__label" for="f-min">Rent from</label>
          <div class="field__group">
            <span class="field__affix" aria-hidden="true">Rp</span>
            <input class="field__control numeric" id="f-min" type="text" inputmode="numeric"
              value="${communityFilters.minRent}" data-action="filter-min-rent" autocomplete="off" />
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="f-max">Rent up to</label>
          <div class="field__group">
            <span class="field__affix" aria-hidden="true">Rp</span>
            <input class="field__control numeric" id="f-max" type="text" inputmode="numeric"
              value="${communityFilters.maxRent}" data-action="filter-max-rent" autocomplete="off" />
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="f-type">Kos type</label>
          <select class="field__control" id="f-type" data-action="filter-type">
            <option value="">All types</option>
            ${raw(
              KOS_TYPES.map(
                (t) => html`<option value="${t.value}" ${communityFilters.type === t.value ? 'selected' : ''}>${t.label}</option>`,
              ).join(''),
            )}
          </select>
        </div>
        <label class="choice filter-grid__star">
          <input type="checkbox" data-action="filter-starred" ${communityFilters.starredOnly ? 'checked' : ''} />
          Starred only
        </label>
      </div>
    </section>

    <p class="meta" style="margin-bottom: var(--space-4)">
      ${visible.length} of ${communitySurveys.length} shared surveys.
    </p>

    ${raw(body)}
  `;
}
