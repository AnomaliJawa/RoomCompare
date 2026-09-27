import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEY, SCHEMA_VERSION } from '../src/storage.js';

/**
 * The store reads storage once, at import. Each test therefore seeds
 * localStorage first and then imports a fresh copy of the module.
 */
async function freshStore() {
  vi.resetModules();
  return import('../src/store.js');
}

function stored() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  localStorage.clear();
});

describe('first run', () => {
  it('seeds sample surveys and writes them straight away', async () => {
    const store = await freshStore();
    expect(store.getState().surveys.length).toBeGreaterThan(0);
    expect(stored().schemaVersion).toBe(SCHEMA_VERSION);
    expect(stored().surveys.length).toBe(store.getState().surveys.length);
  });

  it('does not persist community surveys, which are reference data', async () => {
    const store = await freshStore();
    expect(store.getState().communitySurveys.length).toBeGreaterThan(0);
    expect(stored().communitySurveys).toBeUndefined();
  });
});

describe('returning with stored data', () => {
  it('loads what was saved rather than re-seeding', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, surveys: [{ id: 'only-one', kos: { name: 'Solo' } }], starredIds: [] }),
    );
    const store = await freshStore();
    expect(store.getState().surveys).toHaveLength(1);
    expect(store.getState().surveys[0].kos.name).toBe('Solo');
  });

  it('keeps an emptied list empty instead of resurrecting the samples', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, surveys: [], starredIds: [] }),
    );
    const store = await freshStore();
    expect(store.getState().surveys).toHaveLength(0);
    expect(store.getState().storageNotice).toBeNull();
  });
});

describe('unreadable storage', () => {
  it('starts fresh, keeps the unreadable copy, and says so', async () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    const store = await freshStore();

    expect(store.getState().surveys.length).toBeGreaterThan(0);
    expect(store.getState().storageNotice).toMatch(/could not be read/i);

    const quarantined = Object.keys(localStorage).filter((key) => key.startsWith(`${STORAGE_KEY}:corrupt-`));
    expect(quarantined).toHaveLength(1);
    expect(localStorage.getItem(quarantined[0])).toBe('{not valid json');
  });

  it('treats an unrecognised shape the same way', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, surveys: 'nope' }));
    const store = await freshStore();
    expect(store.getState().surveys.length).toBeGreaterThan(0);
    expect(store.getState().storageNotice).toBeTruthy();
  });
});

describe('writes', () => {
  const draft = { id: 'new-1', ownerId: 'me', status: 'draft', kos: { name: 'Added' }, room: {}, bathroom: {}, shared: {}, surroundings: [], additional: {} };

  it('adds to the front and persists', async () => {
    const store = await freshStore();
    store.addSurvey(draft);
    expect(store.getState().surveys[0].id).toBe('new-1');
    expect(stored().surveys[0].id).toBe('new-1');
  });

  it('updates in place and stamps the time', async () => {
    const store = await freshStore();
    const target = store.getState().surveys[0];
    const before = target.updatedAt;
    store.updateSurvey(target.id, { kos: { ...target.kos, name: 'Renamed' } });
    const after = store.findSurvey(target.id);
    expect(after.kos.name).toBe('Renamed');
    expect(after.updatedAt).not.toBe(before);
    expect(stored().surveys.find((s) => s.id === target.id).kos.name).toBe('Renamed');
  });

  it('reports where a deleted survey sat, so undo can put it back', async () => {
    const store = await freshStore();
    const second = store.getState().surveys[1];
    const result = store.deleteSurvey(second.id);
    expect(result.index).toBe(1);
    expect(result.removed.id).toBe(second.id);
    expect(store.findSurvey(second.id)).toBeNull();
  });

  it('restores to the original position', async () => {
    const store = await freshStore();
    const second = store.getState().surveys[1];
    const { removed, index } = store.deleteSurvey(second.id);
    store.restoreSurvey(removed, index);
    expect(store.getState().surveys[1].id).toBe(second.id);
    expect(stored().surveys[1].id).toBe(second.id);
  });

  it('drops a deleted survey from the comparison', async () => {
    const store = await freshStore();
    const target = store.getState().surveys[0];
    store.toggleCompare(target.id);
    expect(store.getState().compareSelection).toContain(target.id);
    store.deleteSurvey(target.id);
    expect(store.getState().compareSelection).not.toContain(target.id);
  });

  it('ignores an unknown id', async () => {
    const store = await freshStore();
    expect(store.deleteSurvey('nope')).toBeNull();
    expect(store.updateSurvey('nope', {})).toBeNull();
  });
});

