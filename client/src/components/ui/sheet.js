/** Swipe a sheet down to dismiss it, as on iPhone; only the head starts a drag. */

const SHEET_WIDTH = '(max-width: 640px)';
const INTERACTIVE = 'button, a, input, select, textarea, label';

export function dismissDistance(height) {
  return Math.min(160, height / 4);
}

/** A flick dismisses too, however short; velocity is px/ms. */
export function shouldDismiss({ distance, velocity, height }) {
  if (distance >= dismissDistance(height)) return true;
  return distance >= 24 && velocity >= 0.5;
}

function token(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** The inline style is set to the destination first, so nothing flashes back. */
function settle(sheet, to, done) {
  const from = sheet.style.transform || 'none';
  sheet.style.transform = to === 'none' ? '' : to;

  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (still || typeof sheet.animate !== 'function') {
    done?.();
    return;
  }
  const animation = sheet.animate([{ transform: from }, { transform: to }], {
    duration: parseFloat(token('--duration-base', '200ms')),
    easing: token('--ease-out', 'ease-out'),
  });
  animation.onfinish = () => done?.();
}

/** Returns a function that removes the listeners. */
export function enableSheetDismiss(sheet, handleSelector) {
  if (!sheet) return () => {};
  let drag = null;

  const onDown = (event) => {
    if (!sheet.open || !window.matchMedia?.(SHEET_WIDTH).matches) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!event.target.closest(handleSelector) || event.target.closest(INTERACTIVE)) return;

    drag = { id: event.pointerId, startY: event.clientY, lastY: event.clientY, lastTime: event.timeStamp, speed: 0 };
    try {
      sheet.setPointerCapture(event.pointerId);
    } catch {
      // Nothing to capture for a synthetic event; the drag still works.
    }
  };

  const onMove = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    // The latest movement's speed, not the average: a slow start then a flick is a flick.
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.speed = (event.clientY - drag.lastY) / elapsed;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;

    const distance = Math.max(0, event.clientY - drag.startY);
    sheet.style.transform = distance ? `translateY(${distance}px)` : '';
  };

  function release(event, cancelled) {
    if (!drag || event.pointerId !== drag.id) return;
    const distance = Math.max(0, event.clientY - drag.startY);
    // A finger that stopped before lifting was placing the sheet, not flicking it.
    const speed = event.timeStamp - drag.lastTime > 100 ? 0 : drag.speed;
    drag = null;

    if (!cancelled && shouldDismiss({ distance, velocity: speed, height: sheet.offsetHeight })) {
      settle(sheet, 'translateY(100%)', () => sheet.close());
    } else if (distance) {
      settle(sheet, 'none');
    }
  }

  const onUp = (event) => release(event, false);
  const onCancel = (event) => release(event, true);
  const onClose = () => {
    drag = null;
    sheet.style.transform = '';
  };

  const listeners = [
    ['pointerdown', onDown],
    ['pointermove', onMove],
    ['pointerup', onUp],
    ['pointercancel', onCancel],
    ['close', onClose],
  ];
  listeners.forEach(([type, listener]) => sheet.addEventListener(type, listener));
  return () => listeners.forEach(([type, listener]) => sheet.removeEventListener(type, listener));
}
