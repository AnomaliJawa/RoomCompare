import { html, raw, qs, getCheckedValues } from '../utils/dom.js';
import { findSurvey, isOwnSurvey } from '../store.js';
import { attachCurrencyInput } from '../components/currencyInput.js';
import {
  GUIDELINES,
  KOS_TYPES,
  LIKERT,
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

function section(index, title, guideline, body) {
  return html`
    <section class="form-section">
      <div class="form-section__head">
        <span class="form-section__number" aria-hidden="true">${index}</span>
        <h2>${title}</h2>
      </div>
      <p class="form-section__guide">${guideline}</p>
      <div class="form-section__body">${raw(body)}</div>
    </section>
  `;
}

function textField(name, label, val, { type = 'text', placeholder = '', hint = '' } = {}) {
  return html`
    <div class="field">
      <label class="field__label" for="f-${name}">${label}</label>
      <input class="field__control ${type === 'number' ? 'numeric' : ''}" id="f-${name}" name="${name}"
        type="${type}" value="${val ?? ''}" placeholder="${placeholder}" autocomplete="off" />
      ${hint ? raw(html`<span class="field__hint">${hint}</span>`) : ''}
    </div>
  `;
}

function checkboxGroup(name, legend, options, selected) {
  const chosen = new Set(selected ?? []);
  return html`
    <fieldset class="choice-group">
      <legend class="choice-group__legend">${legend}</legend>
      <div class="choice-group__options">
        ${raw(
          options
            .map(
              (option) => html`<label class="choice">
                <input type="checkbox" name="${name}" value="${option}" ${chosen.has(option) ? 'checked' : ''} />
                ${option}
              </label>`,
            )
            .join(''),
        )}
      </div>
    </fieldset>
  `;
}

function likertField(name, legend, val) {
  return html`
    <fieldset class="choice-group">
      <legend class="choice-group__legend">${legend}</legend>
      <div class="choice-group__options">
        ${raw(
          LIKERT.map(
            (step) => html`<label class="choice">
              <input type="radio" name="${name}" value="${step.value}" ${Number(val) === step.value ? 'checked' : ''} />
              ${step.value} ${step.label}
            </label>`,
          ).join(''),
        )}
      </div>
    </fieldset>
  `;
}

function photoNote(count, label) {
  return html`<p class="field__hint">
    ${count ? `${count} ${label} photos recorded.` : `No ${label} photos yet.`}
    Up to ${MAX_PHOTOS_PER_SECTION} per section once photo upload is available.
  </p>`;
}

export function renderSurveyForm({ id } = {}) {
  const editing = Boolean(id);
  const survey = editing ? findSurvey(id) : null;

  if (editing && (!survey || !isOwnSurvey(id))) {
    return html`
      <section class="empty">
        <p class="empty__title">That survey cannot be edited</p>
        <p class="empty__body">It may have been deleted, or it belongs to someone else.</p>
        <a class="btn btn--secondary" href="#/surveys">Back to my surveys</a>
      </section>
    `;
  }

  const kos = survey?.kos ?? {};
  const room = survey?.room ?? {};

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

    <form class="survey-form" id="survey-form" data-action="submit-survey" data-id="${survey?.id ?? ''}" novalidate>
      ${raw(
        section(
          1,
          'Kos information',
          GUIDELINES.kos,
          html`
            <div class="form-grid">
              ${raw(textField('name', 'Kos name', kos.name, { placeholder: 'e.g. Kos Melati Residence' }))}
              ${raw(
                html`<fieldset class="choice-group">
                  <legend class="choice-group__legend">Kos type</legend>
                  <div class="choice-group__options">
                    ${raw(
                      KOS_TYPES.map(
                        (t) => html`<label class="choice">
                          <input type="radio" name="type" value="${t.value}" ${kos.type === t.value ? 'checked' : ''} />
                          ${t.label}
                        </label>`,
                      ).join(''),
                    )}
                  </div>
                </fieldset>`,
              )}
              ${raw(textField('kosLocation', 'Kos location', kos.kosLocation?.label, { placeholder: 'e.g. Lowokwaru, Malang', hint: 'Map pinning arrives with the map picker.' }))}
              ${raw(textField('campusLocation', 'Campus location', kos.campusLocation?.label, { placeholder: 'e.g. Universitas Brawijaya' }))}
              ${raw(textField('distanceKm', 'Distance to campus (km)', kos.distanceKm, { type: 'number', hint: 'Entered by hand for now; later derived from the two pins.' }))}
              <div class="field">
                <label class="field__label" for="f-rent">Monthly rent</label>
                <div class="field__group">
                  <span class="field__affix" aria-hidden="true">Rp</span>
                  <input class="field__control numeric" id="f-rent" name="rent" type="text"
                    inputmode="numeric" value="${kos.rent ?? ''}" autocomplete="off" />
                </div>
              </div>
            </div>
          `,
        ),
      )}

      ${raw(
        section(
          2,
          'Room',
          GUIDELINES.room,
          html`
            <div class="form-grid">
              ${raw(textField('lengthM', 'Room length (m)', room.lengthM, { type: 'number' }))}
              ${raw(textField('widthM', 'Room width (m)', room.widthM, { type: 'number' }))}
            </div>
            ${raw(checkboxGroup('roomFacility', 'Room facilities', ROOM_FACILITIES, room.facilities))}
            ${raw(likertField('cleanliness', 'Cleanliness', room.cleanliness))}
            ${raw(likertField('internet', 'Internet quality', room.internet))}
            ${raw(photoNote(room.photoIds?.length ?? 0, 'room'))}
          `,
        ),
      )}

      ${raw(
        section(
          3,
          'Bathroom',
          GUIDELINES.bathroom,
          html`${raw(checkboxGroup('bathroomFacility', 'Bathroom facilities', BATHROOM_FACILITIES, survey?.bathroom?.facilities))}
          ${raw(photoNote(survey?.bathroom?.photoIds?.length ?? 0, 'bathroom'))}`,
        ),
      )}

      ${raw(
        section(
          4,
          'Shared facilities',
          GUIDELINES.shared,
          html`${raw(checkboxGroup('sharedFacility', 'Shared facilities', SHARED_FACILITIES, survey?.shared?.facilities))}
          ${raw(photoNote(survey?.shared?.photoIds?.length ?? 0, 'shared facility'))}`,
        ),
      )}

      ${raw(section(5, 'Surroundings', GUIDELINES.surroundings, checkboxGroup('surrounding', 'Around the kos', SURROUNDINGS, survey?.surroundings)))}

      ${raw(
        section(
          6,
          'Additional information',
          GUIDELINES.additional,
          html`
            ${raw(likertField('security', 'Security', survey?.additional?.security))}
            <div class="field">
              <label class="field__label" for="f-notes">Additional notes</label>
              <textarea class="field__control" id="f-notes" name="notes" rows="4"
                placeholder="Anything the sections above do not cover.">${survey?.additional?.notes ?? ''}</textarea>
            </div>
          `,
        ),
      )}

      <div class="form-actions">${raw(actions)}</div>
    </form>
  `;
}

/** Attach the currency behaviour once the form markup is in the document. */
export function mountSurveyForm(root) {
  const rent = qs('#f-rent', root);
  if (!rent) return;
  currencyHandle?.destroy();
  currencyHandle = attachCurrencyInput(rent);
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
      photoIds: [],
    },
    bathroom: { facilities: getCheckedValues('bathroomFacility', form), photoIds: [] },
    shared: { facilities: getCheckedValues('sharedFacility', form), photoIds: [] },
    surroundings: getCheckedValues('surrounding', form),
    additional: { security: num('security'), notes: text('notes'), videoIds: [] },
  };
}
