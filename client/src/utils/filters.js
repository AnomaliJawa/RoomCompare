import { ROOM_FACILITIES, SHARED_FACILITIES } from '../constants.js';
import { msg } from '../i18n/index.js';

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

/** The bathroom's answers, offered as requirements like the facilities beside them. */
const BATHROOM_REQUIREMENTS = {
  'Indoor bathroom': (bathroom) => bathroom?.type === 'indoor',
  'Outdoor bathroom': (bathroom) => bathroom?.type === 'outdoor',
  'Squat toilet': (bathroom) => bathroom?.toilet === 'squat',
  'Sitting toilet': (bathroom) => bathroom?.toilet === 'sit',
  'Water heater': (bathroom) => bathroom?.waterHeater === true,
};

/** Facility filters are scoped to their section: a room refrigerator is not a shared one. */
export const FACILITY_SECTIONS = [
  { key: 'room', legend: msg('Room facilities'), options: ROOM_FACILITIES },
  { key: 'bathroom', legend: msg('Bathroom'), options: Object.keys(BATHROOM_REQUIREMENTS) },
  { key: 'shared', legend: msg('Shared facilities'), options: SHARED_FACILITIES },
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

/** `search` matches the kos name or its area; the filters narrow what it finds. */
export function filterCommunity(surveys, filters, starredIds, search = '') {
  const query = searchKey(search).trim();
  const location = searchKey(filters.location).trim();
  const min = filters.minRent === '' ? null : Number(filters.minRent);
  const max = filters.maxRent === '' ? null : Number(filters.maxRent);
  const required = filters.facilities ?? [];

  return surveys.filter((survey) => {
    const area = searchKey(survey.kos.kosLocation?.label);
    if (query && !searchKey(survey.kos.name).includes(query) && !area.includes(query)) return false;
    if (location && !area.includes(location)) return false;
    if (filters.type && survey.kos.type !== filters.type) return false;
    if (filters.starredOnly && !starredIds.includes(survey.id)) return false;
    if (min !== null && Number.isFinite(min) && survey.kos.rent < min) return false;
    if (max !== null && Number.isFinite(max) && survey.kos.rent > max) return false;

    // Every requirement must hold: Wifi and Kitchen means both.
    return required.every((key) => {
      const [section, ...rest] = key.split(':');
      const name = rest.join(':');
      if (section === 'bathroom') return BATHROOM_REQUIREMENTS[name]?.(survey.bathroom) ?? false;
      return (survey[section]?.facilities ?? []).includes(name);
    });
  });
}
