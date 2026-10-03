import { html, raw } from '../utils/dom.js';
import { LIKERT } from '../constants.js';
import { numberToCurrency } from '../utils/format.js';

/** Every control has a real <label>, errors are tied by aria-describedby, groups are fieldsets. */

const INFO_ICON =
  '<svg class="field__info-icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
  '<circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.5" />' +
  '<path d="M10 9v5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />' +
  '<circle cx="10" cy="6.25" r="1" fill="currentColor" />' +
  '</svg>';

/** Beside the label, not inside it: a <label> may not hold another control. */
export function infoButton(guide) {
  if (!guide?.key || !guide.panel) return '';
  return html`<button
    class="field__info"
    type="button"
    data-action="open-howto"
    data-guide="${guide.key}"
    aria-label="How to fill ${guide.label}"
    aria-haspopup="dialog"
  >${raw(INFO_ICON)}</button>`;
}

const count = (n) => n.toLocaleString('en-US');

function counter(id, max, length) {
  return html`<span
    class="field__count${length > max ? ' field__count--over' : ''}"
    id="${id}-count"
    data-count-for="${id}"
    data-count-max="${max}"
  >${count(length)}/${count(max)}</span>`;
}

function describedBy(id, { hint, error, guide }) {
  const ids = [];
  if (guide) {
    ids.push(`${id}-hint`);
    if (guide.counter) ids.push(`${id}-count`);
    if (error) ids.push(`${id}-error`);
  } else if (error) ids.push(`${id}-error`);
  else if (hint) ids.push(`${id}-hint`);
  return ids.length ? ids.join(' ') : null;
}

function support(id, { hint, error, guide, value = '' }) {
  if (guide) {
    return html`
      <div class="field__support">
        <span class="field__hint" id="${id}-hint">${guide.helper}</span>
        ${guide.counter ? counter(id, guide.counter, String(value ?? '').length) : ''}
      </div>
      ${error ? html`<span class="field__error" id="${id}-error">${error}</span>` : ''}
    `;
  }
  if (error) return html`<span class="field__error" id="${id}-error">${error}</span>`;
  if (hint) return html`<span class="field__hint" id="${id}-hint">${hint}</span>`;
  return '';
}

function fieldLabel(id, label, guide) {
  const tag = html`<label class="field__label" for="${id}">${label}</label>`;
  return guide ? html`<div class="field__head">${tag}${infoButton(guide)}</div>` : tag;
}

/** The name sits in its own span, so the ⓘ stays out of the group's accessible name. */
function groupLegend(name, legend, guide) {
  if (!guide) return html`<legend class="choice-group__legend">${legend}</legend>`;
  return html`<legend class="choice-group__legend">
    <span id="${name}-legend">${legend}</span>${infoButton(guide)}
  </legend>`;
}

function groupAttributes(name, guide, { rubric = false } = {}) {
  if (!guide) return '';
  const described = [`${name}-hint`, rubric ? `${name}-rubric` : null].filter(Boolean).join(' ');
  return raw(`aria-labelledby="${name}-legend" aria-describedby="${described}"`);
}

function groupHelper(name, guide) {
  return guide ? html`<p class="field__hint choice-group__hint" id="${name}-hint">${guide.helper}</p>` : '';
}

export function textField({
  name,
  label,
  value = '',
  type = 'text',
  placeholder = '',
  hint = '',
  error = '',
  action = '',
  numeric = false,
  id = `f-${name}`,
  // The kos location has a name field and a map pin; only one can own "kosLocation".
  field = name,
  // Autocomplete off for survey fields; account fields name their purpose for password managers.
  autocomplete = 'off',
  inputmode = '',
  plain = false,
  guide = null,
}) {
  const described = describedBy(id, { hint, error, guide });
  return html`
    <div class="field" data-field="${field}" data-invalid="${error ? 'true' : 'false'}">
      ${fieldLabel(id, label, guide)}
      <input
        class="field__control${numeric ? ' numeric' : ''}"
        id="${id}"
        name="${name}"
        type="${type}"
        value="${value ?? ''}"
        placeholder="${placeholder}"
        autocomplete="${autocomplete}"
        ${inputmode ? raw(`inputmode="${inputmode}"`) : ''}
        ${plain ? raw('autocapitalize="none" spellcheck="false"') : ''}
        ${described ? raw(`aria-describedby="${described}"`) : ''}
        ${action ? raw(`data-action="${action}"`) : ''}
      />
      ${raw(support(id, { hint, error, guide, value }))}
    </div>
  `;
}

const CHEVRON_ICON =
  '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="none" ' +
  'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5.5 8 4.5 4.5L14.5 8"/></svg>';

