import { html, qs, qsa, mount } from '../utils/dom.js';
import { FIELD_SECTION } from '../utils/validate.js';

/**
 * Show validation results on a form that is already on screen.
 *
 * Errors are written into the existing DOM rather than produced by
 * re-rendering: the form holds map instances, uploaded thumbnails, focus and
 * caret position, and rebuilding it to show a message would throw all of that
 * away — which is a worse outcome than the error being reported.
 *
 * Each message is tied to its control with aria-describedby, and each numbered
 * section shows how many problems it holds, so a long form can be repaired
 * without hunting.
 */

const ERROR_CLASS = 'field__error';
const ERROR_MARK = 'data-generated-error';

function errorId(field) {
  return `error-${field}`;
}

/** The control a message should point at, and that focus should land on. */
function controlFor(node, field) {
  return (
    qs(`#f-${field}`, node) ??
    qs(`[name="${field}"]`, node) ??
    qs('input, select, textarea, button', node)
  );
}

export function clearErrors(form) {
  qsa(`[${ERROR_MARK}]`, form).forEach((node) => node.remove());
  qsa('[data-field]', form).forEach((node) => {
    node.removeAttribute('data-invalid');
    const control = controlFor(node, node.dataset.field);
    if (!control) return;
    control.removeAttribute('aria-invalid');
    const described = control.getAttribute('aria-describedby');
    if (!described) return;
    const kept = described
      .split(' ')
      .filter((id) => id !== errorId(node.dataset.field))
      .join(' ');
    if (kept) control.setAttribute('aria-describedby', kept);
    else control.removeAttribute('aria-describedby');
  });
  qsa('[data-section-errors]', form).forEach((badge) => {
    badge.hidden = true;
    badge.textContent = '';
  });
  const summary = qs('[data-error-summary]', form);
  if (summary) {
    summary.hidden = true;
    summary.innerHTML = '';
  }
}

function attach(form, field, message) {
  const node = qs(`[data-field="${field}"]`, form);
  if (!node) return null;

  node.setAttribute('data-invalid', 'true');

  const span = document.createElement('span');
  span.className = ERROR_CLASS;
  span.id = errorId(field);
  span.setAttribute(ERROR_MARK, '');
  span.textContent = message;
  node.append(span);

  const control = controlFor(node, field);
  if (control) {
    control.setAttribute('aria-invalid', 'true');
    const described = control.getAttribute('aria-describedby');
    control.setAttribute('aria-describedby', described ? `${described} ${errorId(field)}` : errorId(field));
  }
  return control;
}

/**
 * Apply a validation result. Returns true when the form was clean.
 * On failure the first problem is focused and scrolled to.
 */
export function showErrors(form, result) {
  clearErrors(form);
  if (result.ok) return true;

  Object.entries(result.errors).forEach(([field, message]) => attach(form, field, message));

  // Per-section counts, so a collapsed or scrolled-past section still says it
  // needs attention.
  Object.entries(result.sectionCounts).forEach(([section, count]) => {
    const badge = qs(`[data-section="${section}"] [data-section-errors]`, form);
    if (!badge) return;
    badge.hidden = false;
    badge.textContent = `${count} to fix`;
  });

  const total = Object.keys(result.errors).length;
  const summary = qs('[data-error-summary]', form);
  if (summary) {
    summary.hidden = false;
    mount(
      summary,
      html`<div class="banner" data-tone="alert">
        <span>
          ${total === 1 ? 'One field needs attention' : `${total} fields need attention`}
          before this survey can be published.
        </span>
      </div>`,
    );
  }

  const firstNode = result.firstField ? qs(`[data-field="${result.firstField}"]`, form) : null;
  const firstControl = firstNode ? controlFor(firstNode, result.firstField) : null;
  if (firstControl) {
    firstControl.focus({ preventScroll: true });
    firstNode.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  return false;
}

/**
 * After a failed submit, re-check that field when the user leaves it, so a
 * fixed problem stops being reported without waiting for another submit.
 * Validating from the first keystroke would nag someone mid-typing.
 */
export function watchForRepair(form, validateNow) {
  if (form.dataset.watchingRepairs === 'true') return;
  form.dataset.watchingRepairs = 'true';

  const recheck = (event) => {
    const node = event.target.closest('[data-field]');
    if (!node || node.getAttribute('data-invalid') !== 'true') return;

    const field = node.dataset.field;
    const result = validateNow();
    if (result.errors[field]) return;

    // This one is fixed; leave the rest reported as they are.
    node.removeAttribute('data-invalid');
    qs(`#${CSS.escape(errorId(field))}`, node)?.remove();
    const control = controlFor(node, field);
    control?.removeAttribute('aria-invalid');

    const section = FIELD_SECTION[field];
    const badge = qs(`[data-section="${section}"] [data-section-errors]`, form);
    const remaining = Object.keys(result.errors).filter((key) => FIELD_SECTION[key] === section).length;
    if (badge) {
      badge.hidden = remaining === 0;
      badge.textContent = remaining ? `${remaining} to fix` : '';
    }
  };

  form.addEventListener('blur', recheck, true);
  form.addEventListener('change', recheck);
}
