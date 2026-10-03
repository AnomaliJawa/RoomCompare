import { html, raw, mount } from '../utils/dom.js';
import { SURVEY_GUIDE } from '../content/guidance.js';

/** Opens by itself on the first new survey on this device, and from the ? beside the title. */

const SEEN_KEY = 'roomcompare:survey-guide-seen';

// Where storage is blocked, the guide still shows only once per visit.
let seenThisVisit = false;
let opener = null;

function seen() {
  if (seenThisVisit) return true;
  try {
    return window.localStorage.getItem(SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

function remember() {
  seenThisVisit = true;
  try {
    window.localStorage.setItem(SEEN_KEY, 'true');
  } catch {
  }
}

const HELP_ICON =
  '<svg class="page-head__help-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.75" />' +
  '<path d="M9.5 9.25a2.5 2.5 0 1 1 3.4 2.33c-.55.22-.9.74-.9 1.33v.59" fill="none" stroke="currentColor" ' +
  'stroke-width="1.75" stroke-linecap="round" />' +
  '<circle cx="12" cy="16.75" r="1.1" fill="currentColor" />' +
  '</svg>';

export function surveyGuideButton() {
  return html`<button
    class="page-head__help"
    type="button"
    data-action="open-survey-guide"
    aria-label="${SURVEY_GUIDE.title}"
    aria-haspopup="dialog"
  >${raw(HELP_ICON)}</button>`;
}

export function renderSurveyGuide() {
  return html`
    <div class="guide-dialog">
      <div class="guide-dialog__head">
        <h2 class="dialog__title" id="survey-guide-title">${SURVEY_GUIDE.title}</h2>
        <button class="btn btn--quiet btn--small" type="button" data-action="close-survey-guide">Close</button>
      </div>
      <div class="guide-dialog__body">
        ${SURVEY_GUIDE.sections.map((section) => {
          const items = section.items.map((item) => html`<li>${item}</li>`);
          return html`<section class="guide-dialog__section">
            <h3 class="guide-dialog__heading">${section.heading}</h3>
            ${section.ordered
              ? html`<ol class="guide-dialog__list guide-dialog__list--steps">${items}</ol>`
              : html`<ul class="guide-dialog__list">${items}</ul>`}
          </section>`;
        })}
      </div>
      <div class="guide-dialog__foot">
        <button class="btn btn--primary" type="button" data-action="close-survey-guide">Got it</button>
      </div>
    </div>
  `;
}

export function openSurveyGuide(trigger = null) {
  const node = document.getElementById('app-survey-guide');
  if (!node) return false;
  mount(node, renderSurveyGuide());
  opener = trigger;
  if (!node.open) node.showModal();
  return true;
}

export function maybeShowSurveyGuide() {
  if (seen()) return false;
  remember();
  return openSurveyGuide();
}

export function initSurveyGuide() {
  const node = document.getElementById('app-survey-guide');
  if (!node) return;
  node.addEventListener('close', () => {
    if (node.open) return;
    const trigger = opener;
    opener = null;
    if (trigger?.isConnected) trigger.focus();
  });
}
