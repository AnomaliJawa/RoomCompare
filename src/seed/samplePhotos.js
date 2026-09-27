import { SAMPLE_PHOTO_PREFIX } from '../constants.js';

/**
 * Photos for the sample surveys, from the drawn illustrations in seed-photos/
 * that the app serves itself (tools-make-assets.py makes them). Each id names
 * a file, so the photos show on every device without being stored anywhere.
 *
 * There are four sets, each with 3 room, 2 bathroom and 2 shared-facility
 * photos. A survey takes each section's photos from a different set, and the
 * sets rotate from one survey to the next, so neighbouring cards differ. A
 * section with no facilities recorded gets no photos: nobody photographs a
 * shared kitchen that is not there.
 */

const SETS = 4;
const COUNTS = { room: 3, bathroom: 2, shared: 2 };
const SHIFT = { room: 0, bathroom: 1, shared: 2 };

export const samplePhotoId = (section, set, index) => `${SAMPLE_PHOTO_PREFIX}${section}-${set}-${index}`;

export function withSamplePhotos(surveys, { offset = 0 } = {}) {
  return surveys.map((survey, position) => {
    const photos = (section) => {
      if (!survey[section]?.facilities?.length) return [];
      const set = ((position + offset + SHIFT[section]) % SETS) + 1;
      return Array.from({ length: COUNTS[section] }, (_, index) => samplePhotoId(section, set, index + 1));
    };
    return {
      ...survey,
      room: { ...survey.room, photoIds: photos('room') },
      bathroom: { ...survey.bathroom, photoIds: photos('bathroom') },
      shared: { ...survey.shared, photoIds: photos('shared') },
    };
  });
}
