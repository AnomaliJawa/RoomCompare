import { html } from '../utils/dom.js';

/**
 * Where a page sits, above its title: the list it was opened from, then the
 * page itself. It replaced the survey page's Back button (the user's request,
 * 2026-09-30), which said where it led only by going there.
 *
 * The separators are drawn in CSS with no text in them, so a screen reader
 * reads the names alone, and the page's own name is marked aria-current.
 *
 * `trail` is [{ label, href }], outermost first; `current` is the page's name.
 */
export function breadcrumbs(trail, current) {
  return html`<nav class="breadcrumbs" aria-label="Breadcrumb">
    <ol class="breadcrumbs__list">
      ${trail.map(({ label, href }) => html`<li class="breadcrumbs__item"><a href="${href}">${label}</a></li>`)}
      <li class="breadcrumbs__item">
        <span class="breadcrumbs__current" aria-current="page">${current}</span>
      </li>
    </ol>
  </nav>`;
}
