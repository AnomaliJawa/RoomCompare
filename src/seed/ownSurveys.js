import { STATUS, DISTANCE_BASIS } from '../constants.js';
import { withSamplePhotos } from './samplePhotos.js';

/**
 * First-run sample data, in the shape defined by the data model: one group per
 * survey-form section, so a single object serves recording, detail and
 * comparison without reshaping.
 *
 * Photos come from the sample set that ships with the app, added by
 * withSamplePhotos (see samplePhotos.js).
 *
 * `distanceKm` is the walking route between the two pins, measured whenever
 * either changes and then persisted with how it was measured
 * (`distanceBasis`), so comparison does not recompute it on every render. The
 * samples' were measured on 2026-10-03 with the routing service the form uses
 * (utils/route.js); the community samples' too.
 */

const CAMPUS = { lat: -7.9526, lng: 112.6148, label: 'Universitas Brawijaya' };

export const ownSurveys = withSamplePhotos([
  {
    id: 'svy-melati',
    ownerId: 'me',
    status: STATUS.PUBLISHED,
    createdAt: '2026-08-02T09:15:00.000Z',
    updatedAt: '2026-08-02T09:15:00.000Z',
    kos: {
      name: 'Kos Melati Residence',
      type: 'female',
      contactPhone: '0810-3456-7890',
      kosLocation: { lat: -7.9391, lng: 112.6167, label: 'Lowokwaru, Malang', address: 'Jalan Melati 9, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 4.3,
      distanceBasis: DISTANCE_BASIS.WALKING,
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
      contactPhone: '0810-5566-7788',
      kosLocation: { lat: -7.9333, lng: 112.6, label: 'Tlogomas, Malang', address: 'Jalan Tlogo Hijau 3, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 4.5,
      distanceBasis: DISTANCE_BASIS.WALKING,
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
      contactPhone: '0810-2211-9090',
      kosLocation: { lat: -7.9425, lng: 112.6069, label: 'Dinoyo, Malang', address: 'Jalan Arwana 15, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 2.8,
      distanceBasis: DISTANCE_BASIS.WALKING,
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
      contactPhone: '0810-3344-5566',
      kosLocation: { lat: -7.9553, lng: 112.6142, label: 'Sumbersari, Malang', address: 'Jalan Bumi Asri 2, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 0.5,
      distanceBasis: DISTANCE_BASIS.WALKING,
      rent: 1250000,
    },
    room: {
      lengthM: 3.2,
      widthM: 2.8,
      facilities: ['Mattress', 'Wardrobe', 'Fan', 'Table', 'Chair', 'Window', 'Includes electricity'],
      cleanliness: 3,
      internet: 2,
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
  {
    id: 'svy-pelangi',
    ownerId: 'me',
    status: STATUS.PUBLISHED,
    createdAt: '2026-08-17T09:40:00.000Z',
    updatedAt: '2026-08-17T09:40:00.000Z',
    kos: {
      name: 'Kos Pelangi',
      type: 'female',
      contactPhone: '0810-9900-1122',
      kosLocation: { lat: -7.9458, lng: 112.6211, label: 'Lowokwaru, Malang', address: 'Jalan Pelangi 4, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 3.1,
      distanceBasis: DISTANCE_BASIS.WALKING,
      rent: 1400000,
    },
    room: {
      lengthM: 3.5,
      widthM: 3.2,
      facilities: ['Mattress', 'Wardrobe', 'AC', 'Table', 'Chair', 'Window', 'Includes electricity'],
      cleanliness: 4,
      internet: 3,
      photoIds: [],
    },
    bathroom: { facilities: ['Indoor bathroom', 'Western-style toilet'], photoIds: [] },
    shared: { facilities: ['Wifi', 'Motorcycle parking', 'Kitchen', 'Laundry', 'Dispenser'], photoIds: [] },
    surroundings: ['Minimarket / supermarket', 'Eatery (warung makan)', 'Laundry', 'ATM / bank'],
    additional: {
      security: 4,
      notes: 'Owner lives next door and the gate is locked overnight. Felt the safest of the ones I saw.',
      videoIds: [],
    },
  },
  {
    id: 'svy-teratai',
    ownerId: 'me',
    status: STATUS.DRAFT,
    createdAt: '2026-08-20T15:10:00.000Z',
    updatedAt: '2026-08-20T15:10:00.000Z',
    kos: {
      name: 'Kos Teratai',
      type: 'mixed',
      contactPhone: '0810-7788-4455',
      kosLocation: { lat: -7.9349, lng: 112.6088, label: 'Tlogomas, Malang', address: 'Jalan Teratai, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 3.7,
      distanceBasis: DISTANCE_BASIS.WALKING,
      rent: 1150000,
    },
    room: {
      lengthM: 3,
      widthM: 2.9,
      facilities: ['Mattress', 'Wardrobe', 'Fan', 'Table', 'Window'],
      cleanliness: 3,
      internet: 3,
      photoIds: [],
    },
    bathroom: { facilities: ['Outdoor bathroom', 'Squat toilet'], photoIds: [] },
    shared: { facilities: ['Wifi', 'Motorcycle parking', 'Kitchen'], photoIds: [] },
    surroundings: ['Eatery (warung makan)', 'Minimarket / supermarket', 'Place of worship'],
    additional: {
      security: 3,
      notes: 'Need to go back and ask whether electricity is included.',
      videoIds: [],
    },
  },
  {
    id: 'svy-kenanga',
    ownerId: 'me',
    status: STATUS.PUBLISHED,
    createdAt: '2026-08-23T11:25:00.000Z',
    updatedAt: '2026-08-24T08:00:00.000Z',
    kos: {
      name: 'Kos Kenanga',
      type: 'female',
      contactPhone: '0810-6070-8090',
      kosLocation: { lat: -7.9575, lng: 112.6183, label: 'Sumbersari, Malang', address: 'Jalan Kenanga 12, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 1.0,
      distanceBasis: DISTANCE_BASIS.WALKING,
      rent: 1850000,
    },
    room: {
      lengthM: 4.1,
      widthM: 3.4,
      facilities: [
        'Mattress',
        'Wardrobe',
        'TV',
        'AC',
        'Table',
        'Chair',
        'Refrigerator',
        'Dispenser',
        'Window',
        'Includes electricity',
      ],
      cleanliness: 4,
      internet: 4,
      photoIds: [],
    },
    bathroom: {
      facilities: ['Indoor bathroom', 'Western-style toilet', 'Water heater'],
      photoIds: [],
    },
    shared: {
      facilities: ['Wifi', 'Motorcycle parking', 'Car parking', 'Kitchen', 'Washing machine', 'Refrigerator'],
      photoIds: [],
    },
    surroundings: [
      'Minimarket / supermarket',
      'Eatery (warung makan)',
      'Pharmacy / clinic',
      'ATM / bank',
      'Place of worship',
      'Gym / sports facilities',
    ],
    additional: {
      security: 4,
      notes: 'The nicest room by a distance, and the dearest. Closest to campus too.',
      videoIds: [],
    },
  },
  {
    id: 'svy-cempaka-dua',
    ownerId: 'me',
    status: STATUS.DRAFT,
    createdAt: '2026-08-27T18:35:00.000Z',
    updatedAt: '2026-08-27T18:35:00.000Z',
    kos: {
      name: 'Kos Cempaka Dua',
      type: 'male',
      contactPhone: '0810-2345-6789',
      kosLocation: { lat: -7.9268, lng: 112.6301, label: 'Blimbing, Malang', address: 'Jalan Cempaka Dua, Malang' },
      campusLocation: CAMPUS,
      distanceKm: 5.8,
      distanceBasis: DISTANCE_BASIS.WALKING,
      rent: 900000,
    },
    room: {
      lengthM: 2.9,
      widthM: 2.6,
      facilities: ['Mattress', 'Wardrobe', 'Fan'],
      cleanliness: 2,
      internet: 2,
      photoIds: [],
    },
    bathroom: { facilities: ['Outdoor bathroom', 'Squat toilet'], photoIds: [] },
    shared: { facilities: ['Motorcycle parking', 'Kitchen'], photoIds: [] },
    surroundings: ['Eatery (warung makan)'],
    additional: {
      security: 2,
      notes: 'Cheapest by far but a long ride, and the shared bathroom needed work.',
      videoIds: [],
    },
  },
]);
