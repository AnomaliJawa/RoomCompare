import { html, raw } from '../utils/dom.js';
import { getState, isLiked, likeCount } from '../store.js';
import { surveyCard } from '../components/surveyCard.js';
import { noFilterResults } from '../components/emptyState.js';
import { filterBar } from '../components/filterPanel.js';
import { mountThumbs } from '../components/thumbs.js';

export function filterCommunity(surveys, filters, starredIds) {
  const location = filters.location.trim().toLowerCase();
  const min = filters.minRent === '' ? null : Number(filters.minRent);
  const max = filters.maxRent === '' ? null : Number(filters.maxRent);
  const required = filters.facilities ?? [];

  return surveys.filter((survey) => {
    if (location && !(survey.kos.kosLocation?.label ?? '').toLowerCase().includes(location)) return false;
    if (filters.type && survey.kos.type !== filters.type) return false;
    if (filters.starredOnly && !starredIds.includes(survey.id)) return false;
    if (min !== null && Number.isFinite(min) && survey.kos.rent < min) return false;
    if (max !== null && Number.isFinite(max) && survey.kos.rent > max) return false;

    // Every requirement must hold: Wifi and Kitchen means both.
    return required.every((key) => {
      const [section, ...rest] = key.split(':');
      const name = rest.join(':');
      return (survey[section]?.facilities ?? []).includes(name);
    });
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
                liked: isLiked(survey.id),
                likes: likeCount(survey.id),
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

    ${filterBar(communityFilters, { total: communitySurveys.length, showing: visible.length })}

    ${body}
  `;
}

export function mountCommunity(root) {
  let handle = null;
  mountThumbs(root).then((result) => {
    handle = result;
  });
  return {
    destroy() {
      handle?.destroy();
    },
  };
}