/** One field that takes a typed number or one picked from its list (an ARIA combobox); combobox.js wires it. */
export function comboField({ name, label, value = '', values, unit, id = `f-${name}`, guide = null }) {
  const described = describedBy(id, { guide });
  const listId = `${id}-list`;
  const typed = value === '' || value == null ? '' : String(value);
  return html`
    <div class="field" data-field="${name}" data-invalid="false">
      ${fieldLabel(id, label, guide)}
      <div class="field__group combo" data-combo>
        <input
          class="field__control numeric"
          id="${id}"
          name="${name}"
          type="text"
          inputmode="decimal"
          value="${typed}"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="none"
          aria-expanded="false"
          aria-controls="${listId}"
          ${described ? raw(`aria-describedby="${described}"`) : ''}
        />
        <button
          class="combo__toggle"
          type="button"
          tabindex="-1"
          aria-label="Show ${label} options"
          aria-controls="${listId}"
          aria-expanded="false"
          data-combo-toggle
        >${raw(CHEVRON_ICON)}</button>
        <ul class="combo__list" id="${listId}" role="listbox" aria-label="${label}" hidden>
          ${values.map(
            (choice) => html`<li
              class="combo__option"
              id="${listId}-${choice}"
              role="option"
              data-value="${choice}"
              aria-selected="${typed !== '' && Number(typed) === choice ? 'true' : 'false'}"
            >${choice} ${unit}</li>`,
          )}
        </ul>
      </div>
      ${raw(support(id, { guide, value }))}
    </div>
  `;
}

/** `slider`: { max, step } adds an unnamed range under the field; the typed field stays the value read. */
function currencySlider(id, label, value, { max, step }) {
  const amount = value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
  return html`<input
      class="field__slider"
      type="range"
      min="0"
      max="${max}"
      step="${step}"
      value="${Math.min(amount ?? 0, max)}"
      aria-label="${label}"
      aria-valuetext="${numberToCurrency(amount)}"
      data-slider-for="${id}"
    />
    <div class="field__scale" aria-hidden="true"><span>${numberToCurrency(0)}</span><span>${numberToCurrency(max)}</span></div>`;
}

export function currencyField({
  name,
  label,
  value = '',
  hint = '',
  error = '',
  action = '',
  id = `f-${name}`,
  guide = null,
  slider = null,
}) {
  const described = describedBy(id, { hint, error, guide });
  return html`
    <div class="field" data-field="${name}" data-invalid="${error ? 'true' : 'false'}">
      ${fieldLabel(id, label, guide)}
      <div class="field__group">
        <span class="field__affix" aria-hidden="true">Rp</span>
        <input
          class="field__control numeric"
          id="${id}"
          name="${name}"
          type="text"
          inputmode="numeric"
          value="${value ?? ''}"
          autocomplete="off"
          ${described ? raw(`aria-describedby="${described}"`) : ''}
          ${action ? raw(`data-action="${action}"`) : ''}
        />
      </div>
      ${slider ? currencySlider(id, label, value, slider) : ''}
      ${raw(support(id, { hint, error, guide }))}
    </div>
  `;
}

export function textareaField({
  name,
  label,
  value = '',
  rows = 4,
  placeholder = '',
  hint = '',
  error = '',
  id = `f-${name}`,
  guide = null,
}) {
  const described = describedBy(id, { hint, error, guide });
  return html`
    <div class="field" data-field="${name}" data-invalid="${error ? 'true' : 'false'}">
      ${fieldLabel(id, label, guide)}
      <textarea
        class="field__control"
        id="${id}"
        name="${name}"
        rows="${rows}"
        placeholder="${placeholder}"
        ${described ? raw(`aria-describedby="${described}"`) : ''}
      >${value ?? ''}</textarea>
      ${raw(support(id, { hint, error, guide, value }))}
    </div>
  `;
}

export function selectField({ name, label, value = '', options, action = '', id = `f-${name}` }) {
  return html`
    <div class="field">
      <label class="field__label" for="${id}">${label}</label>
      <select class="field__control" id="${id}" name="${name}" ${action ? raw(`data-action="${action}"`) : ''}>
        ${options.map(
          (option) => html`<option value="${option.value}" ${option.value === value ? raw('selected') : ''}>
            ${option.label}
          </option>`,
        )}
      </select>
    </div>
  `;
}

export function checkboxGroup({ name, legend, options, selected = [], guide = null }) {
  const chosen = new Set(selected);
  return html`
    <fieldset class="choice-group" data-field="${name}" ${groupAttributes(name, guide)}>
      ${groupLegend(name, legend, guide)}
      <div class="choice-group__options">
        ${options.map(
          (option) => html`<label class="choice">
            <input type="checkbox" name="${name}" value="${option}" ${chosen.has(option) ? raw('checked') : ''} />
            ${option}
          </label>`,
        )}
      </div>
      ${groupHelper(name, guide)}
    </fieldset>
  `;
}

/** Always present and empty until chosen, so a screen reader announces each new description. */
export function radioGroup({ name, legend, options, value = null, guide = null, rubric = null }) {
  return html`
    <fieldset class="choice-group" data-field="${name}" ${groupAttributes(name, guide, { rubric: rubric !== null })}>
      ${groupLegend(name, legend, guide)}
      <div class="choice-group__options">
        ${options.map(
          (option) => html`<label class="choice">
            <input type="radio" name="${name}" value="${option.value}" ${option.value === value ? raw('checked') : ''} />
            ${option.label}
          </label>`,
        )}
      </div>
      ${groupHelper(name, guide)}
      ${rubric !== null
        ? html`<p class="rubric" id="${name}-rubric" data-rubric="${name}" aria-live="polite">${rubric}</p>`
        : ''}
    </fieldset>
  `;
}

export function likertField({ name, legend, value = null, guide = null, rubric = null }) {
  return radioGroup({
    name,
    legend,
    guide,
    rubric,
    value: value === null || value === undefined ? null : Number(value),
    options: LIKERT.map((step) => ({ value: step.value, label: `${step.value} ${step.label}` })),
  });
}
