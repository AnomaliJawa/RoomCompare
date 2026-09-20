import { mount, qs, qsa, debounce, html } from './utils/dom.js';
import { defineRoute, setNotFound, startRouter, navigate, currentRoute } from './router.js';
import { onAction, startEventBridge } from './events.js';
import { toast, dismissToast, confirmDialog } from './components/feedback.js';
import { loadSurveyMedia, restoreMedia, sweepOrphanedMedia, pruneSurveyMedia } from './media.js';
import { banner } from './components/banner.js';
import { showErrors, clearErrors, watchForRepair } from './components/formErrors.js';
import { validateSurvey, findDuplicateName } from './utils/validate.js';
import { normalizeRentInput } from './utils/format.js';
import { STATUS, MAX_COMPARE } from './constants.js';
import * as store from './store.js';

import { renderDashboard } from './features/dashboard.js';
import { renderSurveyList } from './features/surveyList.js';
import { renderSurveyDetail, mountSurveyDetail } from './features/surveyDetail.js';
import {
  renderSurveyForm,
  mountSurveyForm,
  readSurveyForm,
  formSurveyId,
  clearDraftId,
  isFormDirty,
  teardownSurveyForm,
} from './features/surveyForm.js';
import { renderCommunity, filterCommunity } from './features/community.js';
import { filterDialogContent } from './components/filterPanel.js';
import { renderCompare } from './features/compare.js';

const root = () => qs('#app-root');

/** The most recent delete, restorable until its toast expires. */
let pendingUndo = null;

/**
 * Whatever the current view mounted. Views that hold resources — object urls
 * for photo blobs, map instances — return a handle, and it is released before
 * the next view replaces the DOM.
 */
let viewHandle = null;

function releaseView() {
  viewHandle?.destroy?.();
  viewHandle = null;
}

/* --- Routes -------------------------------------------------------------- */

const ROUTES = [
  { path: '/dashboard', name: 'dashboard', render: renderDashboard, nav: null },
  { path: '/surveys', name: 'surveys', render: renderSurveyList, nav: 'surveys' },
  { path: '/surveys/new', name: 'survey-new', render: renderSurveyForm, nav: 'surveys', mount: mountSurveyForm },
  { path: '/surveys/:id', name: 'survey-detail', render: renderSurveyDetail, nav: 'surveys', mount: mountSurveyDetail },
  { path: '/surveys/:id/edit', name: 'survey-edit', render: renderSurveyForm, nav: 'surveys', mount: mountSurveyForm },
  { path: '/community', name: 'community', render: renderCommunity, nav: 'community' },
  { path: '/community/:id', name: 'community-detail', render: renderSurveyDetail, nav: 'community', mount: mountSurveyDetail },
  { path: '/compare', name: 'compare', render: renderCompare, nav: 'compare' },
];

/**
 * Routes whose DOM holds live user input. A store change must not rebuild
 * these: the form owns typed values, focus, caret position, map instances and
 * uploaded thumbnails, and re-rendering would discard all of it mid-edit.
 * Autosave writes to the store on a timer, so this is not hypothetical.
 */
const SELF_MANAGED_ROUTES = new Set(['survey-new', 'survey-edit']);

/** Re-render the active route in place, without touching the URL. */
function refresh() {
  const active = ROUTES.find((route) => route.name === currentRoute().name);
  if (!active) return;

  if (SELF_MANAGED_ROUTES.has(active.name)) {
    // Notices still update; the form itself is left alone.
    renderStorageNotice();
    return;
  }

  renderFilterDialog();

  const params = currentRoute().params;
  releaseView();
  mount(root(), active.render(params));
  viewHandle = active.mount?.(root()) ?? null;
  syncNav(active.nav);
  renderStorageNotice();
}

/**
 * Storage problems are stated plainly rather than left for the user to
 * discover by losing work. The notice sits above the view so it is seen
 * without covering anything.
 */
