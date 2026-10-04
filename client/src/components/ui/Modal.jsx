import { createContext, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { enableSheetDismiss } from './sheet.js';

const FRAME = 'border border-rule bg-surface text-ink rounded-lg motion-safe:open:animate-dialog-in motion-safe:backdrop:animate-backdrop-in';

// On a phone the wide dialogs become bottom sheets, with a strip of the page left showing.
const SHEET =
  'max-lg:mx-0 max-lg:mt-auto max-lg:mb-0 max-lg:w-full max-lg:max-w-full max-lg:max-h-[calc(100dvh_-_2.5rem)] ' +
  'max-lg:rounded-b-none max-lg:border-b-0 max-lg:motion-safe:open:animate-sheet-in';

const WIDE = `${FRAME} ${SHEET} max-h-[calc(100vh_-_4rem)] p-0 shadow-dialog backdrop:bg-[var(--backdrop)] open:flex open:flex-col`;

/** Scoped to [open] through open:, since a bare display would show a closed <dialog>. */
const KINDS = {
  alert: `${FRAME} w-[min(440px,calc(100vw_-_2.5rem))] p-6 shadow-dialog backdrop:bg-[var(--backdrop)]`,
  filters: `${WIDE} w-[min(720px,calc(100vw_-_2.5rem))] max-lg:h-auto`,
  picker: `${WIDE} w-[min(560px,calc(100vw_-_2.5rem))] max-lg:h-auto`,
  criteria: `${WIDE} w-[min(560px,calc(100vw_-_2.5rem))] max-lg:h-auto`,
  // Sized to their few paragraphs: auto, pinned to both edges, would stretch them full height.
  guide: `${WIDE} w-[min(480px,calc(100vw_-_2.5rem))] max-lg:h-fit`,
  howto:
    `${FRAME} ${SHEET} w-[min(360px,calc(100vw_-_2.5rem))] max-h-[min(70vh,560px)] max-lg:h-fit p-0 shadow-dialog ` +
    'backdrop:bg-[var(--backdrop)] open:flex open:flex-col lg:fixed lg:inset-auto lg:m-0 lg:backdrop:bg-transparent',
  lightbox: `${FRAME} w-[min(880px,calc(100vw_-_2.5rem))] p-4 shadow-lightbox backdrop:bg-[var(--backdrop-lightbox)]`,
};

const CloseContext = createContext(() => {});

/** Closes the dialog this sits in, and tells its owner. */
export const useCloseModal = () => useContext(CloseContext);

/**
 * A native modal <dialog>: the browser keeps focus inside and closes it on Escape. Its content mounts
 * only while open, so each opening starts afresh. `sheetHandle` lets a phone sheet be dragged down to close.
 */
export function Modal({ open, onClose, kind = 'alert', sheetHandle = null, closeOnBackdrop = false, onOpened = null, children, ...rest }) {
  const ref = useRef(null);
  const closing = useRef(onClose);
  closing.current = onClose;
  const opened = useRef(onOpened);
  opened.current = onOpened;

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) {
      dialog.showModal();
      opened.current?.(dialog);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    const heard = () => closing.current?.();
    dialog.addEventListener('close', heard);
    const release = sheetHandle ? enableSheetDismiss(dialog, sheetHandle) : () => {};
    return () => {
      dialog.removeEventListener('close', heard);
      release();
      if (dialog.open) dialog.close();
    };
  }, [sheetHandle]);

  // Told at once as well: a hidden tab can hold the close event back, and the owner would think it still open.
  const close = () => {
    if (ref.current?.open) ref.current.close();
    closing.current?.();
  };
  const onClick = closeOnBackdrop
    ? (event) => {
        if (event.target === event.currentTarget) close();
      }
    : undefined;

  return (
    <dialog ref={ref} aria-modal="true" className={KINDS[kind]} onClick={onClick} {...rest}>
      <CloseContext.Provider value={close}>{open ? children : null}</CloseContext.Provider>
    </dialog>
  );
}
