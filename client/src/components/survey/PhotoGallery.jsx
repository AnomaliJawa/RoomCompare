import { useLayoutEffect, useRef, useState } from 'react';
import { useMediaRecords } from '../../hooks/useMediaRecords.js';
import { joinList } from '../../utils/bestMatch.js';
import { Modal, useCloseModal } from '../ui/Modal.jsx';
import { button, cx, meta, narrowLabel } from '../ui/styles.js';
import { msg, t } from '../../i18n/index.js';

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
          {t('{count} of {max}', { count: index + 1, max: records.length })}
        </span>
        <button ref={closeButton} className={button({ variant: 'secondary', size: 'small' })} type="button" onClick={close}>
          {t('Close')}
        </button>
      </div>
      <figure className="m-0 flex flex-col gap-2">
        <img className="max-h-[min(70vh,560px)] w-full rounded-sm bg-paper object-contain" src={record.url} alt={record.originalName || t('Survey photo')} />
        <figcaption className={meta}>{record.caption ?? record.originalName ?? ''}</figcaption>
      </figure>
      <div className="flex gap-2 pointer-coarse:gap-3">
        <button className={button({ className: 'flex-1' })} type="button" disabled={records.length < 2} onClick={() => step(-1)}>
          {t('Previous')}
        </button>
        <button className={button({ className: 'flex-1' })} type="button" disabled={records.length < 2} onClick={() => step(1)}>
          {t('Next')}
        </button>
      </div>
    </div>
  );
}

/** `one` and `many` name a count, as in "1 room photo" and "{count} room photos". */
const counted = (count, { one, many }) => (count === 1 ? t(one) : t(many, { count }));

/** What was recorded per section, and which sections have no photos: none recorded is information too. */
function mediaSummary(groups) {
  const present = groups.filter((group) => group.ids.length).map((group) => counted(group.ids.length, group));
  const absent = groups.filter((group) => !group.ids.length && group.kind !== 'video').map((group) => t(group.none));
  const recorded = present.length ? `${joinList(present)}.` : '';
  const none = absent.length ? t('No {list} recorded.', { list: joinList(absent) }) : '';
  return [recorded, none].filter(Boolean).join(' ');
}

const PHOTOS = { one: msg('1 photo'), many: msg('{count} photos') };
const VIDEOS = { one: msg('1 video'), many: msg('{count} videos') };
const FILES = { one: msg('Loading 1 file…'), many: msg('Loading {count} files…') };

function SectionTag({ children }) {
  return (
    <span className="pointer-events-none absolute bottom-2 left-2 rounded-sm bg-surface/90 px-2 text-xs font-medium text-ink" aria-hidden="true">
      {children}
    </span>
  );
}

/** Beside the large photo on wide screens, the thumbnails fill its height whatever their count. */
const THUMB_LAYOUT = {
  1: 'lg:grid-cols-1 lg:grid-rows-1',
  2: 'lg:grid-cols-1 lg:grid-rows-2',
  3: 'lg:grid-cols-2 lg:grid-rows-2',
  4: 'lg:grid-cols-2 lg:grid-rows-2',
};

const photoTile = 'relative block w-full cursor-zoom-in overflow-hidden rounded-md border border-rule bg-paper p-0 transition-[border-color] hover:border-accent active:border-accent';

/**
 * Every photo of a survey as one gallery at the top of its page: the first large, the next four
 * beside it, the rest behind "+N", all in one viewer. Videos play below. `groups`: { title, one, many, none, ids, kind }.
 */
