import { useRef, useState } from 'react';
import { MAX_PHOTOS_PER_SECTION } from '../../constants.js';
import { MAX_VIDEOS, addPhotos, addVideo } from '../../data/media.js';
import { useMediaRecords } from '../../hooks/useMediaRecords.js';
import { formatBytes } from '../../utils/image.js';
import { cx, fieldError, fieldLabel, meta, narrowLabel } from '../ui/styles.js';
import { InfoButton } from './fields.jsx';

/** Files are stored when chosen, so an interrupted survey keeps them; only records leave the device. */

const ACCEPT = { photo: 'image/*', video: 'video/*' };

const remove = cx(
  'rounded-sm border border-rule bg-surface px-2 py-1 font-narrow text-xs font-semibold text-alert',
  'hover:border-alert hover:bg-alert-bg active:border-alert active:bg-alert-bg',
  // Sits on a photo, where there is room for the real size.
  'pointer-coarse:inline-flex pointer-coarse:min-h-target pointer-coarse:min-w-target pointer-coarse:items-center pointer-coarse:justify-center',
);
const item = 'relative overflow-hidden rounded-sm border border-rule bg-paper';
const fileItem = cx(item, 'flex items-center justify-between gap-3 p-3');

function RemoveButton({ label, onClick, inline = false }) {
  return (
    <button className={cx(remove, !inline && 'absolute right-1 bottom-1')} type="button" aria-label={label} onClick={onClick}>
      Remove
    </button>
  );
}

function FileRow({ name, detail, children }) {
  return (
    <li className={fileItem}>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-medium">{name}</span>
        <span className={meta}>{detail}</span>
      </div>
      {children}
    </li>
  );
}

/**
 * Up to ten photos a section, or two videos. `ids` lists the files; ids this device does not hold stay
 * listed, since dropping them would lose the photo where it is held. `onChange` hears only the user's
 * own adds and removes, never the first paint.
 */
export function MediaUploader({ section, kind = 'photo', label, ids, onChange, surveyId, guide = null }) {
  const max = kind === 'video' ? MAX_VIDEOS : MAX_PHOTOS_PER_SECTION;
  const noun = kind === 'video' ? 'videos' : 'photos';
  const { records } = useMediaRecords(ids);
  const held = new Map(records.map((record) => [record.id, record]));
  const input = useRef(null);
  const busy = useRef(false);
  const latest = useRef(ids);
  latest.current = ids;
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null);
  const full = ids.length >= max;

  async function handleFiles(fileList) {
    const files = [...fileList];
    if (!files.length || busy.current) return;
    busy.current = true;
    setStatus(`Adding ${files.length} file${files.length === 1 ? '' : 's'}…`);
    try {
      let added = [];
      let failures = [];
      if (kind === 'video') {
        const room = Math.max(0, max - latest.current.length);
        failures = files.slice(room).map((file) => ({ fileName: file.name, message: `Only ${max} videos can be added.` }));
        for (const file of files.slice(0, room)) {
          const result = await addVideo(file, { surveyId });
          if (result.ok) added.push(result.record.id);
          else failures.push(result);
        }
      } else {
        const { stored, failed } = await addPhotos(files, { surveyId, section, existingCount: latest.current.length });
        added = stored.map((record) => record.id);
        failures = failed;
      }
      onChange([...latest.current, ...added]);
      setStatus(failures.length ? failures : null);
    } finally {
      busy.current = false;
      if (input.current) input.current.value = '';
    }
  }

  // Dropped from the list only: files go after save, so Cancel can still restore them.
  const drop = (id) => {
    onChange(latest.current.filter((item) => item !== id));
    setStatus('Photo removed. It is deleted when you save.');
  };

  const dragOver = (event) => {
    event.preventDefault();
    if (!full) setDragging(true);
  };

  return (
    <div
      className="flex flex-col gap-3"
      data-uploader={section}
      onDragEnter={dragOver}
      onDragOver={dragOver}
      onDragLeave={(event) => {
        event.preventDefault();
        if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!full) handleFiles(event.dataTransfer?.files ?? []);
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2">
          <span className={fieldLabel} id={`${section}-uploader-label`}>
            {label}
          </span>
          <InfoButton guide={guide} />
        </span>
        <span className={cx(narrowLabel, 'text-muted tabular-nums lining-nums')} data-count>
          {ids.length} of {max}
        </span>
      </div>

      <button
        className={cx(
          'flex w-full flex-col gap-1 rounded-md border border-dashed bg-surface px-4 py-6 text-center transition-[border-color,background-color]',
          'disabled:cursor-not-allowed disabled:text-muted',
          'hover:not-disabled:border-accent hover:not-disabled:bg-accent-tint active:not-disabled:border-accent active:not-disabled:bg-accent-tint',
          dragging ? 'border-solid border-accent bg-accent-tint' : 'border-rule text-ink',
        )}
        type="button"
        disabled={full}
        aria-describedby={`${section}-uploader-hint`}
        onClick={() => input.current?.click()}
      >
        <span className="font-semibold">{full ? `Maximum of ${max} reached` : `Choose ${noun}, or drag them here`}</span>
        <span className="text-xs text-muted" id={`${section}-uploader-hint`}>
          {guide?.helper ??
            (kind === 'video' ? `Up to ${max}, 20 MB each.` : `Up to ${max}. Large photos are resized automatically.`)}
        </span>
      </button>

      <input
        ref={input}
        className="sr-only"
        type="file"
        accept={ACCEPT[kind]}
        multiple={kind !== 'video'}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => handleFiles(event.target.files)}
      />

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 empty:hidden" aria-labelledby={`${section}-uploader-label`}>
        {ids.map((id) => {
          const record = held.get(id);
          if (kind === 'video') {
            return record ? (
              <FileRow key={id} name={record.originalName || 'Video'} detail={formatBytes(record.byteSize)}>
                <RemoveButton label={`Remove ${record.originalName || 'file'}`} onClick={() => drop(id)} inline />
              </FileRow>
            ) : (
              <FileRow key={id} name="Video" detail="Not on this device">
                <RemoveButton label="Remove video not on this device" onClick={() => drop(id)} inline />
              </FileRow>
            );
          }
          // A file this device does not hold says so, instead of showing a broken image.
          return (
            <li key={id} className={item}>
              {record ? (
                <img className="h-24 w-full object-cover" src={record.url} alt={record.originalName || 'Survey photo'} />
              ) : (
                <span className={cx(narrowLabel, 'block h-24 w-full p-2 text-muted')}>Not on this device</span>
              )}
              <RemoveButton
                label={record ? `Remove ${record.originalName || 'file'}` : 'Remove photo not on this device'}
                onClick={() => drop(id)}
              />
            </li>
          );
        })}
      </ul>

      <div className="empty:hidden" role="status" aria-live="polite">
        {Array.isArray(status) ? (
          <ul className="flex flex-col gap-1">
            {status.map((failure, index) => (
              <li key={index} className={fieldError}>
                {failure.fileName ? `${failure.fileName}: ` : ''}
                {failure.message}
              </li>
            ))}
          </ul>
        ) : (
          status
        )}
      </div>
    </div>
  );
}
