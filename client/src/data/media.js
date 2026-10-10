import * as db from './mediaDb.js';
import { getState } from './store.js';
import { downscaleImage, acceptVideo, MediaError } from '../utils/image.js';
import { MAX_PHOTOS_PER_SECTION, SAMPLE_PHOTO_PREFIX } from '../constants.js';
import { msg, t } from '../i18n/index.js';

/** Photos stay on their device; each records its account, so cleanup never touches another's. */
const currentOwner = () => getState().user?.id ?? null;

export const MAX_VIDEOS = 2;

function newId() {
  return `med-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function addPhoto(file, { surveyId, section }) {
  try {
    const processed = await downscaleImage(file);
    const record = {
      id: newId(),
      surveyId,
      ownerId: currentOwner(),
      section,
      blob: processed.blob,
      mimeType: processed.mimeType,
      width: processed.width,
      height: processed.height,
      byteSize: processed.byteSize,
      originalName: file.name,
      originalBytes: file.size,
      createdAt: new Date().toISOString(),
    };

    const stored = await db.putMedia(record);
    if (!stored) {
      return {
        ok: false,
        fileName: file.name,
        message: msg('Photos cannot be saved in this browser mode.'),
      };
    }
    return { ok: true, record };
  } catch (error) {
    const message =
      error instanceof MediaError ? error.message : msg('That file could not be added.');
    return { ok: false, fileName: file?.name ?? '', message };
  }
}

export async function addVideo(file, { surveyId }) {
  try {
    const checked = acceptVideo(file);
    const record = {
      id: newId(),
      surveyId,
      ownerId: currentOwner(),
      section: 'video',
      blob: checked.blob,
      mimeType: checked.mimeType,
      width: null,
      height: null,
      byteSize: checked.byteSize,
      originalName: file.name,
      originalBytes: file.size,
      createdAt: new Date().toISOString(),
    };
    const stored = await db.putMedia(record);
    if (!stored) {
      return { ok: false, fileName: file.name, message: msg('Videos cannot be saved in this browser mode.') };
    }
    return { ok: true, record };
  } catch (error) {
    const message = error instanceof MediaError ? error.message : msg('That file could not be added.');
    return { ok: false, fileName: file?.name ?? '', message };
  }
}

export async function addPhotos(files, { surveyId, section, existingCount = 0 }) {
  const room = Math.max(0, MAX_PHOTOS_PER_SECTION - existingCount);
  const accepted = [...files].slice(0, room);
  const rejected = [...files].slice(room).map((file) => ({
    ok: false,
    fileName: file.name,
    message: t('Only {max} photos can be added to this section.', { max: MAX_PHOTOS_PER_SECTION }),
  }));

  const results = [];
  for (const file of accepted) {
    // Sequential on purpose: decoding several large images at once spikes memory on phones.
    results.push(await addPhoto(file, { surveyId, section }));
  }

  const all = [...results, ...rejected];
  return {
    stored: all.filter((item) => item.ok).map((item) => item.record),
    failed: all.filter((item) => !item.ok),
  };
}

export async function restoreMedia(records) {
  if (!records?.length) return 0;
  let restored = 0;
  for (const record of records) {
    if (await db.putMedia(record)) restored += 1;
  }
  return restored;
}

/** Photos are stored as chosen, so abandoned forms leave orphans; swept after each login. */
export async function sweepOrphanedMedia(knownSurveyIds, ownerId) {
  // Only this account's assets: another account's photos on a shared device are not orphans.
  if (!ownerId) return 0;
  const known = new Set(knownSurveyIds);
  const orphans = (await db.listMediaMeta()).filter((asset) => asset.ownerId === ownerId && !known.has(asset.surveyId));
  for (const asset of orphans) {
    db.releaseUrl(asset.id);
    await db.deleteMedia(asset.id);
  }
  return orphans.length;
}

/** Removal in the form is an intent until save: files go only once the record is written. */
export async function pruneSurveyMedia(surveyId, keepIds) {
  const keep = new Set(keepIds.filter(Boolean));
  const held = await db.getMediaForSurvey(surveyId);
  const stale = held.filter((record) => !keep.has(record.id));
  for (const record of stale) {
    db.releaseUrl(record.id);
    await db.deleteMedia(record.id);
  }
  return stale.length;
}

export async function removeMedia(id) {
  db.releaseUrl(id);
  return db.deleteMedia(id);
}

/** Cached per page: the server sends no-store, so the browser's cache will not help. */
const samples = new Map();

function loadSample(id) {
  if (!samples.has(id)) {
    const name = id.slice(SAMPLE_PHOTO_PREFIX.length);
    const record = fetch(`seed-photos/${encodeURIComponent(name)}.jpg`)
      .then((response) => (response.ok ? response.blob() : null))
      .catch(() => null)
      .then((blob) => {
        if (!blob) {
          samples.delete(id);
          return null;
        }
        return { id, blob, mimeType: blob.type || 'image/jpeg', originalName: `${name}.jpg`, byteSize: blob.size };
      });
    samples.set(id, record);
  }
  return samples.get(id);
}

export async function loadMedia(ids) {
  if (!ids?.length) return [];
  const isSample = (id) => id.startsWith(SAMPLE_PHOTO_PREFIX);
  const [fromSamples, stored] = await Promise.all([
    Promise.all(ids.filter(isSample).map(loadSample)),
    db.getMediaMany(ids.filter((id) => !isSample(id))),
  ]);
  const byId = new Map([...fromSamples.filter(Boolean), ...stored].map((record) => [record.id, record]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export async function loadSurveyMedia(surveyId) {
  return db.getMediaForSurvey(surveyId);
}
