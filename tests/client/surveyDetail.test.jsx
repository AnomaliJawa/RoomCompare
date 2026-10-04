import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

/** Fresh modules for each test: the store reads storage once, at import. */
async function load() {
  vi.resetModules();
  const store = await import('../../client/src/data/store.js');
  const { SurveyDetailPage } = await import('../../client/src/pages/SurveyDetailPage.jsx');
  const { ConfirmDialog } = await import('../../client/src/components/feedback/ConfirmDialog.jsx');
  const { ToastRegion } = await import('../../client/src/components/feedback/ToastRegion.jsx');
  const open = (id) =>
    render(
      <>
        <SurveyDetailPage params={{ id }} />
        <ConfirmDialog />
        <ToastRegion />
      </>,
    );
  return { store, open };
}

const survey = ({ room = [], bathroom = [], shared = [], videos = [] } = {}) => ({
  id: 'svy-media',
  ownerId: 'me',
  status: 'draft',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  kos: {
    name: 'Kos Media',
    type: 'mixed',
    kosLocation: { lat: -7.94, lng: 112.62, label: 'Lowokwaru, Malang' },
    campusLocation: null,
    distanceKm: null,
    rent: 1_250_000,
  },
  room: { lengthM: null, widthM: null, facilities: [], cleanliness: null, internet: null, photoIds: room },
  bathroom: { facilities: [], photoIds: bathroom },
  shared: { facilities: [], photoIds: shared },
  surroundings: [],
  additional: { security: null, notes: '', videoIds: videos },
});

const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim();
const panelOf = (container) => container.querySelector('section[aria-labelledby="media-title"]');
const sections = (container) => [...container.querySelectorAll('section')].filter((s) => s.querySelector(':scope > div > h2'));
const sectionNamed = (container, title) => sections(container).find((s) => text(s.querySelector('h2')) === title);
const rowOf = (container, label) => container.querySelector(`[data-defn="${label}"]`);
const actions = (container) => container.querySelector('[data-page-actions]');

beforeEach(() => localStorage.clear());

describe('photos and videos on the survey page', () => {
  it('sit in one panel after the recorded sections, grouped in the order of the form', async () => {
    const { store, open } = await load();
    store.addSurvey(survey({ room: ['p1', 'p2'], shared: ['p3'], videos: ['v1'] }));
    const { container } = open('svy-media');

    expect(sections(container).map((s) => text(s.querySelector('h2')))).toEqual([
      'Kos information', 'Room', 'Bathroom', 'Shared facilities', 'Surroundings', 'Additional information', 'Photos and videos',
    ]);
    const panel = panelOf(container);
    expect(text(within(panel).getByText('3 photos, 1 video'))).toBe('3 photos, 1 video');
    expect([...panel.querySelectorAll('h3')].map(text)).toEqual(['Room', 'Bathroom', 'Shared facilities', 'Videos']);
    expect([...panel.querySelectorAll('[data-gallery]')].map((g) => g.dataset.gallery)).toEqual(['photo', 'photo', 'video']);
    // An empty group still says so: nothing recorded is not the same as hidden.
    expect(panel.textContent).toContain('No bathroom photos recorded.');
  });

  it('leaves no photos or videos in the other sections', async () => {
    const { store, open } = await load();
    store.addSurvey(survey({ room: ['p1'], bathroom: ['p2'], shared: ['p3'], videos: ['v1'] }));
    const { container } = open('svy-media');
    expect(container.querySelectorAll('[data-gallery]')).toHaveLength(4);
    expect(panelOf(container).querySelectorAll('[data-gallery]')).toHaveLength(4);
  });

  it('says so once when nothing was recorded, instead of once per section', async () => {
    const { store, open } = await load();
    store.addSurvey(survey());
    const { container } = open('svy-media');
    const panel = panelOf(container);
    expect(within(panel).getByText('No photos or videos recorded.')).toBeTruthy();
    expect(panel.querySelector('[data-gallery]')).toBeNull();
    expect(container.textContent).not.toMatch(/No (room|bathroom|shared facility) photos recorded|No videos recorded/);
  });

  it('counts in the singular where there is one', async () => {
    const { store, open } = await load();
    store.addSurvey(survey({ bathroom: ['p1'] }));
    const { container } = open('svy-media');
    expect(within(panelOf(container)).getByText('1 photo')).toBeTruthy();
  });
});

describe('the breadcrumbs on the survey page', () => {
  it('lead back to My surveys from your own survey, in place of a Back button', async () => {
    const { store, open } = await load();
    store.addSurvey(survey());
    open('svy-media');
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'My surveys' }).getAttribute('href')).toBe('#/surveys');
    expect(text(nav.querySelector('[aria-current="page"]'))).toBe('Kos Media');
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('lead back to Community from a community survey', async () => {
    const { store, open } = await load();
    const { id, kos } = store.getState().communitySurveys[0];
    open(id);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Community' }).getAttribute('href')).toBe('#/community');
    expect(text(nav.querySelector('[aria-current="page"]'))).toBe(kos.name);
  });
});

