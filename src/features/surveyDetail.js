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

const count = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/**
 * Every photo and video in one panel, grouped by the part of the kos it shows.
 * Spread through the sections, they were hard to review together, and a
 * survey without any read as four separate "No … recorded" lines.
 *
 * The groups follow the form's order, and the galleries are the same ones the
 * sections held: `data-gallery` keeps its section name, so mountGalleries,
 * the lightbox and the "not on this device" note work unchanged.
 */
function mediaPanel(survey) {
  const groups = [
    { title: 'Room', section: 'room', label: 'room photos', ids: survey.room?.photoIds },
    { title: 'Bathroom', section: 'bathroom', label: 'bathroom photos', ids: survey.bathroom?.photoIds },
    { title: 'Shared facilities', section: 'shared', label: 'shared facility photos', ids: survey.shared?.photoIds },
    { title: 'Videos', section: 'video', label: 'videos', ids: survey.additional?.videoIds, kind: 'video' },
  ].map((group) => ({ ...group, ids: group.ids ?? [] }));

  const photoCount = groups.filter((group) => !group.kind).reduce((sum, group) => sum + group.ids.length, 0);
  const videoCount = groups.find((group) => group.kind === 'video').ids.length;
  const summary = [photoCount && count(photoCount, 'photo'), videoCount && count(videoCount, 'video')]
    .filter(Boolean)
    .join(', ');

  return html`
    <section class="panel section" aria-labelledby="media-title">
      <div class="section__head">
        <h2 id="media-title">Photos and videos</h2>
        ${summary ? html`<span class="meta">${summary}</span>` : ''}
      </div>
      ${summary
        ? html`<div class="media-groups">
            ${groups.map(
              (group) => html`<div class="media-group">
                <h3 class="media-group__title">${group.title}</h3>
                ${galleryField({ section: group.section, label: group.label, mediaIds: group.ids, kind: group.kind })}
              </div>`,
            )}
          </div>`
        : html`<p class="meta">No photos or videos recorded.</p>`}
    </section>
  `;
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
        `,
      ),
    )}

    ${raw(section('Bathroom', checklist(BATHROOM_FACILITIES, survey.bathroom.facilities)))}
    ${raw(section('Shared facilities', checklist(SHARED_FACILITIES, survey.shared.facilities)))}
    ${raw(section('Surroundings', checklist(SURROUNDINGS, survey.surroundings)))}

    ${raw(
      section(
        'Additional information',
        html`
          <dl class="defn-list">
            ${raw(definition('Security', likertLabel(survey.additional.security)))}
          </dl>
          <p class="notes">${raw(value(survey.additional.notes))}</p>
        `,
      ),
    )}

    ${mediaPanel(survey)}
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