export function MediaGallery({ groups }) {
  const photoGroups = groups.filter((group) => group.kind !== 'video');
  const videoIds = groups.find((group) => group.kind === 'video')?.ids ?? [];
  const photoIds = photoGroups.flatMap((group) => group.ids);
  const sectionOf = new Map(photoGroups.flatMap((group) => group.ids.map((id) => [id, t(group.title)])));
  const photos = useMediaRecords(photoIds);
  const videos = useMediaRecords(videoIds);
  const [viewing, setViewing] = useState(null);
  const opener = useRef(null);

  if (!photoIds.length && !videoIds.length) return <p className={meta}>{t('No photos or videos recorded.')}</p>;

  const shown = photos.records.map((record) => ({
    ...record,
    section: sectionOf.get(record.id),
    caption: `${sectionOf.get(record.id)}: ${record.originalName || t('photo')}`,
  }));
  const ready = photos.ready && videos.ready;
  const missingPhotos = photoIds.length - photos.records.length;
  const missingVideos = videoIds.length - videos.records.length;
  let status = counted(photoIds.length + videoIds.length, FILES);
  if (ready) {
    const away = [missingPhotos && counted(missingPhotos, PHOTOS), missingVideos && counted(missingVideos, VIDEOS)].filter(Boolean);
    const items = joinList(away);
    status = '';
    if (away.length) {
      status =
        missingPhotos + missingVideos === 1
          ? t('{items} is not on this device. Photos and videos stay on the device they were added on.', { items })
          : t('{items} are not on this device. Photos and videos stay on the device they were added on.', { items });
    }
  }

  const open = (index) => (event) => {
    opener.current = event.currentTarget;
    setViewing(index);
  };
  const thumbs = shown.slice(1, 5);
  const more = shown.length - 5;

  return (
    <div className="flex flex-col gap-3" data-media-gallery>
      {!photos.ready && photoIds.length > 0 && (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <span className="block aspect-[16/9] max-h-[440px] w-full rounded-md bg-rule motion-safe:animate-skeleton" />
        </div>
      )}
      {photos.ready && shown.length > 0 && (
        <div className={cx('grid gap-2', thumbs.length > 0 && 'lg:grid-cols-[2fr_1fr]')} data-gallery="photo">
          <button className={photoTile} type="button" aria-label={t('Open photo {index} of {count}, {section}', { index: 1, count: shown.length, section: shown[0].section })} onClick={open(0)}>
            <img className="block aspect-[16/9] w-full object-cover" src={shown[0].url} alt={shown[0].originalName || t('Survey photo {index}', { index: 1 })} />
            <SectionTag>{shown[0].section}</SectionTag>
          </button>
          {thumbs.length > 0 && (
            <div className={cx('grid grid-cols-4 gap-2', THUMB_LAYOUT[thumbs.length])}>
              {thumbs.map((record, offset) => {
                const index = offset + 1;
                const last = offset === thumbs.length - 1 && more > 0;
                return (
                  <button
                    key={record.id}
                    className={cx(photoTile, 'lg:h-full', thumbs.length === 3 && offset === 0 && 'lg:col-span-2')}
                    type="button"
                    aria-label={
                      last
                        ? t('Open photo {index} of {count}, and {more} more', { index: index + 1, count: shown.length, more })
                        : t('Open photo {index} of {count}, {section}', { index: index + 1, count: shown.length, section: record.section })
                    }
                    onClick={open(index)}
                  >
                    <img className="block aspect-[4/3] w-full object-cover lg:absolute lg:inset-0 lg:aspect-auto lg:h-full" src={record.url} alt={record.originalName || t('Survey photo {index}', { index: index + 1 })} />
                    {last ? (
                      <span className="absolute inset-0 grid place-items-center bg-ink/50 text-md font-semibold text-surface" aria-hidden="true">
                        +{more}
                      </span>
                    ) : (
                      <SectionTag>{record.section}</SectionTag>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {videos.ready && videos.records.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3" data-gallery="video">
          {videos.records.map((record) => (
            <div key={record.id} className={cx(tile, 'flex flex-col gap-2 p-2')}>
              <video className="w-full rounded-sm" controls preload="metadata" src={record.url} />
              <span className={meta}>{record.originalName || t('Video')}</span>
            </div>
          ))}
        </div>
      )}
      <p className={meta} data-media-summary>
        {mediaSummary(groups)}
      </p>
      <p className={cx(meta, 'empty:hidden')} role="status" aria-live="polite" data-gallery-status>
        {status}
      </p>
      <Modal
        open={viewing !== null}
        kind="lightbox"
        aria-label={t('Photo viewer')}
        closeOnBackdrop
        onClose={() => {
          setViewing(null);
          opener.current?.focus();
        }}
      >
        <LightboxContent records={shown} start={viewing ?? 0} />
      </Modal>
    </div>
  );
}
