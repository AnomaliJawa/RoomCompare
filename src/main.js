import { mount, qs, qsa, debounce, html } from './utils/dom.js';
import { defineRoute, setNotFound, startRouter, navigate, currentRoute, currentPath } from './router.js';
import { onAction, startEventBridge } from './events.js';
import { toast, dismissToast, confirmDialog } from './components/feedback.js';
import { loadSurveyMedia, restoreMedia, sweepOrphanedMedia, pruneSurveyMedia } from './media.js';
import { banner } from './components/banner.js';
import { showErrors, clearErrors, watchForRepair } from './components/formErrors.js';
import { validateSurvey, findDuplicateName, validateLogin, validateRegistration } from './utils/validate.js';
import { normalizeRentInput } from './utils/format.js';
import { STATUS, MAX_COMPARE } from './constants.js';
import * as store from './store.js';
import * as api from './api.js';
import * as sync from './sync.js';
import * as distanceRefresh from './distanceRefresh.js';
import { renderLogin, renderRegister, readCredentials } from './features/auth.js';

import { renderDashboard } from './features/dashboard.js';
import { renderSurveyList, mountSurveyList } from './features/surveyList.js';
import { renderSurveyDetail, mountSurveyDetail } from './features/surveyDetail.js';
import {
  renderSurveyForm,
  mountSurveyForm,
  readSurveyForm,
  newSurveyId,
  isFormDirty,
  teardownSurveyForm,
} from './features/surveyForm.js';
import { renderCommunity, mountCommunity, filterCommunity } from './features/community.js';
import { filterDialogContent } from './components/filterPanel.js';
import { candidatePickerDialog } from './components/candidatePicker.js';
import { enableSheetDismiss } from './components/sheet.js';
import { openHowTo, initHowTo } from './components/howToPanel.js';
import { openSurveyGuide, initSurveyGuide } from './components/surveyGuide.js';
import {
  openCriteria,
  initCriteriaDialog,
  readWeights,
  updateCriteriaTotal,
  stepWeight,
  fillWeights,
} from './components/criteriaDialog.js';
import { DEFAULT_WEIGHTS } from './utils/weights.js';
import { renderCompare, mountCompare } from './features/compare.js';

const root = () => qs('#app-root');

/** The most recent delete, restorable until its toast expires. */
let pendingUndo = null;

/** The selection Start over cleared, restorable until its toast expires. */
let pendingCompareUndo = null;

/** Where a logged-out visitor was headed, so logging in takes them there. */
let returnTo = null;

/** Why the server could not be asked about a session, shown on the login page. */
let serverProblem = null;

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
  // The only routes open without an account.
  { path: '/login', name: 'login', render: renderLogin, nav: null, public: true },
  { path: '/register', name: 'register', render: renderRegister, nav: null, public: true },
  { path: '/dashboard', name: 'dashboard', render: renderDashboard, nav: null },
  { path: '/surveys', name: 'surveys', render: renderSurveyList, nav: 'surveys', mount: mountSurveyList },
  { path: '/surveys/new', name: 'survey-new', render: renderSurveyForm, nav: 'surveys', mount: mountSurveyForm },
  { path: '/surveys/:id', name: 'survey-detail', render: renderSurveyDetail, nav: 'surveys', mount: mountSurveyDetail },
  { path: '/surveys/:id/edit', name: 'survey-edit', render: renderSurveyForm, nav: 'surveys', mount: mountSurveyForm },
  { path: '/community', name: 'community', render: renderCommunity, nav: 'community', mount: mountCommunity },
  { path: '/community/:id', name: 'community-detail', render: renderSurveyDetail, nav: 'community', mount: mountSurveyDetail },
  { path: '/compare', name: 'compare', render: renderCompare, nav: 'compare', mount: mountCompare },
];

/**
 * Routes whose DOM holds live user input. A store change must not rebuild
 * these: the form owns typed values, focus, caret position, map instances and
 * uploaded thumbnails, and re-rendering would discard all of it mid-edit.
 * Autosave writes to the store on a timer, so this is not hypothetical.
 */
const SELF_MANAGED_ROUTES = new Set(['survey-new', 'survey-edit', 'login', 'register']);

