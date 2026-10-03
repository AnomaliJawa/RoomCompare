/** Every enumerated value lives here and nowhere else: duplicated labels once drifted silently. */

export const STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
};

export const STATUS_LABELS = {
  [STATUS.DRAFT]: 'Draft',
  [STATUS.PUBLISHED]: 'Published',
};

/** How distanceKm was measured; a record without it predates walking routes, so it is a straight line. */
export const DISTANCE_BASIS = {
  WALKING: 'walking',
  STRAIGHT: 'straight',
};

export const KOS_TYPES = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'mixed', label: 'Mixed' },
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

export const BATHROOM_FACILITIES = [
  'Outdoor bathroom',
  'Indoor bathroom',
  'Squat toilet',
  'Western-style toilet',
  'Water heater',
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

export const SURROUNDINGS = [
  'Minimarket / supermarket',
  'Eatery (warung makan)',
  'Pharmacy / clinic',
  'ATM / bank',
  'Laundry',
  'Place of worship',
  'Gym / sports facilities',
];

export const TOTAL_FACILITY_COUNT =
  ROOM_FACILITIES.length + BATHROOM_FACILITIES.length + SHARED_FACILITIES.length;

export const LIKERT = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Fair' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Very good' },
];

export function likertLabel(value) {
  const match = LIKERT.find((item) => item.value === Number(value));
  return match ? `${match.label} (${match.value}/4)` : null;
}

export function kosTypeLabel(value) {
  const match = KOS_TYPES.find((item) => item.value === value);
  return match ? match.label : null;
}

/** The PRD's default weights, as whole percentages so they total exactly 100. */
export const BEST_MATCH_CRITERIA = [
  {
    key: 'price',
    label: 'Price',
    defaultWeight: 25,
    description: 'Monthly rent, ranked against the other kos compared. The cheapest scores 100.',
  },
  {
    key: 'facilities',
    label: 'Facilities',
    defaultWeight: 20,
    description: `Recorded facilities out of ${TOTAL_FACILITY_COUNT}, across room, bathroom and shared.`,
  },
  {
    key: 'cleanliness',
    label: 'Cleanliness',
    defaultWeight: 15,
    description: 'The 1–4 rating, where 1 scores 0 and 4 scores 100.',
  },
  {
    key: 'location',
    label: 'Location (surrounding amenities)',
    defaultWeight: 15,
    description: `Recorded surroundings out of ${SURROUNDINGS.length}.`,
  },
  {
    key: 'distance',
    label: 'Distance to campus',
    defaultWeight: 13,
    description: 'Ranked against the other kos compared. The nearest scores 100.',
  },
  {
    key: 'security',
    label: 'Security',
    defaultWeight: 12,
    description: 'The 1–4 rating, where 1 scores 0 and 4 scores 100.',
  },
];

export const COMPARISON_GROUPS = [
  { key: 'kos', label: 'Kos information' },
  { key: 'room', label: 'Room' },
  { key: 'bathroom', label: 'Bathroom' },
  { key: 'shared', label: 'Shared facilities' },
  { key: 'surroundings', label: 'Surroundings' },
  { key: 'additional', label: 'Additional information' },
];

export const MAX_COMPARE = 3;
export const MIN_COMPARE = 2;
export const MAX_PHOTOS_PER_SECTION = 10;

/** A photo id with this prefix names a file in seed-photos/, not a stored blob. */
export const SAMPLE_PHOTO_PREFIX = 'seed:';
