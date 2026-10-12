import { SAMPLE_PHOTO_PREFIX } from '../constants.js';

/** Each sample survey's own photos in seed-photos/ (listed in tools/seed-photos.json); none for a section with nothing recorded. */

const COUNTS = { room: 3, bathroom: 2, shared: 2 };

export const samplePhotoId = (surveyId, section, index) => `${SAMPLE_PHOTO_PREFIX}${surveyId}-${section}-${index}`;

/** The bathroom records answers, not a facility list. */
export function hasRecorded(survey, section) {
  if (section === 'bathroom') {
    const { type = null, toilet = null, waterHeater = null } = survey.bathroom ?? {};
    return type !== null || toilet !== null || waterHeater !== null;
  }
  return Boolean(survey[section]?.facilities?.length);
}

export function withSamplePhotos(surveys) {
  return surveys.map((survey) => {
    const photos = (section) =>
      hasRecorded(survey, section)
        ? Array.from({ length: COUNTS[section] }, (_, index) => samplePhotoId(survey.id, section, index + 1))
        : [];
    return {
      ...survey,
      room: { ...survey.room, photoIds: photos('room') },
      bathroom: { ...survey.bathroom, photoIds: photos('bathroom') },
      shared: { ...survey.shared, photoIds: photos('shared') },
    };
  });
}
