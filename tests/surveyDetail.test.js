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
    // The same galleries the sections held, so loading, the lightbox and "not on this device" work.
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

describe('the breadcrumbs on the survey page', () => {
  const crumbs = (host) => host.querySelector('nav.breadcrumbs');
  const firstLink = (nav) => {
    const link = nav.querySelector('a');
    return [link.textContent.trim(), link.getAttribute('href')];
  };

  it('lead back to My surveys from your own survey, in place of a Back button', async () => {
    const { store, renderSurveyDetail } = await load();
    store.addSurvey(survey());
    const host = render(renderSurveyDetail({ id: 'svy-media' }));
    const nav = crumbs(host);
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
    expect(firstLink(nav)).toEqual(['My surveys', '#/surveys']);
    expect(nav.querySelector('[aria-current="page"]').textContent.trim()).toBe('Kos Media');
    expect([...host.querySelectorAll('a, button')].some((el) => el.textContent.trim() === 'Back')).toBe(false);
  });

  it('lead back to Community from a community survey', async () => {
    const { store, renderSurveyDetail } = await load();
    const { id, kos } = store.getState().communitySurveys[0];
    const nav = crumbs(render(renderSurveyDetail({ id })));
    expect(firstLink(nav)).toEqual(['Community', '#/community']);
    expect(nav.querySelector('[aria-current="page"]').textContent.trim()).toBe(kos.name);
  });
});

describe('a community survey page', () => {
  it('says who shared it, which the card leaves out', async () => {
    const { store, renderSurveyDetail } = await load();
    const { id, kos, ownerName } = store.getState().communitySurveys[0];
    const lede = render(renderSurveyDetail({ id })).querySelector('.page-head__lede');
    expect(lede.textContent.trim()).toBe(`${kos.kosLocation.label} · Shared by ${ownerName}`);
  });
});

describe('the facility checklists on the survey page', () => {
  it('mark what is there ✓ and what is not ✗, saying which to a screen reader', async () => {
    const { store, renderSurveyDetail } = await load();
    const withBathroom = survey();
    withBathroom.bathroom.facilities = ['Indoor bathroom'];
    store.addSurvey(withBathroom);
    const bathroom = [...render(renderSurveyDetail({ id: 'svy-media' })).querySelectorAll('section.section')].find(
      (s) => s.querySelector('h2').textContent.trim() === 'Bathroom',
    );
    const rows = [...bathroom.querySelectorAll('.checklist__item')].map((row) => [
      row.querySelector('.checklist__mark').textContent,
      row.querySelector('.visually-hidden').textContent,
    ]);
    expect(rows).toContainEqual(['✓', 'present']);
    expect(rows).toContainEqual(['✗', 'not available']);
    expect(rows.some(([mark]) => mark === '—')).toBe(false);
  });
});

describe('the section headings on the survey page', () => {
  it('each carry their own icon, which screen readers skip', async () => {
    const { store, renderSurveyDetail } = await load();
    store.addSurvey(survey());
    const heads = [...render(renderSurveyDetail({ id: 'svy-media' })).querySelectorAll('section.section h2')];

    expect(heads.map((h) => h.textContent.trim())).toEqual([
      'Kos information', 'Room', 'Bathroom', 'Shared facilities', 'Surroundings', 'Additional information', 'Photos and videos',
    ]);
    for (const h of heads) {
      const icon = h.querySelector('.section__icon');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.querySelector('svg')).not.toBeNull();
    }
    expect(new Set(heads.map((h) => h.querySelector('svg').innerHTML)).size).toBe(heads.length);
  });

  it('keeps the id the photos panel is labelled by', async () => {
    const { store, renderSurveyDetail } = await load();
    store.addSurvey(survey());
    const host = render(renderSurveyDetail({ id: 'svy-media' }));
    expect(host.querySelector('#media-title').textContent.trim()).toBe('Photos and videos');
    expect(panelOf(host)).not.toBeNull();
  });
});

describe('the owner or security phone on the survey page', () => {
  const kosInfo = (host) =>
    [...host.querySelectorAll('section.section')].find((s) => s.querySelector('h2').textContent.trim() === 'Kos information');
  const phoneRow = (host) =>
    [...kosInfo(host).querySelectorAll('.defn')].find(
      (row) => row.querySelector('.defn__label').textContent.trim() === 'Owner or security phone',
    );

  it('shows the number as a link that dials it', async () => {
    const { store, renderSurveyDetail } = await load();
    const withPhone = survey();
    withPhone.kos.contactPhone = '0812-3456-7890';
    store.addSurvey(withPhone);
    const link = phoneRow(render(renderSurveyDetail({ id: 'svy-media' }))).querySelector('a');
    expect(link.getAttribute('href')).toBe('tel:081234567890');
    expect(link.textContent.trim()).toBe('0812-3456-7890');
  });

  it('reads "Not recorded" when there is no number', async () => {
    const { store, renderSurveyDetail } = await load();
    store.addSurvey(survey());
    const row = phoneRow(render(renderSurveyDetail({ id: 'svy-media' })));
    expect(row.querySelector('a')).toBeNull();
    expect(row.querySelector('.unrecorded').textContent.trim()).toBe('Not recorded');
  });
});

describe('the star on a community survey page', () => {
  it('is an icon that follows the starred state', async () => {
    const { store, renderSurveyDetail } = await load();
    const { id, kos } = store.getState().communitySurveys[0];
    const star = () => render(renderSurveyDetail({ id })).querySelector('[data-action="toggle-star"]');

    const before = star();
    expect(before.textContent.trim()).toBe('');
    expect(before.getAttribute('aria-label')).toBe(`Star ${kos.name}`);
    expect(before.getAttribute('aria-pressed')).toBe(String(store.isStarred(id)));

    store.toggleStar(id);
    expect(star().getAttribute('aria-pressed')).toBe(String(store.isStarred(id)));
    expect(star().getAttribute('aria-pressed')).not.toBe(before.getAttribute('aria-pressed'));
  });

  it('is not on your own survey, which has Edit and Delete as named icons', async () => {
    const { store, renderSurveyDetail } = await load();
    store.addSurvey(survey());
    const actions = render(renderSurveyDetail({ id: 'svy-media' })).querySelector('.page-head__actions');
    expect(actions.querySelector('[data-action="toggle-star"]')).toBeNull();
    const edit = actions.querySelector('a[href="#/surveys/svy-media/edit"]');
    const remove = actions.querySelector('[data-action="ask-delete"]');
    expect([edit.getAttribute('aria-label'), edit.textContent.trim()]).toEqual(['Edit Kos Media', '']);
    expect([remove.getAttribute('aria-label'), remove.textContent.trim()]).toEqual(['Delete Kos Media', '']);
  });
});

describe('Add to compare on the survey page', () => {
  const addButton = (host) => host.querySelector('.page-head__actions [data-action="toggle-compare"]');

  // Only published surveys can be compared.
  it('is not offered on a draft', async () => {
    const { store, renderSurveyDetail } = await load();
    store.addSurvey(survey());
    expect(addButton(render(renderSurveyDetail({ id: 'svy-media' })))).toBeNull();
  });

  it('is offered once the survey is published, and on a community survey', async () => {
    const { store, renderSurveyDetail } = await load();
    store.addSurvey({ ...survey(), status: 'published' });
    expect(addButton(render(renderSurveyDetail({ id: 'svy-media' }))).textContent.trim()).toBe('Add to compare');
    const { id } = store.getState().communitySurveys[0];
    expect(addButton(render(renderSurveyDetail({ id })))).not.toBeNull();
  });
});
