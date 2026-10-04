import { ROOM_FACILITIES, BATHROOM_FACILITIES, SHARED_FACILITIES } from '../constants.js';

/** Matches ignoring case and accents, so a phone keyboard's spelling still finds the kos. */
function searchKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function filterSurveys(surveys, query) {
  const term = searchKey(query).trim();
  if (!term) return surveys;
  return surveys.filter((survey) => searchKey(survey.kos.name).includes(term));
}

/** Facility filters are scoped to their section: a room refrigerator is not a shared one. */
export const FACILITY_SECTIONS = [
  { key: 'room', legend: 'Room facilities', options: ROOM_FACILITIES },
  { key: 'bathroom', legend: 'Bathroom facilities', options: BATHROOM_FACILITIES },
  { key: 'shared', legend: 'Shared facilities', options: SHARED_FACILITIES },
];

export const facilityKey = (section, name) => `${section}:${name}`;

export function activeFilterCount(filters) {
  return (
    (filters.location ? 1 : 0) +
    (filters.minRent ? 1 : 0) +
    (filters.maxRent ? 1 : 0) +
    (filters.type ? 1 : 0) +
    (filters.starredOnly ? 1 : 0) +
    (filters.facilities?.length ?? 0)
  );
}

export function filterCommunity(surveys, filters, starredIds) {
  const location = filters.location.trim().toLowerCase();
  const min = filters.minRent === '' ? null : Number(filters.minRent);
  const max = filters.maxRent === '' ? null : Number(filters.maxRent);
  const required = filters.facilities ?? [];

  return surveys.filter((survey) => {
    if (location && !(survey.kos.kosLocation?.label ?? '').toLowerCase().includes(location)) return false;
    if (filters.type && survey.kos.type !== filters.type) return false;
    if (filters.starredOnly && !starredIds.includes(survey.id)) return false;
    if (min !== null && Number.isFinite(min) && survey.kos.rent < min) return false;
    if (max !== null && Number.isFinite(max) && survey.kos.rent > max) return false;

    // Every requirement must hold: Wifi and Kitchen means both.
    return required.every((key) => {
      const [section, ...rest] = key.split(':');
      const name = rest.join(':');
      return (survey[section]?.facilities ?? []).includes(name);
    });
  });
}
