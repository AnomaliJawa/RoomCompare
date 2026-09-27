/**
 * Single source of truth for every enumerated value in RoomCompare.
 *
 * The prototype wrote these 31 facility labels twice — once as `<input value>`
 * in index.html, once as strings in the seed array — and checkbox restoration
 * broke silently whenever the two drifted. Checkbox groups, the community
 * facility filters, the comparison rows and the facility sub-score all read
 * from here instead.
 */

export const STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
};

export const STATUS_LABELS = {
  [STATUS.DRAFT]: 'Draft',
  [STATUS.PUBLISHED]: 'Published',
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

/** Total checkbox count across the three facility sections. Drives the facility sub-score. */
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

/**
 * Fixed weights defined by the system, per the PRD. Not user-configurable.
 * Consumed only by features/bestMatch.js.
 */
export const BEST_MATCH_WEIGHTS = [
  { key: 'price', label: 'Price', weight: 0.25 },
  { key: 'facilities', label: 'Facilities', weight: 0.2 },
  { key: 'cleanliness', label: 'Cleanliness', weight: 0.15 },
  { key: 'location', label: 'Location (surrounding amenities)', weight: 0.15 },
  { key: 'distance', label: 'Distance to campus', weight: 0.13 },
  { key: 'security', label: 'Security', weight: 0.12 },
];

/** Guidance panels, quoted from the PRD's survey form specification. */
export const GUIDELINES = {
  kos:
    'Fill in the basic information about the kos, including its name, type, ' +
    'location, distance to campus, and monthly rental price. Use the map to ' +
    'accurately mark the kos and campus locations so the system can ' +
    'automatically calculate the distance between them.',
  room:
    "Provide the room's dimensions, available facilities, cleanliness, " +
    'internet quality, and photos based on your actual observation during the ' +
    'kos survey.',
  bathroom:
    'Select all available bathroom facilities based on your observation during ' +
    "the kos survey, then upload up to 10 photos showing the bathroom's actual " +
    'condition.',
  shared:
    'Select all shared facilities available at the kos and upload up to 10 ' +
    'photos that show their actual condition.',
  surroundings:
    'Select all relevant facilities or places available around the kos that may ' +
    'support your daily needs, such as food, healthcare, banking, or worship.',
  additional:
    "Rate the kos's overall security based on your observation, add any " +
    'important information that is not covered in the previous sections, and ' +
    'optionally upload videos to provide a more complete view of the kos.',
};

/** Comparison groups, in PRD order. Section 6 is added — see plan ambiguity 2. */
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

/**
 * Sample photographs ship with the app as seed-photos/<name>.jpg. A photo id
 * with this prefix names one of those files ("seed:room-2-1") rather than a
 * file stored in the browser, so the sample surveys show their photos on
 * every device and nothing is stored for them. media.js resolves these ids.
 */
export const SAMPLE_PHOTO_PREFIX = 'seed:';
