import { html, raw, mount, qs } from '../utils/dom.js';

export const TOAST_DURATION = 7000;

let toastTimer = null;
let expireToast = null;

// A toast holds while hovered or focused (Undo), then gets a fresh full duration.
let hovered = false;
let focused = false;
let watching = false;

function scheduleExpiry(region) {
  clearTimeout(toastTimer);
  if (hovered || focused || !region.firstElementChild) return;
  toastTimer = setTimeout(() => {
    toastTimer = null;
    region.innerHTML = '';
    const done = expireToast;
    expireToast = null;
    done?.();
  }, TOAST_DURATION);
}

function holdWhileAttended(region) {
  if (watching) return;
  watching = true;
  region.addEventListener('pointerenter', () => {
    hovered = true;
    scheduleExpiry(region);
  });
  region.addEventListener('pointerleave', () => {
    hovered = false;
    scheduleExpiry(region);
  });
  region.addEventListener('focusin', () => {
    focused = true;
    scheduleExpiry(region);
  });
  region.addEventListener('focusout', (event) => {
    if (region.contains(event.relatedTarget)) return;
    focused = false;
    scheduleExpiry(region);
  });
}

export function toast(message, { action = null, onExpire = null } = {}) {
  const region = qs('#toast-region');
  if (!region) return;

  mount(
    region,
    html`
      <div class="toast">
        <span>${message}</span>
        ${action
          ? html`<button class="btn btn--quiet btn--small" type="button" data-action="${action.name}">
              ${action.label}
            </button>`
          : ''}
      </div>
    `,
  );

  holdWhileAttended(region);
  // Replacing a toast removes a focused Undo without focusout in every browser.
  focused = region.contains(document.activeElement);
  expireToast = onExpire;
  scheduleExpiry(region);
}

export function dismissToast() {
  clearTimeout(toastTimer);
  expireToast = null;
  focused = false;
  const region = qs('#toast-region');
  if (region) region.innerHTML = '';
}

export function confirmDialog({ title, body, confirmLabel = 'Delete', cancelLabel = 'Keep', tone = 'danger' }) {
  const node = qs('#app-dialog');
  if (!node) return Promise.resolve(false);

  mount(
    node,
    html`
      <p class="dialog__title" id="dialog-title">${title}</p>
      <p class="dialog__body">${body}</p>
      <div class="dialog__actions">
        <button class="btn btn--quiet" type="button" data-dialog="cancel">${cancelLabel}</button>
        <button class="btn btn--${tone}" type="button" data-dialog="confirm">${confirmLabel}</button>
      </div>
    `,
  );
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
