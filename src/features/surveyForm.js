import { html, raw, qs, getCheckedValues } from '../utils/dom.js';
import { findSurvey, isOwnSurvey } from '../store.js';
import { attachCurrencyInput } from '../components/currencyInput.js';
import { uploaderField, mountUploaders } from '../components/mediaUploader.js';
import { notFound } from '../components/emptyState.js';
import {
  textField,
  currencyField,
  textareaField,
  checkboxGroup,
  radioGroup,
  likertField,
} from '../components/fields.js';
import {
  GUIDELINES,
  KOS_TYPES,
  ROOM_FACILITIES,
  BATHROOM_FACILITIES,
  SHARED_FACILITIES,
  SURROUNDINGS,
  MAX_PHOTOS_PER_SECTION,
} from '../constants.js';

/**
 * The survey form.
 *
 * Sections are numbered because this form genuinely is a sequence and the
 * requirement numbers it that way — the only place numbered markers are used.
 *
 * Interim in this phase: locations are typed rather than pinned on a map, the
 * distance is entered by hand rather than derived from two coordinates, and
 * photo pickers are not yet wired. Those arrive with the map and media work.
 */

let currencyHandle = null;
let uploaderHandle = null;

/**
 * A new survey is given its id when the form opens, not when it is saved.
 *
 * Photos are stored the moment they are chosen — a survey is filled in while
 * standing in the room, and an interrupted session should not lose them — and
 * a stored file needs a survey to belong to. Media left by a form that is
 * never saved is swept on the next boot.
 */
let draftId = null;

