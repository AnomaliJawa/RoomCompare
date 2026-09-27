/**
 * localStorage access, isolated from the store so the failure modes live in
 * one place and can be reasoned about on their own.
 *
 * Three things can go wrong, and all three are ordinary rather than
 * exceptional: storage can be unavailable (private browsing, blocked site
 * data), the stored JSON can be unreadable, and a write can exceed quota.
 * None of them may lose the user's typed input or leave a blank page.
 */

export const STORAGE_KEY = 'roomcompare:v1';
export const SCHEMA_VERSION = 1;

export const LOAD_STATUS = {
  OK: 'ok',
  EMPTY: 'empty',
  CORRUPT: 'corrupt',
  UNAVAILABLE: 'unavailable',
};

export const SAVE_RESULT = {
  OK: 'ok',
  QUOTA: 'quota',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
};

/**
 * Reading `window.localStorage` can itself throw when site data is blocked,
 * so the probe has to cover access as well as writing.
 */
export function isAvailable() {
  try {
    const probe = '__roomcompare_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function looksValid(parsed) {
  return (
    parsed &&
    typeof parsed === 'object' &&
    parsed.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(parsed.surveys) &&
    Array.isArray(parsed.starredIds)
  );
}

/**
 * Keep unreadable data instead of discarding it — it is the only copy of
 * whatever the user recorded, and a later version may be able to salvage it.
 */
function quarantine(raw) {
  try {
    window.localStorage.setItem(`${STORAGE_KEY}:corrupt-${Date.now()}`, raw);
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing further to do: the data was already unusable.
  }
}

export function load() {
  if (!isAvailable()) return { status: LOAD_STATUS.UNAVAILABLE, data: null };

  let raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { status: LOAD_STATUS.UNAVAILABLE, data: null };
  }

  if (raw === null) return { status: LOAD_STATUS.EMPTY, data: null };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    quarantine(raw);
    return { status: LOAD_STATUS.CORRUPT, data: null };
  }

  // A shape we do not recognise is as unusable as invalid JSON, including a
  // schemaVersion from some future build.
  if (!looksValid(parsed)) {
    quarantine(raw);
    return { status: LOAD_STATUS.CORRUPT, data: null };
  }

  return { status: LOAD_STATUS.OK, data: parsed };
}

/**
 * `ownerId` says whose account this copy belongs to. It is null for data
 * recorded before accounts existed, and after a logout; the app only shows
 * the copy to the account that owns it.
 */
export function save({ surveys, starredIds, ownerId = null }) {
  if (!isAvailable()) return SAVE_RESULT.UNAVAILABLE;

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    surveys,
    starredIds,
    ownerId,
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return SAVE_RESULT.OK;
  } catch (error) {
    // Chrome reports code 22, Firefox 1014; some builds only set the name.
    const quota =
      error instanceof DOMException &&
      (error.code === 22 ||
        error.code === 1014 ||
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    return quota ? SAVE_RESULT.QUOTA : SAVE_RESULT.FAILED;
  }
}

/**
 * Surveys recorded here before accounts existed, which the user chose not
 * to add to their account. Kept aside rather than deleted, like unreadable
 * data: it may be the only copy of something they recorded.
 */
export function keepUnclaimed(surveys) {
  try {
    window.localStorage.setItem(`${STORAGE_KEY}:unclaimed-${Date.now()}`, JSON.stringify(surveys));
    return true;
  } catch {
    return false;
  }
}

/** Used by the reset affordance and by tests. */
export function clear() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Roughly how much space the record currently takes, for the storage notice. */
export function approximateSize() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? raw.length : 0;
  } catch {
    return 0;
  }
}
