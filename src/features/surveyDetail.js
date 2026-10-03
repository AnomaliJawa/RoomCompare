import { html, raw } from '../utils/dom.js';
import { numberToCurrency, formatKosDistance } from '../utils/format.js';
import { findSurvey, isOwnSurvey, isStarred, getState, canCompare } from '../store.js';
import { notFound } from '../components/emptyState.js';
import { galleryField, mountGalleries } from '../components/photoGallery.js';
import { starButton } from '../components/starButton.js';
import { breadcrumbs } from '../components/breadcrumbs.js';
import { editLink, deleteButton } from '../components/surveyActions.js';
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

/** Missing values read "Not recorded": unknown and absent are different facts. */
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

/** The href keeps only digits and a leading +; the label stays as typed. */
function contactValue(phone) {
  if (!phone) return null;
  const href = phone.replace(/[^+0-9]/g, '');
  return href ? html`<a href="tel:${href}">${phone}</a>` : html`${phone}`;
}

/** Every facility is listed, present or absent: "No AC" is information. */
function checklist(all, selected) {
  const chosen = new Set(selected ?? []);
  return html`
    <ul class="checklist">
      ${raw(
        all
          .map(
            (item) => html`<li class="checklist__item" data-present="${chosen.has(item)}">
              <span class="checklist__mark" aria-hidden="true">${chosen.has(item) ? '✓' : '✗'}</span>
              <span>${item}</span>
              <span class="visually-hidden">${chosen.has(item) ? 'present' : 'not available'}</span>
            </li>`,
          )
          .join(''),
      )}
    </ul>
  `;
}

/** Decorative: the heading's words name the section, so screen readers skip the icon. */
const icon = (paths) =>
  '<svg width="24" height="24" viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="none" ' +
  `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const SECTION_ICONS = {
  kos: icon('<path d="M2.5 9.5 10 3l7.5 6.5"/><path d="M4.5 8v8.5h11V8"/><path d="M8.25 16.5V12h3.5v4.5"/>'),
  room: icon(
    '<path d="M2.5 4.5v12M17.5 10v6.5M2.5 10h15M2.5 13.5h15"/>' +
      '<rect x="4.5" y="6.75" width="4.5" height="3.25" rx="1"/>',
  ),
  bathroom: icon(
    '<path d="M2.5 10h15v2a4.5 4.5 0 0 1-4.5 4.5H7A4.5 4.5 0 0 1 2.5 12z"/>' +
      '<path d="M5 10V5.25a2.25 2.25 0 0 1 4.5 0v.5"/><path d="M5.5 16.5 4.75 18M14.5 16.5l.75 1.5"/>',
  ),
  shared: icon(
    '<circle cx="7.5" cy="6.75" r="2.75"/><path d="M2.75 17a4.75 4.75 0 0 1 9.5 0"/>' +
      '<circle cx="14" cy="7.25" r="2.25"/><path d="M13.5 12.25a4.25 4.25 0 0 1 4.25 4.75"/>',
  ),
  surroundings: icon(
    '<path d="M10 17.75s5.5-4.75 5.5-9.5a5.5 5.5 0 0 0-11 0c0 4.75 5.5 9.5 5.5 9.5z"/><circle cx="10" cy="8.25" r="2"/>',
  ),
  additional: icon('<path d="M5 2.5h6.5L15 6v11.5H5z"/><path d="M11.5 2.5V6H15"/><path d="M7.5 10h5M7.5 13h5"/>'),
  media: icon(
    '<path d="M2.5 7A1.5 1.5 0 0 1 4 5.5h2l1.25-2h5.5l1.25 2h2A1.5 1.5 0 0 1 17.5 7v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 15z"/>' +
      '<circle cx="10" cy="10.75" r="3"/>',
  ),
};

function heading(title, iconKey, id = null) {
  const content = html`<span class="section__icon" aria-hidden="true">${raw(SECTION_ICONS[iconKey])}</span>
    <span>${title}</span>`;
  return id
    ? html`<h2 class="section__title" id="${id}">${content}</h2>`
    : html`<h2 class="section__title">${content}</h2>`;
}

function section(title, iconKey, body) {
  return html`
    <section class="panel section">
      <div class="section__head">${heading(title, iconKey)}</div>
      ${raw(body)}
    </section>
  `;
}

const count = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** data-gallery keeps its section name, so the galleries and the lightbox work unchanged. */
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
        ${heading('Photos and videos', 'media', 'media-title')}
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
    ? html`${editLink(survey)} ${deleteButton(survey)}`
    : starButton(survey, { starred: isStarred(survey.id) });

  // The breadcrumbs sit above the head, so its buttons centre on the name; a draft has no Add to compare.
  return html`
    ${breadcrumbs(
      [own ? { label: 'My surveys', href: '#/surveys' } : { label: 'Community', href: '#/community' }],
      survey.kos.name,
    )}
    <div class="page-head">
      <div class="page-head__text">
        <h1>${survey.kos.name}</h1>
        <p class="page-head__lede">
          ${survey.kos.kosLocation?.label}${own ? '' : ` · Shared by ${survey.ownerName}`}
        </p>
      </div>
      <div class="page-head__actions">
        ${canCompare(id)
          ? html`<button
              class="btn btn--secondary"
              type="button"
              data-action="toggle-compare"
              data-id="${survey.id}"
            >${inCompare ? 'In comparison' : 'Add to compare'}</button>`
          : ''}
        ${raw(actions)}
      </div>
    </div>

    <div class="facts panel">
      <div><span class="facts__label">Monthly rent</span><span class="facts__value">${numberToCurrency(survey.kos.rent)}</span></div>
      <div><span class="facts__label">Distance to campus</span><span class="facts__value">${formatKosDistance(survey.kos)}</span></div>
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
        'kos',
        html`<dl class="defn-list">
          ${raw(definition('Type', kosTypeLabel(survey.kos.type)))}
          ${raw(definition('Location', survey.kos.kosLocation?.label))}
          ${raw(definition('Address', survey.kos.kosLocation?.address))}
          ${raw(definition('Pinned at', survey.kos.kosLocation?.lat == null ? null : formatCoordinate(survey.kos.kosLocation)))}
          ${raw(definition('Campus', survey.kos.campusLocation?.label))}
          ${raw(definition('Distance to campus', survey.kos.distanceKm == null ? null : formatKosDistance(survey.kos)))}
          ${raw(definition('Monthly rent', numberToCurrency(survey.kos.rent)))}
          ${raw(definition('Owner or security phone', contactValue(survey.kos.contactPhone)))}
        </dl>`,
      ),
    )}

    ${raw(
      section(
        'Room',
        'room',
        html`
          <dl class="defn-list">
            ${raw(definition('Cleanliness', likertLabel(survey.room.cleanliness)))}
            ${raw(definition('Internet quality', likertLabel(survey.room.internet)))}
          </dl>
          ${raw(checklist(ROOM_FACILITIES, survey.room.facilities))}
        `,
      ),
    )}

    ${raw(section('Bathroom', 'bathroom', checklist(BATHROOM_FACILITIES, survey.bathroom.facilities)))}
    ${raw(section('Shared facilities', 'shared', checklist(SHARED_FACILITIES, survey.shared.facilities)))}
    ${raw(section('Surroundings', 'surroundings', checklist(SURROUNDINGS, survey.surroundings)))}

    ${raw(
      section(
        'Additional information',
        'additional',
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
