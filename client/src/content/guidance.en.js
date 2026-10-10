/** Survey form copy from the user's Guidelines concept doc: change the doc first, then here and in guidance.id.js. */

export const SECTION_INTROS = {
  kos: 'Start with the basics: name, rent, type, and location. These are the base for comparing every kos.',
  room: 'Record the room you surveyed: size, facilities, and condition in photos. Write down what you see on the day.',
  bathroom: "Record the bathroom's type, toilet, hot water and condition to judge how comfortable it is.",
  shared: 'Record the facilities tenants share for daily needs, including Wi-Fi.',
  surroundings: 'Record useful places within a 10-minute walk of the kos.',
  additional: 'Add anything else that affects your choice: security, notes, and videos.',
};

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
const SIZE_HELPER = 'In meters, 1–10. Pick from the list or type one, e.g. 2.5.';

const ROOM_SIZE_PANEL = {
  what: 'The floor size of the room, in meters.',
  find: 'Measure the floor wall to wall with a tape measure, or ask the owner.',
  example:
    'A 3 × 4 m room: pick 3 for length and 4 for width. For part of a meter, type it with a dot, e.g. 2.5.',
  rules: 'Optional. 1–10 m, with a dot for decimals. The list offers whole meters from 1 to 10; type a size in between.',
  tip: "Don't include an indoor bathroom.",
};

const COORDINATES_EXAMPLE =
  'Map not loading? Enter coordinates: in Google Maps, long-press the spot and copy the numbers, e.g. -7.7713, 110.3775.';

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
    helper: 'Per month. Slide up to Rp10.000.000, or type up to Rp100.000.000.',
    panel: {
      what:
        'Rent per month in rupiah, for the room you surveyed. Slide to the amount or type it exactly; the slider stops at Rp10.000.000.',
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
  // No location or campus name fields: Find on map names the area (the user's request).
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
  // No helper line under this field, at the user's request; its panel explains it.
  distance: {
    label: 'Distance to campus',
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
  bathroomType: {
    label: 'Bathroom type',
    helper: 'Indoor is inside your room; outdoor is outside it, usually shared.',
    panel: {
      what: 'Where the bathroom is: inside the room, or outside it.',
      find: 'Check where the bathroom is yourself.',
      example: 'Indoor: inside your room, for you only. Outdoor: outside the room, usually shared with other tenants.',
      rules: 'Optional. Choose one.',
      tip: 'If the room has both, choose Indoor and mention the outdoor one in Additional notes.',
    },
  },
  toiletType: {
    label: 'Toilet type',
    helper: 'Squat, or sitting (Western-style).',
    panel: {
      what: 'The kind of toilet in the bathroom you would use.',
      find: 'Look in the bathroom.',
      example: 'Squat: set into the floor. Sitting: a Western-style toilet with a seat.',
      rules: 'Optional. Choose one.',
      tip: 'Flush it to check that it works and drains well.',
    },
  },
  waterHeater: {
    label: 'Water heater',
    helper: 'Yes only if it works.',
    panel: {
      what: 'Whether the bathroom has hot water.',
      find: 'Turn on the hot water to check.',
      rules: 'Optional. Yes or No.',
      tip: 'Choose Yes only if it works: a heater that is broken is no heater.',
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
        'Laundry: a laundry shop nearby (a service run by the kos goes under Shared facilities).',
      rules: 'Optional. Unticked means not nearby.',
    },
  },
  worship: {
    label: 'Places of worship nearby',
    helper: 'Tick each one within a 10-minute walk (about 800 m).',
    panel: {
      what: 'Places of worship within a 10-minute walk (about 800 m).',
      find: 'Walk around the kos, or search Google Maps near the kos pin.',
      example: 'Masjid, gereja, pura, vihara or klenteng: tick every one that is close.',
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
