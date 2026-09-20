import { html, raw } from '../utils/dom.js';

/**
 * An empty screen is an invitation to act, not a shrug.
 *
 * Every empty state says what is not there, why, and what to do next. They
 * were written inline in four features and had already drifted in tone, so
 * they share one shape here.
 */

function action({ label, href, actionName }) {
  if (href) return html`<a class="btn btn--primary" href="${href}">${label}</a>`;
  return html`<button class="btn btn--secondary" type="button" data-action="${actionName}">${label}</button>`;
}

export function emptyState({ title, body, actions = [] }) {
  return html`
    <section class="empty">
      <p class="empty__title">${title}</p>
      <p class="empty__body">${body}</p>
      ${actions.length ? raw(html`<div class="row">${actions.map((item) => action(item))}</div>`) : ''}
    </section>
  `;
}

/* Named states, so wording stays consistent wherever they appear. */

export const noSurveysYet = () =>
  emptyState({
    title: 'No kos recorded yet',
    body: 'Add the first kos you visited. Once you have two, you can compare them side by side.',
    actions: [{ label: 'Add survey', href: '#/surveys/new' }],
  });

export const noSearchResults = (query) =>
  emptyState({
    title: `No surveys match “${query}”`,
    body: 'Check the spelling, or clear the search to see everything.',
    actions: [{ label: 'Clear search', actionName: 'clear-search' }],
  });

export const noFilterResults = () =>
  emptyState({
    title: 'No shared surveys match these filters',
    body: 'Widen the rent range or clear the filters to see everything.',
    actions: [{ label: 'Clear filters', actionName: 'clear-community-filters' }],
  });

export const nothingSelected = () =>
  emptyState({
    title: 'Add two kos to start comparing',
    body:
      'Pick from the surveys you have recorded, and any community surveys you have starred. ' +
      'You can compare up to three at once.',
  });

export const needsOneMore = (name) =>
  emptyState({
    title: 'Add one more kos',
    body: `A comparison needs at least two. ${name} is ready to go.`,
    actions: [{ label: 'Add survey', href: '#/surveys/new' }],
  });

export const notFound = ({ title, body, backHref, backLabel }) =>
  emptyState({
    title,
    body,
    actions: [{ label: backLabel, href: backHref }],
  });
