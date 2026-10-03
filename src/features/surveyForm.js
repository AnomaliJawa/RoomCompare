import { html, raw, qs, qsa, getCheckedValues } from '../utils/dom.js';
import { findSurvey, isOwnSurvey } from '../store.js';
import { attachCurrencyInput } from '../components/currencyInput.js';
import { uploaderField, mountUploaders } from '../components/mediaUploader.js';
import { mapPickerField, mountMapPickers } from '../components/mapPicker.js';
import { distanceFor, rememberWalkingKm, ROUTE_STATUS } from '../utils/route.js';
import { formatKosDistance } from '../utils/format.js';
import { notFound } from '../components/emptyState.js';
import { surveyGuideButton, maybeShowSurveyGuide } from '../components/surveyGuide.js';
import {
  textField,
  currencyField,
  textareaField,
  checkboxGroup,
  radioGroup,
  likertField,
  infoButton,
} from '../components/fields.js';
import {
  KOS_TYPES,
  ROOM_FACILITIES,
  BATHROOM_FACILITIES,
  SHARED_FACILITIES,
  SURROUNDINGS,
  MAX_PHOTOS_PER_SECTION,
  DISTANCE_BASIS,
} from '../constants.js';
import { SECTION_INTROS, FIELD_GUIDE, rubricText } from '../content/guidance.js';

/** A field's guidance, with its key, which its ⓘ opens the panel by. */
function guide(key) {
  return { key, ...FIELD_GUIDE[key] };
}

const DISTANCE_PLACEHOLDER = 'Fills in once both pins are set';

/**
 * Why the distance shown is a straight line, when it is one. Only a route the
 * service could not be reached for is replaced later by itself; a pair of
 * pins with no walking route between them needs a pin moved.
 */
const DISTANCE_NOTES = {
  [ROUTE_STATUS.UNAVAILABLE]:
    'The walking route can’t be reached right now, so this is the straight line. It’s replaced once the route can be measured.',
  [ROUTE_STATUS.NO_ROUTE]:
    'No walking route was found between the pins, so this is the straight line. Check that both pins are on or beside a road.',
};

/** A 1–4 field with its helper and the description of the saved level. */
function scoreField(name, legend, value) {
  return likertField({ name, legend, value, guide: guide(name), rubric: rubricText(name, value) });
}

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
 * never saved is swept after the next login.
 *
 * Every new form gets its own, carried on the form element. The id used to be
 * kept here until Save or Cancel cleared it, so a form left any other way —
 * through the nav, after autosave had already kept it as a draft — passed its
 * id to the next new survey. That survey's autosave overwrote the draft,
 * saving it added a second record under the same id, and the server, which
 * keeps one record per id, kept only one of them.
 */
