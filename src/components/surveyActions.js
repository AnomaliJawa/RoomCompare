import { html, raw } from '../utils/dom.js';

/**
 * Edit and Delete for one of your own surveys, as icons (the user's request,
 * 2026-09-30), on its card and on its page.
 *
 * Each keeps its button style (Edit secondary, Delete danger) and is named
 * for its kos, since an icon says nothing to a screen reader.
 */

const icon = (paths) =>
  '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="none" ' +
  `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

// A pencil.
const EDIT_ICON = icon('<path d="M14 3.5 16.5 6 7 15.5l-3.5 1 1-3.5z"/><path d="m11.9 5.6 2.5 2.5"/>');

// A bin with its lid.
const DELETE_ICON = icon(
  '<path d="M3.5 5.5h13"/><path d="M7.75 5.5V4a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1v1.5"/>' +
    '<path d="M5 5.5l.8 10.6a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L15 5.5"/>' +
    '<path d="M8.5 8.75v5.5M11.5 8.75v5.5"/>',
);

/** `small` is the card's size; otherwise it matches a page's buttons. */
export function editLink(survey, { small = false } = {}) {
  return html`<a
    class="btn btn--secondary${small ? ' btn--small' : ''} btn--icon"
    href="#/surveys/${survey.id}/edit"
    aria-label="Edit ${survey.kos.name}"
  >${raw(EDIT_ICON)}</a>`;
}

export function deleteButton(survey, { small = false } = {}) {
  return html`<button
    class="btn btn--danger${small ? ' btn--small' : ''} btn--icon"
    type="button"
    data-action="ask-delete"
    data-id="${survey.id}"
    aria-label="Delete ${survey.kos.name}"
  >${raw(DELETE_ICON)}</button>`;
}
