import * as db from '../db.js';
import { addPhoto } from '../media.js';

/**
 * Attach sample photographs to the sample surveys, once, on a first run.
 *
 * The images are drawn illustrations of rooms rather than photography —
 * there is no licensed photo set to ship — but they are real JPEG files
 * fetched over the network and stored as blobs, so the gallery, the
 * thumbnails, the lightbox and the photo counts all work on the same path a
 * user's own upload takes.
 *
 * This runs after the store has seeded and never on a later visit: the check
 * is whether the database already holds anything, so a user who deletes every
 * photo does not have them reappear.
 */

/** Which files belong to which survey. Four surveys carry photos; the rest
 *  stay empty, so the "no photos recorded" state is still visible. */
const ASSIGNMENTS = [
  { surveyId: 'svy-melati', variant: 1 },
  { surveyId: 'svy-casa-hijau', variant: 2 },
  { surveyId: 'svy-kenanga', variant: 3 },
  { surveyId: 'svy-pelangi', variant: 4 },
];

const SECTIONS = [
  { section: 'room', count: 3 },
  { section: 'bathroom', count: 2 },
  { section: 'shared', count: 2 },
];

const BASE = 'seed-photos';

async function fileFor(section, variant, index) {
  const name = `${section}-${variant}-${index}.jpg`;
  const response = await fetch(`${BASE}/${name}`);
  if (!response.ok) return null;
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}

/**
 * Returns the photo ids per survey, or null when nothing was seeded.
 * Never throws: sample imagery failing to load is not worth breaking a boot.
 */
export async function seedPhotos() {
  try {
    if (!(await db.isAvailable())) return null;
    // Anything already stored means this is not a first run.
    if ((await db.countMedia()) > 0) return null;

    const assigned = {};

    for (const { surveyId, variant } of ASSIGNMENTS) {
      const perSection = { room: [], bathroom: [], shared: [] };

      for (const { section, count } of SECTIONS) {
        for (let index = 1; index <= count; index += 1) {
          const file = await fileFor(section, variant, index);
          if (!file) continue;
          const result = await addPhoto(file, { surveyId, section });
          if (result.ok) perSection[section].push(result.record.id);
        }
      }

      const total = perSection.room.length + perSection.bathroom.length + perSection.shared.length;
      if (total > 0) assigned[surveyId] = perSection;
    }

    return Object.keys(assigned).length ? assigned : null;
  } catch {
    return null;
  }
}
