import { describe, it, expect, vi, afterEach } from 'vitest';
import { uploaderField, mountUploaders } from '../src/components/mediaUploader.js';
import { galleryField, mountGalleries } from '../src/components/photoGallery.js';
import { loadMedia } from '../src/media.js';
import { MAX_PHOTOS_PER_SECTION } from '../src/constants.js';

// jsdom has no IndexedDB, so no file is on "this device" — exactly the case of
// a survey synced from the phone that took its photos. Only the record
// travels to the account; the files stay behind.

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function place(markup) {
  const host = document.createElement('div');
  host.innerHTML = String(markup);
  document.body.append(host);
  return host;
}

async function roomUploader(mediaIds) {
  const host = place(uploaderField({ section: 'room', label: 'Room photos', name: 'roomPhotoIds', mediaIds }));
  const onChange = vi.fn();
  mountUploaders(host, { surveyId: 'svy-a', onChange });
  await settle();
  return { host, onChange };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

/** The app's own sample files, served; anything else is a 404. */
function serveSamples(files = ['room-1-1', 'room-1-2', 'bathroom-2-1']) {
  const fetch = vi.fn(async (url) => {
    const name = decodeURIComponent(String(url).replace(/^seed-photos\//, '').replace(/\.jpg$/, ''));
    return files.includes(name)
      ? { ok: true, blob: async () => new Blob([name], { type: 'image/jpeg' }) }
      : { ok: false, blob: async () => null };
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('sample photos', () => {
  it('load from the files that ship with the app, in the order asked, beside stored ones', async () => {
    const fetch = serveSamples();
    const records = await loadMedia(['seed:room-1-1', 'p-stored', 'seed:bathroom-2-1']);
    expect(records.map((r) => [r.id, r.originalName])).toEqual([
      ['seed:room-1-1', 'room-1-1.jpg'],
      ['seed:bathroom-2-1', 'bathroom-2-1.jpg'],
    ]);
    expect(fetch).toHaveBeenCalledWith('seed-photos/room-1-1.jpg');
    // "p-stored" is looked up in this browser's storage, not fetched.
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('are fetched once per page, since the server tells the browser not to cache', async () => {
    const fetch = serveSamples();
    await loadMedia(['seed:room-1-2']);
    await loadMedia(['seed:room-1-2']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('are left out when a file cannot be loaded, and tried again later', async () => {
    const fetch = serveSamples([]);
    expect(await loadMedia(['seed:shared-9-9'])).toEqual([]);
    await loadMedia(['seed:shared-9-9']);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('show as photos in the form, not as files kept on another device', async () => {
    serveSamples();
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL: () => 'blob:sample', revokeObjectURL: () => {} }));
    const { host } = await roomUploader(['seed:room-1-1']);
    expect(host.querySelector('img.uploader__thumb').getAttribute('alt')).toBe('room-1-1.jpg');
    expect(host.querySelector('.uploader__elsewhere')).toBeNull();
    expect(host.querySelector('[data-ids]').value).toBe('seed:room-1-1');
  });
});

describe('photos added on another device', () => {
  it('stay in the form, so saving an edit here does not take them away', async () => {
    const { host } = await roomUploader(['p1', 'p2']);

    expect(host.querySelector('[data-ids]').value).toBe('p1,p2');
    expect(host.querySelector('[data-count]').textContent).toBe(`2 of ${MAX_PHOTOS_PER_SECTION}`);
    const tiles = [...host.querySelectorAll('.uploader__elsewhere')].map((tile) => tile.textContent);
    expect(tiles).toEqual(['Not on this device', 'Not on this device']);
    expect(host.querySelector('img')).toBeNull();
  });

  it('can still be removed, which is a change', async () => {
    const { host, onChange } = await roomUploader(['p1', 'p2']);
    const remove = host.querySelector('[data-remove="p1"]');
    expect(remove.getAttribute('aria-label')).toBe('Remove photo not on this device');

    remove.click();
    await settle();
    expect(host.querySelector('[data-ids]').value).toBe('p2');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('are named on the survey page rather than reported lost', async () => {
    const host = place(galleryField({ section: 'room', label: 'room photos', mediaIds: ['p1', 'p2'] }));
    await mountGalleries(host);
    expect(host.querySelector('[data-status]').textContent).toBe(
      '2 photos are not on this device. Photos and videos stay on the device they were added on.',
    );
  });
});

describe('opening the form', () => {
  it('is not a change: Cancel on an untouched form does not ask', async () => {
    // The first paint lands after the form resets its dirty flag, so it must
    // not report itself as the user's doing.
    const { onChange } = await roomUploader([]);
    expect(onChange).not.toHaveBeenCalled();
  });
});
