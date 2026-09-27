import { describe, it, expect, beforeEach, vi } from 'vitest';

// The real store and storage, against jsdom's localStorage; only the network
// is replaced.
vi.mock('../src/api.js', () => {
  class ApiError extends Error {
    constructor(status, message, errors = null) {
      super(message);
      this.status = status;
      this.errors = errors;
    }

    get offline() {
      return this.status === 0;
    }
  }
  return {
    ApiError,
    listSurveys: vi.fn(),
    putSurvey: vi.fn(),
    deleteSurvey: vi.fn(),
  };
});

const USER = { id: 'u1', name: 'Rahma', email: 'rahma@example.com' };

const survey = (id, name = `Kos ${id}`) => ({
  id,
  ownerId: 'me',
  status: 'draft',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  kos: { name, rent: 1_500_000 },
  room: { facilities: [], photoIds: [] },
  bathroom: { facilities: [], photoIds: [] },
  shared: { facilities: [], photoIds: [] },
  surroundings: [],
  additional: { notes: '' },
});

/** Fresh modules for each test: the store reads storage once, at import. */
async function load({ server = [] } = {}) {
  vi.resetModules();
  const api = await import('../src/api.js');
  api.listSurveys.mockReset().mockResolvedValue({ surveys: server });
  api.putSurvey.mockReset().mockResolvedValue(null);
  api.deleteSurvey.mockReset().mockResolvedValue(null);
  const store = await import('../src/store.js');
  const sync = await import('../src/sync.js');
  return { api, store, sync };
}

const cached = () => JSON.parse(localStorage.getItem('roomcompare:v1'));
const queued = (userId = USER.id) => JSON.parse(localStorage.getItem(`roomcompare:v1:pending:${userId}`) ?? '[]');

beforeEach(() => localStorage.clear());

