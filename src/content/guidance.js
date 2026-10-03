/**
 * Guidance copy for the survey form: section intros, a helper line under
 * every field, the 1–4 score rubrics, and the How to fill panel behind each
 * field's ⓘ. What a field is required for is said in its panel's rules.
 *
 * The wording comes from "Guidelines Feature Concept – RoomCompare" and is
 * changed there first, then here. It is plain data, kept apart from the
 * components, so copy can change without touching markup, and it ships with
 * the app, so it still shows with no connection.
 *
 * Each panel follows the same order, so it is easy to scan: what to fill,
 * how to find it, an example, the rules the form checks, and an optional
 * survey tip. The concept gives each field's panel as one paragraph; it is
 * split into those parts here, with no facts added.
 *
 * Two lines differ from the concept on purpose:
 * - Distance to campus says walking where the concept says road, since the
 *   route is measured on foot (utils/route.js, the user's request,
 *   2026-10-03), and its rules add the straight-line fallback.
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

/** The panel's parts, in the order they are shown. */
export const PANEL_PARTS = [
  ['what', 'What to fill'],
  ['find', 'How to find it'],
  ['example', 'Example'],
  ['rules', 'Rules'],
  ['tip', 'Survey tip'],
];

const PHOTO_HELPER = 'Up to 10 photos, max 10 MB each.';
const PHOTO_RULES = 'Optional. Up to 10 photos, max 10 MB each.';
const PHOTO_FIND = 'Take them on site, following the suggested shots below.';
const SIZE_HELPER = 'In meters, 0.1–20. Use a dot for decimals.';

const ROOM_SIZE_PANEL = {
  what: 'The floor size of the room, in meters.',
  find: 'Measure the floor wall to wall with a tape measure, or ask the owner.',
  example: 'A 3 × 4 m room: length 3, width 4. Use a dot for part of a meter, e.g. 2.5.',
  rules: 'Optional. 0.1–20 m, with a dot for decimals.',
  tip: "Don't include an indoor bathroom.",
};

const COORDINATES_EXAMPLE =
  'Map not loading? Enter coordinates: in Google Maps, long-press the spot and copy the numbers, e.g. -7.7713, 110.3775.';

/**
 * One entry per field, keyed as the form keys it.
 * - `counter`: a character limit to count against as the user types.
 * - `panel`: the How to fill panel, by part (PANEL_PARTS).
 * - `photos`: what to photograph, for the photo fields.
 */
