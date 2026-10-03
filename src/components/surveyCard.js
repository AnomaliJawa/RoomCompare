import { html, raw, photoPlaceholder } from '../utils/dom.js';
import { numberToCurrency, formatKosDistance } from '../utils/format.js';
import { STATUS, STATUS_LABELS, kosTypeLabel } from '../constants.js';
import { starButton } from './starButton.js';
import { editLink, deleteButton } from './surveyActions.js';

/** Filled by mountThumbs once the blob loads: the record only carries ids. */
function thumb(survey) {
  const photoId =
    survey.room?.photoIds?.[0] ?? survey.shared?.photoIds?.[0] ?? survey.bathroom?.photoIds?.[0];
  if (!photoId) return raw(photoPlaceholder(survey.kos.name));
  return html`<img
    class="thumb"
    src=""
    alt="${survey.kos.name}"
    loading="lazy"
    data-photo-id="${photoId}"
    data-kos-name="${survey.kos.name}"
  />`;
}

/** The status word stays as the icon's name and tooltip. */
const statusIcon = (paths) =>
  '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="none" ' +
  `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const STATUS_ICONS = {
  [STATUS.DRAFT]: statusIcon('<circle cx="10" cy="10" r="7.25" pathLength="20" stroke-dasharray="1 1.5"/>'),
  [STATUS.PUBLISHED]: statusIcon('<circle cx="10" cy="10" r="7.25"/><path d="m6.9 10.2 2.2 2.2 4-4.3"/>'),
};

function statusBadge(survey) {
  const label = STATUS_LABELS[survey.status];
  return html`<span
    class="status"
    data-status="${survey.status}"
    role="img"
    aria-label="${label}"
    title="${label}"
  >${raw(STATUS_ICONS[survey.status] ?? '')}</span>`;
}

function fact(label, value) {
  return html`
    <div class="card__fact">
      <span class="card__fact-label">${label}</span>
      <span class="card__fact-value numeric">${value}</span>
    </div>
  `;
}

export function surveyCard(survey, { variant = 'own', starred = false, inCompare = false } = {}) {
  const isCommunity = variant === 'community';
  const href = isCommunity ? `#/community/${survey.id}` : `#/surveys/${survey.id}`;

  // The location only: a community card does not name who shared it.
  const meta = html`<span class="meta">${survey.kos.kosLocation?.label}</span>`;

  const badge = isCommunity
    ? html`<span class="meta">${kosTypeLabel(survey.kos.type)}</span>`
    : statusBadge(survey);

  const actions = isCommunity
    ? html`
        <a class="btn btn--secondary btn--small" href="${href}">View</a>
        <button
          class="btn btn--secondary btn--small"
          type="button"
          data-action="toggle-compare"
          data-id="${survey.id}"
        >${inCompare ? 'In comparison' : 'Add to compare'}</button>
        ${starButton(survey, { starred, small: true })}
      `
    : html`
        <a class="btn btn--secondary btn--small" href="${href}">View</a>
        ${editLink(survey, { small: true })}
        ${deleteButton(survey, { small: true })}
      `;

  return html`
    <article class="card survey-card">
      ${thumb(survey)}
      <div class="survey-card__body">
        <h2 class="card__title">
          <a class="survey-card__link" href="${href}">${survey.kos.name}</a>
        </h2>
        <div class="survey-card__meta">
          ${meta}
          ${badge}
        </div>
        <div class="survey-card__facts">
          ${fact('Rent', numberToCurrency(survey.kos.rent))}
          ${fact('To campus', formatKosDistance(survey.kos))}
        </div>
        <div class="survey-card__actions">${actions}</div>
      </div>
    </article>
  `;
}