describe('syncing an account', () => {
  it("makes the account's surveys the working copy, without sending them back", async () => {
    const { api, store, sync } = await load({ server: [survey('svy-a'), survey('svy-b')] });
    await expect(sync.start(USER)).resolves.toBe(true);

    expect(store.getState().surveys.map((s) => s.id)).toEqual(['svy-a', 'svy-b']);
    expect(cached().ownerId).toBe(USER.id);
    expect(api.putSurvey).not.toHaveBeenCalled();
  });

  it('sends every change to the account: added, edited, deleted', async () => {
    const { api, store, sync } = await load();
    await sync.start(USER);

    store.addSurvey(survey('svy-new'));
    await sync.flush();
    expect(api.putSurvey).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'svy-new' }));

    store.updateSurvey('svy-new', { kos: { name: 'Kos Baru', rent: 1_200_000 } });
    await sync.flush();
    expect(api.putSurvey).toHaveBeenLastCalledWith(expect.objectContaining({ kos: { name: 'Kos Baru', rent: 1_200_000 } }));

    store.deleteSurvey('svy-new');
    await sync.flush();
    expect(api.deleteSurvey).toHaveBeenCalledWith('svy-new');
    expect(sync.pendingCount()).toBe(0);
  });

  it('does not touch the network for a change that is not a survey', async () => {
    const { api, store, sync } = await load({ server: [survey('svy-a')] });
    await sync.start(USER);
    store.setSearch('melati');
    store.toggleCompare('svy-a');
    await sync.flush();
    expect(api.putSurvey).not.toHaveBeenCalled();
  });

  it('keeps changes made offline, says so, and sends them when the connection returns', async () => {
    const { api, store, sync } = await load();
    await sync.start(USER);
    api.putSurvey.mockRejectedValueOnce(new api.ApiError(0, 'unreachable'));

    store.addSurvey(survey('svy-offline'));
    await sync.flush();
    expect(sync.pendingCount()).toBe(1);
    expect(queued().map(([id]) => id)).toEqual(['svy-offline']);
    expect(store.getState().syncNotice).toMatch(/offline/);

    window.dispatchEvent(new Event('online'));
    await sync.flush();
    expect(api.putSurvey).toHaveBeenCalledTimes(2);
    expect(sync.pendingCount()).toBe(0);
    expect(queued()).toEqual([]);
    expect(store.getState().syncNotice).toBeNull();
  });

  it('sends what a closed tab left behind before reading the account back', async () => {
    localStorage.setItem(`roomcompare:v1:pending:${USER.id}`, JSON.stringify([['svy-left', { op: 'put', survey: survey('svy-left') }]]));
    const { api, sync } = await load({ server: [survey('svy-left')] });
    await sync.start(USER);

    expect(api.putSurvey).toHaveBeenCalledWith(expect.objectContaining({ id: 'svy-left' }));
    expect(api.putSurvey.mock.invocationCallOrder[0]).toBeLessThan(api.listSurveys.mock.invocationCallOrder[0]);
    expect(queued()).toEqual([]);
  });

  it("keeps this device's newer edit when it cannot be sent yet", async () => {
    const newer = survey('svy-x', 'Kos Newer');
    localStorage.setItem(`roomcompare:v1:pending:${USER.id}`, JSON.stringify([['svy-x', { op: 'put', survey: newer }]]));
    const { api, store, sync } = await load({ server: [survey('svy-x', 'Kos Older')] });
    api.putSurvey.mockRejectedValue(new api.ApiError(0, 'unreachable'));

    await sync.start(USER);
    expect(store.getState().surveys.map((s) => s.kos.name)).toEqual(['Kos Newer']);
    expect(sync.pendingCount()).toBe(1);
  });

  it('offers surveys recorded before accounts existed — never the samples', async () => {
    localStorage.setItem(
      'roomcompare:v1',
      JSON.stringify({ schemaVersion: 1, surveys: [survey('svy-melati'), survey('svy-mine', 'My own kos')], starredIds: [], ownerId: null }),
    );
    const { api, store, sync } = await load();
    const claimSurveys = vi.fn().mockResolvedValue(true);

    await sync.start(USER, { claimSurveys });
    await sync.flush();
    expect(claimSurveys).toHaveBeenCalledWith(1);
    expect(store.getState().surveys.map((s) => s.id)).toEqual(['svy-mine']);
    expect(api.putSurvey).toHaveBeenCalledWith(expect.objectContaining({ id: 'svy-mine' }));
  });

  it('keeps declined surveys aside on the device instead of deleting them', async () => {
    localStorage.setItem(
      'roomcompare:v1',
      JSON.stringify({ schemaVersion: 1, surveys: [survey('svy-mine', 'My own kos')], starredIds: [], ownerId: null }),
    );
    const { api, store, sync } = await load();
    await sync.start(USER, { claimSurveys: vi.fn().mockResolvedValue(false) });

    expect(store.getState().surveys).toEqual([]);
    expect(api.putSurvey).not.toHaveBeenCalled();
    const aside = Object.keys(localStorage).find((key) => key.startsWith('roomcompare:v1:unclaimed-'));
    expect(JSON.parse(localStorage.getItem(aside))[0].id).toBe('svy-mine');
  });

  it('hands over to logging in when the session ends, keeping the queue for later', async () => {
    const { api, store, sync } = await load();
    const onSessionEnded = vi.fn();
    await sync.start(USER, { onSessionEnded });
    api.putSurvey.mockRejectedValue(new api.ApiError(401, 'Log in to continue.'));

    store.addSurvey(survey('svy-late'));
    await sync.flush();
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
    expect(queued().map(([id]) => id)).toEqual(['svy-late']);
  });

  it('drops a change the server refuses, and says it was not saved', async () => {
    const { api, store, sync } = await load();
    await sync.start(USER);
    api.putSurvey.mockRejectedValueOnce(new api.ApiError(413, 'That survey is too large to save.'));

    store.addSurvey(survey('svy-huge', 'Kos Besar'));
    await sync.flush();
    expect(sync.pendingCount()).toBe(0);
    expect(store.getState().syncNotice).toBe('Kos Besar could not be saved to your account: That survey is too large to save.');
  });
});

describe('logging out', () => {
  it('takes the account off this device', async () => {
    const { store, sync } = await load({ server: [survey('svy-a')] });
    store.setUser(USER);
    await sync.start(USER);
    sync.stop();
    store.forgetAccount();

    expect(store.getState().user).toBeNull();
    expect(store.getState().surveys).toEqual([]);
    expect(cached()).toMatchObject({ surveys: [], ownerId: null });
  });
});
