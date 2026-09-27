import { describe, it, expect, beforeEach, vi } from 'vitest';

/** Fresh modules: each load is a new visit to the app. */
async function load() {
  vi.resetModules();
  return import('../src/components/surveyGuide.js');
}

// jsdom has no <dialog> behaviour: open and close as a browser would.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  localStorage.clear();
  document.body.innerHTML = '<button id="help">?</button><dialog id="app-survey-guide"></dialog>';
});

const dialog = () => document.getElementById('app-survey-guide');
const text = (node) => node.textContent.replace(/\s+/g, ' ').trim();

describe('the Survey guide', () => {
  it('opens by itself the first time, and not again on this device', async () => {
    const guide = await load();
    expect(guide.maybeShowSurveyGuide()).toBe(true);
    expect(dialog().open).toBe(true);
    dialog().close();

    expect(guide.maybeShowSurveyGuide()).toBe(false);
    const nextVisit = await load();
    expect(nextVisit.maybeShowSurveyGuide()).toBe(false);
    expect(dialog().open).toBe(false);
  });

  it('still shows only once per visit where storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const guide = await load();
    expect(guide.maybeShowSurveyGuide()).toBe(true);
    dialog().close();
    expect(guide.maybeShowSurveyGuide()).toBe(false);
  });

  it('says what to bring and ask, and the steps on site in order', async () => {
    const guide = await load();
    guide.openSurveyGuide();

    const sections = [...dialog().querySelectorAll('.guide-dialog__section')];
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
    const guide = await load();
    guide.initSurveyGuide();
    const help = document.getElementById('help');

    expect(guide.openSurveyGuide(help)).toBe(true);
    expect(dialog().open).toBe(true);
    dialog().close();
    expect(document.activeElement).toBe(help);
  });
});

describe('the ? on the survey form', () => {
  it('sits beside the title of both the new and the edit form', async () => {
    vi.resetModules();
    const store = await import('../src/store.js');
    const { renderSurveyForm } = await import('../src/features/surveyForm.js');
    const help = () => document.querySelector('.page-head__title [data-action="open-survey-guide"]');

    document.body.innerHTML = String(renderSurveyForm());
    expect(help().getAttribute('aria-label')).toBe('Survey guide');
    expect(help().type).toBe('button');

    store.addSurvey({
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
    document.body.innerHTML = String(renderSurveyForm({ id: 'svy-guide' }));
    expect(text(document.querySelector('.page-head__title h1'))).toBe('Edit survey');
    expect(help()).not.toBeNull();
  });
});
