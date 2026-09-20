import { STATUS } from '../constants.js';

/**
 * Shared survey results from other RoomCompare users.
 *
 * Read-only reference data, held as a static module rather than written to
 * storage: it cannot be corrupted and it does not consume the user's quota.
 * There are no accounts in this build, so authorship is simulated — the
 * README says so plainly, to avoid it reading as an unfinished feature.
 *
 * The prototype's Community tab listed the user's OWN published surveys,
 * which is not what the requirement describes. These are separate records.
 */

const CAMPUS = { lat: -7.9526, lng: 112.6148, label: 'Universitas Brawijaya' };

export const communitySurveys = [
  {
    id: 'com-kartika',
    ownerId: 'user-rahma',
    ownerName: 'Rahma',
    status: STATUS.PUBLISHED,
    createdAt: '2026-07-19T11:00:00.000Z',
    updatedAt: '2026-07-19T11:00:00.000Z',
    kos: {
      name: 'Kos Kartika',
      type: 'female',
      kosLocation: { lat: -7.9448, lng: 112.6135, label: 'Ketawanggede, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 0.9,
      rent: 1650000,
    },
    room: {
      lengthM: 3.6,
      widthM: 3.2,
      facilities: ['Mattress', 'Wardrobe', 'AC', 'Table', 'Chair', 'Window', 'Includes electricity'],
      cleanliness: 4,
      internet: 4,
      photoIds: [],
    },
    bathroom: { facilities: ['Indoor bathroom', 'Western-style toilet', 'Water heater'], photoIds: [] },
    shared: {
      facilities: ['Wifi', 'Motorcycle parking', 'Kitchen', 'Washing machine', 'Refrigerator'],
      photoIds: [],
    },
    surroundings: ['Minimarket / supermarket', 'Eatery (warung makan)', 'ATM / bank', 'Pharmacy / clinic'],
    additional: {
      security: 4,
      notes: 'Walking distance to campus. Curfew at 11pm and the owner lives on site.',
      videoIds: [],
    },
  },
  {
    id: 'com-pondok-biru',
    ownerId: 'user-dimas',
    ownerName: 'Dimas',
    status: STATUS.PUBLISHED,
    createdAt: '2026-07-28T15:30:00.000Z',
    updatedAt: '2026-07-28T15:30:00.000Z',
    kos: {
      name: 'Pondok Biru',
      type: 'male',
      kosLocation: { lat: -7.9302, lng: 112.6221, label: 'Blimbing, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 3.4,
      rent: 950000,
    },
    room: {
      lengthM: 3,
      widthM: 2.5,
      facilities: ['Mattress', 'Wardrobe', 'Fan', 'Table', 'Window'],
      cleanliness: 2,
      internet: 2,
      photoIds: [],
    },
    bathroom: { facilities: ['Outdoor bathroom', 'Squat toilet'], photoIds: [] },
    shared: { facilities: ['Motorcycle parking', 'Kitchen'], photoIds: [] },
    surroundings: ['Eatery (warung makan)', 'Minimarket / supermarket'],
    additional: {
      security: 2,
      notes: 'Cheapest one I found. Basic, and the ride to campus takes about fifteen minutes.',
      videoIds: [],
    },
  },
  {
    id: 'com-griya-asri',
    ownerId: 'user-sari',
    ownerName: 'Sari',
    status: STATUS.PUBLISHED,
    createdAt: '2026-08-03T09:45:00.000Z',
    updatedAt: '2026-08-03T09:45:00.000Z',
    kos: {
      name: 'Griya Asri',
      type: 'mixed',
      kosLocation: { lat: -7.9487, lng: 112.6077, label: 'Dinoyo, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 1.4,
      rent: 1450000,
    },
    room: {
      lengthM: 3.4,
      widthM: 3,
      facilities: ['Mattress', 'Wardrobe', 'AC', 'Fan', 'Table', 'Chair', 'Dispenser', 'Window'],
      cleanliness: 3,
      internet: 3,
      photoIds: [],
    },
    bathroom: { facilities: ['Indoor bathroom', 'Western-style toilet'], photoIds: [] },
    shared: {
      facilities: ['Wifi', 'Motorcycle parking', 'Car parking', 'Kitchen', 'Laundry', 'Dispenser'],
      photoIds: [],
    },
    surroundings: [
      'Minimarket / supermarket',
      'Eatery (warung makan)',
      'Laundry',
      'Place of worship',
      'Gym / sports facilities',
    ],
    additional: {
      security: 3,
      notes: 'Electricity is billed separately, so budget a little above the listed rent.',
      videoIds: [],
    },
  },
  {
    id: 'com-wisma-cempaka',
    ownerId: 'user-bagus',
    ownerName: 'Bagus',
    status: STATUS.PUBLISHED,
    createdAt: '2026-08-09T18:10:00.000Z',
    updatedAt: '2026-08-09T18:10:00.000Z',
    kos: {
      name: 'Wisma Cempaka',
      type: 'female',
      kosLocation: { lat: -7.9601, lng: 112.6203, label: 'Sukun, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 4.1,
      rent: 1100000,
    },
    room: {
      lengthM: 3.2,
      widthM: 3,
      facilities: ['Mattress', 'Wardrobe', 'Fan', 'Table', 'Chair', 'Window', 'Includes electricity'],
      cleanliness: 4,
      internet: 3,
      photoIds: [],
    },
    bathroom: { facilities: ['Indoor bathroom', 'Squat toilet'], photoIds: [] },
    shared: { facilities: ['Wifi', 'Motorcycle parking', 'Kitchen', 'Washing machine'], photoIds: [] },
    surroundings: ['Minimarket / supermarket', 'Eatery (warung makan)', 'Place of worship', 'ATM / bank'],
    additional: {
      security: 3,
      notes: 'Very clean and quiet, but far enough out that you would want a motorbike.',
      videoIds: [],
    },
  },
];