function renderStorageNotice() {
  const region = qs('#storage-notice');
  if (!region) return;
  const { storageNotice, storageStatus } = store.getState();

  if (!storageNotice) {
    region.innerHTML = '';
    return;
  }

  mount(
    region,
    banner({
      message: storageNotice,
      tone: storageStatus === 'ok' ? 'info' : 'alert',
      action: { name: 'dismiss-storage-notice', label: 'Dismiss' },
    }),
  );
}

/**
 * Keep the filter dialog current. Filters apply as they are changed, so the
 * count on its primary button updates while the dialog is still open and the
 * user can see what a choice costs before committing to it.
 */
function renderFilterDialog() {
  const node = qs('#app-filters');
  if (!node || !node.open) return;
  const { communitySurveys, communityFilters, starredIds } = store.getState();
  const showing = filterCommunity(communitySurveys, communityFilters, starredIds).length;
  mount(node, filterDialogContent(communityFilters, { total: communitySurveys.length, showing }));
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

    const photoCount = (await loadSurveyMedia(dataset.id)).length;
    const detail = photoCount
      ? `${survey.kos.name} and its ${photoCount} photo${photoCount === 1 ? '' : 's'} will be removed from your surveys.`
      : `${survey.kos.name} will be removed from your surveys.`;

    const confirmed = await confirmDialog({
      title: 'Delete this survey?',
      body: detail,
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;

    // Capture the media before the delete cascades, so undo can put the
    // photos back and not just the record.
    const captured = await loadSurveyMedia(dataset.id);
    const { removed, index, mediaCleanup } = store.deleteSurvey(dataset.id) ?? {};
    if (!removed) return;

    // Wait for the cleanup to finish before offering undo: otherwise a quick
    // undo restores the photos and the cascade then deletes them again.
    await mediaCleanup;

    pendingUndo = { survey: removed, index, media: captured };
    toast(`${survey.kos.name} deleted`, {
      action: { name: 'undo-delete', label: 'Undo' },
      onExpire: () => {
        pendingUndo = null;
      },
    });

    if (currentRoute().name === 'survey-detail') navigate('/surveys');
  });

  onAction('undo-delete', async () => {
    if (!pendingUndo) return;
    const { survey, index, media } = pendingUndo;
    pendingUndo = null;

    await restoreMedia(media);
    store.restoreSurvey(survey, index);

    dismissToast();
    toast(`${survey.kos.name} restored`);
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

  onAction('cancel-form', async () => {
    if (isFormDirty()) {
      const discard = await confirmDialog({
        title: 'Discard your changes?',
        body: 'What you have entered on this form will not be saved.',
        confirmLabel: 'Discard',
      });
      if (!discard) return;
    }
    // Photos chosen on an abandoned form are swept on the next boot.
    teardownSurveyForm();
    clearDraftId();
    navigate('/surveys');
  });

  onAction('dismiss-storage-notice', () => store.clearStorageNotice());

  // A new survey autosaves as a draft so a dropped tab mid-visit costs
  // nothing. It is deliberately quiet: no navigation, no toast stealing
  // attention while someone is still typing.
  document.addEventListener('autosave', (event) => {
    const form = event.target;
    const data = readSurveyForm(form);
    if (!data.kos.name) return;

    const id = form.dataset.surveyId;
    if (store.findSurvey(id)) {
      store.updateSurvey(id, data);
    } else {
      store.addSurvey({
        id,
        ownerId: 'me',
        status: STATUS.DRAFT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      });
      // The form is now editing a real record rather than creating one.
      form.dataset.id = id;
    }
    const note = qs('[data-autosave-note]');
    if (note) note.textContent = `Draft saved ${new Date().toLocaleTimeString()}`;
  });

  onAction('filter-location', debounce(({ target }) => applyFilter('location', target.value, '#f-location'), 200), 'input');
  onAction('filter-min-rent', debounce(({ target }) => applyFilter('minRent', normalizeRentInput(target.value), '#f-min'), 200), 'input');
  onAction('filter-max-rent', debounce(({ target }) => applyFilter('maxRent', normalizeRentInput(target.value), '#f-max'), 200), 'input');
  onAction('filter-type', ({ target }) => store.setCommunityFilter('type', target.value), 'change');
  onAction('filter-starred', ({ target }) => store.setCommunityFilter('starredOnly', target.checked), 'change');
  onAction('filter-facility', ({ target }) => store.toggleCommunityFacility(target.value), 'change');

  onAction('open-filters', () => {
    const node = qs('#app-filters');
    if (!node) return;
    const { communitySurveys, communityFilters, starredIds } = store.getState();
    const showing = filterCommunity(communitySurveys, communityFilters, starredIds).length;
    mount(node, filterDialogContent(communityFilters, { total: communitySurveys.length, showing }));
    node.showModal();
  });

  onAction('close-filters', () => qs('#app-filters')?.close());

  onAction('clear-community-filters', () => store.clearCommunityFilters());

  onAction('submit-survey', async ({ target, event }) => {
    const intent = event.submitter?.dataset.intent ?? 'draft';
    const data = readSurveyForm(target);

    // Update keeps whatever status the record already has, so an edited draft
    // is held to draft rules rather than being forced to completeness.
    const existing = target.dataset.id ? store.findSurvey(target.dataset.id) : null;
    const mode =
      intent === 'publish' || (intent === 'update' && existing?.status === STATUS.PUBLISHED)
        ? 'publish'
        : 'draft';

    const result = validateSurvey(data, { mode });
    // Re-check a repaired field on blur from here on, but never before the
    // user has actually tried to submit.
    watchForRepair(target, () => validateSurvey(readSurveyForm(target), { mode }));

    if (!showErrors(target, result)) return;

    // Two kos can share a name, so this asks rather than refuses.
    const duplicate = findDuplicateName(store.getState().surveys, data.kos.name, {
      excludeId: target.dataset.id || target.dataset.surveyId,
    });
    if (duplicate) {
      const proceed = await confirmDialog({
        title: 'You already have a survey with this name',
        body: `${duplicate.kos.name} in ${duplicate.kos.kosLocation?.label ?? 'an unnamed location'} is already saved. Save this one as well?`,
        confirmLabel: 'Save anyway',
        tone: 'primary',
      });
      if (!proceed) {
        qs('#f-name', target)?.focus();
        return;
      }
    }

    clearErrors(target);

    /** Every media id the saved survey still points at. */
    const keptMedia = [
      ...data.room.photoIds,
      ...data.bathroom.photoIds,
      ...data.shared.photoIds,
      ...data.additional.videoIds,
    ];

    const editingId = target.dataset.id;
    if (editingId) {
      // An autosaved draft is already a record, so publishing it promotes
      // the same row rather than creating a second one.
      const intended = intent === 'publish' ? STATUS.PUBLISHED : undefined;
      store.updateSurvey(editingId, intended ? { ...data, status: intended } : data);
      toast(intent === 'publish' ? 'Published' : 'Survey updated');
    } else {
      store.addSurvey({
        id: target.dataset.surveyId || formSurveyId(),
        ownerId: 'me',
        status: intent === 'publish' ? STATUS.PUBLISHED : STATUS.DRAFT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      });
      toast(intent === 'publish' ? 'Published' : 'Saved as draft');
    }
    // Photos dropped in the form are destroyed here, once the record that no
    // longer lists them has actually been written.
    pruneSurveyMedia(editingId || target.dataset.surveyId, keptMedia).catch(() => null);

    teardownSurveyForm();
    clearDraftId();
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
        releaseView();
        mount(root(), route.render(params));
        viewHandle = route.mount?.(root()) ?? null;
        syncNav(route.nav);
        renderStorageNotice();
        closeMobileNav();
        window.scrollTo(0, 0);
      },
    });
  });
  setNotFound(notFound);

  startEventBridge();
  wireActions();

  // Files chosen on a form that was never saved have nothing pointing at
  // them. Clearing them here keeps abandoned drafts from accumulating.
  sweepOrphanedMedia(store.getState().surveys.map((survey) => survey.id)).catch(() => null);
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
