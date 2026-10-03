/** html escapes every interpolated value; markup must go through raw() deliberately. */

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

/** Nested html results compose instead of being escaped into visible text. */
class SafeHtml {
  constructor(value) {
    this.value = value;
    this[RAW] = true;
  }

  toString() {
    return this.value;
  }
}

export function raw(value) {
  if (value instanceof SafeHtml) return value;
  return new SafeHtml(value === null || value === undefined ? '' : String(value));
}

export function isSafeHtml(value) {
  return value instanceof SafeHtml;
}

function resolve(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(resolve).join('');
  if (typeof value === 'object' && value[RAW]) return String(value.value ?? '');
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) {
    out += resolve(values[i]) + strings[i + 1];
  }
  return new SafeHtml(out);
}

export function mount(node, markup) {
  node.innerHTML = String(markup);
  return node;
}

export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/** Scoped to the container, so two forms on a page cannot collide. */
export function getCheckedValues(name, scope = document) {
  return qsa(`input[name="${name}"]:checked`, scope).map((input) => input.value);
}

export function debounce(fn, wait = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function photoPlaceholder(name) {
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  return html`<div class="thumb thumb--empty" aria-hidden="true"><span>${initial}</span></div>`;
}
