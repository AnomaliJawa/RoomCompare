import { html, qs, qsa, mount } from '../utils/dom.js';
import { FIELD_SECTION } from '../utils/validate.js';

/** Errors are written into the existing DOM: re-rendering would lose maps, photos, focus and caret. */

const ERROR_CLASS = 'field__error';
const ERROR_MARK = 'data-generated-error';

function errorId(field) {
  return `error-${field}`;
}

/** Never a field's ⓘ: it explains the field, it is not where the answer goes. */
function controlFor(node, field) {
  return (
    qs(`#f-${field}`, node) ??
    qs(`[name="${field}"]`, node) ??
    qs('input, select, textarea, button:not(.field__info)', node)
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

export function showErrors(form, result) {
  clearErrors(form);
  if (result.ok) return true;

  Object.entries(result.errors).forEach(([field, message]) => attach(form, field, message));

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

/** After a failed submit, a fixed field is re-checked on blur; never mid-typing. */
export function watchForRepair(form, validateNow) {
  if (form.dataset.watchingRepairs === 'true') return;
  form.dataset.watchingRepairs = 'true';

  const recheck = (event) => {
    const node = event.target.closest('[data-field]');
    if (!node || node.getAttribute('data-invalid') !== 'true') return;

    const field = node.dataset.field;
    const result = validateNow();
    if (result.errors[field]) return;

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