export function formSurveyId(editingId) {
  if (editingId) return editingId;
  if (!draftId) draftId = `svy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return draftId;
}

export function clearDraftId() {
  draftId = null;
}

function section(index, title, guideline, body) {
  return html`
    <section class="form-section">
      <div class="form-section__head">
        <span class="form-section__number" aria-hidden="true">${index}</span>
        <h2>${title}</h2>
      </div>
      <p class="form-section__guide">${guideline}</p>
      <div class="form-section__body">${body}</div>
    </section>
  `;
}

export function renderSurveyForm({ id } = {}) {
  const editing = Boolean(id);
  const survey = editing ? findSurvey(id) : null;

  if (editing && (!survey || !isOwnSurvey(id))) {
    return notFound({
      title: 'That survey cannot be edited',
      body: 'It may have been deleted, or it belongs to someone else.',
      backHref: '#/surveys',
      backLabel: 'Back to my surveys',
    });
  }

  const kos = survey?.kos ?? {};
  const room = survey?.room ?? {};
  const surveyId = formSurveyId(survey?.id);

  const actions = editing
    ? html`
        <button class="btn btn--quiet" type="button" data-action="cancel-form">Cancel</button>
        <button class="btn btn--primary" type="submit" data-intent="update">Update</button>
      `
    : html`
        <button class="btn btn--quiet" type="button" data-action="cancel-form">Cancel</button>
        <button class="btn btn--secondary" type="submit" data-intent="draft">Save as draft</button>
        <button class="btn btn--primary" type="submit" data-intent="publish">Publish</button>
      `;

  return html`
    <div class="page-head">
      <div class="page-head__text">
        <h1>${editing ? 'Edit survey' : 'New survey'}</h1>
        <p class="page-head__lede">
          ${editing
            ? 'Change what you recorded. Cancel leaves the saved version untouched.'
            : 'Record what you saw during the visit. Only the kos name is needed to save a draft.'}
        </p>
      </div>
    </div>

    <form
      class="survey-form"
      id="survey-form"
      data-action="submit-survey"
      data-id="${survey?.id ?? ''}"
      data-survey-id="${surveyId}"
      novalidate
    >
      ${section(
        1,
        'Kos information',
        GUIDELINES.kos,
        html`
          <div class="form-grid">
            ${textField({ name: 'name', label: 'Kos name', value: kos.name, placeholder: 'e.g. Kos Melati Residence' })}
            ${currencyField({ name: 'rent', label: 'Monthly rent', value: kos.rent ?? '' })}
          </div>
          ${radioGroup({ name: 'type', legend: 'Kos type', value: kos.type, options: KOS_TYPES })}
          <div class="form-grid">
            ${textField({
              name: 'kosLocation',
              label: 'Kos location',
              value: kos.kosLocation?.label,
              placeholder: 'e.g. Lowokwaru, Malang',
              hint: 'Map pinning arrives with the map picker.',
            })}
            ${textField({
              name: 'campusLocation',
              label: 'Campus location',
              value: kos.campusLocation?.label,
              placeholder: 'e.g. Universitas Brawijaya',
            })}
            ${textField({
              name: 'distanceKm',
              label: 'Distance to campus (km)',
              value: kos.distanceKm,
              type: 'number',
              numeric: true,
              hint: 'Entered by hand for now; later derived from the two pins.',
            })}
          </div>
        `,
      )}

      ${section(
        2,
        'Room',
        GUIDELINES.room,
        html`
          <div class="form-grid">
            ${textField({ name: 'lengthM', label: 'Room length (m)', value: room.lengthM, type: 'number', numeric: true })}
            ${textField({ name: 'widthM', label: 'Room width (m)', value: room.widthM, type: 'number', numeric: true })}
          </div>
          ${checkboxGroup({ name: 'roomFacility', legend: 'Room facilities', options: ROOM_FACILITIES, selected: room.facilities })}
          ${likertField({ name: 'cleanliness', legend: 'Cleanliness', value: room.cleanliness })}
          ${likertField({ name: 'internet', legend: 'Internet quality', value: room.internet })}
          ${uploaderField({
            section: 'room',
            label: 'Room photos',
            name: 'roomPhotoIds',
            mediaIds: room.photoIds ?? [],
          })}
        `,
      )}

      ${section(
        3,
        'Bathroom',
        GUIDELINES.bathroom,
        html`
          ${checkboxGroup({
            name: 'bathroomFacility',
            legend: 'Bathroom facilities',
            options: BATHROOM_FACILITIES,
            selected: survey?.bathroom?.facilities,
          })}
          ${uploaderField({
            section: 'bathroom',
            label: 'Bathroom photos',
            name: 'bathroomPhotoIds',
            mediaIds: survey?.bathroom?.photoIds ?? [],
          })}
        `,
      )}

      ${section(
        4,
        'Shared facilities',
        GUIDELINES.shared,
        html`
          ${checkboxGroup({
            name: 'sharedFacility',
            legend: 'Shared facilities',
            options: SHARED_FACILITIES,
            selected: survey?.shared?.facilities,
          })}
          ${uploaderField({
            section: 'shared',
            label: 'Shared facility photos',
            name: 'sharedPhotoIds',
            mediaIds: survey?.shared?.photoIds ?? [],
          })}
        `,
      )}

      ${section(
        5,
        'Surroundings',
        GUIDELINES.surroundings,
        checkboxGroup({
          name: 'surrounding',
          legend: 'Around the kos',
          options: SURROUNDINGS,
          selected: survey?.surroundings,
        }),
      )}

      ${section(
        6,
        'Additional information',
        GUIDELINES.additional,
        html`
          ${likertField({ name: 'security', legend: 'Security', value: survey?.additional?.security })}
          ${textareaField({
            name: 'notes',
            label: 'Additional notes',
            value: survey?.additional?.notes,
            placeholder: 'Anything the sections above do not cover.',
          })}
          ${uploaderField({
            section: 'video',
            kind: 'video',
            label: 'Videos (optional)',
            name: 'videoIds',
            mediaIds: survey?.additional?.videoIds ?? [],
          })}
        `,
      )}

      <div class="form-actions">${actions}</div>
    </form>
  `;
}

/** Attach field behaviour once the form markup is in the document. */
export function mountSurveyForm(root) {
  const form = qs('#survey-form', root);
  if (!form) return;

  const rent = qs('#f-rent', form);
  if (rent) {
    currencyHandle?.destroy();
    currencyHandle = attachCurrencyInput(rent);
  }

  uploaderHandle?.destroy();
  uploaderHandle = mountUploaders(form, { surveyId: form.dataset.surveyId });
}

/** Read the form into the survey shape. Full validation arrives later. */
export function readSurveyForm(form) {
  const data = new FormData(form);
  const text = (key) => String(data.get(key) ?? '').trim();
  const num = (key) => {
    const value = text(key);
    if (value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const place = (key) => (text(key) ? { lat: null, lng: null, label: text(key) } : null);
  const ids = (key) => text(key).split(',').filter(Boolean);
  const rentInput = qs('#f-rent', form);

  return {
    kos: {
      name: text('name'),
      type: text('type') || null,
      kosLocation: place('kosLocation'),
      campusLocation: place('campusLocation'),
      distanceKm: num('distanceKm'),
      rent: rentInput?.dataset.value ? Number(rentInput.dataset.value) : null,
    },
    room: {
      lengthM: num('lengthM'),
      widthM: num('widthM'),
      facilities: getCheckedValues('roomFacility', form),
      cleanliness: num('cleanliness'),
      internet: num('internet'),
      photoIds: ids('roomPhotoIds'),
    },
    bathroom: { facilities: getCheckedValues('bathroomFacility', form), photoIds: ids('bathroomPhotoIds') },
    shared: { facilities: getCheckedValues('sharedFacility', form), photoIds: ids('sharedPhotoIds') },
    surroundings: getCheckedValues('surrounding', form),
    additional: { security: num('security'), notes: text('notes'), videoIds: ids('videoIds') },
  };
}
