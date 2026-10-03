import { html, raw } from '../utils/dom.js';

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

export const noSurveysYet = () =>
  emptyState({
    title: 'No kos recorded yet',
    body: 'Add the first kos you visited. Once two are published, you can compare them side by side.',
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
      'Choose an empty slot above to pick from your published surveys and the community’s. ' +
      'You can compare up to three at once.',
  });

export const needsOneMore = (name) =>
  emptyState({
    title: 'Add one more kos',
    body: `A comparison needs at least two. ${name} is ready to go; choose an empty slot above to pick another.`,
    actions: [{ label: 'Add survey', href: '#/surveys/new' }],
  });

export const notFound = ({ title, body, backHref, backLabel }) =>
  emptyState({
    title,
    body,
    actions: [{ label: backLabel, href: backHref }],
  });
