import { BATHROOM_TYPES, ROOM_FACILITIES, SHARED_FACILITIES, SURROUNDINGS, TOILET_TYPES } from '../constants.js';
import { distanceFor } from '../services/walkingRoute.js';
import { isValidPoint } from './geo.js';

/** The survey form's values, and the record they make. Pure, so the form's rules are testable without it. */

/** Each form makes its own id: a kept id once overwrote the previous draft. */
export function newSurveyId() {
  return `svy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const pin = (point) => ({
  label: point?.label ?? '',
  address: point?.address ?? '',
  lat: isValidPoint(point) ? point.lat : '',
  lng: isValidPoint(point) ? point.lng : '',
});

const side = (value) => (value === null || value === undefined ? '' : String(value));

/** What the form shows for a saved survey, or for a new one. */
export function formValues(survey = null) {
  const kos = survey?.kos ?? {};
  const room = survey?.room ?? {};
  return {
    name: kos.name ?? '',
    rent: kos.rent ?? null,
    type: kos.type ?? null,
    contactPhone: kos.contactPhone ?? '',
    kosLocation: pin(kos.kosLocation),
    campusLocation: pin(kos.campusLocation),
    lengthM: side(room.lengthM),
    widthM: side(room.widthM),
    roomFacility: room.facilities ?? [],
    cleanliness: room.cleanliness ?? null,
    internet: room.internet ?? null,
    roomPhotoIds: room.photoIds ?? [],
    bathroomType: survey?.bathroom?.type ?? null,
    toiletType: survey?.bathroom?.toilet ?? null,
    waterHeater: survey?.bathroom?.waterHeater ?? null,
    bathroomPhotoIds: survey?.bathroom?.photoIds ?? [],
    sharedFacility: survey?.shared?.facilities ?? [],
    sharedPhotoIds: survey?.shared?.photoIds ?? [],
    surrounding: survey?.surroundings ?? [],
    security: survey?.additional?.security ?? null,
    notes: survey?.additional?.notes ?? '',
    videoIds: survey?.additional?.videoIds ?? [],
  };
}

const text = (value) => String(value ?? '').trim();

function num(value) {
  const typed = text(value);
  if (typed === '') return null;
  const parsed = Number(typed);
  return Number.isFinite(parsed) ? parsed : null;
}

function place(point) {
  const label = text(point.label);
  const address = text(point.address);
  const lat = num(point.lat);
  const lng = num(point.lng);
  if (!label && !address && lat === null && lng === null) return null;
  // The address is kept as typed: it is what the lookup was based on.
  return { lat, lng, label: label || address || null, address: address || null };
}

/** Ticked boxes in the form's order, whatever order they were ticked in. */
const inOrder = (options, chosen) => options.filter((option) => chosen.includes(option));

/** One of the offered choices, or nothing: a stray value must not reach the record. */
const oneOf = (options, value) => (options.some((option) => option.value === value) ? value : null);

export function readSurvey(values) {
  const kosPoint = place(values.kosLocation);
  const campusPoint = place(values.campusLocation);
  const distance = distanceFor(kosPoint, campusPoint);

  return {
    kos: {
      name: text(values.name),
      type: text(values.type) || null,
      // Kept as typed: normalising a phone number could drop a form the user recognises.
      contactPhone: text(values.contactPhone) || null,
      kosLocation: kosPoint,
      campusLocation: campusPoint,
      // From the pins, never a display field: the walk for exactly these pins, else the straight line.
      distanceKm: distance.km,
      distanceBasis: distance.basis,
      rent: values.rent === null || values.rent === '' ? null : Number(values.rent),
    },
    room: {
      lengthM: num(values.lengthM),
      widthM: num(values.widthM),
      facilities: inOrder(ROOM_FACILITIES, values.roomFacility),
      cleanliness: num(values.cleanliness),
      internet: num(values.internet),
      photoIds: values.roomPhotoIds.filter(Boolean),
    },
    bathroom: {
      type: oneOf(BATHROOM_TYPES, values.bathroomType),
      toilet: oneOf(TOILET_TYPES, values.toiletType),
      waterHeater: typeof values.waterHeater === 'boolean' ? values.waterHeater : null,
      photoIds: values.bathroomPhotoIds.filter(Boolean),
    },
    shared: { facilities: inOrder(SHARED_FACILITIES, values.sharedFacility), photoIds: values.sharedPhotoIds.filter(Boolean) },
    surroundings: inOrder(SURROUNDINGS, values.surrounding),
    additional: { security: num(values.security), notes: text(values.notes), videoIds: values.videoIds.filter(Boolean) },
  };
}
