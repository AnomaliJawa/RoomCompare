import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ToastRegion } from '../../client/src/components/feedback/ToastRegion.jsx';
import { TOAST_DURATION, dismissToast, holdToast, toast } from '../../client/src/components/feedback/feedback.js';

const region = () => screen.getByRole('status');
const show = (...args) => act(() => toast(...args));
const pass = (ms) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  render(<ToastRegion />);
});

afterEach(() => {
  act(() => {
    holdToast({ pointer: false, focus: false });
    dismissToast();
  });
  vi.useRealTimers();
});

describe('a toast', () => {
  it('leaves on its own after its duration', () => {
    const onExpire = vi.fn();
    show('Saved as draft', { onExpire });
    pass(TOAST_DURATION - 1);
    expect(region().textContent).toContain('Saved as draft');
    pass(1);
    expect(region().textContent).toBe('');
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('holds while the pointer rests on it, then gets a full duration again', () => {
    const onExpire = vi.fn();
    show('Kos Melati deleted', { action: { label: 'Undo', onClick: () => {} }, onExpire });
    fireEvent.pointerEnter(region());
    pass(TOAST_DURATION * 3);
    expect(region().textContent).toContain('Undo');
    expect(onExpire).not.toHaveBeenCalled();

    fireEvent.pointerLeave(region());
    pass(TOAST_DURATION - 1);
    expect(region().textContent).toContain('Undo');
    pass(1);
    expect(region().textContent).toBe('');
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('holds while focus is on Undo, as when a screen reader lands on it', () => {
    show('Comparison cleared', { action: { label: 'Undo', onClick: () => {} } });
    act(() => screen.getByRole('button', { name: 'Undo' }).focus());
    pass(TOAST_DURATION * 2);
    expect(region().textContent).toContain('Undo');

    act(() => screen.getByRole('button', { name: 'Undo' }).blur());
    pass(TOAST_DURATION);
    expect(region().textContent).toBe('');
  });

  it('is not held by focus that left with the toast it replaced', () => {
    show('Kos Melati deleted', { action: { label: 'Undo', onClick: () => {} } });
    act(() => screen.getByRole('button', { name: 'Undo' }).focus());
    show('Kos Melati restored');
    pass(TOAST_DURATION);
    expect(region().textContent).toBe('');
  });

  it('runs its action when pressed', () => {
    const onClick = vi.fn();
    show('Kos Melati deleted', { action: { label: 'Undo', onClick } });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
