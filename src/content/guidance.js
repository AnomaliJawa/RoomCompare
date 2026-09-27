/**
 * Guidance copy for the survey form: section intros, a helper line under
 * every field, the required badges and the 1–4 score rubrics.
 *
 * The wording comes from "Guidelines Feature Concept – RoomCompare" and is
 * changed there first, then here. It is plain data, kept apart from the
 * components, so copy can change without touching markup, and it ships with
 * the app, so it still shows with no connection.
 *
 * Two lines differ from the concept on purpose:
 * - Distance to campus is measured in a straight line between the two pins
 *   (utils/geo.js), not along the road, and the copy says so.
 * - Monthly rent's helper states its limit, as the PRD's helper-text
 *   requirement asks of every limited field.
 */

export const SECTION_INTROS = {
  kos: 'Start with the basics: name, rent, type, and location. These are the base for comparing every kos.',
  room: 'Record the room you surveyed: size, facilities, and condition in photos. Write down what you see on the day.',
  bathroom: "Record the bathroom's facilities and condition to judge how comfortable it is.",
  shared: 'Record the facilities tenants share for daily needs, including Wi-Fi.',
  surroundings: 'Record useful places within a 10-minute walk of the kos.',
  additional: 'Add anything else that affects your choice: security, notes, and videos.',
};

/** Badge wording by what a field is required for. */
export const REQUIRED_BADGE = {
  draft: 'Required',
  publish: 'Required to publish',
};

const PHOTO_HELPER = 'Up to 10 photos, max 10 MB each.';
const SIZE_HELPER = 'In meters, 0.1–20. Use a dot for decimals.';

/**
 * One entry per field, keyed as the form keys it. `required` is what the
 * field is needed for: a draft ('draft', which also covers publishing), a
 * published survey ('publish'), or neither. `counter` is a character limit
 * to count against as the user types.
 */
export const FIELD_GUIDE = {
  // 1. Kos information
  name: {
    label: 'Kos name',
    required: 'draft',
    helper: 'The name on the signboard or listing. Max 80 characters.',
    counter: 80,
  },
  rent: {
    label: 'Monthly rent',
    required: 'publish',
    helper: 'Rent per month in rupiah, max Rp100.000.000.',
  },
  type: {
    label: 'Kos type',
    required: 'publish',
    helper: 'Who is allowed to rent here.',
  },
  kosLocation: {
    label: 'Pin the kos',
    required: 'publish',
    helper: 'Search the address, then drop the pin on the kos entrance.',
  },
  kosLocationName: {
    label: 'Kos location name',
    required: null,
    helper: 'A short label for the area.',
  },
  campusLocationName: {
    label: 'Campus name',
    required: null,
    helper: "The campus you'll commute to most.",
  },
  campusLocation: {
    label: 'Pin the campus',
    required: null,
    helper: 'Pin your campus to calculate the distance.',
  },
  distance: {
    label: 'Distance to campus',
    required: null,
    helper: 'Straight-line distance between the kos pin and the campus pin.',
  },

  // 2. Room
  lengthM: {
    label: 'Room length',
    required: null,
    helper: SIZE_HELPER,
  },
  widthM: {
    label: 'Room width',
    required: null,
    helper: SIZE_HELPER,
  },
  roomFacility: {
    label: 'Room facilities',
    required: null,
    helper: 'Tick everything in the room. Unticked means not available.',
  },
  cleanliness: {
    label: 'Cleanliness',
    required: 'publish',
    helper: 'Rate the room as it is today, 1–4.',
  },
  internet: {
    label: 'Internet quality',
    required: 'publish',
    helper: 'Test inside the room, then rate 1–4.',
  },
  roomPhotos: {
    label: 'Room photos',
    required: null,
    helper: PHOTO_HELPER,
  },

  // 3. Bathroom
  bathroomFacility: {
    label: 'Bathroom facilities',
    required: null,
    helper: 'Tick everything available. Unticked means not available.',
  },
  bathroomPhotos: {
    label: 'Bathroom photos',
    required: null,
    helper: PHOTO_HELPER,
  },

  // 4. Shared facilities
  sharedFacility: {
    label: 'Shared facilities',
    required: null,
    helper: 'Tick what all tenants can use. Unticked means not available.',
  },
  sharedPhotos: {
    label: 'Shared facility photos',
    required: null,
    helper: PHOTO_HELPER,
  },

  // 5. Surroundings
  surrounding: {
    label: 'Around the kos',
    required: null,
    helper: 'Tick places within a 10-minute walk (about 800 m).',
  },

  // 6. Additional information
  security: {
    label: 'Security',
    required: 'publish',
    helper: 'Rate how safe the kos feels, 1–4.',
  },
  notes: {
    label: 'Additional notes',
    required: null,
    helper: 'Anything else worth remembering. Max 1,000 characters.',
    counter: 1000,
  },
  videos: {
    label: 'Videos',
    required: null,
    helper: 'Up to 2 videos, max 20 MB each.',
  },
};

/**
 * What each point of a 1–4 score means, in what can be seen or measured.
 * The labels match LIKERT in constants.js. Internet adds the average
 * Download from Speedtest by Ookla that each level corresponds to.
 */
export const RUBRICS = {
  cleanliness: [
    { score: 1, label: 'Poor', text: 'Visible dirt or stains, a bad smell, mold, or signs of pests.' },
    { score: 2, label: 'Fair', text: 'Usable, but dusty or stained in places. Needs a proper clean before moving in.' },
    { score: 3, label: 'Good', text: 'Floor, walls, and furniture are clean. Only minor wear.' },
    { score: 4, label: 'Very good', text: 'Spotless, smells fresh, and looks well maintained.' },
  ],
  internet: [
    { score: 1, label: 'Poor', text: 'No signal, or pages barely load and keep dropping.', benchmark: '< 3 Mbps' },
    { score: 2, label: 'Fair', text: 'Chat and browsing work; HD video and video calls sometimes stutter.', benchmark: '3–10 Mbps' },
    { score: 3, label: 'Good', text: 'HD video and video calls run smoothly.', benchmark: '10–25 Mbps' },
    { score: 4, label: 'Very good', text: 'Fast and stable, even with several devices or large downloads.', benchmark: '> 25 Mbps' },
  ],
  security: [
    { score: 1, label: 'Poor', text: 'No working gate or lock, a dark entrance, and anyone can walk in.' },
    { score: 2, label: 'Fair', text: 'The room locks, but the entrance is open or poorly lit. No CCTV or owner on site.' },
    { score: 3, label: 'Good', text: 'Lockable gate and room, a well-lit entrance, plus CCTV or an owner on site.' },
    { score: 4, label: 'Very good', text: 'Several layers: locked gate, CCTV, owner or guard on site, and clear guest rules.' },
  ],
};

/** The line shown under a scale for one level, e.g. "3 Good: …". */
export function rubricLine(level) {
  const base = `${level.score} ${level.label}: ${level.text}`;
  return level.benchmark ? `${base} Average Download ${level.benchmark}.` : base;
}

/** The line for a score on a rubric, or '' when there is no such score. */
export function rubricText(key, score) {
  const level = RUBRICS[key]?.find((step) => step.score === Number(score));
  return level ? rubricLine(level) : '';
}
