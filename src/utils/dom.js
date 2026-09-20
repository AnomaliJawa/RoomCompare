/**
 * DOM and templating helpers.
 *
 * Every template in the prototype interpolated user input into innerHTML
 * unescaped, so a kos named `<img onerror=...>` broke the page. The `html`
 * tag below escapes interpolated values by default; anything already built
 * as markup has to be passed through `raw()` deliberately.
 */

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

const RAW = Symbol('raw');

/** Mark a string as trusted markup so `html` will not escape it. */
export function raw(value) {
  return { [RAW]: true, value: value === null || value === undefined ? '' : String(value) };
}

function resolve(value) {
  if (value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(resolve).join('');
  if (typeof value === 'object' && value[RAW]) return value.value;
  return escapeHtml(value);
}

/** Tagged template that escapes interpolations. Arrays are joined. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) {
    out += resolve(values[i]) + strings[i + 1];
  }
  return out;
}

/** Render markup into a node, replacing its contents. */
export function mount(node, markup) {
  node.innerHTML = markup;
  return node;
}

export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/**
 * Checked values of a named group, scoped to a container.
 * The prototype queried `document`, which would collide once two forms exist.
 */
export function getCheckedValues(name, scope = document) {
  return qsa(`input[name="${name}"]:checked`, scope).map((input) => input.value);
}

/** Debounce, for search inputs. */
export function debounce(fn, wait = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Placeholder tile for a survey with no photos recorded. */
export function photoPlaceholder(name) {
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  return html`<div class="thumb thumb--empty" aria-hidden="true"><span>${initial}</span></div>`;
}