export const FIELD_GUIDE = {
  // 1. Kos information
  name: {
    label: 'Kos name',
    helper: 'The name on the signboard or listing. Max 80 characters.',
    counter: 80,
    panel: {
      what: 'The name on the signboard or listing.',
      find: 'Check the signboard, Mamikos, social media, or ask the owner.',
      example:
        "Kos Melati Pogung. No official name? Use the owner's name and street, e.g. Kos Bu Sri – Jl. Kaliurang.",
      rules: 'Required, even for a draft. Max 80 characters.',
    },
  },
  rent: {
    label: 'Monthly rent',
    helper: 'Rent per month in rupiah, max Rp100.000.000.',
    panel: {
      what: 'Rent per month in rupiah, for the room you surveyed.',
      find: 'Ask the owner. If the price depends on room type or facilities, enter the price of the room you surveyed.',
      example: 'Paid per semester or year? Divide by the months, e.g. Rp9.000.000/year = Rp750.000.',
      rules: 'Required to publish. Max Rp100.000.000.',
      tip: 'If electricity is included, tick Includes electricity in Room facilities.',
    },
  },
  type: {
    label: 'Kos type',
    helper: 'Who is allowed to rent here.',
    panel: {
      what: 'Who is allowed to rent here.',
      find: "Ask the owner; don't guess from the tenants you see.",
      example: 'Male: men only. Female: women only. Mixed: men and women.',
      rules: 'Required to publish. Choose one.',
    },
  },
  contactPhone: {
    label: 'Owner or security phone',
    helper: 'A number to reach the owner or on-site security.',
    panel: {
      what: 'A phone number to reach the kos owner, or the security or caretaker on site.',
      find: 'Ask the owner or a tenant, or check the signboard or listing.',
      example: 'A mobile or WhatsApp number, e.g. 0812-3456-7890.',
      rules: 'Optional.',
    },
  },
  kosLocation: {
    label: 'Pin the kos',
    helper: 'Search the address, then drop the pin on the kos entrance.',
    panel: {
      what: 'Where the kos is, with the pin on its entrance.',
      find: 'Search the address, then drag the pin to the gate or front door.',
      example: COORDINATES_EXAMPLE,
      rules: 'Required to publish.',
      tip: 'Distance to campus is measured from this pin, so place it carefully.',
    },
  },
  kosLocationName: {
    label: 'Kos location name',
    helper: 'A short label for the area.',
    panel: {
      what: 'A short label for the area.',
      find: "Use the area, street, or a landmark you'll remember.",
      example: 'Pogung Baru, near the mosque.',
      rules: 'Optional.',
    },
  },
  campusLocationName: {
    label: 'Campus name',
    helper: "The campus you'll commute to most.",
    panel: {
      what: "The campus you'll commute to most.",
      find: 'If faculties are far apart, include yours.',
      example: 'UGM – Faculty of Engineering.',
      rules: 'Optional.',
    },
  },
  campusLocation: {
    label: 'Pin the campus',
    helper: 'Pin your campus to calculate the distance.',
    panel: {
      what: 'Where you commute to, pinned to calculate the distance.',
      find: 'Pin the gate or building you go to most, not the middle of the campus.',
      example: COORDINATES_EXAMPLE,
      rules: 'Optional. Without it, no distance is calculated.',
    },
  },
  distance: {
    label: 'Distance to campus',
    helper: 'Walking distance along the road from the kos pin to the campus pin.',
    panel: {
      what: 'Walking distance along the road from the kos pin to the campus pin.',
      find: 'It fills in once both pins are set. To change it, move one of the pins.',
      rules:
        'Read-only. Measured along the walking route, not in a straight line. When the route can’t be measured, the straight line is shown instead and marked as such.',
    },
  },

  // 2. Room
  lengthM: {
    label: 'Room length',
    helper: SIZE_HELPER,
    panel: ROOM_SIZE_PANEL,
  },
  widthM: {
    label: 'Room width',
    helper: SIZE_HELPER,
    panel: ROOM_SIZE_PANEL,
  },
  roomFacility: {
    label: 'Room facilities',
    helper: 'Tick everything in the room. Unticked means not available.',
    panel: {
      what: "Everything in the room that's ready to use.",
      find: "Look around the room, and tick only what's there and ready to use.",
      example:
        'Includes electricity: tick if the rent already covers electricity (no separate token or bill). ' +
        'Window: tick if it opens to the outside, not just a vent.',
      rules: 'Optional. Unticked means not available.',
    },
  },
  cleanliness: {
    label: 'Cleanliness',
    helper: 'Rate the room as it is today, 1–4.',
    panel: {
      what: 'How clean the room is today, on a 1–4 scale.',
      find: 'Check the floor, corners, under the bed, walls (mold or damp), and the smell.',
      example: 'Floor, walls, and furniture clean, with only minor wear: 3 Good.',
      rules: 'Required to publish. Choose 1–4, matching what you see to the scores.',
      tip: 'Rate what you see, not what the owner promises to clean.',
    },
  },
  internet: {
    label: 'Internet quality',
    helper: 'Test inside the room, then rate 1–4.',
    panel: {
      what: 'How well the internet works inside the room, on a 1–4 scale.',
      find: 'Run Speedtest by Ookla (app or speedtest.net) 3 times inside the room, not in the lobby or next to the router.',
      example: 'An average Download of 15 Mbps: 3 Good.',
      rules: 'Required to publish. Match the average Download to the scores.',
      tip: 'No kos Wi-Fi? Test and rate your mobile data instead, and mention it in Additional notes.',
    },
  },
  roomPhotos: {
    label: 'Room photos',
    helper: PHOTO_HELPER,
    panel: {
      what: 'Photos of the room as it is on the day.',
      find: PHOTO_FIND,
      rules: PHOTO_RULES,
      tip: 'Shoot in daylight with the room light on.',
    },
    photos: [
      'A wide shot from the door',
      'Bed',
      'Wardrobe',
      'Desk',
      'Floor',
      'Walls',
      'Window',
      'Lighting',
      'Each ticked facility',
    ],
  },

  // 3. Bathroom
  bathroomFacility: {
    label: 'Bathroom facilities',
    helper: 'Tick everything available. Unticked means not available.',
    panel: {
      what: 'What the bathroom has.',
      find: 'Check the bathroom yourself.',
      example:
        'Indoor bathroom: inside your room, for you only. Outdoor bathroom: outside the room, usually shared. ' +
        'If both exist, tick both. Squat or Western-style: the toilet type.',
      rules: 'Optional. Unticked means not available.',
      tip: 'Water heater: tick only if it works; turn on the hot water to check.',
    },
  },
  bathroomPhotos: {
    label: 'Bathroom photos',
    helper: PHOTO_HELPER,
    panel: {
      what: 'Photos of the bathroom as it is on the day.',
      find: PHOTO_FIND,
      rules: PHOTO_RULES,
      tip: 'Run the tap and flush to check water pressure and clarity, and note any problem in Additional notes.',
    },
    photos: ['Toilet', 'Shower or tap', 'Sink', 'Floor and walls', 'Drain', 'Water heater'],
  },

  // 4. Shared facilities
  sharedFacility: {
    label: 'Shared facilities',
    helper: 'Tick what all tenants can use. Unticked means not available.',
    panel: {
      what: 'What all tenants can use.',
      find: 'Check the shared areas on site, and ask the owner.',
      example:
        'Wifi: internet provided by the kos (rate its quality under Room). ' +
        'Motorcycle or Car parking: a space provided by the kos, not the street. ' +
        'Washing machine: a machine tenants run themselves. ' +
        'Laundry: a laundry service run by the kos, free or paid.',
      rules: 'Optional. Unticked means not available.',
      tip: 'A laundry shop nearby goes under Surroundings, not here.',
    },
  },
  sharedPhotos: {
    label: 'Shared facility photos',
    helper: PHOTO_HELPER,
    panel: {
      what: 'Photos of the spaces tenants share.',
      find: PHOTO_FIND,
      rules: PHOTO_RULES,
    },
    photos: ['Kitchen', 'Living room', 'Drying area', 'Parking', 'Washing area', 'Other shared spaces'],
  },

  // 5. Surroundings
  surrounding: {
    label: 'Around the kos',
    helper: 'Tick places within a 10-minute walk (about 800 m).',
    panel: {
      what: 'Useful places within a 10-minute walk (about 800 m).',
      find: 'Walk around the kos, or use Google Maps walking directions from the kos pin.',
      example:
        'Eatery: a warung makan or small restaurant. ' +
        'Laundry: a laundry shop nearby (a service run by the kos goes under Shared facilities). ' +
        'Place of worship: a mosque, church, temple, or similar.',
      rules: 'Optional. Unticked means not nearby.',
    },
  },

  // 6. Additional information
  security: {
    label: 'Security',
    helper: 'Rate how safe the kos feels, 1–4.',
    panel: {
      what: 'How safe the kos feels, on a 1–4 scale.',
      find:
        'Check the gate and room lock, lighting on the way in, CCTV, whether the owner or a guard lives on site, and guest rules.',
      example: 'A lockable gate and room, a well-lit entrance, and CCTV: 3 Good.',
      rules: 'Required to publish. Choose 1–4, matching what you see to the scores.',
      tip: 'Ask a current tenant if you can.',
    },
  },
  notes: {
    label: 'Additional notes',
    helper: 'Anything else worth remembering. Max 1,000 characters.',
    counter: 1000,
    panel: {
      what: 'Anything else worth remembering.',
      find: 'Ask the owner, and write down what you notice on site.',
      example:
        'Extra fees (electricity, water, parking, laundry), deposit and payment terms, curfew and guest rules, ' +
        "noise, water pressure, the owner's contact, and your overall impression.",
      rules: 'Optional. Max 1,000 characters.',
    },
  },
  videos: {
    label: 'Videos',
    helper: 'Up to 2 videos, max 20 MB each.',
    panel: {
      what: 'Short videos of the kos.',
      find: 'Record them on site.',
      example: 'A short room tour: walk from the door around the room in about 15 seconds.',
      rules: 'Optional. Up to 2 videos, max 20 MB each.',
      tip: 'If the file is too big, lower the camera resolution.',
    },
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

/**
 * The Survey guide, shown the first time the survey form opens and again
 * from the ? beside its title: what to prepare before visiting a kos. The
 * concept's three sentences, as lists, so each item can be ticked off.
 */
export const SURVEY_GUIDE = {
  title: 'Survey guide',
  sections: [
    {
      heading: 'Bring',
      items: [
        'A tape measure, or a measuring app',
        'A charged phone with space for photos and videos',
        'The Speedtest by Ookla app',
      ],
    },
    {
      heading: 'Ask the owner',
      items: [
        'The monthly price, and what it includes (electricity, water, Wi-Fi)',
        'The kos type',
        'The deposit and payment period',
        'Curfew and guest rules',
        'Extra fees',
      ],
    },
    {
      heading: 'On site',
      ordered: true,
      items: [
        'Save a draft as soon as you have the kos name.',
        'Fill in the rest as you walk around.',
        'Publish when all required fields are done.',
      ],
    },
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