/** Re-render the active route in place, without touching the URL. */
function refresh() {
  renderAccount();
  const active = ROUTES.find((route) => route.name === currentRoute().name);
  if (!active) return;

  if (SELF_MANAGED_ROUTES.has(active.name)) {
    // Notices still update; the form itself is left alone.
    renderStorageNotice();
    return;
  }

  renderFilterDialog();
  renderPickerDialog();

  const params = currentRoute().params;
  // A panel the user opened stays open while the view is rebuilt around it.
  // Best Match would otherwise shut the moment new weights are saved, hiding
  // the scores they changed. A fresh visit to the page still starts closed.
  const kept = qsa('details[data-keep-open][open]', root()).map((node) => node.dataset.keepOpen);
  releaseView();
  mount(root(), active.render(params));
  for (const key of kept) qs(`details[data-keep-open="${key}"]`, root())?.setAttribute('open', '');
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
  const { storageNotice, storageStatus, syncNotice, user } = store.getState();

  // The account's notice means nothing on the login page.
  const accountNotice = user ? syncNotice : null;
  if (!storageNotice && !accountNotice) {
    region.innerHTML = '';
    return;
  }

  mount(
    region,
    html`${storageNotice
      ? banner({
          message: storageNotice,
          tone: storageStatus === 'ok' ? 'info' : 'alert',
          action: { name: 'dismiss-storage-notice', label: 'Dismiss' },
        })
      : ''}${accountNotice
      ? banner({ message: accountNotice, action: { name: 'dismiss-sync-notice', label: 'Dismiss' } })
      : ''}`,
  );
}

/**
 * The shell follows the session: logged out, the nav shows the wordmark
 * alone, since every other destination needs an account.
 */
