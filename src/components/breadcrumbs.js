import { html } from '../utils/dom.js';

/** Separators are drawn in CSS, so a screen reader reads the names alone. */
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
