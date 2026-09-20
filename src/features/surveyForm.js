import { html, raw, qs, getCheckedValues } from '../utils/dom.js';
import { findSurvey, isOwnSurvey } from '../store.js';
import { attachCurrencyInput } from '../components/currencyInput.js';
import { uploaderField, mountUploaders } from '../components/mediaUploader.js';
import { mapPickerField, mountMapPickers } from '../components/mapPicker.js';
import { formatDistance } from '../utils/format.js';
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
 * Locations are pinned on a map and the distance between them is derived, so
 * the number cannot drift from the two points it describes. Photos are stored
 * as they are chosen. Validation beyond a required name arrives with the
 * validation phase.
 */

let currencyHandle = null;
let uploaderHandle = null;
let mapHandle = null;
let autosaveTimer = null;

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
              label: 'Kos location name',
              value: kos.kosLocation?.label,
              placeholder: 'e.g. Lowokwaru, Malang',
              hint: 'What you will recognise it by in a list.',
            })}
            ${textField({
              name: 'campusLocation',
              label: 'Campus name',
              value: kos.campusLocation?.label,
              placeholder: 'e.g. Universitas Brawijaya',
            })}
          </div>
          <div class="map-pair">
            ${mapPickerField({
              name: 'kosLocation',
              label: 'Pin the kos',
              addressLabel: 'Kos address',
              placeholder: 'e.g. Jl. Sumbersari 12, Malang',
              hint: 'Search the address, tap the map, or drag the marker.',
              point: kos.kosLocation,
            })}
            ${mapPickerField({
              name: 'campusLocation',
              label: 'Pin the campus',
              addressLabel: 'Campus address',
              placeholder: 'e.g. Universitas Brawijaya',
              hint: 'The distance below is measured between the two pins.',
              point: kos.campusLocation,
            })}
          </div>
          <div class="field">
            <label class="field__label" for="f-distanceKm">Distance to campus</label>
            <input class="field__control numeric" id="f-distanceKm" name="distanceKm" type="text"
              value="${kos.distanceKm ?? ''}" readonly aria-describedby="f-distanceKm-hint" />
            <span class="field__hint" id="f-distanceKm-hint" data-distance-readout>
              ${kos.distanceKm == null ? 'Pin both places to measure the distance.' : formatDistance(kos.distanceKm)}
            </span>
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

      <div class="form-actions">
        <span class="form-actions__note meta" data-autosave-note role="status" aria-live="polite"></span>
        ${actions}
      </div>
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
  uploaderHandle = mountUploaders(form, { surveyId: form.dataset.surveyId, onChange: markDirty });

  mapHandle?.destroy();
  mountMapPickers(form, {
    onDistance: (km) => {
      const field = qs('#f-distanceKm', form);
      const readout = qs('[data-distance-readout]', form);
      if (!field) return;
      field.value = km ?? '';
      if (readout) {
        readout.textContent = km == null ? 'Pin both places to measure the distance.' : formatDistance(km);
      }
      markDirty();
    },
  }).then((handle) => {
    mapHandle = handle;
  });

  // Anything the user touches counts, so Cancel can ask before discarding.
  dirty = false;
  form.addEventListener('input', markDirty);
  form.addEventListener('change', markDirty);

  startAutosave(form);
}

let dirty = false;

function markDirty() {
  dirty = true;
}

export function isFormDirty() {
  return dirty;
}

export function teardownSurveyForm() {
  clearInterval(autosaveTimer);
  autosaveTimer = null;
  mapHandle?.destroy();
  mapHandle = null;
  uploaderHandle?.destroy();
  uploaderHandle = null;
  dirty = false;
}

/**
 * Autosave applies to new surveys only.
 *
 * A survey is recorded on a phone, mid-visit, and losing it to a dropped tab
 * would be the worst failure this form has. An edit is left alone: Cancel
 * there promises the saved version is untouched, and autosaving would break
 * that promise.
 */
const AUTOSAVE_MS = 30000;

function startAutosave(form) {
  clearInterval(autosaveTimer);
  if (form.dataset.id) return;

  autosaveTimer = setInterval(() => {
    if (!dirty) return;
    const name = qs('#f-name', form)?.value.trim();
    if (!name) return;
    form.dispatchEvent(new CustomEvent('autosave', { bubbles: true }));
  }, AUTOSAVE_MS);
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
  /**
   * A place is kept when it has a pin or a name. Coordinates come from the
   * map; the label is what lists and tables display.
   */
  const place = (key) => {
    const label = text(key);
    const address = text(`${key}Address`);
    const lat = num(`${key}Lat`);
    const lng = num(`${key}Lng`);
    if (!label && !address && lat === null && lng === null) return null;
    // The address is kept as typed: it is what the lookup was based on, and
    // reopening the form should show the user what they entered.
    return { lat, lng, label: label || address || null, address: address || null };
  };
  const ids = (key) => text(key).split(',').filter(Boolean);
  const rentInput = qs('#f-rent', form);

  return {
    kos: {
      name: text('name'),
      type: text('type') || null,
      kosLocation: place('kosLocation'),
      campusLocation: place('campusLocation'),
      // Derived from the two pins by the map picker; never hand-edited.
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
