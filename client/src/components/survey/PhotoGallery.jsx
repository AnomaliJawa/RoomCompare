import { useLayoutEffect, useRef, useState } from 'react';
import { useMediaRecords } from '../../hooks/useMediaRecords.js';
import { Modal, useCloseModal } from '../ui/Modal.jsx';
import { button, cx, meta, narrowLabel } from '../ui/styles.js';

/** Files stay on the device that added them; elsewhere they are named as not here. */
function notHere(count, kind) {
  const noun = kind === 'video' ? 'video' : 'photo';
  const what = count === 1 ? `1 ${noun} is` : `${count} ${noun}s are`;
  return `${what} not on this device. Photos and videos stay on the device they were added on.`;
}

const tile = 'overflow-hidden rounded-sm border border-rule bg-paper';

function LightboxContent({ records, start }) {
  const close = useCloseModal();
  const [index, setIndex] = useState(start);
  const closeButton = useRef(null);
  const record = records[index];
  const step = (by) => {
    if (records.length < 2) return;
    setIndex((now) => (now + by + records.length) % records.length);
  };

  // Close is the safe default, and it keeps focus inside the dialog.
  useLayoutEffect(() => closeButton.current?.focus(), [index]);

  return (
    <div
      className="flex flex-col gap-3"
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          step(-1);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          step(1);
        }
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <span className={cx(narrowLabel, 'text-muted tabular-nums lining-nums')}>
          {index + 1} of {records.length}
        </span>
        <button ref={closeButton} className={button({ variant: 'secondary', size: 'small' })} type="button" onClick={close}>
          Close
        </button>
      </div>
      <figure className="m-0 flex flex-col gap-2">
        <img className="max-h-[min(70vh,560px)] w-full rounded-sm bg-paper object-contain" src={record.url} alt={record.originalName || 'Survey photo'} />
        <figcaption className={meta}>{record.originalName || ''}</figcaption>
      </figure>
      <div className="flex gap-2 pointer-coarse:gap-3">
        <button className={button({ className: 'flex-1' })} type="button" disabled={records.length < 2} onClick={() => step(-1)}>
          Previous
        </button>
        <button className={button({ className: 'flex-1' })} type="button" disabled={records.length < 2} onClick={() => step(1)}>
          Next
        </button>
      </div>
    </div>
  );
}

/** Tiles hold their place while the files load; a photo opens in the lightbox, a video plays in place. */
export function Gallery({ label, mediaIds = [], kind = 'photo' }) {
  const { ready, records } = useMediaRecords(mediaIds);
  const [viewing, setViewing] = useState(null);
  const opener = useRef(null);

  if (!mediaIds.length) return <p className={meta}>No {label} recorded.</p>;

  const missing = mediaIds.length - records.length;
  let status = `Loading ${mediaIds.length} ${mediaIds.length === 1 ? 'file' : 'files'}…`;
  if (ready) status = missing ? notHere(missing, kind) : '';

  return (
    <div className="flex flex-col gap-3" data-gallery={kind}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
        {!ready &&
          mediaIds.map((id) => (
            <div key={id} className={tile} aria-hidden="true">
              <span className="block h-[110px] w-full rounded-sm bg-rule motion-safe:animate-skeleton" />
            </div>
          ))}
        {ready &&
          kind === 'video' &&
          records.map((record) => (
            <div key={record.id} className={cx(tile, 'flex flex-col gap-2 p-2')}>
              <video className="w-full rounded-sm" controls preload="metadata" src={record.url} />
              <span className={meta}>{record.originalName || 'Video'}</span>
            </div>
          ))}
        {ready &&
          kind !== 'video' &&
          records.map((record, index) => (
            <button
              key={record.id}
              className={cx(tile, 'cursor-zoom-in p-0 transition-[border-color] hover:border-accent active:border-accent')}
              type="button"
              aria-label={`Open photo ${index + 1} of ${records.length}`}
              onClick={(event) => {
                opener.current = event.currentTarget;
                setViewing(index);
              }}
            >
              <img className="block h-[110px] w-full object-cover" src={record.url} alt={record.originalName || `Survey photo ${index + 1}`} />
            </button>
          ))}
      </div>
      <p className={cx(meta, 'empty:hidden')} role="status" aria-live="polite" data-gallery-status>
        {status}
      </p>
      {kind !== 'video' && (
        <Modal
          open={viewing !== null}
          kind="lightbox"
          aria-label="Photo viewer"
          closeOnBackdrop
          onClose={() => {
            setViewing(null);
            opener.current?.focus();
          }}
        >
          <LightboxContent records={records} start={viewing ?? 0} />
        </Modal>
      )}
    </div>
  );
}
