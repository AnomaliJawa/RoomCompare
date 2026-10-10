import { msg, t } from './i18n/index.js';

/** Every enumerated value lives here and nowhere else: duplicated labels once drifted silently. */

export const STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
};

export const STATUS_LABELS = {
  [STATUS.DRAFT]: msg('Draft'),
  [STATUS.PUBLISHED]: msg('Published'),
};

/** How distanceKm was measured; a record without it predates walking routes, so it is a straight line. */
export const DISTANCE_BASIS = {
  WALKING: 'walking',
  STRAIGHT: 'straight',
};

export const KOS_TYPES = [
  { value: 'male', label: msg('Male') },
  { value: 'female', label: msg('Female') },
  { value: 'mixed', label: msg('Mixed') },
];

export const ROOM_FACILITIES = [
  'Mattress',
  'Wardrobe',
  'TV',
  'AC',
  'Fan',
  'Table',
  'Chair',
  'Refrigerator',
  'Dispenser',
  'Window',
  'Includes electricity',
];

export const BATHROOM_TYPES = [
  { value: 'indoor', label: msg('Indoor (inside the room)') },
  { value: 'outdoor', label: msg('Outdoor (outside the room)') },
];

export const TOILET_TYPES = [
  { value: 'squat', label: msg('Squat toilet') },
  { value: 'sit', label: msg('Sitting (Western-style) toilet') },
];

export const YES_NO = [
  { value: true, label: msg('Yes') },
  { value: false, label: msg('No') },
];

export const SHARED_FACILITIES = [
  'Wifi',
  'Motorcycle parking',
  'Car parking',
  'Kitchen',
  'Washing machine',
  'Laundry',
  'Refrigerator',
  'Dispenser',
];

export const WORSHIP_PLACES = [
  'Mosque (masjid)',
  'Church (gereja)',
  'Hindu temple (pura)',
  'Buddhist temple (vihara)',
  'Chinese temple (klenteng)',
];

export const SURROUNDINGS = [
  'Minimarket / supermarket',
  'Eatery (warung makan)',
  'Pharmacy / clinic',
  'ATM / bank',
  'Laundry',
  ...WORSHIP_PLACES,
  'Gym / sports facilities',
];

/** Any place of worship counts once (the user's choice), so a kos is not scored on how many faiths are near. */
export const AMENITY_COUNT = SURROUNDINGS.length - WORSHIP_PLACES.length + 1;

/** Room and shared facilities, a working water heater, and an indoor bathroom; the toilet type is a preference. */
export const TOTAL_FACILITY_COUNT = ROOM_FACILITIES.length + SHARED_FACILITIES.length + 2;

/** Stored values stay English; these show them in the reader's language. */
export function choiceLabel(options, value) {
  const label = options.find((option) => option.value === value)?.label;
  return label ? t(label) : null;
}

export const statusLabel = (status) => t(STATUS_LABELS[status]);

export const LIKERT = [
  { value: 1, label: msg('Poor') },
  { value: 2, label: msg('Fair') },
  { value: 3, label: msg('Good') },
  { value: 4, label: msg('Very good') },
];

export function likertLabel(value) {
  const match = LIKERT.find((item) => item.value === Number(value));
  return match ? `${t(match.label)} (${match.value}/4)` : null;
}

export function kosTypeLabel(value) {
  const match = KOS_TYPES.find((item) => item.value === value);
  return match ? t(match.label) : null;
}

/** The PRD's default weights, as whole percentages so they total exactly 100. */
export const BEST_MATCH_CRITERIA = [
  {
    key: 'price',
    label: msg('Price'),
    defaultWeight: 25,
    description: msg('Monthly rent, ranked against the other kos compared. The cheapest scores 100.'),
  },
  {
    key: 'facilities',
    label: msg('Facilities'),
    defaultWeight: 20,
    description: msg('Recorded facilities out of {facilities}: room and shared, a water heater, and an indoor bathroom.'),
  },
  {
    key: 'cleanliness',
    label: msg('Cleanliness'),
    defaultWeight: 15,
    description: msg('The 1–4 rating, where 1 scores 0 and 4 scores 100.'),
  },
  {
    key: 'location',
    label: msg('Location (distance and amenities)'),
    defaultWeight: 15,
    description: msg(
      'Half nearness to campus, ranked against the other kos compared, and half recorded surroundings out of {amenities}, any place of worship counting once.',
    ),
  },
  {
    key: 'distance',
    label: msg('Distance to campus'),
    defaultWeight: 13,
    description: msg('Ranked against the other kos compared. The nearest scores 100.'),
  },
  {
    key: 'security',
    label: msg('Security'),
    defaultWeight: 12,
    description: msg('The 1–4 rating, where 1 scores 0 and 4 scores 100.'),
  },
];

export const criterionLabel = (criterion) => t(criterion.label);
export const criterionDescription = (criterion) =>
  t(criterion.description, { facilities: TOTAL_FACILITY_COUNT, amenities: AMENITY_COUNT });

export const COMPARISON_GROUPS = [
  { key: 'kos', label: msg('Kos information') },
  { key: 'room', label: msg('Room') },
  { key: 'bathroom', label: msg('Bathroom') },
  { key: 'shared', label: msg('Shared facilities') },
  { key: 'surroundings', label: msg('Surroundings') },
  { key: 'additional', label: msg('Additional information') },
];

export const MAX_COMPARE = 3;
export const MIN_COMPARE = 2;
export const MAX_PHOTOS_PER_SECTION = 10;

/** The rent slider's reach (the user's choice); the typed field still takes up to validate.js's RENT_MAX. */
export const RENT_SLIDER = { MAX: 10_000_000, STEP: 50_000 };

/** Whole metres in the room length and width lists (the user's choice); typing takes validate.js's range. */
export const ROOM_SIDE_CHOICES = Array.from({ length: 10 }, (_, index) => index + 1);

/** A photo id with this prefix names a file in seed-photos/, not a stored blob. */
export const SAMPLE_PHOTO_PREFIX = 'seed:';
