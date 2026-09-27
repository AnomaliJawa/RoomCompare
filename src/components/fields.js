import { html, raw } from '../utils/dom.js';
import { LIKERT } from '../constants.js';

/**
 * Form controls.
 *
 * Every field carries a real <label> tied to its control, and an error is
 * wired with aria-describedby rather than left as red text floating nearby.
 * Checkbox and radio groups are <fieldset>/<legend>, so a screen reader
 * announces what the group is for before reading twelve options.
 *
 * A survey field can also carry guidance (content/guidance.js, passed as
 * `guide`): a helper line that is always shown, a character limit counted
 * as the user types, and an ⓘ that opens its How to fill panel. Fields
 * without a guide render as they always have.
 */

// An "i" in a circle, drawn in the button's own colour.
const INFO_ICON =
  '<svg class="field__info-icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
  '<circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.5" />' +
  '<path d="M10 9v5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />' +
  '<circle cx="10" cy="6.25" r="1" fill="currentColor" />' +
  '</svg>';

/**
 * The ⓘ beside a label, which opens the field's How to fill panel. It sits
 * next to the label rather than inside it: a <label> may not hold another
 * control, and its name would join the field's.
 */
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

/** A field's label, in a head row with its ⓘ when the field carries guidance. */
function fieldLabel(id, label, guide) {
  const tag = html`<label class="field__label" for="${id}">${label}</label>`;
  return guide ? html`<div class="field__head">${tag}${infoButton(guide)}</div>` : tag;
}

/**
 * A group's legend. With guidance, the name sits in its own span, which the
 * fieldset is labelled by, so the ⓘ beside it stays out of the group's
 * accessible name.
 */
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
  // Error key, when it differs from the form name. The kos location has both
  // a name field and a map pin; only one of them can own "kosLocation".
  field = name,
  // Survey fields keep autocomplete off: a browser suggestion for "Kos name"
  // is always wrong. Account fields name their purpose, so password managers
  // fill them and phones offer the right keyboard.
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

/** Rupiah amounts, grouped as the user types. The value is read from dataset. */
export function currencyField({ name, label, value = '', hint = '', error = '', action = '', id = `f-${name}`, guide = null }) {
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

/** A real fieldset, rendered from an enum so the labels cannot drift. */
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

/**
 * `rubric` adds a line under the options that describes the chosen level. It
 * is always present, and empty until a level is chosen, so a screen reader
 * announces each new description as the choice changes.
 */
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

/**
 * The 1-4 scale, as radios rather than a dropdown: all four points and their
 * meanings are visible at once, which is what a rating scale is for.
 * `rubric` is the description of the saved level, or '' before one is chosen.
 */
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
