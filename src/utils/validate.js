import { isValidPoint } from './geo.js';
import { KOS_TYPES } from '../constants.js';

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
  security: 6,
  notes: 6,
};

const isBlank = (value) => value === null || value === undefined || String(value).trim() === '';

function checkName(data, errors) {
  const name = data.kos.name?.trim() ?? '';
  if (!name) {
    errors.name = 'Enter a name so you can find this kos later.';
  } else if (name.length > LIMITS.NAME_MAX) {
    errors.name = `Keep the name to ${LIMITS.NAME_MAX} characters or fewer.`;
  }
}

function checkOptionalSizes(data, errors) {
  ['lengthM', 'widthM'].forEach((key) => {
    const value = data.room[key];
    if (value === null || value === undefined) return;
    if (!Number.isFinite(value) || value < LIMITS.ROOM_MIN_M || value > LIMITS.ROOM_MAX_M) {
      errors[key] = `Enter a size between ${LIMITS.ROOM_MIN_M} and ${LIMITS.ROOM_MAX_M} metres.`;
    }
  });
}

function checkNotes(data, errors) {
  const notes = data.additional.notes ?? '';
  if (notes.length > LIMITS.NOTES_MAX) {
    errors.notes = `Notes are limited to ${LIMITS.NOTES_MAX} characters.`;
  }
}

function checkRent(data, errors, { required }) {
  const rent = data.kos.rent;
  if (rent === null || rent === undefined) {
    if (required) errors.rent = 'Enter the monthly rent in rupiah.';
    return;
  }
  if (!Number.isFinite(rent) || rent < 0) {
    errors.rent = 'Enter the monthly rent in rupiah.';
  } else if (rent > LIMITS.RENT_MAX) {
    errors.rent = 'Rent looks unusually high. Check the amount.';
  }
}

function checkLikert(value, key, errors, { required }) {
  if (value === null || value === undefined) {
    if (required) errors[key] = 'Rate this from 1 to 4.';
    return;
  }
  if (!Number.isInteger(value) || value < LIMITS.LIKERT_MIN || value > LIMITS.LIKERT_MAX) {
    errors[key] = 'Rate this from 1 to 4.';
  }
}

export function validateSurvey(data, { mode = 'publish' } = {}) {
  const errors = {};
  const publishing = mode === 'publish';

  // Always checked: a malformed value is wrong even in a draft.
  checkName(data, errors);
  checkOptionalSizes(data, errors);
  checkNotes(data, errors);
  checkRent(data, errors, { required: publishing });

  if (publishing) {
    if (isBlank(data.kos.type) || !KOS_TYPES.some((type) => type.value === data.kos.type)) {
      errors.type = 'Select the kos type.';
    }
    if (!isValidPoint(data.kos.kosLocation)) {
      errors.kosLocation = 'Pin the kos location on the map, or search its address.';
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
      errors.campusLocation = 'That campus pin is incomplete. Set both coordinates, or clear them.';
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

// Accounts: the same rules and wording as server.py, which has the final say.

export const ACCOUNT_LIMITS = {
  NAME_MAX: 60,
  EMAIL_MAX: 254,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function checkEmail(email, errors) {
  if (!email) errors.email = 'Enter your email address.';
  else if (email.length > ACCOUNT_LIMITS.EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter an email address like name@example.com.';
  }
}

function accountResult(errors, order) {
  const keys = Object.keys(errors);
  return { ok: keys.length === 0, errors, firstField: order.find((key) => keys.includes(key)) ?? null, sectionCounts: {} };
}

export function validateLogin({ email = '', password = '' }) {
  const errors = {};
  checkEmail(email.trim(), errors);
  if (!password) errors.password = 'Enter your password.';
  return accountResult(errors, ['email', 'password']);
}

export function validateRegistration({ name = '', email = '', password = '' }) {
  const errors = {};
  const trimmed = name.trim();
  if (!trimmed) errors.name = 'Enter your name.';
  else if (trimmed.length > ACCOUNT_LIMITS.NAME_MAX) errors.name = `Use ${ACCOUNT_LIMITS.NAME_MAX} characters or fewer.`;
  checkEmail(email.trim(), errors);
  if (password.length < ACCOUNT_LIMITS.PASSWORD_MIN) errors.password = `Use at least ${ACCOUNT_LIMITS.PASSWORD_MIN} characters.`;
  else if (password.length > ACCOUNT_LIMITS.PASSWORD_MAX) errors.password = `Use ${ACCOUNT_LIMITS.PASSWORD_MAX} characters or fewer.`;
  return accountResult(errors, ['name', 'email', 'password']);
}

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
