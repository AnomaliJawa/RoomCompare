import * as db from './db.js';
import { downscaleImage, acceptVideo, MediaError } from './utils/image.js';
import { MAX_PHOTOS_PER_SECTION } from './constants.js';

/**
 * Resize-then-store, the seam the uploader will sit on.
 *
 * Files are processed one at a time and reported individually: one unreadable
 * photo out of ten must not discard the other nine.
 */

export const MAX_VIDEOS = 2;

function newId() {
  return `med-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Store one image against a survey section.
 * Resolves { ok: true, record } or { ok: false, fileName, message }.
 */
export async function addPhoto(file, { surveyId, section }) {
  try {
    const processed = await downscaleImage(file);
    const record = {
      id: newId(),
      surveyId,
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
        message: 'Photos cannot be saved in this browser mode.',
      };
    }
    return { ok: true, record };
  } catch (error) {
    const message =
      error instanceof MediaError ? error.message : 'That file could not be added.';
    return { ok: false, fileName: file?.name ?? '', message };
  }
}

export async function addVideo(file, { surveyId }) {
  try {
    const checked = acceptVideo(file);
    const record = {
      id: newId(),
      surveyId,
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
      return { ok: false, fileName: file.name, message: 'Videos cannot be saved in this browser mode.' };
    }
    return { ok: true, record };
  } catch (error) {
    const message = error instanceof MediaError ? error.message : 'That file could not be added.';
    return { ok: false, fileName: file?.name ?? '', message };
  }
}

/**
 * Process a batch, stopping at the section limit. Returns the successes and
 * the failures separately so the uploader can show both.
 */
export async function addPhotos(files, { surveyId, section, existingCount = 0 }) {
  const room = Math.max(0, MAX_PHOTOS_PER_SECTION - existingCount);
  const accepted = [...files].slice(0, room);
  const rejected = [...files].slice(room).map((file) => ({
    ok: false,
    fileName: file.name,
    message: `Only ${MAX_PHOTOS_PER_SECTION} photos can be added to this section.`,
  }));

  const results = [];
  for (const file of accepted) {
    // Sequential on purpose: decoding several large images at once spikes
    // memory on the phones this is meant to run on.
    results.push(await addPhoto(file, { surveyId, section }));
  }

  const all = [...results, ...rejected];
  return {
    stored: all.filter((item) => item.ok).map((item) => item.record),
    failed: all.filter((item) => !item.ok),
  };
}

/** Re-store records captured before a delete, so undo brings the photos back. */
export async function restoreMedia(records) {
  if (!records?.length) return 0;
  let restored = 0;
  for (const record of records) {
    if (await db.putMedia(record)) restored += 1;
  }
  return restored;
}

/**
 * Delete media belonging to surveys that no longer exist.
 *
 * Photos are stored as soon as they are chosen, so a form abandoned without
 * saving — or a tab closed mid-survey — leaves files with nothing pointing at
 * them. Sweeping on boot keeps that from accumulating silently.
 */
export async function sweepOrphanedMedia(knownSurveyIds) {
  const known = new Set(knownSurveyIds);
  const owners = await db.listMediaOwners();
  const orphans = owners.filter((owner) => !known.has(owner));
  for (const orphan of orphans) {
    await db.deleteMediaForSurvey(orphan);
  }
  return orphans.length;
}

/**
 * Delete media belonging to a survey that its saved record no longer lists.
 *
 * Removal in the form is only an intent until the survey is saved, so this is
 * where a removed photo is actually destroyed — and only once the record that
 * dropped it has been written.
 */
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

/** Records for a list of ids, in the order given, skipping any that are gone. */
export async function loadMedia(ids) {
  return db.getMediaMany(ids);
}

/** Everything stored against a survey, whatever section it belongs to. */
export async function loadSurveyMedia(surveyId) {
  return db.getMediaForSurvey(surveyId);
}
