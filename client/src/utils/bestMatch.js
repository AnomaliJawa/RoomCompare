import { BEST_MATCH_CRITERIA, TOTAL_FACILITY_COUNT, SURROUNDINGS } from '../constants.js';
import { DEFAULT_WEIGHTS } from './weights.js';

/** 1 is the floor, so (v-1)/3: a "Poor" rating must not read as a quarter mark. */
function fromLikert(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 4) return null;
  return ((n - 1) / 3) * 100;
}

/** 100 for the best value; when every kos matches, none is worse. */
function relative(values, index, { lowerIsBetter }) {
  if (!Number.isFinite(values[index])) return null;

  // Only recorded values take part, so a missing one cannot drag the others down.
  const present = values.filter((value) => Number.isFinite(value));

  const min = Math.min(...present);
  const max = Math.max(...present);
  if (min === max) return 100;

  const position = (values[index] - min) / (max - min);
  return (lowerIsBetter ? 1 - position : position) * 100;
}

function facilityScore(survey) {
  const count =
    (survey.room.facilities?.length ?? 0) +
    (survey.bathroom.facilities?.length ?? 0) +
    (survey.shared.facilities?.length ?? 0);
  return (count / TOTAL_FACILITY_COUNT) * 100;
}

/** Half nearness to campus, half surroundings out of 7: the user's reading of the requirement's unnamed Location. */
function locationScore(survey, nearness) {
  if (nearness === null) return null;
  const amenities = ((survey.surroundings?.length ?? 0) / SURROUNDINGS.length) * 100;
  return (nearness + amenities) / 2;
}

const MISSING_LABELS = {
  price: 'monthly rent',
  cleanliness: 'cleanliness',
  security: 'security',
  location: 'distance to campus',
  distance: 'distance to campus',
};

/** A kos missing any weighted input gets no total; a criterion at 0% needs no data. */
export function computeBestMatch(surveys, weights = DEFAULT_WEIGHTS) {
  const counted = BEST_MATCH_CRITERIA.filter((criterion) => weights[criterion.key] > 0);
  const rents = surveys.map((survey) => survey.kos.rent ?? NaN);
  const distances = surveys.map((survey) => survey.kos.distanceKm ?? NaN);

  const scored = surveys.map((survey, index) => {
    const nearness = relative(distances, index, { lowerIsBetter: true });
    const parts = {
      price: relative(rents, index, { lowerIsBetter: true }),
      facilities: facilityScore(survey),
      cleanliness: fromLikert(survey.room.cleanliness),
      location: locationScore(survey, nearness),
      distance: nearness,
      security: fromLikert(survey.additional.security),
    };

    // Location and Distance both need the distance; it is named once.
    const missing = [
      ...new Set(
        counted
          .filter((criterion) => parts[criterion.key] === null)
          .map((criterion) => MISSING_LABELS[criterion.key] ?? criterion.key),
      ),
    ];

    // Divided once, at the end: the weights are percentages.
    const total = missing.length
      ? null
      : Math.round(counted.reduce((sum, criterion) => sum + parts[criterion.key] * weights[criterion.key], 0) / 100);

    return { survey, parts, missing, total };
  });

  // Ties are shown as ties; picking a winner would invent a distinction.
  const best = scored.reduce((highest, item) => {
    if (item.total === null) return highest;
    return highest === null || item.total > highest ? item.total : highest;
  }, null);

  return {
    scored,
    best,
    leaders: best === null ? [] : scored.filter((item) => item.total === best).map((item) => item.survey.id),
  };
}

export const joinList = (items) =>
  items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
