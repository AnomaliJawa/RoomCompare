import { html, raw } from '../utils/dom.js';
import { numberToCurrency, formatDistance } from '../utils/format.js';
import { findSurvey, isOwnSurvey, isStarred, getState } from '../store.js';
import { notFound } from '../components/emptyState.js';
import { galleryField, mountGalleries } from '../components/photoGallery.js';
import { formatCoordinate } from '../utils/geo.js';
import {
  ROOM_FACILITIES,
  BATHROOM_FACILITIES,
  SHARED_FACILITIES,
  SURROUNDINGS,
  STATUS_LABELS,
  likertLabel,
  kosTypeLabel,
} from '../constants.js';

/** Missing values read "Not recorded" — unknown and absent are different facts. */
function value(input) {
  if (input === null || input === undefined || input === '') {
    return html`<span class="unrecorded">Not recorded</span>`;
  }
  return html`${input}`;
}

function definition(label, input) {
  return html`
    <div class="defn">
      <dt class="defn__label">${label}</dt>
      <dd class="defn__value">${raw(value(input))}</dd>
    </div>
  `;
}

/**
 * Facilities are shown as the full checklist with present and absent marked,
 * not as a list of what happens to be there. "No AC" is information.
 */
function checklist(all, selected) {
  const chosen = new Set(selected ?? []);
  return html`
    <ul class="checklist">
      ${raw(
        all
          .map(
            (item) => html`<li class="checklist__item" data-present="${chosen.has(item)}">
              <span class="checklist__mark" aria-hidden="true">${chosen.has(item) ? '✓' : '—'}</span>
              <span>${item}</span>
              <span class="visually-hidden">${chosen.has(item) ? 'present' : 'not available'}</span>
            </li>`,
          )
          .join(''),
      )}
    </ul>
  `;
}

function section(title, body) {
  return html`
    <section class="panel section">
      <div class="section__head"><h2>${title}</h2></div>
      ${raw(body)}
    </section>
  `;
}

function photos(ids, section, label) {
  return galleryField({ section, label: `${label} photos`, mediaIds: ids ?? [] });
}

export function renderSurveyDetail({ id }) {
  const survey = findSurvey(id);
  if (!survey) {
    return notFound({
      title: 'That survey is not here',
      body: 'It may have been deleted, or the link may be wrong.',
      backHref: '#/surveys',
      backLabel: 'Back to my surveys',
    });
  }

  const own = isOwnSurvey(id);
  const { compareSelection } = getState();
  const inCompare = compareSelection.includes(id);

  const actions = own
    ? html`
        <a class="btn btn--secondary" href="#/surveys/${survey.id}/edit">Edit</a>
        <button class="btn btn--danger" type="button" data-action="ask-delete" data-id="${survey.id}">Delete</button>
      `
    : html`
        <button
          class="btn btn--secondary"
          type="button"
          data-action="toggle-star"
          data-id="${survey.id}"
          aria-pressed="${isStarred(survey.id) ? 'true' : 'false'}"
        >${isStarred(survey.id) ? 'Starred' : 'Star'}</button>
      `;

  return html`
    <div class="page-head">
      <div class="page-head__text">
        <a class="btn btn--quiet btn--small" href="${own ? '#/surveys' : '#/community'}">Back</a>
        <h1>${survey.kos.name}</h1>
        <p class="page-head__lede">
          ${survey.kos.kosLocation?.label}${own ? '' : ` · Shared by ${survey.ownerName}`}
        </p>
      </div>
      <div class="page-head__actions">
        <button
          class="btn btn--secondary"
          type="button"
          data-action="toggle-compare"
          data-id="${survey.id}"
        >${inCompare ? 'In comparison' : 'Add to compare'}</button>
        ${raw(actions)}
      </div>
    </div>

    <div class="facts panel">
      <div><span class="facts__label">Monthly rent</span><span class="facts__value">${numberToCurrency(survey.kos.rent)}</span></div>
      <div><span class="facts__label">Distance to campus</span><span class="facts__value">${formatDistance(survey.kos.distanceKm)}</span></div>
      <div><span class="facts__label">Room</span><span class="facts__value">${
        survey.room.lengthM && survey.room.widthM
          ? `${survey.room.lengthM} × ${survey.room.widthM} m`
          : 'Not recorded'
      }</span></div>
      ${own ? raw(html`<div><span class="facts__label">Status</span><span class="facts__value">${STATUS_LABELS[survey.status]}</span></div>`) : ''}
    </div>

    ${raw(
      section(
        'Kos information',
        html`<dl class="defn-list">
          ${raw(definition('Type', kosTypeLabel(survey.kos.type)))}
          ${raw(definition('Location', survey.kos.kosLocation?.label))}
          ${raw(definition('Address', survey.kos.kosLocation?.address))}
          ${raw(definition('Pinned at', survey.kos.kosLocation?.lat == null ? null : formatCoordinate(survey.kos.kosLocation)))}
          ${raw(definition('Campus', survey.kos.campusLocation?.label))}
          ${raw(definition('Distance to campus', formatDistance(survey.kos.distanceKm)))}
          ${raw(definition('Monthly rent', numberToCurrency(survey.kos.rent)))}
        </dl>`,
      ),
    )}

    ${raw(
      section(
        'Room',
        html`
          <dl class="defn-list">
            ${raw(definition('Cleanliness', likertLabel(survey.room.cleanliness)))}
            ${raw(definition('Internet quality', likertLabel(survey.room.internet)))}
          </dl>
          ${raw(checklist(ROOM_FACILITIES, survey.room.facilities))}
          ${photos(survey.room.photoIds, 'room', 'room')}
        `,
      ),
    )}

    ${raw(section('Bathroom', html`${raw(checklist(BATHROOM_FACILITIES, survey.bathroom.facilities))}${photos(survey.bathroom.photoIds, 'bathroom', 'bathroom')}`))}
    ${raw(section('Shared facilities', html`${raw(checklist(SHARED_FACILITIES, survey.shared.facilities))}${photos(survey.shared.photoIds, 'shared', 'shared facility')}`))}
    ${raw(section('Surroundings', checklist(SURROUNDINGS, survey.surroundings)))}

    ${raw(
      section(
        'Additional information',
        html`
          <dl class="defn-list">
            ${raw(definition('Security', likertLabel(survey.additional.security)))}
          </dl>
          <p class="notes">${raw(value(survey.additional.notes))}</p>
          ${galleryField({
            section: 'video',
            kind: 'video',
            label: 'videos',
            mediaIds: survey.additional?.videoIds ?? [],
          })}
        `,
      ),
    )}
  `;
}

/** Load the stored blobs once the markup is in the document. */
export function mountSurveyDetail(root) {
  let handle = null;
  mountGalleries(root).then((result) => {
    handle = result;
  });
  return {
    destroy() {
      handle?.destroy();
    },
  };
}