describe('a community survey page', () => {
  it('says who shared it, which the card leaves out', async () => {
    const { store, open } = await load();
    const { id, kos, ownerName } = store.getState().communitySurveys[0];
    const { container } = open(id);
    expect(text(container.querySelector('[data-lede]'))).toBe(`${kos.kosLocation.label} · Shared by ${ownerName}`);
  });
});

describe('the facility checklists on the survey page', () => {
  it('mark what is there ✓ and what is not ✗, saying which to a screen reader', async () => {
    const { store, open } = await load();
    const withBathroom = survey();
    withBathroom.bathroom.facilities = ['Indoor bathroom'];
    store.addSurvey(withBathroom);
    const { container } = open('svy-media');
    const rows = [...sectionNamed(container, 'Bathroom').querySelectorAll('li')].map((row) => [
      row.querySelector('[data-mark]').textContent,
      row.querySelector('.sr-only').textContent,
    ]);
    expect(rows).toContainEqual(['✓', 'present']);
    expect(rows).toContainEqual(['✗', 'not available']);
    expect(rows.some(([mark]) => mark === '—')).toBe(false);
  });
});

describe('the section headings on the survey page', () => {
  it('each carry their own icon, which screen readers skip', async () => {
    const { store, open } = await load();
    store.addSurvey(survey());
    const { container } = open('svy-media');
    const heads = sections(container).map((s) => s.querySelector('h2'));
    for (const h of heads) {
      const icon = h.querySelector('[data-section-icon]');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.querySelector('svg')).not.toBeNull();
    }
    expect(new Set(heads.map((h) => h.querySelector('svg').innerHTML)).size).toBe(heads.length);
  });

  it('keeps the id the photos panel is labelled by', async () => {
    const { store, open } = await load();
    store.addSurvey(survey());
    const { container } = open('svy-media');
    expect(text(document.getElementById('media-title'))).toBe('Photos and videos');
    expect(panelOf(container)).not.toBeNull();
  });
});

describe('the owner or security phone on the survey page', () => {
  it('shows the number as a link that dials it', async () => {
    const { store, open } = await load();
    const withPhone = survey();
    withPhone.kos.contactPhone = '0812-3456-7890';
    store.addSurvey(withPhone);
    const { container } = open('svy-media');
    const link = rowOf(container, 'Owner or security phone').querySelector('a');
    expect(link.getAttribute('href')).toBe('tel:081234567890');
    expect(text(link)).toBe('0812-3456-7890');
  });

  it('reads "Not recorded" when there is no number', async () => {
    const { store, open } = await load();
    store.addSurvey(survey());
    const { container } = open('svy-media');
    const row = rowOf(container, 'Owner or security phone');
    expect(row.querySelector('a')).toBeNull();
    expect(text(row.querySelector('dd'))).toBe('Not recorded');
    expect(row.querySelector('dd span').className).toContain('italic');
  });
});

describe('the star on a community survey page', () => {
  it('is an icon that follows the starred state, and says so', async () => {
    const { store, open } = await load();
    const { id, kos } = store.getState().communitySurveys[0];
    open(id);
    const star = () => screen.getByRole('button', { name: `Star ${kos.name}` });
    const before = star().getAttribute('aria-pressed');
    expect(before).toBe(String(store.isStarred(id)));
    expect(star().textContent.trim()).toBe('');

    fireEvent.click(star());
    expect(star().getAttribute('aria-pressed')).not.toBe(before);
    expect(star().getAttribute('aria-pressed')).toBe(String(store.isStarred(id)));
    expect(await screen.findByText(store.isStarred(id) ? `${kos.name} starred` : `${kos.name} unstarred`)).toBeTruthy();
  });

  it('sits beside a like button whose count follows your like', async () => {
    const { store, open } = await load();
    store.setUser({ id: 'user-ana', email: 'ana@example.test', name: 'Ana' });
    const { id, likes, kos } = store.getState().communitySurveys[0];
    const { container } = open(id);
    const like = () => within(actions(container)).getByRole('button', { name: new RegExp(`^Like ${kos.name}`) });
    expect([like().getAttribute('aria-pressed'), like().querySelector('[data-like-count]').textContent]).toEqual(['false', String(likes)]);
    fireEvent.click(like());
    expect([like().getAttribute('aria-pressed'), like().querySelector('[data-like-count]').textContent]).toEqual(['true', String(likes + 1)]);
  });

  it('is not on your own survey, which has Edit and Delete as named icons', async () => {
    const { store, open } = await load();
    store.addSurvey(survey());
    const { container } = open('svy-media');
    const bar = actions(container);
    expect(within(bar).queryByRole('button', { name: /^Star / })).toBeNull();
    expect(within(bar).queryByRole('button', { name: /^Like / })).toBeNull();
    const edit = within(bar).getByRole('link', { name: 'Edit Kos Media' });
    expect([edit.getAttribute('href'), edit.textContent.trim()]).toEqual(['#/surveys/svy-media/edit', '']);
    expect(within(bar).getByRole('button', { name: 'Delete Kos Media' }).textContent.trim()).toBe('');
  });
});