function renderAccount() {
  const { user } = store.getState();
  document.body.dataset.auth = user ? 'in' : 'out';
  qsa('[data-action="logout"]').forEach((button) => {
    if (user) button.title = `Logged in as ${user.email}`;
    else button.removeAttribute('title');
  });
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

/**
 * Keep the kos picker current while it is open, so Selected and "Maximum of
 * 3" change as the user picks. The list is rebuilt under the pointer, which
 * would drop keyboard focus to the page; it goes back to the kos just
 * toggled instead. The list keeps its scroll position too: it holds every
 * community kos below the user's own, and a pick far down would otherwise
 * send it back to the top. Safari does not focus a tapped button, so focus
 * alone would not bring it back there.
 */
function renderPickerDialog() {
  const node = qs('#app-picker');
  if (!node || !node.open) return;
  const active = node.contains(document.activeElement) ? document.activeElement : null;
  const id = active?.dataset.id;
  const scrolled = qs('.picker-dialog__body', node)?.scrollTop ?? 0;
  mount(node, candidatePickerDialog(store.compareCandidates(), store.getState().compareSelection));
  const body = qs('.picker-dialog__body', node);
  if (body) body.scrollTop = scrolled;
  if (!active) return;
  const target = (id && qs(`[data-id="${CSS.escape(id)}"]`, node)) || qs('[data-action="close-picker"]', node);
  target?.focus();
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
    // Adding needs no toast: the button pressed already says so (Selected in
    // the picker, In comparison on a card or a survey's page), and the
    // picker's count updates with it.
    if (!store.getState().compareSelection.includes(dataset.id)) {
      toast(`${survey.kos.name} removed from comparison`);
    }
  });

  onAction('remove-compare', ({ dataset }) => {
    store.removeFromCompare(dataset.id);
  });

  onAction('show-comparison', () => store.showComparison());

  // Start over sits beside Add kos, so a slipped tap would throw away a
  // shortlist chosen with care. It is undoable rather than confirmed:
  // asking first would slow every deliberate use to guard the rare mistake.
  onAction('clear-compare', () => {
    const { compareSelection, compareShown } = store.getState();
    pendingCompareUndo = { selection: [...compareSelection], shown: compareShown };
    store.clearCompare();
    // Start over has just disappeared with the table; Add kos is where the
    // next choice starts.
    qs('[data-action="open-picker"]')?.focus();
    toast('Comparison cleared', {
      action: { name: 'undo-clear-compare', label: 'Undo' },
      onExpire: () => {
        pendingCompareUndo = null;
      },
    });
  });

  onAction('undo-clear-compare', () => {
    if (!pendingCompareUndo) return;
    const { selection, shown } = pendingCompareUndo;
    pendingCompareUndo = null;
    store.restoreCompare(selection, shown);
    dismissToast();
    toast('Comparison restored');
  });

  onAction('open-picker', () => {
    const node = qs('#app-picker');
    if (!node) return;
    mount(node, candidatePickerDialog(store.compareCandidates(), store.getState().compareSelection));
    node.showModal();
  });

  onAction('close-picker', () => qs('#app-picker')?.close());

  // The Add kos button is rebuilt with the view whenever a kos is picked, so
  // the browser's own focus return would land on a node that no longer
  // exists. Send it to the current button instead.
  qs('#app-picker')?.addEventListener('close', () => qs('[data-action="open-picker"]')?.focus());

  onAction('cancel-form', async () => {
    if (isFormDirty()) {
      const discard = await confirmDialog({
        title: 'Discard your changes?',
        body: 'What you have entered on this form will not be saved.',
        confirmLabel: 'Discard',
      });
      if (!discard) return;
    }
    // Photos chosen on an abandoned form are swept after the next login.
    teardownSurveyForm();
    navigate('/surveys');
  });

  onAction('dismiss-storage-notice', () => store.clearStorageNotice());
  onAction('dismiss-sync-notice', () => store.setSyncNotice(null));

  onAction(
    'submit-login',
    ({ target }) => submitCredentials(target, { validate: validateLogin, call: api.login, label: 'Log in', busy: 'Logging in…' }),
    'submit',
  );

  onAction(
    'submit-register',
    ({ target }) =>
      submitCredentials(target, {
        validate: validateRegistration,
        call: api.register,
        label: 'Create account',
        busy: 'Creating account…',
        done: 'Account created',
      }),
    'submit',
  );

  onAction('logout', async () => {
    // Anything waiting goes now if it can; only what still cannot is worth
    // asking about.
    await sync.flush();
    const waiting = sync.pendingCount();
    if (waiting) {
      const leave = await confirmDialog({
        title: 'Log out before everything is saved?',
        body: `${waiting === 1 ? 'One change has' : `${waiting} changes have`} not reached your account yet. ${
          waiting === 1 ? 'It stays' : 'They stay'
        } on this device and will be sent the next time you log in here.`,
        confirmLabel: 'Log out',
        cancelLabel: 'Stay logged in',
        tone: 'primary',
      });
      if (!leave) return;
    }
    try {
      await api.logout();
    } catch (error) {
      // The session is an HttpOnly cookie only the server can end. Clearing
      // the screen without it would look logged out and not be.
      toast(error.offline ? 'You’re offline, so you can’t log out yet. Try again once you’re connected.' : error.message);
      return;
    }
    sync.stop();
    distanceRefresh.stop();
    store.forgetAccount();
    closeMobileNav();
    navigate('/login');
    toast('Logged out');
  });

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

  // A field's ⓘ opens its How to fill panel.
  onAction('open-howto', ({ target }) => openHowTo(target.dataset.guide, target));
  onAction('close-howto', () => qs('#app-howto')?.close());

  // The ? beside the survey form's title reopens the Survey guide.
  onAction('open-survey-guide', ({ target }) => openSurveyGuide(target));
  onAction('close-survey-guide', () => qs('#app-survey-guide')?.close());

  // Best Match weights, from Edit criteria in the panel or on the Dashboard.
  // The draft stays in the dialog's inputs; only Save touches the store.
  onAction('open-criteria', () => openCriteria(store.bestMatchWeights()));
  onAction('close-criteria', () => qs('#app-criteria')?.close());
  onAction('criteria-step', ({ target, dataset }) => stepWeight(target.form, dataset.key, Number(dataset.step)));
  onAction('criteria-input', ({ target }) => updateCriteriaTotal(target.form), 'input');
  onAction('criteria-reset', ({ target }) => fillWeights(target.form, DEFAULT_WEIGHTS));
  onAction(
    'criteria-save',
    ({ target }) => {
      if (!updateCriteriaTotal(target).ok) return;
      const { ok, kept } = store.setBestMatchWeights(readWeights(target));
      if (!ok) return;
      qs('#app-criteria')?.close();
      toast(kept ? 'Best Match weights saved' : 'Weights applied, but this browser could not keep them');
    },
    'submit',
  );

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
        id: target.dataset.surveyId || newSurveyId(),
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
    navigate('/surveys');
  }, 'submit');
}

/* --- Account --------------------------------------------------------------- */

/**
 * Surveys recorded here before accounts existed are offered to the first
 * account that logs in. Left out, they are kept aside on this device rather
 * than deleted (storage.keepUnclaimed).
 */
function claimSurveys(count) {
  const one = count === 1;
  return confirmDialog({
    title: 'Add surveys from this device to your account?',
    body: `${one ? 'One survey was' : `${count} surveys were`} recorded on this device before you had an account. Added, ${
      one ? 'it is' : 'they are'
    } there wherever you log in. Left out, ${one ? 'it stays' : 'they stay'} stored on this device, out of sight.`,
    confirmLabel: 'Add to my account',
    cancelLabel: 'Leave out',
    tone: 'primary',
  });
}

