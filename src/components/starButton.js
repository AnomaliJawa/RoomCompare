import { html, raw } from '../utils/dom.js';

/**
 * The star that keeps a community survey, on its card and on its page.
 *
 * An icon in place of the words Star and Starred. Its name stays "Star" and
 * aria-pressed carries the state: a toggle whose name changed too would be
 * read as "Starred, pressed". The outline fills when pressed, drawn by CSS
 * from aria-pressed, so what is seen and what is announced cannot disagree.
 */

// A five-pointed star, drawn in the button's own colour.
const STAR_ICON =
  '<svg class="star__icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
  '<path d="M10 2.3 12.5 7.36 18.08 8.17 14.04 12.11 15 17.68 10 15.05 5 17.68 5.96 12.11 1.92 8.17 7.5 7.36Z" ' +
  'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />' +
  '</svg>';

/** `small` is the card's quiet button; otherwise it matches a page's buttons. */
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
