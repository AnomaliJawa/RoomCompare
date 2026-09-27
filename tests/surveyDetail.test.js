import { describe, it, expect, beforeEach, vi } from 'vitest';

/** Fresh modules for each test: the store reads storage once, at import. */
async function load() {
  vi.resetModules();
  const store = await import('../src/store.js');
  const { renderSurveyDetail } = await import('../src/features/surveyDetail.js');
  return { store, renderSurveyDetail };
}

function render(markup) {
  const host = document.createElement('div');
  host.innerHTML = String(markup);
  return host;
}

const survey = ({ room = [], bathroom = [], shared = [], videos = [] } = {}) => ({
  id: 'svy-media',
  ownerId: 'me',
  status: 'draft',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  kos: { name: 'Kos Media', type: 'mixed', kosLocation: { lat: -7.94, lng: 112.62, label: 'Lowokwaru, Malang' }, campusLocation: null, distanceKm: null, rent: 1_250_000 },
  room: { lengthM: null, widthM: null, facilities: [], cleanliness: null, internet: null, photoIds: room },
  bathroom: { facilities: [], photoIds: bathroom },
  shared: { facilities: [], photoIds: shared },
  surroundings: [],
  additional: { security: null, notes: '', videoIds: videos },
});

const panelOf = (host) => host.querySelector('section[aria-labelledby="media-title"]');

beforeEach(() => localStorage.clear());

describe('photos and videos on the survey page', () => {
  it('sit in one panel after the recorded sections, grouped in the order of the form', async () => {
    const { store, renderSurveyDetail } = await load();
    store.addSurvey(survey({ room: ['p1', 'p2'], shared: ['p3'], videos: ['v1'] }));
    const host = render(renderSurveyDetail({ id: 'svy-media' }));

    const headings = [...host.querySelectorAll('section.section h2')].map((h) => h.textContent.trim());
    expect(headings).toEqual([
      'Kos information', 'Room', 'Bathroom', 'Shared facilities', 'Surroundings', 'Additional information', 'Photos and videos',
    ]);

    const panel = panelOf(host);
    expect(panel.querySelector('.section__head .meta').textContent).toBe('3 photos, 1 video');
    expect([...panel.querySelectorAll('.media-group__title')].map((t) => t.textContent)).toEqual([
      'Room', 'Bathroom', 'Shared facilities', 'Videos',
    ]);
    // The same galleries the sections held, so loading, the lightbox and
    // "not on this device" work as before.
    const galleries = [...panel.querySelectorAll('[data-gallery]')].map((g) => [g.dataset.gallery, g.dataset.kind, g.dataset.ids]);
    expect(galleries).toEqual([['room', 'photo', 'p1,p2'], ['shared', 'photo', 'p3'], ['video', 'video', 'v1']]);
    // An empty group still says so: nothing recorded is not the same as hidden.
    expect(panel.textContent).toContain('No bathroom photos recorded.');
  });

  it('leaves no photos or videos in the other sections', async () => {
    const { store, renderSurveyDetail } = await load();
    store.addSurvey(survey({ room: ['p1'], bathroom: ['p2'], shared: ['p3'], videos: ['v1'] }));
    const host = render(renderSurveyDetail({ id: 'svy-media' }));
    const everywhere = host.querySelectorAll('[data-gallery]').length;
    expect(everywhere).toBe(4);
    expect(panelOf(host).querySelectorAll('[data-gallery]').length).toBe(everywhere);
  });

  it('says so once when nothing was recorded, instead of once per section', async () => {
    const { store, renderSurveyDetail } = await load();
    store.addSurvey(survey());
    const host = render(renderSurveyDetail({ id: 'svy-media' }));
    const panel = panelOf(host);
    expect(panel.querySelector('p.meta').textContent).toBe('No photos or videos recorded.');
    expect(panel.querySelector('.section__head .meta')).toBeNull();
    expect(panel.querySelector('.media-groups')).toBeNull();
    expect(host.textContent).not.toMatch(/No (room|bathroom|shared facility) photos recorded|No videos recorded/);
  });

  it('counts in the singular where there is one', async () => {
    const { store, renderSurveyDetail } = await load();
    store.addSurvey(survey({ bathroom: ['p1'] }));
    const panel = panelOf(render(renderSurveyDetail({ id: 'svy-media' })));
    expect(panel.querySelector('.section__head .meta').textContent).toBe('1 photo');
  });
});