function sessionEnded() {
  distanceRefresh.stop();
  store.setUser(null);
  navigate('/login');
  toast('Your session has ended. Log in again to keep saving to your account.');
}

/**
 * Make an account the current one: its surveys become this device's working
 * copy, and changes start flowing to it. Resolves false if it did not work
 * out, in which case nobody is logged in.
 */
async function signIn(user) {
  store.setUser(user);
  try {
    if (!(await sync.start(user, { claimSurveys, onSessionEnded: sessionEnded }))) return false;
  } catch (error) {
    sync.stop();
    store.setUser(null);
    throw error;
  }
  // Distances still measured in a straight line are walked, in the background.
  distanceRefresh.start();
  // Photos left by forms abandoned before saving: this account's only.
  sweepOrphanedMedia(store.getState().surveys.map((survey) => survey.id), user.id).catch(() => null);
  return true;
}

/** Log in or register: the browser's checks first, then the server's answer. */
async function submitCredentials(form, { validate, call, label, busy, done = null }) {
  const credentials = readCredentials(form);
  watchForRepair(form, () => validate(readCredentials(form)));
  if (!showErrors(form, validate(credentials))) return;

  const button = qs('button[type="submit"]', form);
  const notice = qs('[data-auth-notice]');
  if (notice) notice.innerHTML = '';
  button.disabled = true;
  button.textContent = busy;

  try {
    const { user } = await call(credentials);
    if (!(await signIn(user))) throw new api.ApiError(401, 'Your session could not be started. Try again.');
    serverProblem = null;
    const next = returnTo ?? '/dashboard';
    returnTo = null;
    navigate(next);
    if (done) toast(done);
  } catch (error) {
    button.disabled = false;
    button.textContent = label;
    if (error.errors) {
      const fields = Object.keys(error.errors);
      showErrors(form, { ok: false, errors: error.errors, firstField: fields[0], sectionCounts: {} });
    } else if (notice) {
      mount(notice, banner({ message: error.message, tone: 'alert' }));
    }
  }
}

/** At boot: is someone already logged in on this browser? */
async function restoreSession() {
  try {
    const { user } = await api.me();
    await signIn(user);
  } catch (error) {
    // 401 is the ordinary answer for nobody logged in. Anything else — no
    // server, no connection — is worth saying on the login page.
    if (error.status !== 401) serverProblem = error.message;
  }
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

async function start() {
  ROUTES.forEach((route) => {
    defineRoute({
      path: route.path,
      name: route.name,
      render: (params) => {
        // Every route but logging in and registering needs an account. A
        // visitor sent to log in is taken on to where they were headed.
        const signedIn = Boolean(store.getState().user);
        if (!route.public && !signedIn) {
          returnTo = currentPath();
          navigate('/login', { replace: true });
          return;
        }
        if (route.public && signedIn) {
          navigate('/dashboard', { replace: true });
          return;
        }
        releaseView();
        mount(root(), route.render(params));
        viewHandle = route.mount?.(root()) ?? null;
        syncNav(route.nav);
        renderAccount();
        renderStorageNotice();
        const notice = route.public && serverProblem ? qs('[data-auth-notice]') : null;
        if (notice) mount(notice, banner({ message: serverProblem, tone: 'alert' }));
        closeMobileNav();
        window.scrollTo(0, 0);
      },
    });
  });
  setNotFound(notFound);

  startEventBridge();
  wireActions();

  // On a phone these are sheets, dismissed by dragging their head down.
  enableSheetDismiss(qs('#app-filters'), '.filter-dialog__head');
  enableSheetDismiss(qs('#app-picker'), '.picker-dialog__head');
  enableSheetDismiss(qs('#app-howto'), '.howto__head');
  enableSheetDismiss(qs('#app-survey-guide'), '.guide-dialog__head');
  enableSheetDismiss(qs('#app-criteria'), '.criteria-dialog__head');
  initHowTo();
  initSurveyGuide();
  initCriteriaDialog();

  // iOS Safari has applied :active only where a touch listener exists on the
  // element or an ancestor. Without this no-op, the pressed states in
  // components.css would not show on an iPhone that still behaves that way.
  document.addEventListener('touchstart', () => {}, { passive: true });

  // Any store write re-renders the active route.
  store.subscribe(refresh);

  // The session decides the first screen, so ask before routing. Sample
  // surveys are no longer attached to a first run: an account starts with its
  // own, and the orphan sweep now runs per account, in signIn().
  await restoreSession();
  renderAccount();
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