describe('comparison selection', () => {
  it('holds at most three and says when it is full', async () => {
    const store = await freshStore();
    const ids = store.getState().surveys.slice(0, 4).map((s) => s.id);
    expect(store.toggleCompare(ids[0])).toBe(true);
    expect(store.toggleCompare(ids[1])).toBe(true);
    expect(store.toggleCompare(ids[2])).toBe(true);
    expect(store.toggleCompare(ids[3])).toBe(false);
    expect(store.getState().compareSelection).toHaveLength(3);
  });

  it('toggles a selected kos back off, freeing a slot', async () => {
    const store = await freshStore();
    const ids = store.getState().surveys.slice(0, 3).map((s) => s.id);
    ids.forEach((id) => store.toggleCompare(id));
    expect(store.toggleCompare(ids[0])).toBe(true);
    expect(store.getState().compareSelection).toHaveLength(2);
  });

  it('is session state, not written to storage', async () => {
    const store = await freshStore();
    store.toggleCompare(store.getState().surveys[0].id);
    expect(stored().compareSelection).toBeUndefined();
  });
});

describe('undoing Start over', () => {
  it('puts the selection back, and the open table with it', async () => {
    const store = await freshStore();
    const ids = store.getState().surveys.slice(0, 3).map((s) => s.id);
    ids.forEach((id) => store.toggleCompare(id));
    store.showComparison();

    store.clearCompare();
    store.restoreCompare(ids, true);
    expect(store.getState().compareSelection).toEqual(ids);
    expect(store.getState().compareShown).toBe(true);
  });

  it('leaves out a kos deleted in the meantime, and keeps the table shut below two', async () => {
    const store = await freshStore();
    const ids = store.getState().surveys.slice(0, 2).map((s) => s.id);
    ids.forEach((id) => store.toggleCompare(id));
    store.showComparison();

    store.clearCompare();
    store.deleteSurvey(ids[1]);
    store.restoreCompare(ids, true);
    expect(store.getState().compareSelection).toEqual([ids[0]]);
    expect(store.getState().compareShown).toBe(false);
  });

  it('never restores more than the comparison holds', async () => {
    const store = await freshStore();
    const ids = store.getState().surveys.slice(0, 5).map((s) => s.id);
    store.restoreCompare(ids, false);
    expect(store.getState().compareSelection).toHaveLength(3);
  });
});

describe('starring', () => {
  it('is kept apart from the survey record', async () => {
    const store = await freshStore();
    const community = store.getState().communitySurveys[1];
    store.toggleStar(community.id);
    expect(store.isStarred(community.id)).toBe(true);
    expect(stored().starredIds).toContain(community.id);
    expect(community.starred).toBeUndefined();
  });

  it('does not decide what can be compared', async () => {
    const store = await freshStore();
    const community = store.getState().communitySurveys[1];
    const comparable = () => store.comparableSurveys().some((s) => s.id === community.id);
    expect(store.isStarred(community.id)).toBe(false);
    expect(comparable()).toBe(true);
    store.toggleStar(community.id);
    expect(comparable()).toBe(true);
  });
});

describe('comparison candidates', () => {
  // A new account starts with no surveys, and was offered only the one
  // community kos starred on a first visit.
  it('are every survey of your own and every community survey, by source', async () => {
    const store = await freshStore();
    const { surveys, communitySurveys } = store.getState();
    const { own, community } = store.compareCandidates();
    expect(own.map((s) => s.id)).toEqual(surveys.map((s) => s.id));
    expect(community.map((s) => s.id)).toEqual(communitySurveys.map((s) => s.id));
    expect(store.comparableSurveys().map((s) => s.id)).toEqual([...own, ...community].map((s) => s.id));
  });

  it('can be compared across both sources at once', async () => {
    const store = await freshStore();
    const { own, community } = store.compareCandidates();
    const picked = [own[0].id, community[2].id, community[5].id];
    picked.forEach((id) => expect(store.toggleCompare(id)).toBe(true));
    expect(store.showComparison()).toBe(true);
    expect(store.selectedForCompare().map((s) => s.id)).toEqual(picked);
  });

  it('come back after Start over, community ones included', async () => {
    const store = await freshStore();
    const { own, community } = store.compareCandidates();
    const picked = [own[0].id, community[3].id];
    picked.forEach((id) => store.toggleCompare(id));
    store.clearCompare();
    store.restoreCompare(picked, true);
    expect(store.getState().compareSelection).toEqual(picked);
  });
});

describe('subscribers', () => {
  it('are notified on a data change and can unsubscribe', async () => {
    const store = await freshStore();
    const seen = vi.fn();
    const off = store.subscribe(seen);
    store.setSearch('melati');
    expect(seen).toHaveBeenCalledTimes(1);
    off();
    store.setSearch('');
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe('failed writes', () => {
  it('keep the change in memory and report it', async () => {
    const store = await freshStore();
    const realSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key) {
      if (String(key).startsWith(STORAGE_KEY)) {
        throw new DOMException('full', 'QuotaExceededError');
      }
      return realSetItem.apply(this, arguments);
    };

    store.addSurvey({ id: 'over-quota', ownerId: 'me', status: 'draft', kos: { name: 'Too big' }, room: {}, bathroom: {}, shared: {}, surroundings: [], additional: {} });

    expect(store.findSurvey('over-quota')).not.toBeNull();
    expect(store.getState().storageStatus).toBe('quota');
    expect(store.getState().storageNotice).toMatch(/storage is full/i);

    Storage.prototype.setItem = realSetItem;
    store.deleteSurvey('over-quota');
    expect(store.getState().storageStatus).toBe('ok');
  });
});
