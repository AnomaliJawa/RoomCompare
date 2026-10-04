import { useSyncExternalStore } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { button } from '../ui/styles.js';
import { currentConfirmation, getVersion, settleConfirmation, subscribe } from './feedback.js';

/** Delete, discard, a duplicate name, logging out with changes unsent, and pre-account surveys. */
export function ConfirmDialog() {
  useSyncExternalStore(subscribe, getVersion);
  const asked = currentConfirmation();

  // Closing it any other way, Escape included, is a no.
  return (
    <Modal open={Boolean(asked)} onClose={() => settleConfirmation(false)} aria-labelledby="dialog-title">
      {asked && (
        <>
          <p className="text-md font-semibold" id="dialog-title">
            {asked.title}
          </p>
          <p className="mt-3 mb-6 text-muted">{asked.body}</p>
          <div className="flex justify-end gap-2 pointer-coarse:gap-3">
            <button className={button({ variant: 'quiet' })} type="button" onClick={() => settleConfirmation(false)}>
              {asked.cancelLabel}
            </button>
            <button className={button({ variant: asked.tone })} type="button" onClick={() => settleConfirmation(true)}>
              {asked.confirmLabel}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
