import { SAMPLE_PHOTO_PREFIX } from '../constants.js';

/** Photos from seed-photos/, rotated so neighbouring cards differ; none for a section with nothing recorded. */

const SETS = 4;
const COUNTS = { room: 3, bathroom: 2, shared: 2 };
const SHIFT = { room: 0, bathroom: 1, shared: 2 };

export const samplePhotoId = (section, set, index) => `${SAMPLE_PHOTO_PREFIX}${section}-${set}-${index}`;

/** The bathroom records answers, not a facility list. */
export function hasRecorded(survey, section) {
  if (section === 'bathroom') {
    const { type = null, toilet = null, waterHeater = null } = survey.bathroom ?? {};
    return type !== null || toilet !== null || waterHeater !== null;
  }
  return Boolean(survey[section]?.facilities?.length);
}

export function withSamplePhotos(surveys, { offset = 0 } = {}) {
  return surveys.map((survey, position) => {
    const photos = (section) => {
      if (!hasRecorded(survey, section)) return [];
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
