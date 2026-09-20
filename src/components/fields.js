import { html, raw } from '../utils/dom.js';
import { LIKERT } from '../constants.js';

/**
 * Form controls.
 *
 * Every field carries a real <label> tied to its control, and an error is
 * wired with aria-describedby rather than left as red text floating nearby.
 * Checkbox and radio groups are <fieldset>/<legend>, so a screen reader
 * announces what the group is for before reading twelve options.
 */

function describedBy(id, { hint, error }) {
  const ids = [];
  if (error) ids.push(`${id}-error`);
  else if (hint) ids.push(`${id}-hint`);
  return ids.length ? ids.join(' ') : null;
}

function support(id, { hint, error }) {
  if (error) return html`<span class="field__error" id="${id}-error">${error}</span>`;
  if (hint) return html`<span class="field__hint" id="${id}-hint">${hint}</span>`;
  return '';
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
}) {
  const described = describedBy(id, { hint, error });
  return html`
    <div class="field" data-invalid="${error ? 'true' : 'false'}">
      <label class="field__label" for="${id}">${label}</label>
      <input
        class="field__control${numeric ? ' numeric' : ''}"
        id="${id}"
        name="${name}"
        type="${type}"
        value="${value ?? ''}"
        placeholder="${placeholder}"
        autocomplete="off"
        ${described ? raw(`aria-describedby="${described}"`) : ''}
        ${action ? raw(`data-action="${action}"`) : ''}
      />
      ${raw(support(id, { hint, error }))}
    </div>
  `;
}

/** Rupiah amounts, grouped as the user types. The value is read from dataset. */
export function currencyField({ name, label, value = '', hint = '', error = '', action = '', id = `f-${name}` }) {
  const described = describedBy(id, { hint, error });
  return html`
    <div class="field" data-invalid="${error ? 'true' : 'false'}">
      <label class="field__label" for="${id}">${label}</label>
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
      ${raw(support(id, { hint, error }))}
    </div>
  `;
}

export function textareaField({ name, label, value = '', rows = 4, placeholder = '', hint = '', error = '', id = `f-${name}` }) {
  const described = describedBy(id, { hint, error });
  return html`
    <div class="field" data-invalid="${error ? 'true' : 'false'}">
      <label class="field__label" for="${id}">${label}</label>
      <textarea
        class="field__control"
        id="${id}"
        name="${name}"
        rows="${rows}"
        placeholder="${placeholder}"
        ${described ? raw(`aria-describedby="${described}"`) : ''}
      >${value ?? ''}</textarea>
      ${raw(support(id, { hint, error }))}
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
export function checkboxGroup({ name, legend, options, selected = [] }) {
  const chosen = new Set(selected);
  return html`
    <fieldset class="choice-group">
      <legend class="choice-group__legend">${legend}</legend>
      <div class="choice-group__options">
        ${options.map(
          (option) => html`<label class="choice">
            <input type="checkbox" name="${name}" value="${option}" ${chosen.has(option) ? raw('checked') : ''} />
            ${option}
          </label>`,
        )}
      </div>
    </fieldset>
  `;
}

export function radioGroup({ name, legend, options, value = null }) {
  return html`
    <fieldset class="choice-group">
      <legend class="choice-group__legend">${legend}</legend>
      <div class="choice-group__options">
        ${options.map(
          (option) => html`<label class="choice">
            <input type="radio" name="${name}" value="${option.value}" ${option.value === value ? raw('checked') : ''} />
            ${option.label}
          </label>`,
        )}
      </div>
    </fieldset>
  `;
}

/**
 * The 1-4 scale, as radios rather than a dropdown: all four points and their
 * meanings are visible at once, which is what a rating scale is for.
 */
export function likertField({ name, legend, value = null }) {
  return radioGroup({
    name,
    legend,
    value: value === null || value === undefined ? null : Number(value),
    options: LIKERT.map((step) => ({ value: step.value, label: `${step.value} ${step.label}` })),
  });
}
