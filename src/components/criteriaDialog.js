import { html, raw, mount, qs, qsa } from '../utils/dom.js';
import { BEST_MATCH_CRITERIA } from '../constants.js';
import { checkWeights } from '../utils/weights.js';

/**
 * Setting the Best Match weights: a row per criterion, each a whole
 * percentage with − and + beside it, and the total underneath. Save waits for
 * exactly 100%, so the numbers on screen are the numbers the score uses;
 * nothing is rescaled behind the user's back.
 *
 * The draft lives only in these inputs until Save. Close, Esc or a swipe
 * leave the saved weights as they were. The dialog sits outside #app-root
 * (#app-criteria) and refresh() leaves it alone, so a store change rebuilding
 * the view behind it cannot wipe the draft. main.js wires the actions.
 */

const STEP = 5;

function totalMessage({ total, invalid }) {
  if (invalid.length) return 'Each weight is a whole number from 0 to 100.';
  if (total < 100) return `Total ${total}% · ${100 - total}% left to share`;
  if (total > 100) return `Total ${total}% · ${total - 100}% over`;
  return 'Total 100%';
}

function row(criterion, value) {
  const id = `weight-${criterion.key}`;
  return html`<li class="criteria-row">
    <label class="criteria-row__label" for="${id}">${criterion.label}</label>
    <p class="criteria-row__hint" id="${id}-hint">${criterion.description}</p>
    <div class="stepper">
      <button
        class="btn btn--secondary stepper__step"
        type="button"
        data-action="criteria-step"
        data-key="${criterion.key}"
        data-step="${-STEP}"
        aria-label="Decrease ${criterion.label}"
      >−</button>
      <input
        class="field__control stepper__input"
        id="${id}"
        name="${criterion.key}"
        type="number"
        inputmode="numeric"
        min="0"
        max="100"
        step="1"
        value="${value}"
        aria-describedby="${id}-hint"
        aria-invalid="false"
        data-action="criteria-input"
      />
      <span class="stepper__unit" aria-hidden="true">%</span>
      <button
        class="btn btn--secondary stepper__step"
        type="button"
        data-action="criteria-step"
        data-key="${criterion.key}"
        data-step="${STEP}"
        aria-label="Increase ${criterion.label}"
      >+</button>
    </div>
  </li>`;
}

/** The dialog's content, on `weights`: the ones in use when it opens. */
export function criteriaDialog(weights) {
  const check = checkWeights(weights);
  return html`
    <form class="criteria-dialog" data-action="criteria-save" novalidate>
      <div class="criteria-dialog__head">
        <h2 class="dialog__title" id="criteria-dialog-title">Best Match criteria</h2>
        <button class="btn btn--quiet btn--small" type="button" data-action="close-criteria">Close</button>
      </div>

      <div class="criteria-dialog__body">
        <p class="meta">
          How much each criterion counts in the optional score under a comparison.
          The total must be 100%; 0% leaves a criterion out.
        </p>
        <ul class="criteria-list">
          ${BEST_MATCH_CRITERIA.map((criterion) => row(criterion, weights[criterion.key]))}
        </ul>
      </div>

      <div class="criteria-dialog__foot">
        <p
          class="criteria-dialog__total${check.ok ? '' : ' criteria-dialog__total--off'}"
          role="status"
          aria-live="polite"
          data-criteria-total
        >${totalMessage(check)}</p>
        <div class="criteria-dialog__actions">
          <button class="btn btn--quiet" type="button" data-action="criteria-reset">Reset to default</button>
          <button class="btn btn--primary" type="submit" data-criteria-save ${check.ok ? '' : raw('disabled')}>Save</button>
        </div>
      </div>
    </form>
  `;
}

const input = (form, key) => qs(`input[name="${key}"]`, form);

/**
 * The weights as typed. A blank field reads as NaN rather than 0, so it is
 * reported, not quietly counted as nothing.
 */
export function readWeights(form) {
  return Object.fromEntries(
    BEST_MATCH_CRITERIA.map(({ key }) => {
      const text = input(form, key)?.value.trim() ?? '';
      return [key, text === '' ? Number.NaN : Number(text)];
    }),
  );
}

/** Bring the total, its message, Save and the invalid marks up to date. */
export function updateCriteriaTotal(form) {
  const check = checkWeights(readWeights(form));
  const line = qs('[data-criteria-total]', form);
  line.textContent = totalMessage(check);
  line.classList.toggle('criteria-dialog__total--off', !check.ok);
  qs('[data-criteria-save]', form).disabled = !check.ok;
  for (const field of qsa('.stepper__input', form)) {
    field.setAttribute('aria-invalid', String(check.invalid.includes(field.name)));
  }
  return check;
}

/** − or +: move one weight by `step`, never below 0 or above 100. */
export function stepWeight(form, key, step) {
  const field = input(form, key);
  const current = Number.parseInt(field.value, 10);
  field.value = String(Math.min(100, Math.max(0, (Number.isFinite(current) ? current : 0) + step)));
  return updateCriteriaTotal(form);
}

/** Put a whole set in the inputs: Reset to default. It still needs Save. */
export function fillWeights(form, weights) {
  for (const { key } of BEST_MATCH_CRITERIA) input(form, key).value = String(weights[key]);
  return updateCriteriaTotal(form);
}

/** Open the dialog on the weights in use. */
export function openCriteria(weights) {
  const node = document.getElementById('app-criteria');
  if (!node) return false;
  mount(node, criteriaDialog(weights));
  if (!node.open) node.showModal();
  return true;
}

/**
 * Wire the dialog once, at startup. Closing returns focus to Edit criteria.
 * Saving rebuilt the view behind the dialog, so the button that opened it is
 * gone by then; its replacement takes focus instead.
 */
export function initCriteriaDialog() {
  const node = document.getElementById('app-criteria');
  if (!node) return;
  node.addEventListener('close', () => {
    if (node.open) return;
    qs('[data-action="open-criteria"]')?.focus();
  });
}