export function newSurveyId() {
  return `svy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function section(index, title, intro, body) {
  return html`
    <section class="form-section" data-section="${index}">
      <div class="form-section__head">
        <span class="form-section__number" aria-hidden="true">${index}</span>
        <h2>${title}</h2>
        <span class="form-section__errors" data-section-errors hidden></span>
      </div>
      <p class="form-section__guide">${intro}</p>
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
  const surveyId = survey?.id ?? newSurveyId();

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
        <div class="page-head__title">
          <h1>${editing ? 'Edit survey' : 'New survey'}</h1>
          ${surveyGuideButton()}
        </div>
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
      <div class="error-summary" data-error-summary hidden role="alert"></div>

      ${section(
        1,
        'Kos information',
        SECTION_INTROS.kos,
        html`
          <div class="form-grid">
            ${textField({ name: 'name', label: 'Kos name', value: kos.name, placeholder: 'e.g. Kos Melati Residence', guide: guide('name') })}
            ${currencyField({ name: 'rent', label: 'Monthly rent', value: kos.rent ?? '', guide: guide('rent') })}
          </div>
          ${radioGroup({ name: 'type', legend: 'Kos type', value: kos.type, options: KOS_TYPES, guide: guide('type') })}
          ${textField({
            name: 'contactPhone',
            label: 'Owner or security phone',
            value: kos.contactPhone,
            type: 'tel',
            inputmode: 'tel',
            plain: true,
            placeholder: 'e.g. 0812-3456-7890',
            guide: guide('contactPhone'),
          })}
          <div class="form-grid">
            ${textField({
              name: 'kosLocation',
              field: 'kosLocationName',
              label: 'Kos location name',
              value: kos.kosLocation?.label,
              placeholder: 'e.g. Lowokwaru, Malang',
              guide: guide('kosLocationName'),
            })}
            ${textField({
              name: 'campusLocation',
              field: 'campusLocationName',
              label: 'Campus name',
              value: kos.campusLocation?.label,
              placeholder: 'e.g. Universitas Brawijaya',
              guide: guide('campusLocationName'),
            })}
          </div>
          <div class="map-pair">
            ${mapPickerField({
              name: 'kosLocation',
              label: 'Pin the kos',
              addressLabel: 'Kos address',
              placeholder: 'e.g. Jl. Sumbersari 12, Malang',
              point: kos.kosLocation,
              guide: guide('kosLocation'),
            })}
            ${mapPickerField({
              name: 'campusLocation',
              label: 'Pin the campus',
              addressLabel: 'Campus address',
              placeholder: 'e.g. Universitas Brawijaya',
              point: kos.campusLocation,
              guide: guide('campusLocation'),
            })}
          </div>
          <div class="field">
            <div class="field__head">
              <label class="field__label" for="f-distanceKm">Distance to campus</label>
              ${infoButton(guide('distance'))}
            </div>
            <input class="field__control numeric" id="f-distanceKm" name="distanceKm" type="text"
              value="${kos.distanceKm == null ? '' : formatKosDistance(kos)}" readonly
              placeholder="${DISTANCE_PLACEHOLDER}" aria-describedby="f-distanceKm-hint f-distanceKm-status" />
            <span class="field__hint" id="f-distanceKm-hint">${guide('distance').helper}</span>
            <span class="field__hint" id="f-distanceKm-status" data-distance-status role="status" aria-live="polite"></span>
            <span class="field__credit">Route data © OpenStreetMap contributors</span>
          </div>
        `,
      )}

      ${section(
        2,
        'Room',
        SECTION_INTROS.room,
        html`
          <div class="form-grid">
            ${textField({ name: 'lengthM', label: 'Room length (m)', value: room.lengthM, type: 'number', numeric: true, guide: guide('lengthM') })}
            ${textField({ name: 'widthM', label: 'Room width (m)', value: room.widthM, type: 'number', numeric: true, guide: guide('widthM') })}
          </div>
          ${checkboxGroup({
            name: 'roomFacility',
            legend: 'Room facilities',
            options: ROOM_FACILITIES,
            selected: room.facilities,
            guide: guide('roomFacility'),
          })}
          ${scoreField('cleanliness', 'Cleanliness', room.cleanliness)}
          ${scoreField('internet', 'Internet quality', room.internet)}
          ${uploaderField({
            section: 'room',
            label: 'Room photos',
            name: 'roomPhotoIds',
            mediaIds: room.photoIds ?? [],
            guide: guide('roomPhotos'),
          })}
        `,
      )}

      ${section(
        3,
        'Bathroom',
        SECTION_INTROS.bathroom,
        html`
          ${checkboxGroup({
            name: 'bathroomFacility',
            legend: 'Bathroom facilities',
            options: BATHROOM_FACILITIES,
            selected: survey?.bathroom?.facilities,
            guide: guide('bathroomFacility'),
          })}
          ${uploaderField({
            section: 'bathroom',
            label: 'Bathroom photos',
            name: 'bathroomPhotoIds',
            mediaIds: survey?.bathroom?.photoIds ?? [],
            guide: guide('bathroomPhotos'),
          })}
        `,
      )}

      ${section(
        4,
        'Shared facilities',
        SECTION_INTROS.shared,
        html`
          ${checkboxGroup({
            name: 'sharedFacility',
            legend: 'Shared facilities',
            options: SHARED_FACILITIES,
            selected: survey?.shared?.facilities,
            guide: guide('sharedFacility'),
          })}
          ${uploaderField({
            section: 'shared',
            label: 'Shared facility photos',
            name: 'sharedPhotoIds',
            mediaIds: survey?.shared?.photoIds ?? [],
            guide: guide('sharedPhotos'),
          })}
        `,
      )}

      ${section(
        5,
        'Surroundings',
        SECTION_INTROS.surroundings,
        checkboxGroup({
          name: 'surrounding',
          legend: 'Around the kos',
          options: SURROUNDINGS,
          selected: survey?.surroundings,
          guide: guide('surrounding'),
        }),
      )}

      ${section(
        6,
        'Additional information',
        SECTION_INTROS.additional,
        html`
          ${scoreField('security', 'Security', survey?.additional?.security)}
          ${textareaField({
            name: 'notes',
            label: 'Additional notes',
            value: survey?.additional?.notes,
            placeholder: 'Anything the sections above do not cover.',
            guide: guide('notes'),
          })}
          ${uploaderField({
            section: 'video',
            kind: 'video',
            label: 'Videos (optional)',
            name: 'videoIds',
            mediaIds: survey?.additional?.videoIds ?? [],
            guide: guide('videos'),
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

  // A survey saved with a walking distance keeps it for the same pins without
  // asking the routing service again — and, offline, without falling back to
  // the straight line.
  const saved = form.dataset.id ? findSurvey(form.dataset.id) : null;
  if (saved?.kos?.distanceBasis === DISTANCE_BASIS.WALKING) {
    rememberWalkingKm(saved.kos.kosLocation, saved.kos.campusLocation, saved.kos.distanceKm);
  }

  mapHandle?.destroy();
  mountMapPickers(form, {
    onDistance: ({ km, basis, status }, { initial = false } = {}) => {
      const field = qs('#f-distanceKm', form);
      if (!field) return;
      // Display only: readSurveyForm works the distance out again from the pins.
      field.value = km == null ? '' : formatKosDistance({ distanceKm: km, distanceBasis: basis });
      field.placeholder = status === 'routing' ? 'Measuring the walking route…' : DISTANCE_PLACEHOLDER;
      const note = qs('[data-distance-status]', form);
      if (note) note.textContent = DISTANCE_NOTES[status] ?? '';
      // A pin move fires no input event, so it is marked here — but not the
      // first reading of pins that were already saved.
      if (!initial) markDirty();
    },
  }).then((handle) => {
    mapHandle = handle;
  });

  attachGuidance(form);

  // The first new survey on this device opens with the Survey guide: what to
  // bring and ask before the visit. Editing is later, so it is left alone.
  if (!form.dataset.id) maybeShowSurveyGuide();

  // Anything the user touches counts, so Cancel can ask before discarding.
  dirty = false;
  form.addEventListener('input', markDirty);
  form.addEventListener('change', markDirty);

  startAutosave(form);
}

/**
 * The guidance that answers as the user fills in the form.
 *
 * - Character counters follow every keystroke, so the limit is visible
 *   before it is hit rather than reported after Publish.
 * - A 1–4 score shows what the chosen level means, and changes with the
 *   choice, so two people rating the same room pick the same number.
 */
export function attachGuidance(form) {
  qsa('[data-count-max]', form).forEach((count) => {
    const control = form.ownerDocument.getElementById(count.dataset.countFor);
    if (!control) return;
    const max = Number(count.dataset.countMax);
    const update = () => {
      const length = control.value.length;
      count.textContent = `${length.toLocaleString('en-US')}/${max.toLocaleString('en-US')}`;
      count.classList.toggle('field__count--over', length > max);
    };
    control.addEventListener('input', update);
    update();
  });

  form.addEventListener('change', ({ target }) => {
    if (target.type !== 'radio') return;
    const rubric = target.closest('fieldset')?.querySelector('[data-rubric]');
    if (rubric) rubric.textContent = rubricText(rubric.dataset.rubric, target.value);
  });
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
  const kosPoint = place('kosLocation');
  const campusPoint = place('campusLocation');
  const distance = distanceFor(kosPoint, campusPoint);

  return {
    kos: {
      name: text('name'),
      type: text('type') || null,
      // Contact for the owner or on-site security. Kept as typed — numbers
      // are written with spaces, dashes or a +62, and normalising them could
      // drop a form the user recognises.
      contactPhone: text('contactPhone') || null,
      kosLocation: kosPoint,
      campusLocation: campusPoint,
      // Worked out again from the two pins rather than read back from the
      // display field: the walking route measured for exactly these pins, or
      // the straight line when no route could be had, saying which. Derived
      // data stored beside its inputs can drift from them; this way the saved
      // distance can never belong to other pins than the saved ones.
      distanceKm: distance.km,
      distanceBasis: distance.basis,
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
