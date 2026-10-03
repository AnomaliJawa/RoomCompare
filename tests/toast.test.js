import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { toast, dismissToast, TOAST_DURATION } from '../src/components/feedback.js';

// The module watches its region once, so the region is created once and emptied between tests.
let region;

beforeAll(() => {
  document.body.innerHTML = '<div id="toast-region"></div>';
  region = document.querySelector('#toast-region');
});

afterEach(() => {
  region.dispatchEvent(new Event('pointerleave'));
  dismissToast();
  vi.useRealTimers();
});

describe('a toast', () => {
  it('leaves on its own after its duration', () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    toast('Saved as draft', { onExpire });
    vi.advanceTimersByTime(TOAST_DURATION - 1);
    expect(region.textContent).toContain('Saved as draft');
    vi.advanceTimersByTime(1);
    expect(region.textContent).toBe('');
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('holds while the pointer rests on it, then gets a full duration again', () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    toast('Kos Melati deleted', { action: { name: 'undo-delete', label: 'Undo' }, onExpire });
    region.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(TOAST_DURATION * 3);
    expect(region.textContent).toContain('Undo');
    expect(onExpire).not.toHaveBeenCalled();

    region.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(TOAST_DURATION - 1);
    expect(region.textContent).toContain('Undo');
    vi.advanceTimersByTime(1);
    expect(region.textContent).toBe('');
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('holds while focus is on Undo, as when a screen reader lands on it', () => {
    vi.useFakeTimers();
    toast('Comparison cleared', { action: { name: 'undo-clear-compare', label: 'Undo' } });
    region.querySelector('button').focus();
    vi.advanceTimersByTime(TOAST_DURATION * 2);
    expect(region.textContent).toContain('Undo');

    region.querySelector('button').blur();
    vi.advanceTimersByTime(TOAST_DURATION);
    expect(region.textContent).toBe('');
  });

  it('is not held by focus that left with the toast it replaced', () => {
    vi.useFakeTimers();
    toast('Kos Melati deleted', { action: { name: 'undo-delete', label: 'Undo' } });
    region.querySelector('button').focus();
    toast('Kos Melati restored');
    vi.advanceTimersByTime(TOAST_DURATION);
    expect(region.textContent).toBe('');
  });
});
