import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEY, SCHEMA_VERSION } from '../src/storage.js';

/** The store reads storage once, at import, so each test seeds first, then imports a fresh copy. */
async function freshStore() {
  vi.resetModules();
  return import('../src/store.js');
}

function stored() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

/** Ids of the user's own published surveys, the only own ones a comparison takes. */
const published = (store) => store.compareCandidates().own.map((s) => s.id);

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
    const ids = published(store).slice(0, 4);
    expect(store.toggleCompare(ids[0])).toBe(true);
    expect(store.toggleCompare(ids[1])).toBe(true);
    expect(store.toggleCompare(ids[2])).toBe(true);
    expect(store.toggleCompare(ids[3])).toBe(false);
    expect(store.getState().compareSelection).toHaveLength(3);
  });

  it('toggles a selected kos back off, freeing a slot', async () => {
    const store = await freshStore();
    const ids = published(store).slice(0, 3);
    ids.forEach((id) => store.toggleCompare(id));
    expect(store.toggleCompare(ids[0])).toBe(true);
    expect(store.getState().compareSelection).toHaveLength(2);
  });

  it('is session state, not written to storage', async () => {
    const store = await freshStore();
    store.toggleCompare(store.getState().surveys[0].id);
    expect(stored().compareSelection).toBeUndefined();
  });

  it('changes a kos in its own slot, so the others keep their columns', async () => {
    const store = await freshStore();
    const ids = published(store).slice(0, 4);
    ids.slice(0, 3).forEach((id) => store.toggleCompare(id));
    store.showComparison();
    expect(store.replaceInCompare(ids[1], ids[3])).toBe(true);
    expect(store.getState().compareSelection).toEqual([ids[0], ids[3], ids[2]]);
    expect(store.getState().compareShown).toBe(true);
  });

  it('refuses a change to a kos already in, or to a draft', async () => {
    const store = await freshStore();
    const ids = published(store).slice(0, 2);
    ids.forEach((id) => store.toggleCompare(id));
    const draft = store.getState().surveys.find((s) => s.status === 'draft');
    expect(store.replaceInCompare(ids[0], ids[1])).toBe(false);
    expect(store.replaceInCompare(ids[0], draft.id)).toBe(false);
    expect(store.getState().compareSelection).toEqual(ids);
  });
});