describe('deleting from the survey page', () => {
  it('asks first, goes back to My surveys, and can be undone', async () => {
    const { store, open } = await load();
    store.addSurvey(survey());
    window.location.hash = '#/surveys/svy-media';
    open('svy-media');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Kos Media' }));
    expect(await screen.findByText('Delete this survey?')).toBeTruthy();
    expect(screen.getByText('Kos Media will be removed from your surveys.')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete' })));
    expect(store.findSurvey('svy-media')).toBeNull();
    expect(window.location.hash).toBe('#/surveys');
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Undo' })));
    expect(store.findSurvey('svy-media')).not.toBeNull();
    expect(await screen.findByText('Kos Media restored')).toBeTruthy();
  });

  it('keeps the survey when the question is answered Keep', async () => {
    const { store, open } = await load();
    store.addSurvey(survey());
    open('svy-media');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Kos Media' }));
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Keep' })));
    expect(store.findSurvey('svy-media')).not.toBeNull();
  });
});

describe('Add to compare on the survey page', () => {
  // Only published surveys can be compared.
  it('is not offered on a draft', async () => {
    const { store, open } = await load();
    store.addSurvey(survey());
    open('svy-media');
    expect(screen.queryByRole('button', { name: 'Add to compare' })).toBeNull();
  });

  it('is offered once the survey is published, and on a community survey', async () => {
    const { store, open } = await load();
    store.addSurvey({ ...survey(), status: 'published' });
    const first = open('svy-media');
    fireEvent.click(screen.getByRole('button', { name: 'Add to compare' }));
    expect(screen.getByRole('button', { name: 'In comparison' })).toBeTruthy();
    first.unmount();
    open(store.getState().communitySurveys[0].id);
    expect(screen.getByRole('button', { name: 'Add to compare' })).toBeTruthy();
  });
});

describe('Kos information on the survey page', () => {
  it('matches the form: no Location or Campus rows, with the area still under the name', async () => {
    const { store, open } = await load();
    store.addSurvey(survey());
    const { container } = open('svy-media');
    const labels = [...sectionNamed(container, 'Kos information').querySelectorAll('dt')].map(text);
    expect(labels).toEqual(['Type', 'Address', 'Pinned at', 'Campus', 'Distance to campus', 'Monthly rent', 'Owner or security phone']);
    expect(text(container.querySelector('[data-lede]'))).toBe('Lowokwaru, Malang');
  });

  it('opens the pin in Google Maps, in a new tab', async () => {
    const { store, open } = await load();
    store.addSurvey(survey());
    const { container } = open('svy-media');
    const link = rowOf(container, 'Pinned at').querySelector('a');
    expect(text(link)).toBe('-7.940000, 112.620000');
    expect(link.getAttribute('href')).toBe('https://www.google.com/maps/search/?api=1&query=-7.94%2C112.62');
    expect([link.getAttribute('target'), link.getAttribute('rel')]).toEqual(['_blank', 'noopener']);
    expect(link.getAttribute('aria-label')).toBe('-7.940000, 112.620000, open in Google Maps');
  });

  it('names the campus as typed, or as the lookup found it, so the distance says where to', async () => {
    const { store, open } = await load();
    const campus = (campusLocation) => {
      store.addSurvey({ ...survey(), id: 'svy-campus', kos: { ...survey().kos, campusLocation } });
      const view = open('svy-campus');
      const shown = text(rowOf(view.container, 'Campus').querySelector('dd'));
      view.unmount();
      store.deleteSurvey('svy-campus');
      return shown;
    };
    expect(campus({ lat: -7.95, lng: 112.61, label: 'Universitas Brawijaya, Ketawanggede', address: 'Universitas Brawijaya' })).toBe('Universitas Brawijaya');
    expect(campus({ lat: -7.95, lng: 112.61, label: 'Universitas Brawijaya', address: null })).toBe('Universitas Brawijaya');
    expect(campus(null)).toBe('Not recorded');
  });

  it('says plainly when the survey is not there', async () => {
    const { open } = await load();
    open('svy-gone');
    expect(screen.getByText('That survey is not here')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to my surveys' }).getAttribute('href')).toBe('#/surveys');
  });
});
