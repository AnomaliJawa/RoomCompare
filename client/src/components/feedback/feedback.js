/** Toasts and the confirm dialog: called from anywhere, shown by <ToastRegion> and <ConfirmDialog>. */

export const TOAST_DURATION = 7000;

const listeners = new Set();
let version = 0;

let current = null;
let expire = null;
let timer = null;
let sequence = 0;
// A toast holds while hovered or focused (Undo), then gets a fresh full duration.
let hovered = false;
let focused = false;

let confirmation = null;

function emit() {
  version += 1;
  listeners.forEach((listener) => listener());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getVersion = () => version;
export const currentToast = () => current;
export const currentConfirmation = () => confirmation;

function schedule() {
  clearTimeout(timer);
  timer = null;
  if (hovered || focused || !current) return;
  timer = setTimeout(() => {
    timer = null;
    current = null;
    const done = expire;
    expire = null;
    emit();
    done?.();
  }, TOAST_DURATION);
}

/** `action`: { label, onClick }, such as Undo. */
export function toast(message, { action = null, onExpire = null } = {}) {
  sequence += 1;
  current = { id: sequence, message, action };
  expire = onExpire;
  emit();
  schedule();
}

export function dismissToast() {
  clearTimeout(timer);
  timer = null;
  expire = null;
  focused = false;
  current = null;
  emit();
}

export function holdToast({ pointer = hovered, focus = focused } = {}) {
  hovered = pointer;
  focused = focus;
  schedule();
}

/** Resolves true on confirm; false on cancel or Escape. */
export function confirmDialog({ title, body, confirmLabel = 'Delete', cancelLabel = 'Keep', tone = 'danger' }) {
  confirmation?.resolve(false);
  return new Promise((resolve) => {
    confirmation = { title, body, confirmLabel, cancelLabel, tone, resolve };
    emit();
  });
}

export function settleConfirmation(result) {
  const settled = confirmation;
  if (!settled) return;
  confirmation = null;
  emit();
  settled.resolve(result);
}
