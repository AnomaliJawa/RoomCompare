import { html, qs } from '../utils/dom.js';

/**
 * Toasts and the confirmation dialog.
 *
 * The prototype gave no feedback at all after saving, deleting or starring —
 * an action simply happened and the screen changed. An action keeps its name
 * through the flow, so Publish produces "Published".
 */

let toastTimer = null;

export function toast(message, { action = null } = {}) {
  const region = qs('#toast-region');
  if (!region) return;

  region.innerHTML = html`
    <div class="toast">
      <span>${message}</span>
      ${action ? `<button class="btn btn--quiet btn--small" type="button" data-action="${action.name}">${action.label}</button>` : ''}
    </div>
  `;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    region.innerHTML = '';
  }, 6000);
}

export function dismissToast() {
  clearTimeout(toastTimer);
  const region = qs('#toast-region');
  if (region) region.innerHTML = '';
}

/**
 * Confirm before something irreversible. Resolves true only on confirm.
 * <dialog> brings the focus trap and Escape handling with it.
 */
export function confirmDialog({ title, body, confirmLabel = 'Delete', tone = 'danger' }) {
  const node = qs('#app-dialog');
  if (!node) return Promise.resolve(false);

  node.innerHTML = html`
    <p class="dialog__title" id="dialog-title">${title}</p>
    <p class="dialog__body">${body}</p>
    <div class="dialog__actions">
      <button class="btn btn--quiet" type="button" value="cancel" data-dialog="cancel">Keep</button>
      <button class="btn btn--${tone}" type="button" value="confirm" data-dialog="confirm">${confirmLabel}</button>
    </div>
  `;
  node.setAttribute('aria-labelledby', 'dialog-title');

  return new Promise((resolve) => {
    function finish(result) {
      node.removeEventListener('click', onClick);
      node.removeEventListener('close', onClose);
      if (node.open) node.close();
      resolve(result);
    }
    function onClick(event) {
      const button = event.target.closest('[data-dialog]');
      if (!button) return;
      finish(button.dataset.dialog === 'confirm');
    }
    // Covers Escape, which closes a <dialog> without a button press.
    function onClose() {
      finish(false);
    }
    node.addEventListener('click', onClick);
    node.addEventListener('close', onClose);
    node.showModal();
  });
}
