import { html, raw } from '../utils/dom.js';

/** The count sits inside the button, so its name reads "Like Kos Kartika, 24 likes"; aria-pressed carries the state. */

const HEART_ICON =
  '<svg class="like__icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
  '<path d="M10 16.75S3 12.5 3 7.75A3.75 3.75 0 0 1 10 5.9a3.75 3.75 0 0 1 7 1.85c0 4.75-7 9-7 9Z" ' +
  'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />' +
  '</svg>';

export function likeButton(survey, { liked = false, count = 0, small = false } = {}) {
  return html`<button
    class="btn ${small ? 'btn--quiet btn--small' : 'btn--secondary'} like"
    type="button"
    data-action="toggle-like"
    data-id="${survey.id}"
    aria-pressed="${liked ? 'true' : 'false'}"
  >${raw(HEART_ICON)}<span class="visually-hidden">Like ${survey.kos.name}, </span><span class="like__count"
    >${count}</span><span class="visually-hidden"> ${count === 1 ? 'like' : 'likes'}</span></button>`;
}
