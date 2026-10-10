import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MediaUploader } from '../../client/src/components/form/MediaUploader.jsx';
import { MediaGallery } from '../../client/src/components/survey/PhotoGallery.jsx';
import { loadMedia } from '../../client/src/data/media.js';
import { MAX_PHOTOS_PER_SECTION } from '../../client/src/constants.js';

// jsdom has no IndexedDB, so no file is on this device, as for a survey synced from another phone.

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

afterEach(() => vi.unstubAllGlobals());

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

const roomGallery = (ids) => (
  <MediaGallery groups={[{ title: 'Room', one: '1 room photo', many: '{count} room photos', none: 'room photos', ids }]} />
);

async function roomUploader(ids) {
  const onChange = vi.fn();
  const view = render(<MediaUploader section="room" label="Room photos" ids={ids} onChange={onChange} surveyId="svy-a" />);
  await settle();
  return { ...view, onChange };
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
    await roomUploader(['seed:room-1-1']);
    expect(screen.getByRole('img').getAttribute('alt')).toBe('room-1-1.jpg');
    expect(screen.queryByText('Not on this device')).toBeNull();
  });
});

describe('photos added on another device', () => {
  it('stay in the form, so saving an edit here does not take them away', async () => {
    const { container } = await roomUploader(['p1', 'p2']);
    expect(container.querySelector('[data-count]').textContent).toBe(`2 of ${MAX_PHOTOS_PER_SECTION}`);
    expect(screen.getAllByText('Not on this device')).toHaveLength(2);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('can still be removed, which is a change', async () => {
    const { onChange } = await roomUploader(['p1', 'p2']);
    const remove = screen.getAllByRole('button', { name: 'Remove photo not on this device' })[0];
    fireEvent.click(remove);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['p2']);
    expect(screen.getByRole('status').textContent).toBe('Photo removed. It is deleted when you save.');
  });

  it('are named on the survey page rather than reported lost', async () => {
    render(roomGallery(['p1', 'p2']));
    await settle();
    expect(screen.getByRole('status').textContent).toBe(
      '2 photos are not on this device. Photos and videos stay on the device they were added on.',
    );
  });
});

describe('the uploader', () => {
  it('says when a section is full, and takes no more', async () => {
    const ids = Array.from({ length: MAX_PHOTOS_PER_SECTION }, (_, i) => `p${i}`);
    await roomUploader(ids);
    const drop = screen.getByRole('button', { name: /Maximum of 10 reached/ });
    expect(drop.disabled).toBe(true);
  });

  it('holds the large photo’s place while the files load', () => {
    const { container } = render(roomGallery(['p1', 'p2']));
    expect(container.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe('Loading 2 files…');
  });
});

describe('opening the form', () => {
  it('is not a change: Cancel on an untouched form does not ask', async () => {
    // The first paint lands after the form's dirty flag starts clean, so it must not count as the user's.
    const { onChange } = await roomUploader([]);
    expect(onChange).not.toHaveBeenCalled();
  });
});
