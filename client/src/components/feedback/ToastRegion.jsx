import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { button } from '../ui/styles.js';
import { currentToast, getVersion, holdToast, subscribe } from './feedback.js';

export function ToastRegion() {
  useSyncExternalStore(subscribe, getVersion);
  const toast = currentToast();
  const region = useRef(null);

  // Replacing a toast removes a focused Undo without focusout in every browser, so look again.
  useLayoutEffect(() => {
    holdToast({ focus: Boolean(region.current?.contains(document.activeElement)) });
  }, [toast?.id]);

  return (
    <div
      ref={region}
      className="fixed bottom-6 left-1/2 z-70 flex -translate-x-1/2 flex-col gap-2"
      role="status"
      aria-live="polite"
      onPointerEnter={() => holdToast({ pointer: true })}
      onPointerLeave={() => holdToast({ pointer: false })}
      onFocus={() => holdToast({ focus: true })}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) holdToast({ focus: false });
      }}
    >
      {toast && (
        <div key={toast.id} className="flex items-center gap-4 rounded-sm bg-ink px-4 py-3 text-base text-paper">
          <span>{toast.message}</span>
          {toast.action && (
            <button className={button({ variant: 'inverse', size: 'small' })} type="button" onClick={toast.action.onClick}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
