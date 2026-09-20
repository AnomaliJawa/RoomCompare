import { html, raw, photoPlaceholder } from '../utils/dom.js';
import { numberToCurrency, formatDistance } from '../utils/format.js';
import { STATUS_LABELS, kosTypeLabel } from '../constants.js';

/**
 * One card for both survey lists.
 *
 * The prototype had two renderers that were ~80% identical and had already
 * drifted apart; merging them is the largest de-duplication in the rebuild.
 */

function thumb(survey) {
  // Media lands in a later phase; every card currently takes the
  // no-photos placeholder, which is a real specified state, not a stub.
  const photoId = survey.room?.photoIds?.[0];
  if (!photoId) return raw(photoPlaceholder(survey.kos.name));
  return html`<img class="thumb" src="" alt="" data-photo-id="${photoId}" />`;
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

  const meta = isCommunity
    ? html`<p class="meta">${survey.kos.kosLocation?.label} · Shared by ${survey.ownerName}</p>`
    : html`<p class="meta">${survey.kos.kosLocation?.label}</p>`;

  const badge = isCommunity
    ? html`<span class="meta">${kosTypeLabel(survey.kos.type)}</span>`
    : html`<span class="status" data-status="${survey.status}">${STATUS_LABELS[survey.status]}</span>`;

  const actions = isCommunity
    ? html`
        <a class="btn btn--secondary btn--small" href="${href}">View</a>
        <button
          class="btn btn--secondary btn--small"
          type="button"
          data-action="toggle-compare"
          data-id="${survey.id}"
        >${inCompare ? 'In comparison' : 'Add to compare'}</button>
        <button
          class="btn btn--quiet btn--small star"
          type="button"
          data-action="toggle-star"
          data-id="${survey.id}"
          aria-pressed="${starred ? 'true' : 'false'}"
        >${starred ? 'Starred' : 'Star'}</button>
      `
    : html`
        <a class="btn btn--secondary btn--small" href="${href}">View</a>
        <a class="btn btn--secondary btn--small" href="#/surveys/${survey.id}/edit">Edit</a>
        <button
          class="btn btn--danger btn--small"
          type="button"
          data-action="ask-delete"
          data-id="${survey.id}"
        >Delete</button>
      `;

  return html`
    <article class="card survey-card">
      ${thumb(survey)}
      <div class="survey-card__body">
        <div class="survey-card__head">
          <h3 class="card__title"><a class="survey-card__link" href="${href}">${survey.kos.name}</a></h3>
          ${badge}
        </div>
        ${meta}
        <div class="survey-card__facts">
          ${fact('Rent', numberToCurrency(survey.kos.rent))}
          ${fact('To campus', formatDistance(survey.kos.distanceKm))}
        </div>
        <div class="survey-card__actions">${actions}</div>
      </div>
    </article>
  `;
}
