/**
 * IndexedDB store for photo and video blobs.
 *
 * Survey records live in localStorage and hold only photoIds; the binary data
 * lives here. The PRD allows ten photos per section across four sections, so a
 * single survey can carry forty images — localStorage holds strings only, so
 * they would have to be base64-encoded (inflating them by about a third)
 * inside the same few megabytes that hold every survey record. A couple of
 * phone photos would exhaust it.
 *
 * Every call resolves rather than rejecting on a missing database: if storage
 * is blocked, photos cannot be kept, but nothing else about the app should
 * break.
 */

const DB_NAME = 'roomcompare';
const DB_VERSION = 1;
const STORE = 'media';
const SURVEY_INDEX = 'surveyId';

let dbPromise = null;
let unavailableReason = null;

export function mediaUnavailableReason() {
  return unavailableReason;
}

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      // Accessing indexedDB can itself throw when site data is blocked.
      unavailableReason = error?.message ?? 'IndexedDB is not available';
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        // Makes cascade delete a single index query rather than a full scan.
        store.createIndex(SURVEY_INDEX, 'surveyId', { unique: false });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgrading the schema would otherwise block it forever.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      unavailableReason = request.error?.message ?? 'IndexedDB could not be opened';
      resolve(null);
    };

    request.onblocked = () => {
      unavailableReason = 'Another RoomCompare tab is holding the database open';
      resolve(null);
    };
  });

  return dbPromise;
}

export async function isAvailable() {
  return (await openDatabase()) !== null;
}

/** Wrap one transaction, resolving with whatever `work` produced. */
async function withStore(mode, work) {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    let transaction;
    try {
      transaction = db.transaction(STORE, mode);
    } catch (error) {
      unavailableReason = error?.message ?? 'Transaction could not be started';
      resolve(null);
      return;
    }

    const store = transaction.objectStore(STORE);
    let result;

    try {
      result = work(store);
    } catch (error) {
      unavailableReason = error?.message ?? 'Media operation failed';
      resolve(null);
      return;
    }

    transaction.oncomplete = () => resolve(result?.value ?? result ?? null);
    transaction.onabort = transaction.onerror = () => {
      unavailableReason = transaction.error?.message ?? 'Media transaction failed';
      resolve(null);
    };
  });
}

function requestValue(request) {
  const box = { value: null };
  request.onsuccess = () => {
    box.value = request.result ?? null;
  };
  return box;
}

/* --- Writes -------------------------------------------------------------- */

/**
 * Store one asset. Returns its id, or null when media storage is unavailable
 * so the caller can report the failure for that file alone.
 */
export async function putMedia(record) {
  const saved = await withStore('readwrite', (store) => {
    store.put(record);
    return { value: record.id };
  });
  return saved;
}

export async function deleteMedia(id) {
  return withStore('readwrite', (store) => {
    store.delete(id);
    return { value: true };
  });
}

/** Remove every asset belonging to a survey. Called when a survey is deleted. */
export async function deleteMediaForSurvey(surveyId) {
  return withStore('readwrite', (store) => {
    const box = { value: 0 };
    const request = store.index(SURVEY_INDEX).openKeyCursor(IDBKeyRange.only(surveyId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      store.delete(cursor.primaryKey);
      box.value += 1;
      cursor.continue();
    };
    return box;
  });
}

export async function clearAllMedia() {
  return withStore('readwrite', (store) => {
    store.clear();
    return { value: true };
  });
}

/* --- Reads --------------------------------------------------------------- */

export async function getMedia(id) {
  return withStore('readonly', (store) => requestValue(store.get(id)));
}

/** Fetch several assets in one transaction, in the order the ids were given. */
export async function getMediaMany(ids) {
  if (!ids || !ids.length) return [];
  const found = await withStore('readonly', (store) => {
    const box = { value: new Map() };
    ids.forEach((id) => {
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) box.value.set(id, request.result);
      };
    });
    return box;
  });
  if (!found) return [];
  return ids.map((id) => found.get(id)).filter(Boolean);
}

export async function getMediaForSurvey(surveyId) {
  return (
    (await withStore('readonly', (store) =>
      requestValue(store.index(SURVEY_INDEX).getAll(IDBKeyRange.only(surveyId))),
    )) ?? []
  );
}

export async function countMedia() {
  return (await withStore('readonly', (store) => requestValue(store.count()))) ?? 0;
}

/**
 * Browser-reported usage. Unlike localStorage, IndexedDB can be evicted under
 * storage pressure, so it is worth being able to show how close to the limit
 * the user is.
 */
export async function estimateUsage() {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage: usage ?? 0, quota: quota ?? 0 };
  } catch {
    return null;
  }
}

/* --- Object URLs ---------------------------------------------------------
   Every createObjectURL holds its blob in memory until revoked, so a gallery
   that navigates away without revoking leaks the full image set. Views take
   urls from here and release them on unmount. */

const urls = new Map();

export function urlFor(record) {
  if (!record?.blob) return null;
  if (urls.has(record.id)) return urls.get(record.id);
  const url = URL.createObjectURL(record.blob);
  urls.set(record.id, url);
  return url;
}

export function releaseUrl(id) {
  const url = urls.get(id);
  if (!url) return;
  URL.revokeObjectURL(url);
  urls.delete(id);
}

export function releaseAllUrls() {
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls.clear();
}
