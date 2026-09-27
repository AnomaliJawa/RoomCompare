import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enableSheetDismiss, shouldDismiss, dismissDistance } from '../src/components/sheet.js';

/** jsdom has no PointerEvent; a MouseEvent carrying the same fields will do. */
function pointer(type, target, clientY, timeStamp) {
  const event = new MouseEvent(type, { bubbles: true, clientY, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  target.dispatchEvent(event);
}

describe('when a released drag dismisses a sheet', () => {
  it('needs a quarter of the sheet from a slow drag, but never more than 160px', () => {
    expect(dismissDistance(400)).toBe(100);
    expect(dismissDistance(1000)).toBe(160);
    expect(shouldDismiss({ distance: 99, velocity: 0, height: 400 })).toBe(false);
    expect(shouldDismiss({ distance: 100, velocity: 0, height: 400 })).toBe(true);
  });

  it('takes a quick flick from a short distance, but not a twitch', () => {
    expect(shouldDismiss({ distance: 30, velocity: 0.8, height: 800 })).toBe(true);
    expect(shouldDismiss({ distance: 10, velocity: 2, height: 800 })).toBe(false);
  });
});

describe('dragging a sheet by its head', () => {
  let sheet;
  let title;
  let close;
  let wide;

  beforeEach(() => {
    document.body.innerHTML = `
      <dialog id="sheet" open>
        <div class="picker-dialog__head"><h2>Add kos</h2><button type="button">Close</button></div>
        <div class="picker-dialog__body"><p>List</p></div>
      </dialog>`;
    sheet = document.querySelector('#sheet');
    title = sheet.querySelector('h2');
    close = sheet.querySelector('button');
    // jsdom lays nothing out and does not implement close().
    Object.defineProperty(sheet, 'offsetHeight', { value: 600 });
    sheet.close = vi.fn(() => sheet.dispatchEvent(new Event('close')));
    wide = false;
    window.matchMedia = vi.fn((query) => ({ matches: query.includes('max-width') ? !wide : false }));
    enableSheetDismiss(sheet, '.picker-dialog__head');
  });

  it('follows the finger downward only', () => {
    pointer('pointerdown', title, 100, 0);
    pointer('pointermove', title, 60, 16);
    expect(sheet.style.transform).toBe('');
    pointer('pointermove', title, 160, 32);
    expect(sheet.style.transform).toBe('translateY(60px)');
  });

  it('closes once pulled far enough', () => {
    pointer('pointerdown', title, 100, 0);
    pointer('pointermove', title, 300, 400);
    pointer('pointerup', title, 300, 800);
    expect(sheet.close).toHaveBeenCalledTimes(1);
    expect(sheet.style.transform).toBe('');
  });

  it('springs back from a short, slow pull and stays open', () => {
    pointer('pointerdown', title, 100, 0);
    pointer('pointermove', title, 130, 400);
    pointer('pointerup', title, 130, 800);
    expect(sheet.close).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe('');
  });

  it('leaves a press on a button to the button', () => {
    pointer('pointerdown', close, 100, 0);
    pointer('pointermove', close, 400, 16);
    pointer('pointerup', close, 400, 32);
    expect(sheet.close).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe('');
  });

  it('does nothing on a wide screen, where the dialog is not a sheet', () => {
    wide = true;
    pointer('pointerdown', title, 100, 0);
    pointer('pointermove', title, 400, 16);
    pointer('pointerup', title, 400, 32);
    expect(sheet.close).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe('');
  });
});
