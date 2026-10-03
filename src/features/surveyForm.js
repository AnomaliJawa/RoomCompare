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

function guide(key) {
  return { key, ...FIELD_GUIDE[key] };
}

const DISTANCE_PLACEHOLDER = 'Fills in once both pins are set';

/** Only an unreachable route fixes itself later; no route between the pins needs a pin moved. */
const DISTANCE_NOTES = {
  [ROUTE_STATUS.UNAVAILABLE]:
    'The walking route can’t be reached right now, so this is the straight line. It’s replaced once the route can be measured.',
  [ROUTE_STATUS.NO_ROUTE]:
    'No walking route was found between the pins, so this is the straight line. Check that both pins are on or beside a road.',
};

function scoreField(name, legend, value) {
  return likertField({ name, legend, value, guide: guide(name), rubric: rubricText(name, value) });
}

let currencyHandle = null;
let uploaderHandle = null;
let mapHandle = null;
let autosaveTimer = null;

/** Each form makes its own id, carried on the form: a kept id once overwrote the previous draft. */
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
              placeholder="${DISTANCE_PLACEHOLDER}" aria-describedby="f-distanceKm-status" />
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

  // A saved walking distance is kept for the same pins without asking again, even offline.
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
      // A pin move fires no input event, so it is marked here, except for the first reading.
      if (!initial) markDirty();
    },
  }).then((handle) => {
    mapHandle = handle;
  });

  attachGuidance(form);

  if (!form.dataset.id) maybeShowSurveyGuide();

  dirty = false;
  form.addEventListener('input', markDirty);
  form.addEventListener('change', markDirty);

  startAutosave(form);
}

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

/** New surveys only: Cancel on an edit promises the saved version is untouched. */
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

export function readSurveyForm(form) {
  const data = new FormData(form);
  const text = (key) => String(data.get(key) ?? '').trim();
  const num = (key) => {
    const value = text(key);
    if (value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const place = (key) => {
    const label = text(key);
    const address = text(`${key}Address`);
    const lat = num(`${key}Lat`);
    const lng = num(`${key}Lng`);
    if (!label && !address && lat === null && lng === null) return null;
    // The address is kept as typed: it is what the lookup was based on.
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
      // Kept as typed: normalising a phone number could drop a form the user recognises.
      contactPhone: text('contactPhone') || null,
      kosLocation: kosPoint,
      campusLocation: campusPoint,
      // From the pins, never the display field: the walk for exactly these pins, else the straight line.
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
