import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

/** Fresh modules: each load is a new visit to the app. */
async function load() {
  vi.resetModules();
  return import('../../client/src/components/form/SurveyGuide.jsx');
}

async function form(id) {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => null })));
  const store = await import('../../client/src/data/store.js');
  const { SurveyFormPage } = await import('../../client/src/pages/SurveyFormPage.jsx');
  return { store, render: (params = {}) => render(<SurveyFormPage params={params} />) };
}

const text = (node) => node.textContent.replace(/\s+/g, ' ').trim();
const guideOpen = () => document.querySelector('dialog[aria-labelledby="survey-guide-title"]')?.open ?? false;

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('the Survey guide', () => {
  it('opens by itself on the first new survey, and not again on this device', async () => {
    const first = await form();
    const view = first.render();
    expect(guideOpen()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(guideOpen()).toBe(false);
    view.unmount();

    const nextVisit = await form();
    nextVisit.render();
    expect(guideOpen()).toBe(false);
  });

  it('still shows only once per visit where storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const guide = await load();
    expect(guide.firstSurveyGuide()).toBe(true);
    expect(guide.firstSurveyGuide()).toBe(false);
  });

  it('says what to bring and ask, and the steps on site in order', async () => {
    const { SurveyGuide } = await load();
    render(<SurveyGuide open onClose={() => {}} />);
    const sections = [...document.querySelectorAll('[data-guide-section]')];
    expect(sections.map((section) => text(section.querySelector('h3')))).toEqual(['Bring', 'Ask the owner', 'On site']);
    expect(sections[0].querySelectorAll('li')).toHaveLength(3);
    expect(sections[1].querySelectorAll('li')).toHaveLength(5);
    expect([...sections[2].querySelectorAll('ol > li')].map(text)).toEqual([
      'Save a draft as soon as you have the kos name.',
      'Fill in the rest as you walk around.',
      'Publish when all required fields are done.',
    ]);
  });

  it('reopens from the ?, and gives focus back to it when closed', async () => {
    localStorage.setItem('roomcompare:survey-guide-seen', 'true');
    const page = await form();
    page.render();
    const help = screen.getByRole('button', { name: 'Survey guide' });
    fireEvent.click(help);
    expect(guideOpen()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(guideOpen()).toBe(false);
    expect(document.activeElement).toBe(help);
  });
});

describe('the ? on the survey form', () => {
  it('sits beside the title of both the new and the edit form', async () => {
    localStorage.setItem('roomcompare:survey-guide-seen', 'true');
    const page = await form();
    const help = () => screen.getByRole('button', { name: 'Survey guide' });
    const created = page.render();
    expect(help().type).toBe('button');
    expect(help().closest('div').querySelector('h1').textContent).toBe('New survey');
    created.unmount();

    page.store.addSurvey({
      id: 'svy-guide',
      ownerId: 'me',
      status: 'draft',
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
      kos: { name: 'Kos Guide', type: null, kosLocation: null, campusLocation: null, distanceKm: null, rent: null },
      room: { lengthM: null, widthM: null, facilities: [], cleanliness: null, internet: null, photoIds: [] },
      bathroom: { facilities: [], photoIds: [] },
      shared: { facilities: [], photoIds: [] },
      surroundings: [],
      additional: { security: null, notes: '', videoIds: [] },
    });
    page.render({ id: 'svy-guide' });
    expect(help().closest('div').querySelector('h1').textContent).toBe('Edit survey');
  });
});
