import { STATUS } from '../constants.js';

/**
 * First-run sample data, in the shape defined by the data model: one group per
 * survey-form section, so a single object serves recording, detail and
 * comparison without reshaping.
 *
 * `photoIds` are empty until the media layer lands, so cards and detail views
 * exercise the no-photos placeholder state.
 *
 * `distanceKm` is derived from the two coordinates whenever either changes and
 * then persisted, so comparison does not recompute it on every render.
 */

const CAMPUS = { lat: -7.9526, lng: 112.6148, label: 'Universitas Brawijaya' };

export const ownSurveys = [
  {
    id: 'svy-melati',
    ownerId: 'me',
    status: STATUS.PUBLISHED,
    createdAt: '2026-08-02T09:15:00.000Z',
    updatedAt: '2026-08-02T09:15:00.000Z',
    kos: {
      name: 'Kos Melati Residence',
      type: 'female',
      kosLocation: { lat: -7.9391, lng: 112.6167, label: 'Lowokwaru, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 1.8,
      rent: 1500000,
    },
    room: {
      lengthM: 3.5,
      widthM: 3,
      facilities: ['Mattress', 'Wardrobe', 'Fan', 'Table', 'Chair', 'Dispenser', 'Window', 'Includes electricity'],
      cleanliness: 4,
      internet: 4,
      photoIds: [],
    },
    bathroom: {
      facilities: ['Indoor bathroom', 'Western-style toilet', 'Water heater'],
      photoIds: [],
    },
    shared: {
      facilities: ['Wifi', 'Motorcycle parking', 'Kitchen', 'Washing machine', 'Laundry', 'Dispenser'],
      photoIds: [],
    },
    surroundings: ['Minimarket / supermarket', 'Eatery (warung makan)', 'Place of worship'],
    additional: {
      security: 3,
      notes:
        'Quiet street and the owner answers quickly. Gate is locked from 10pm. ' +
        'Food stalls and a minimarket are both a short walk away.',
      videoIds: [],
    },
  },
  {
    id: 'svy-casa-hijau',
    ownerId: 'me',
    status: STATUS.PUBLISHED,
    createdAt: '2026-08-05T13:40:00.000Z',
    updatedAt: '2026-08-06T08:05:00.000Z',
    kos: {
      name: 'Casa Hijau',
      type: 'mixed',
      kosLocation: { lat: -7.9333, lng: 112.6, label: 'Tlogomas, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 2.3,
      rent: 1350000,
    },
    room: {
      lengthM: 4,
      widthM: 3.2,
      facilities: ['Mattress', 'Wardrobe', 'Fan', 'Table', 'Chair', 'Refrigerator', 'Window', 'Includes electricity'],
      cleanliness: 4,
      internet: 3,
      photoIds: [],
    },
    bathroom: {
      facilities: ['Indoor bathroom', 'Western-style toilet'],
      photoIds: [],
    },
    shared: {
      facilities: ['Wifi', 'Motorcycle parking', 'Car parking', 'Kitchen', 'Laundry', 'Dispenser'],
      photoIds: [],
    },
    surroundings: [
      'Minimarket / supermarket',
      'Eatery (warung makan)',
      'Pharmacy / clinic',
      'Place of worship',
    ],
    additional: {
      security: 4,
      notes:
        'Good natural light and a clean shared kitchen. Busier than the others, ' +
        'but the building felt well looked after.',
      videoIds: [],
    },
  },
  {
    id: 'svy-arwana',
    ownerId: 'me',
    status: STATUS.DRAFT,
    createdAt: '2026-08-11T16:20:00.000Z',
    updatedAt: '2026-08-11T16:20:00.000Z',
    kos: {
      name: 'Kost Arwana',
      type: 'male',
      kosLocation: { lat: -7.9425, lng: 112.6069, label: 'Dinoyo, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 1.6,
      rent: 1700000,
    },
    room: {
      lengthM: 3.8,
      widthM: 3.1,
      facilities: ['Mattress', 'Wardrobe', 'AC', 'Fan', 'Table', 'Chair', 'Dispenser', 'Window', 'Includes electricity'],
      cleanliness: 3,
      internet: 4,
      photoIds: [],
    },
    bathroom: {
      facilities: ['Indoor bathroom', 'Western-style toilet', 'Water heater'],
      photoIds: [],
    },
    shared: {
      facilities: ['Wifi', 'Motorcycle parking', 'Car parking', 'Kitchen', 'Washing machine'],
      photoIds: [],
    },
    surroundings: ['Eatery (warung makan)', 'Place of worship', 'Gym / sports facilities'],
    additional: {
      security: 3,
      notes: 'Closest to campus and the signal was strong. Bathroom fittings need work.',
      videoIds: [],
    },
  },
  {
    id: 'svy-bumi-asri',
    ownerId: 'me',
    status: STATUS.PUBLISHED,
    createdAt: '2026-08-14T10:05:00.000Z',
    updatedAt: '2026-08-14T10:05:00.000Z',
    kos: {
      name: 'Kost Bumi Asri',
      type: 'female',
      kosLocation: { lat: -7.9553, lng: 112.6142, label: 'Sumbersari, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 2.8,
      rent: 1250000,
    },
    room: {
      lengthM: 3.2,
      widthM: 2.8,
      facilities: ['Mattress', 'Wardrobe', 'Fan', 'Table', 'Chair', 'Window', 'Includes electricity'],
      cleanliness: 3,
      // Internet was never recorded on this visit — exercises the
      // "Not recorded" path in detail, comparison and Best Match.
      internet: null,
      photoIds: [],
    },
    bathroom: {
      facilities: ['Outdoor bathroom', 'Squat toilet'],
      photoIds: [],
    },
    shared: {
      facilities: ['Wifi', 'Motorcycle parking', 'Laundry'],
      photoIds: [],
    },
    surroundings: ['Minimarket / supermarket', 'Eatery (warung makan)'],
    additional: {
      security: 2,
      notes: 'Cheapest of the four and close to the market. The side gate stays open at night.',
      videoIds: [],
    },
  },
];
