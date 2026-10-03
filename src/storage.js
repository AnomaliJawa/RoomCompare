/** localStorage failures (unavailable, unreadable, over quota) are ordinary and handled here. */

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

/** Reading window.localStorage can itself throw when site data is blocked. */
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

/** Unreadable data is kept, not discarded: it may be the only copy. */
function quarantine(raw) {
  try {
    window.localStorage.setItem(`${STORAGE_KEY}:corrupt-${Date.now()}`, raw);
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
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

  // An unrecognised shape, including a future schemaVersion, counts as unreadable.
  if (!looksValid(parsed)) {
    quarantine(raw);
    return { status: LOAD_STATUS.CORRUPT, data: null };
  }

  return { status: LOAD_STATUS.OK, data: parsed };
}

/** ownerId is null for data from before accounts, and after a logout. */
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
    return isQuotaError(error) ? SAVE_RESULT.QUOTA : SAVE_RESULT.FAILED;
  }
}

// Chrome reports code 22, Firefox 1014; some builds only set the name.
function isQuotaError(error) {
  return (
    error instanceof DOMException &&
    (error.code === 22 ||
      error.code === 1014 ||
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

/** Weights are filed per account and survive logout, unlike the surveys' copy. */
const weightsKey = (userId) => `${STORAGE_KEY}:weights:${userId}`;

export function loadWeights(userId) {
  try {
    const raw = window.localStorage.getItem(weightsKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** null removes them, so the defaults apply. */
export function saveWeights(userId, weights) {
  if (!isAvailable()) return SAVE_RESULT.UNAVAILABLE;
  try {
    if (weights === null) window.localStorage.removeItem(weightsKey(userId));
    else window.localStorage.setItem(weightsKey(userId), JSON.stringify(weights));
    return SAVE_RESULT.OK;
  } catch (error) {
    return isQuotaError(error) ? SAVE_RESULT.QUOTA : SAVE_RESULT.FAILED;
  }
}

/** Likes too are filed per account, so a shared phone's next user starts with none. */
const likesKey = (userId) => `${STORAGE_KEY}:likes:${userId}`;

export function loadLikes(userId) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(likesKey(userId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveLikes(userId, ids) {
  if (!isAvailable()) return SAVE_RESULT.UNAVAILABLE;
  try {
    window.localStorage.setItem(likesKey(userId), JSON.stringify(ids));
    return SAVE_RESULT.OK;
  } catch (error) {
    return isQuotaError(error) ? SAVE_RESULT.QUOTA : SAVE_RESULT.FAILED;
  }
}

/** Declined pre-account surveys are kept aside, never deleted. */
export function keepUnclaimed(surveys) {
  try {
    window.localStorage.setItem(`${STORAGE_KEY}:unclaimed-${Date.now()}`, JSON.stringify(surveys));
    return true;
  } catch {
    return false;
  }
}

export function clear() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function approximateSize() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? raw.length : 0;
  } catch {
    return 0;
  }
}
