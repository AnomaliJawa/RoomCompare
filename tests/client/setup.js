import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(() => cleanup());

// jsdom has no <dialog> behaviour: open and close as a browser would.
HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close() {
  if (!this.open) return;
  this.open = false;
  this.dispatchEvent(new Event('close'));
};
