import { SAMPLE_PHOTO_PREFIX, SURROUNDINGS, WORSHIP_PLACES } from '../constants.js';
import { samplePhotoId } from '../seed/samplePhotos.js';

/** Records written before the bathroom and the place of worship were split, or before each sample kos had its own photos, brought to today's shape. */

const LEGACY_WORSHIP = 'Place of worship';

/** FNV-1a: the same id always gives the same number, on every device. */
function hash(text) {
  let value = 0x811c9dc5;
  for (const char of String(text)) {
    value ^= char.codePointAt(0);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

/** The old record named no faith, so one is chosen by the survey's id (the user's choice): stable, not random per load. */
export function worshipFor(id) {
  return WORSHIP_PLACES[hash(id) % WORSHIP_PLACES.length];
}

/** One of two ticks, or nothing: both ticked, or neither, does not say which. */
function either(ticked, first, second, [firstValue, secondValue]) {
  if (ticked.has(first) && !ticked.has(second)) return firstValue;
  if (ticked.has(second) && !ticked.has(first)) return secondValue;
  return null;
}

function bathroomFrom({ facilities, ...rest }) {
  const ticked = new Set(facilities);
  return {
    ...rest,
    type: either(ticked, 'Indoor bathroom', 'Outdoor bathroom', ['indoor', 'outdoor']),
    toilet: either(ticked, 'Squat toilet', 'Western-style toilet', ['squat', 'sit']),
    // An empty list was never filled in; one with other ticks says the water heater was not there.
    waterHeater: ticked.size ? ticked.has('Water heater') : null,
  };
}

/** A photo from the four sets the sample kos once shared, as `seed:room-2-1`. */
const SHARED_SAMPLE = new RegExp(String.raw`^${SAMPLE_PHOTO_PREFIX}(room|bathroom|shared)-\d+-(\d+)$`);

/** The demo account's surveys keep their old ids on the server; each now points at its own photo in the same place. */
function ownSamplePhotos(survey) {
  let next = survey;
  for (const section of ['room', 'bathroom', 'shared']) {
    const ids = survey[section]?.photoIds;
    if (!Array.isArray(ids) || !ids.some((id) => SHARED_SAMPLE.test(id))) continue;
    const photoIds = ids.map((id) => {
      const match = SHARED_SAMPLE.exec(id);
      return match ? samplePhotoId(survey.id, match[1], match[2]) : id;
    });
    next = { ...next, [section]: { ...next[section], photoIds } };
  }
  return next;
}

export function normalizeSurvey(survey) {
  if (!survey || typeof survey !== 'object') return survey;
  let next = survey;
  if (Array.isArray(survey.bathroom?.facilities)) next = { ...next, bathroom: bathroomFrom(survey.bathroom) };
  if (Array.isArray(survey.surroundings) && survey.surroundings.includes(LEGACY_WORSHIP)) {
    const chosen = new Set(survey.surroundings.filter((item) => item !== LEGACY_WORSHIP));
    chosen.add(worshipFor(survey.id));
    next = { ...next, surroundings: SURROUNDINGS.filter((item) => chosen.has(item)) };
  }
  return ownSamplePhotos(next);
}
