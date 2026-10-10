import { isValidPoint } from './geo.js';
import { BATHROOM_TYPES, KOS_TYPES, TOILET_TYPES, YES_NO } from '../constants.js';
import { msg, t } from '../i18n/index.js';
import { validateLogin as checkLogin, validateRegistration as checkRegistration } from '../../../shared/accounts.js';

/** A draft needs only a name; publishing needs everything a comparison depends on. */

export const LIMITS = {
  NAME_MAX: 80,
  RENT_MAX: 100_000_000,
  ROOM_MIN_M: 1,
  ROOM_MAX_M: 10,
  NOTES_MAX: 1000,
  LIKERT_MIN: 1,
  LIKERT_MAX: 4,
};

export const FIELD_SECTION = {
  name: 1,
  type: 1,
  rent: 1,
  kosLocation: 1,
  campusLocation: 1,
  lengthM: 2,
  widthM: 2,
  cleanliness: 2,
  internet: 2,
  bathroomType: 3,
  toiletType: 3,
  waterHeater: 3,
  security: 6,
  notes: 6,
};

const isBlank = (value) => value === null || value === undefined || String(value).trim() === '';

function checkName(data, errors) {
  const name = data.kos.name?.trim() ?? '';
  if (!name) {
    errors.name = t('Enter a name so you can find this kos later.');
  } else if (name.length > LIMITS.NAME_MAX) {
    errors.name = t('Keep the name to {max} characters or fewer.', { max: LIMITS.NAME_MAX });
  }
}

function checkOptionalSizes(data, errors) {
  ['lengthM', 'widthM'].forEach((key) => {
    const value = data.room[key];
    if (value === null || value === undefined) return;
    if (!Number.isFinite(value) || value < LIMITS.ROOM_MIN_M || value > LIMITS.ROOM_MAX_M) {
      errors[key] = t('Enter a size between {min} and {max} metres.', { min: LIMITS.ROOM_MIN_M, max: LIMITS.ROOM_MAX_M });
    }
  });
}

function checkNotes(data, errors) {
  const notes = data.additional.notes ?? '';
  if (notes.length > LIMITS.NOTES_MAX) {
    errors.notes = t('Notes are limited to {max} characters.', { max: LIMITS.NOTES_MAX });
  }
}

function checkRent(data, errors, { required }) {
  const rent = data.kos.rent;
  if (rent === null || rent === undefined) {
    if (required) errors.rent = t('Enter the monthly rent in rupiah.');
    return;
  }
  if (!Number.isFinite(rent) || rent < 0) {
    errors.rent = t('Enter the monthly rent in rupiah.');
  } else if (rent > LIMITS.RENT_MAX) {
    errors.rent = t('Rent looks unusually high. Check the amount.');
  }
}

function checkLikert(value, key, errors, { required }) {
  if (value === null || value === undefined) {
    if (required) errors[key] = t('Rate this from 1 to 4.');
    return;
  }
  if (!Number.isInteger(value) || value < LIMITS.LIKERT_MIN || value > LIMITS.LIKERT_MAX) {
    errors[key] = t('Rate this from 1 to 4.');
  }
}

/** An answer is optional, but it must be one of the choices offered. */
function checkChoice(value, options, key, message, errors) {
  if (value === null || value === undefined) return;
  if (!options.some((option) => option.value === value)) errors[key] = t(message);
}

export function validateSurvey(data, { mode = 'publish' } = {}) {
  const errors = {};
  const publishing = mode === 'publish';

  // Always checked: a malformed value is wrong even in a draft.
  checkName(data, errors);
  checkOptionalSizes(data, errors);
  checkNotes(data, errors);
  checkRent(data, errors, { required: publishing });
  checkChoice(data.bathroom?.type, BATHROOM_TYPES, 'bathroomType', msg('Choose indoor or outdoor.'), errors);
  checkChoice(data.bathroom?.toilet, TOILET_TYPES, 'toiletType', msg('Choose squat or sitting.'), errors);
  checkChoice(data.bathroom?.waterHeater, YES_NO, 'waterHeater', msg('Choose Yes or No.'), errors);

  if (publishing) {
    if (isBlank(data.kos.type) || !KOS_TYPES.some((type) => type.value === data.kos.type)) {
      errors.type = t('Select the kos type.');
    }
    if (!isValidPoint(data.kos.kosLocation)) {
      errors.kosLocation = t('Pin the kos location on the map, or search its address.');
    }
    checkLikert(data.room.cleanliness, 'cleanliness', errors, { required: true });
    checkLikert(data.room.internet, 'internet', errors, { required: true });
    checkLikert(data.additional.security, 'security', errors, { required: true });
  } else {
    checkLikert(data.room.cleanliness, 'cleanliness', errors, { required: false });
    checkLikert(data.room.internet, 'internet', errors, { required: false });
    checkLikert(data.additional.security, 'security', errors, { required: false });
  }

  // Campus is optional either way; without it there is no distance.
  if (data.kos.campusLocation && !isValidPoint(data.kos.campusLocation)) {
    const hasPartialPin =
      data.kos.campusLocation.lat !== null || data.kos.campusLocation.lng !== null;
    if (hasPartialPin) {
      errors.campusLocation = t('That campus pin is incomplete. Set both coordinates, or clear them.');
    }
  }

  const keys = Object.keys(errors);
  const sectionCounts = {};
  keys.forEach((key) => {
    const section = FIELD_SECTION[key];
    if (!section) return;
    sectionCounts[section] = (sectionCounts[section] ?? 0) + 1;
  });

  // Fields in form order, so focus lands on the first problem the user would reach.
  const ordered = Object.keys(FIELD_SECTION).filter((key) => keys.includes(key));

  return {
    ok: keys.length === 0,
    errors,
    firstField: ordered[0] ?? keys[0] ?? null,
    sectionCounts,
  };
}

// Accounts: one module for the app and the server, so the wording cannot drift; the app shows it translated.
export { ACCOUNT_LIMITS } from '../../../shared/accounts.js';

const translated = (result) => ({
  ...result,
  errors: Object.fromEntries(Object.entries(result.errors).map(([field, text]) => [field, t(text)])),
});

export const validateLogin = (credentials) => translated(checkLogin(credentials));
export const validateRegistration = (credentials) => translated(checkRegistration(credentials));

/** Two kos can share a name, so this only warns. */
export function findDuplicateName(surveys, name, { excludeId = null } = {}) {
  const target = name?.trim().toLowerCase();
  if (!target) return null;
  return (
    surveys.find(
      (survey) => survey.id !== excludeId && survey.kos.name?.trim().toLowerCase() === target,
    ) ?? null
  );
}
