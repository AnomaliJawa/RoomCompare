/**
 * Drag a sheet down to dismiss it, as on iPhone.
 *
 * Below 640px the filter and kos-picker dialogs are sheets anchored to the
 * bottom edge (see components.css). People expect to push a sheet away with
 * a downward swipe rather than reach up for a button, so the sheet follows
 * the finger, then either leaves or springs back.
 *
 * Only the head starts a drag. The body scrolls, and a pull there has to
 * stay a scroll. Close and Done still dismiss it: the gesture is a
 * shortcut, never the only way out.
 */

const SHEET_WIDTH = '(max-width: 640px)';
const INTERACTIVE = 'button, a, input, select, textarea, label';

/** How far a slow drag must travel: a quarter of the sheet, at most 160px. */
export function dismissDistance(height) {
  return Math.min(160, height / 4);
}

/**
 * Whether a released drag dismisses: far enough, or a flick — a quick swipe
 * that covers little ground still means "go away". Velocity is px/ms.
 */
export function shouldDismiss({ distance, velocity, height }) {
  if (distance >= dismissDistance(height)) return true;
  return distance >= 24 && velocity >= 0.5;
}

function token(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Carry the sheet from wherever the finger left it to `to`, then run
 * `done`. The inline style is set to the destination first, so nothing
 * flashes back into place when the animation ends.
 */
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

export function enableSheetDismiss(sheet, handleSelector) {
  if (!sheet) return;
  let drag = null;

  sheet.addEventListener('pointerdown', (event) => {
    if (!sheet.open || !window.matchMedia?.(SHEET_WIDTH).matches) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!event.target.closest(handleSelector) || event.target.closest(INTERACTIVE)) return;

    drag = { id: event.pointerId, startY: event.clientY, lastY: event.clientY, lastTime: event.timeStamp, speed: 0 };
    try {
      sheet.setPointerCapture(event.pointerId);
    } catch {
      // Nothing to capture for a synthetic event; the drag still works.
    }
  });

  sheet.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    // The speed of the latest movement, not the average: a slow start
    // followed by a flick is a flick.
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.speed = (event.clientY - drag.lastY) / elapsed;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;

    // Downward only: a sheet is not pulled up past where it rests.
    const distance = Math.max(0, event.clientY - drag.startY);
    sheet.style.transform = distance ? `translateY(${distance}px)` : '';
  });

  function release(event, cancelled) {
    if (!drag || event.pointerId !== drag.id) return;
    const distance = Math.max(0, event.clientY - drag.startY);
    // A finger that stopped before lifting was placing the sheet, not
    // flicking it.
    const speed = event.timeStamp - drag.lastTime > 100 ? 0 : drag.speed;
    drag = null;

    if (!cancelled && shouldDismiss({ distance, velocity: speed, height: sheet.offsetHeight })) {
      settle(sheet, 'translateY(100%)', () => sheet.close());
    } else if (distance) {
      settle(sheet, 'none');
    }
  }

  sheet.addEventListener('pointerup', (event) => release(event, false));
  sheet.addEventListener('pointercancel', (event) => release(event, true));

  // However it closed, the sheet opens next time at rest.
  sheet.addEventListener('close', () => {
    drag = null;
    sheet.style.transform = '';
  });
}
