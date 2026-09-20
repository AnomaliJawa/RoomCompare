import { mount, qs, qsa, debounce, html } from './utils/dom.js';
import { defineRoute, setNotFound, startRouter, navigate, currentRoute } from './router.js';
import { onAction, startEventBridge } from './events.js';
import { toast, confirmDialog } from './components/feedback.js';
import { normalizeRentInput } from './utils/format.js';
import { STATUS, MAX_COMPARE } from './constants.js';
import * as store from './store.js';

import { renderDashboard } from './features/dashboard.js';
import { renderSurveyList } from './features/surveyList.js';
import { renderSurveyDetail } from './features/surveyDetail.js';
import { renderSurveyForm, mountSurveyForm, readSurveyForm } from './features/surveyForm.js';
import { renderCommunity } from './features/community.js';
import { renderCompare } from './features/compare.js';

const root = () => qs('#app-root');

/* --- Routes -------------------------------------------------------------- */

const ROUTES = [
  { path: '/dashboard', name: 'dashboard', render: renderDashboard, nav: null },
  { path: '/surveys', name: 'surveys', render: renderSurveyList, nav: 'surveys' },
  { path: '/surveys/new', name: 'survey-new', render: renderSurveyForm, nav: 'surveys', mount: mountSurveyForm },
  { path: '/surveys/:id', name: 'survey-detail', render: renderSurveyDetail, nav: 'surveys' },
  { path: '/surveys/:id/edit', name: 'survey-edit', render: renderSurveyForm, nav: 'surveys', mount: mountSurveyForm },
  { path: '/community', name: 'community', render: renderCommunity, nav: 'community' },
  { path: '/community/:id', name: 'community-detail', render: renderSurveyDetail, nav: 'community' },
  { path: '/compare', name: 'compare', render: renderCompare, nav: 'compare' },
];

/** Re-render the active route in place, without touching the URL. */
function refresh() {
  const active = ROUTES.find((route) => route.name === currentRoute().name);
  if (!active) return;
  const params = currentRoute().params;
  mount(root(), active.render(params));
  active.mount?.(root());
  syncNav(active.nav);
}

function syncNav(active) {
  qsa('.nav__link').forEach((link) => {
    if (link.dataset.nav === active) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function closeMobileNav() {
  const links = qs('.nav__links');
  const toggle = qs('.nav__toggle');
  links?.setAttribute('data-open', 'false');
  toggle?.setAttribute('aria-expanded', 'false');
}

/* --- Actions ------------------------------------------------------------- */

function wireActions() {
  onAction('toggle-nav', () => {
    const links = qs('.nav__links');
    const toggle = qs('.nav__toggle');
    const open = links.dataset.open === 'true';
    links.dataset.open = String(!open);
    toggle.setAttribute('aria-expanded', String(!open));
  });

  onAction('search-surveys', () => {}, 'click');
  onAction(
    'search-surveys',
    debounce(({ target }) => {
      const caret = target.selectionStart;
      store.setSearch(target.value);
      // The list re-renders, so restore focus where the user left it.
      const next = qs('#survey-search');
      if (next) {
        next.focus();
        next.setSelectionRange(caret, caret);
      }
    }, 200),
    'input',
  );

  onAction('clear-search', () => {
    store.setSearch('');
    qs('#survey-search')?.focus();
  });

  onAction('ask-delete', async ({ dataset }) => {
    const survey = store.findSurvey(dataset.id);
    if (!survey) return;
    const confirmed = await confirmDialog({
      title: 'Delete this survey?',
      body: `${survey.kos.name} will be removed from your surveys.`,
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    store.deleteSurvey(dataset.id);
    toast(`${survey.kos.name} deleted`);
    if (currentRoute().name === 'survey-detail') navigate('/surveys');
  });

  onAction('toggle-star', ({ dataset }) => {
    store.toggleStar(dataset.id);
    const survey = store.findSurvey(dataset.id);
    toast(store.isStarred(dataset.id) ? `${survey.kos.name} starred` : `${survey.kos.name} unstarred`);
  });

  onAction('toggle-compare', ({ dataset }) => {
    const survey = store.findSurvey(dataset.id);
    const added = store.toggleCompare(dataset.id);
    if (!added) {
      toast(`Remove one kos before adding another. You can compare up to ${MAX_COMPARE}.`);
      return;
    }
    const selected = store.getState().compareSelection.includes(dataset.id);
    toast(selected ? `${survey.kos.name} added to comparison` : `${survey.kos.name} removed from comparison`);
  });

  onAction('remove-compare', ({ dataset }) => {
    store.removeFromCompare(dataset.id);
  });

  onAction('cancel-form', () => navigate('/surveys'));

  onAction('filter-location', debounce(({ target }) => applyFilter('location', target.value, '#f-location'), 200), 'input');
  onAction('filter-min-rent', debounce(({ target }) => applyFilter('minRent', normalizeRentInput(target.value), '#f-min'), 200), 'input');
  onAction('filter-max-rent', debounce(({ target }) => applyFilter('maxRent', normalizeRentInput(target.value), '#f-max'), 200), 'input');
  onAction('filter-type', ({ target }) => store.setCommunityFilter('type', target.value), 'change');
  onAction('filter-starred', ({ target }) => store.setCommunityFilter('starredOnly', target.checked), 'change');

  onAction('clear-community-filters', () => {
    ['location', 'minRent', 'maxRent', 'type'].forEach((key) => store.setCommunityFilter(key, ''));
    store.setCommunityFilter('starredOnly', false);
  });

  onAction('submit-survey', ({ target, event }) => {
    const intent = event.submitter?.dataset.intent ?? 'draft';
    const data = readSurveyForm(target);

    if (!data.kos.name) {
      toast('Enter a name so you can find this kos later.');
      qs('#f-name', target)?.focus();
      return;
    }

    const editingId = target.dataset.id;
    if (editingId) {
      store.updateSurvey(editingId, data);
      toast('Survey updated');
    } else {
      store.addSurvey({
        id: `svy-${Date.now().toString(36)}`,
        ownerId: 'me',
        status: intent === 'publish' ? STATUS.PUBLISHED : STATUS.DRAFT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      });
      toast(intent === 'publish' ? 'Published' : 'Saved as draft');
    }
    navigate('/surveys');
  }, 'submit');
}

/* --- Boot ---------------------------------------------------------------- */

function notFound(path) {
  mount(
    root(),
    html`
      <section class="empty">
        <p class="empty__title">Nothing at this address</p>
        <p class="empty__body">${path} does not match any page.</p>
        <a class="btn btn--primary" href="#/dashboard">Go to the dashboard</a>
      </section>
    `,
  );
  syncNav(null);
}

function start() {
  ROUTES.forEach((route) => {
    defineRoute({
      path: route.path,
      name: route.name,
      render: (params) => {
        mount(root(), route.render(params));
        route.mount?.(root());
        syncNav(route.nav);
        closeMobileNav();
        window.scrollTo(0, 0);
      },
    });
  });
  setNotFound(notFound);

  startEventBridge();
  wireActions();
  // Any store write re-renders the active route.
  store.subscribe(refresh);
  startRouter();
}

function applyFilter(key, value, selector) {
  const input = qs(selector);
  const caret = input?.selectionStart ?? null;
  store.setCommunityFilter(key, value);
  const next = qs(selector);
  if (next && caret !== null) {
    next.focus();
    next.setSelectionRange(caret, caret);
  }
}

start();
