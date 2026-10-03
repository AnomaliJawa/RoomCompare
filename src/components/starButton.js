import { html, raw } from '../utils/dom.js';

/** The name stays "Star" and aria-pressed carries the state; CSS fills the icon from it. */

const STAR_ICON =
  '<svg class="star__icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
  '<path d="M10 2.3 12.5 7.36 18.08 8.17 14.04 12.11 15 17.68 10 15.05 5 17.68 5.96 12.11 1.92 8.17 7.5 7.36Z" ' +
  'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />' +
  '</svg>';

export function starButton(survey, { starred = false, small = false } = {}) {
  return html`<button
    class="btn ${small ? 'btn--quiet btn--small' : 'btn--secondary'} btn--icon star"
    type="button"
    data-action="toggle-star"
    data-id="${survey.id}"
    aria-label="Star ${survey.kos.name}"
    aria-pressed="${starred ? 'true' : 'false'}"
  >${raw(STAR_ICON)}</button>`;
}