describe('undoing Start over', () => {
  it('puts the selection back, and the open table with it', async () => {
    const store = await freshStore();
    const ids = published(store).slice(0, 3);
    ids.forEach((id) => store.toggleCompare(id));
    store.showComparison();

    store.clearCompare();
    store.restoreCompare(ids, true);
    expect(store.getState().compareSelection).toEqual(ids);
    expect(store.getState().compareShown).toBe(true);
  });

  it('leaves out a kos deleted in the meantime, and keeps the table shut below two', async () => {
    const store = await freshStore();
    const ids = published(store).slice(0, 2);
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
    const ids = published(store).slice(0, 5);
    store.restoreCompare(ids, false);
    expect(store.getState().compareSelection).toHaveLength(3);
  });

  it('never restores a draft', async () => {
    const store = await freshStore();
    const draft = store.getState().surveys.find((s) => s.status === 'draft');
    store.restoreCompare([published(store)[0], draft.id], false);
    expect(store.getState().compareSelection).toEqual([published(store)[0]]);
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
  // A new account starts with no surveys, and was once offered only the one starred kos.
  it('are your published surveys and every community survey, by source, with the drafts counted', async () => {
    const store = await freshStore();
    const { surveys, communitySurveys } = store.getState();
    const { own, community, drafts } = store.compareCandidates();
    expect(own.map((s) => s.id)).toEqual(surveys.filter((s) => s.status === 'published').map((s) => s.id));
    expect(drafts).toBe(surveys.filter((s) => s.status === 'draft').length);
    expect(drafts).toBeGreaterThan(0);
    expect(community.map((s) => s.id)).toEqual(communitySurveys.map((s) => s.id));
    expect(store.comparableSurveys().map((s) => s.id)).toEqual([...own, ...community].map((s) => s.id));
  });

  // A draft is still being filled in; only publishing says a survey can be compared.
  it('leave drafts out, and refuse one asked for directly', async () => {
    const store = await freshStore();
    const draft = store.getState().surveys.find((s) => s.status === 'draft');
    expect(store.canCompare(draft.id)).toBe(false);
    expect(store.toggleCompare(draft.id)).toBe(false);
    expect(store.getState().compareSelection).toEqual([]);
  });

  it('take a draft once it is published', async () => {
    const store = await freshStore();
    const draft = store.getState().surveys.find((s) => s.status === 'draft');
    store.updateSurvey(draft.id, { status: 'published' });
    expect(store.canCompare(draft.id)).toBe(true);
    expect(store.toggleCompare(draft.id)).toBe(true);
    expect(store.compareCandidates().own.map((s) => s.id)).toContain(draft.id);
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

describe('likes', () => {
  const ana = { id: 'user-ana', email: 'ana@example.test', name: 'Ana' };
  const budi = { id: 'user-budi', email: 'budi@example.test', name: 'Budi' };
  const key = (user) => `${STORAGE_KEY}:likes:${user.id}`;

  it('count a community kos’s sample likes, plus one for your own', async () => {
    const store = await freshStore();
    store.setUser(ana);
    const kartika = store.getState().communitySurveys.find((s) => s.id === 'com-kartika');
    expect(store.likeCount('com-kartika')).toBe(kartika.likes);
    expect(store.toggleLike('com-kartika')).toBe(true);
    expect(store.isLiked('com-kartika')).toBe(true);
    expect(store.likeCount('com-kartika')).toBe(kartika.likes + 1);
    store.toggleLike('com-kartika');
    expect(store.likeCount('com-kartika')).toBe(kartika.likes);
  });

  it('give every community kos a sample count, and none to your own surveys', async () => {
    const store = await freshStore();
    store.setUser(ana);
    for (const survey of store.getState().communitySurveys) expect(Number.isInteger(survey.likes)).toBe(true);
    const own = store.getState().surveys[0].id;
    expect(store.toggleLike(own)).toBe(false);
    expect(store.likeCount(own)).toBeNull();
  });

  it('need an account, and are kept on this device under it', async () => {
    const store = await freshStore();
    expect(store.toggleLike('com-kartika')).toBe(false);
    store.setUser(ana);
    store.toggleLike('com-kartika');
    expect(JSON.parse(localStorage.getItem(key(ana)))).toEqual(['com-kartika']);
    expect(stored().likedIds).toBeUndefined();

    store.forgetAccount();
    expect(store.isLiked('com-kartika')).toBe(false);
    store.setUser(budi);
    expect(store.isLiked('com-kartika')).toBe(false);

    const nextVisit = await freshStore();
    nextVisit.setUser(ana);
    expect(nextVisit.isLiked('com-kartika')).toBe(true);
  });
});

describe('Best Match weights', () => {
  const ana = { id: 'user-ana', email: 'ana@example.test', name: 'Ana' };
  const budi = { id: 'user-budi', email: 'budi@example.test', name: 'Budi' };
  const custom = { price: 35, facilities: 20, cleanliness: 15, location: 15, distance: 3, security: 12 };
  const defaults = { price: 25, facilities: 20, cleanliness: 15, location: 15, distance: 13, security: 12 };
  const key = (user) => `${STORAGE_KEY}:weights:${user.id}`;

  it('are the defaults for an account that never set its own', async () => {
    const store = await freshStore();
    store.setUser(ana);
    expect(store.bestMatchWeights()).toEqual(defaults);
  });

  it('are kept on this device under the account, and come back at its next login', async () => {
    const store = await freshStore();
    store.setUser(ana);
    expect(store.setBestMatchWeights(custom)).toEqual({ ok: true, kept: true });
    expect(store.bestMatchWeights()).toEqual(custom);
    expect(JSON.parse(localStorage.getItem(key(ana)))).toEqual(custom);

    store.forgetAccount();
    expect(store.bestMatchWeights()).toEqual(defaults);
    // Logging out takes them off the screen, not off the device.
    expect(localStorage.getItem(key(ana))).not.toBeNull();

    const nextVisit = await freshStore();
    nextVisit.setUser(ana);
    expect(nextVisit.bestMatchWeights()).toEqual(custom);
  });

  it('belong to one account: another on the same device starts from the defaults', async () => {
    const store = await freshStore();
    store.setUser(ana);
    store.setBestMatchWeights(custom);
    store.forgetAccount();
    store.setUser(budi);
    expect(store.bestMatchWeights()).toEqual(defaults);
  });

  it('stay out of the surveys’ copy, which belongs to whoever logged in last', async () => {
    const store = await freshStore();
    store.setUser(ana);
    store.setBestMatchWeights(custom);
    expect(Object.keys(stored()).sort()).toEqual(['ownerId', 'schemaVersion', 'starredIds', 'surveys', 'updatedAt']);
  });

  it('are stored as the defaults when set back to them, so nothing is left behind', async () => {
    const store = await freshStore();
    store.setUser(ana);
    store.setBestMatchWeights(custom);
    expect(store.setBestMatchWeights({ ...defaults })).toEqual({ ok: true, kept: true });
    expect(localStorage.getItem(key(ana))).toBeNull();
    store.setBestMatchWeights(custom);
    store.setBestMatchWeights(null);
    expect(localStorage.getItem(key(ana))).toBeNull();
    expect(store.bestMatchWeights()).toEqual(defaults);
  });

  it('refuse a set that does not total 100%, keeping what was there', async () => {
    const store = await freshStore();
    store.setUser(ana);
    store.setBestMatchWeights(custom);
    const seen = vi.fn();
    store.subscribe(seen);
    expect(store.setBestMatchWeights({ ...custom, price: 40 })).toEqual({ ok: false, kept: false });
    expect(store.bestMatchWeights()).toEqual(custom);
    expect(seen).not.toHaveBeenCalled();
  });

  it('need someone logged in', async () => {
    const store = await freshStore();
    expect(store.setBestMatchWeights(custom)).toEqual({ ok: false, kept: false });
    expect(store.bestMatchWeights()).toEqual(defaults);
  });

  it('still apply when this browser cannot keep them, and say so', async () => {
    const store = await freshStore();
    store.setUser(ana);
    const realSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem() {
      throw new DOMException('full', 'QuotaExceededError');
    };
    try {
      expect(store.setBestMatchWeights(custom)).toEqual({ ok: true, kept: false });
    } finally {
      Storage.prototype.setItem = realSetItem;
    }
    expect(store.bestMatchWeights()).toEqual(custom);
  });

  it('ignore a saved entry that is not a valid set', async () => {
    localStorage.setItem(key(ana), JSON.stringify({ ...custom, price: 200 }));
    const store = await freshStore();
    store.setUser(ana);
    expect(store.bestMatchWeights()).toEqual(defaults);

    localStorage.setItem(key(ana), '{not json');
    store.setUser(ana);
    expect(store.bestMatchWeights()).toEqual(defaults);
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
