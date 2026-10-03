import { html, raw, mount, qs, qsa } from '../utils/dom.js';
import { BEST_MATCH_CRITERIA } from '../constants.js';
import { checkWeights } from '../utils/weights.js';

/** Save waits for exactly 100%; the draft lives in the inputs, so refresh() never re-renders this. */

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

/** A blank field reads as NaN, not 0, so it is reported rather than counted as nothing. */
export function readWeights(form) {
  return Object.fromEntries(
    BEST_MATCH_CRITERIA.map(({ key }) => {
      const text = input(form, key)?.value.trim() ?? '';
      return [key, text === '' ? Number.NaN : Number(text)];
    }),
  );
}

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

export function stepWeight(form, key, step) {
  const field = input(form, key);
  const current = Number.parseInt(field.value, 10);
  field.value = String(Math.min(100, Math.max(0, (Number.isFinite(current) ? current : 0) + step)));
  return updateCriteriaTotal(form);
}

export function fillWeights(form, weights) {
  for (const { key } of BEST_MATCH_CRITERIA) input(form, key).value = String(weights[key]);
  return updateCriteriaTotal(form);
}

export function openCriteria(weights) {
  const node = document.getElementById('app-criteria');
  if (!node) return false;
  mount(node, criteriaDialog(weights));
  if (!node.open) node.showModal();
  return true;
}

/** A save rebuilt the view, so the opener's replacement takes focus when the dialog closes. */
export function initCriteriaDialog() {
  const node = document.getElementById('app-criteria');
  if (!node) return;
  node.addEventListener('close', () => {
    if (node.open) return;
    qs('[data-action="open-criteria"]')?.focus();
  });
}
