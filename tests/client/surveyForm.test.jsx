import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

/** No walking route service in tests: every distance stays a straight line unless one is remembered. */
const noRoute = vi.fn(async () => ({ ok: false, status: 503, json: async () => null }));

/** Fresh modules for each test: the store reads storage once, at import. */
async function load() {
  vi.resetModules();
  vi.stubGlobal('fetch', noRoute);
  // The Survey guide opens by itself on a first visit; these tests are not about it.
  localStorage.setItem('roomcompare:survey-guide-seen', 'true');
  const store = await import('../../client/src/data/store.js');
  const { SurveyFormPage } = await import('../../client/src/pages/SurveyFormPage.jsx');
  const { ConfirmDialog } = await import('../../client/src/components/feedback/ConfirmDialog.jsx');
  const guidance = await import('../../client/src/content/guidance.js');
  const route = await import('../../client/src/services/walkingRoute.js');
  const surveyForm = await import('../../client/src/utils/surveyForm.js');
  const open = (id) =>
    render(
      <>
        <SurveyFormPage params={id ? { id } : {}} />
        <ConfirmDialog />
      </>,
    );
  return { store, open, route, ...guidance, ...surveyForm };
}

const text = (node) => node?.textContent.trim();
const form = () => document.getElementById('survey-form');
const type = (control, value) => fireEvent.change(control, { target: { value } });
const section = (n) => form().querySelector(`[data-section="${n}"]`);

const saved = {
  id: 'svy-scored',
  ownerId: 'me',
  status: 'draft',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  kos: {
    name: 'Kos Scored',
    type: 'mixed',
    kosLocation: { lat: -7.95, lng: 112.61, label: 'Lowokwaru, Malang' },
    campusLocation: { lat: -7.952, lng: 112.614, label: 'Universitas Brawijaya' },
    distanceKm: 1.8,
    distanceBasis: 'walking',
    rent: 1_250_000,
  },
  room: { lengthM: 3, widthM: 4, facilities: [], cleanliness: 4, internet: null, photoIds: [] },
  bathroom: { facilities: [], photoIds: [] },
  shared: { facilities: [], photoIds: [] },
  surroundings: [],
  additional: { security: 2, notes: 'Quiet street.', videoIds: [] },
};

/** Saves the form as a draft and hands back what the store now holds under that name. */
function saveDraft(store, name = 'Kos Draft') {
  if (!screen.getByLabelText('Kos name').value) type(screen.getByLabelText('Kos name'), name);
  fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
  return store.getState().surveys.find((survey) => survey.kos.name === (screen.queryByLabelText('Kos name')?.value || name));
}

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '#/surveys/new';
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('guidance on the survey form', () => {
  it('introduces every section, and puts a helper line under each field but the distance', async () => {
    const { open, SECTION_INTROS, FIELD_GUIDE } = await load();
    open();
    const intros = [1, 2, 3, 4, 5, 6].map((n) => text(section(n).querySelector('p')));
    expect(intros).toEqual(Object.values(SECTION_INTROS));

    const helpers = Object.values(FIELD_GUIDE).map((guide) => guide.helper).filter(Boolean);
    expect(helpers).toHaveLength(20);
    for (const helper of helpers) expect(screen.getAllByText(helper).length).toBeGreaterThan(0);
    // Removed at the user's request: only the status line describes the distance.
    expect(screen.getByLabelText('Distance to campus').getAttribute('aria-describedby')).toBe('f-distanceKm-status');
  });

  it('names each field by its label alone, with no required badges', async () => {
    const { open } = await load();
    open();
    expect(screen.getByLabelText('Kos name').id).toBe('f-name');
    expect(text(document.getElementById('kosLocation-label'))).toBe('Pin the kos');
    expect(form().textContent).not.toMatch(/\*|Required/);
    const group = form().querySelector('fieldset[data-field="cleanliness"]');
    expect(text(document.getElementById(group.getAttribute('aria-labelledby')))).toBe('Cleanliness');
  });

  it('counts the name and the notes as the user types, and flags going over', async () => {
    const { open } = await load();
    open();
    const count = () => document.getElementById('f-name-count');
    expect(text(count())).toBe('0/80');
    type(screen.getByLabelText('Kos name'), 'Kos Melati');
    expect(text(count())).toBe('10/80');

    const notes = () => document.getElementById('f-notes-count');
    expect(text(notes())).toBe('0/1,000');
    type(screen.getByLabelText('Additional notes'), 'x'.repeat(1001));
    expect(text(notes())).toBe('1,001/1,000');
    expect(notes().dataset.over).toBe('true');
    type(screen.getByLabelText('Additional notes'), 'x'.repeat(1000));
    expect(notes().dataset.over).toBeUndefined();
  });

  it('says what the chosen score means, and changes the description with the choice', async () => {
    const { open, rubricText } = await load();
    open();
    const group = (name) => form().querySelector(`fieldset[data-field="${name}"]`);
    const rubric = (name) => form().querySelector(`[data-rubric="${name}"]`);

    expect(text(rubric('cleanliness'))).toBe('');
    fireEvent.click(within(group('cleanliness')).getByLabelText('3 Good'));
    expect(text(rubric('cleanliness'))).toBe(rubricText('cleanliness', 3));
    fireEvent.click(within(group('cleanliness')).getByLabelText('1 Poor'));
    expect(text(rubric('cleanliness'))).toBe(rubricText('cleanliness', 1));

    fireEvent.click(within(group('internet')).getByLabelText('2 Fair'));
    expect(text(rubric('internet'))).toMatch(/Average Download 3–10 Mbps\.$/);
    // Choosing one score leaves the others' descriptions alone.
    expect(text(rubric('cleanliness'))).toBe(rubricText('cleanliness', 1));
  });

  it('reopens a saved survey with its scores described and its distance shown', async () => {
    const { store, open, rubricText } = await load();
    store.addSurvey(saved);
    open('svy-scored');
    expect(text(form().querySelector('[data-rubric="cleanliness"]'))).toBe(rubricText('cleanliness', 4));
    expect(text(form().querySelector('[data-rubric="security"]'))).toBe(rubricText('security', 2));
    expect(text(form().querySelector('[data-rubric="internet"]'))).toBe('');
    expect(screen.getByLabelText('Distance to campus').value).toBe('1,8 km');
    expect(text(document.getElementById('f-notes-count'))).toBe('13/1,000');
  });

  it('leaves the distance empty until both pins are set', async () => {
    const { open } = await load();
    open();
    const distance = screen.getByLabelText('Distance to campus');
    expect(distance.value).toBe('');
    expect(distance.placeholder).toBe('Fills in once both pins are set');
  });

  it('marks a distance saved as a straight line, as every older survey is', async () => {
    const { store, open } = await load();
    const { distanceBasis, ...older } = saved.kos;
    store.addSurvey({ ...saved, kos: { ...older, distanceKm: 0.5 } });
    open('svy-scored');
    // The walk is asked for at once; with no route service it stays the straight line, marked.
    await waitFor(() => expect(screen.getByLabelText('Distance to campus').value).toBe('0,5 km (straight line)'));
    expect(text(document.getElementById('f-distanceKm-status'))).toMatch(/^The walking route can’t be reached right now/);
  });

  // OpenStreetMap's licence asks for its attribution wherever its data is used.
  it('credits OpenStreetMap for the route', async () => {
    const { open } = await load();
    open();
    const credit = form().querySelector('[data-credit]');
    expect(text(credit)).toBe('Route data © OpenStreetMap contributors');
    // "Fix the map" was removed at the user's request.
    expect(credit.querySelector('a')).toBeNull();
  });
});

describe('the area a kos and its campus are in', () => {
  it('has no field to type it in', async () => {
    const { open } = await load();
    open();
    expect(document.getElementById('f-kosLocation')).toBeNull();
    expect(document.getElementById('f-campusLocation')).toBeNull();
    expect(form().textContent).not.toMatch(/Kos location name|Campus name/);
  });

  it('keeps the area of a saved survey through an edit', async () => {
    const { store, open } = await load();
    store.addSurvey(saved);
    open('svy-scored');
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    const { kosLocation, campusLocation } = store.findSurvey('svy-scored').kos;
    expect([kosLocation.label, campusLocation.label]).toEqual(['Lowokwaru, Malang', 'Universitas Brawijaya']);
  });

  it('falls back to the typed address when nothing was looked up', async () => {
    const { store, open } = await load();
    open();
    type(screen.getByLabelText('Kos address'), 'Jl. Sumbersari 12, Malang');
    const survey = saveDraft(store);
    expect(survey.kos.kosLocation).toMatchObject({ label: 'Jl. Sumbersari 12, Malang', address: 'Jl. Sumbersari 12, Malang' });
  });
});

describe('the distance a survey is saved with', () => {
  it('is the straight line, saying so, until a walking route is known for its pins', async () => {
    const { route, readSurvey, formValues } = await load();
    route.resetRoutes();
    const { distanceBasis, ...unwalked } = saved.kos;
    const values = formValues({ ...saved, kos: unwalked });
    expect(readSurvey(values).kos).toMatchObject({ distanceKm: 0.5, distanceBasis: 'straight' });
    route.rememberWalkingKm(saved.kos.kosLocation, saved.kos.campusLocation, 1.8);
    expect(readSurvey(values).kos).toMatchObject({ distanceKm: 1.8, distanceBasis: 'walking' });
  });

  it('is nothing at all without both pins', async () => {
    const { readSurvey, formValues } = await load();
    expect(readSurvey(formValues()).kos).toMatchObject({ distanceKm: null, distanceBasis: null });
  });

  it('keeps a saved walk for the same pins, even with the route service unreachable', async () => {
    const { store, open } = await load();
    store.addSurvey(saved);
    open('svy-scored');
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(store.findSurvey('svy-scored').kos).toMatchObject({ distanceKm: 1.8, distanceBasis: 'walking' });
  });
});

describe('the owner or security phone', () => {
  it('is a phone field in the Kos information section', async () => {
    const { open } = await load();
    open();
    const input = screen.getByLabelText('Owner or security phone');
    expect(input.getAttribute('type')).toBe('tel');
    expect(input.getAttribute('inputmode')).toBe('tel');
    expect(input.closest('[data-section]').dataset.section).toBe('1');
  });

  it('saves the number as typed, and nothing when left blank', async () => {
    const { store, open } = await load();
    open();
    expect(saveDraft(store, 'Kos Blank').kos.contactPhone).toBeNull();
  });

  it('trims the number it saves, keeping its own form', async () => {
    const { store, open } = await load();
    open();
    type(screen.getByLabelText('Owner or security phone'), '  0812-3456-7890 ');
    expect(saveDraft(store).kos.contactPhone).toBe('0812-3456-7890');
  });

  it('reopens a saved survey with its number shown', async () => {
    const { store, open } = await load();
    store.addSurvey({ ...saved, kos: { ...saved.kos, contactPhone: '0899-1122-3344' } });
    open('svy-scored');
    expect(screen.getByLabelText('Owner or security phone').value).toBe('0899-1122-3344');
  });
});

describe('the monthly rent', () => {
  const field = () => document.getElementById('f-rent');
  const slider = () => form().querySelector('[data-slider-for="f-rent"]');

  it('has a slider from Rp 0 to Rp 10.000.000 under the typed field, read by nothing', async () => {
    const { store, open } = await load();
    open();
    expect([slider().type, slider().min, slider().max, slider().step]).toEqual(['range', '0', '10000000', '50000']);
    expect(slider().getAttribute('aria-label')).toBe('Monthly rent');
    expect(slider().name).toBe('');
    expect(slider().closest('[data-field]')).toBe(field().closest('[data-field]'));
    expect(within(field().closest('[data-field]')).getByText('Rp 10.000.000')).toBeTruthy();
    expect(saveDraft(store).kos.rent).toBeNull();
  });

  it('types the amount the slider is moved to', async () => {
    const { store, open } = await load();
    open();
    fireEvent.change(slider(), { target: { value: '1500000' } });
    expect(field().value).toBe('1.500.000');
    expect(slider().getAttribute('aria-valuetext')).toBe('Rp 1.500.000');
    expect(saveDraft(store).kos.rent).toBe(1_500_000);
  });

  it('follows a typed amount, resting at its end past Rp 10.000.000 while the field keeps the figure', async () => {
    const { store, open } = await load();
    open();
    fireEvent.input(field(), { target: { value: '2500000' } });
    expect(field().value).toBe('2.500.000');
    expect(slider().value).toBe('2500000');
    fireEvent.input(field(), { target: { value: '15000000' } });
    expect(slider().value).toBe('10000000');
    expect(field().value).toBe('15.000.000');
    expect(slider().getAttribute('aria-valuetext')).toBe('Rp 15.000.000');
    expect(saveDraft(store).kos.rent).toBe(15_000_000);
  });

  it('opens a saved survey with the slider at its rent', async () => {
    const { store, open } = await load();
    store.addSurvey(saved);
    open('svy-scored');
    expect(field().value).toBe('1.250.000');
    expect(slider().value).toBe('1250000');
    expect(slider().getAttribute('aria-valuetext')).toBe('Rp 1.250.000');
  });
});

describe('the room length and width', () => {
  const field = (key) => document.getElementById(`f-${key}`);
  const list = (key) => document.getElementById(`f-${key}-list`);
  const selected = (key) => [...list(key).querySelectorAll('[aria-selected="true"]')].map((o) => o.dataset.value);
  const key = (control, name, init = {}) => fireEvent.keyDown(control, { key: name, ...init });

  it('is one field each, with a 1–10 m list it opens, and no second control to read', async () => {
    const { open } = await load();
    open();
    for (const name of ['lengthM', 'widthM']) {
      const input = field(name);
      expect([input.type, input.inputMode, input.getAttribute('role'), input.name]).toEqual(['text', 'decimal', 'combobox', name]);
      expect(input.getAttribute('aria-controls')).toBe(list(name).id);
      expect(input.getAttribute('aria-expanded')).toBe('false');
      expect(list(name).hidden).toBe(true);
      expect([...list(name).querySelectorAll('[role="option"]')].map(text)).toEqual(Array.from({ length: 10 }, (_, i) => `${i + 1} m`));
    }
    expect(screen.getByRole('button', { name: 'Show Room length (m) options' }).tabIndex).toBe(-1);
    expect(form().querySelector('select')).toBeNull();
  });

  it('opens from the chevron, and types the metres picked', async () => {
    const { store, open } = await load();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Show Room length (m) options' }));
    expect(list('lengthM').hidden).toBe(false);
    expect(field('lengthM').getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(list('lengthM').querySelector('[data-value="3"]'));
    expect(field('lengthM').value).toBe('3');
    expect(list('lengthM').hidden).toBe(true);
    expect(selected('lengthM')).toEqual(['3']);
    expect(saveDraft(store).room.lengthM).toBe(3);
  });

  it('takes a typed size the list does not hold, like the number field it replaced', async () => {
    const { store, open } = await load();
    open();
    type(field('widthM'), '4');
    expect(selected('widthM')).toEqual(['4']);
    type(field('widthM'), '3,5');
    expect(field('widthM').value).toBe('3.5');
    expect(selected('widthM')).toEqual([]);
    type(field('widthM'), '9.5m');
    expect(field('widthM').value).toBe('9.5');
    expect(saveDraft(store).room.widthM).toBe(9.5);
  });

  it('works from the keyboard: ↓ opens on the current size, Enter picks, Escape leaves it be', async () => {
    const { open } = await load();
    open();
    const input = field('lengthM');
    type(input, '5');
    key(input, 'ArrowDown');
    expect(list('lengthM').hidden).toBe(false);
    expect(input.getAttribute('aria-activedescendant')).toBe('f-lengthM-list-5');
    key(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe('f-lengthM-list-6');
    key(input, 'Escape');
    expect(list('lengthM').hidden).toBe(true);
    expect(input.value).toBe('5');
    key(input, 'ArrowDown');
    key(input, 'ArrowUp');
    key(input, 'Enter');
    expect(input.value).toBe('4');
    expect(list('lengthM').hidden).toBe(true);
  });

  it('opens a saved survey with its sizes shown and marked in the lists', async () => {
    const { store, open } = await load();
    store.addSurvey(saved);
    open('svy-scored');
    expect([field('lengthM').value, field('widthM').value]).toEqual(['3', '4']);
    expect([selected('lengthM'), selected('widthM')]).toEqual([['3'], ['4']]);
  });
});

describe('the survey id', () => {
  // A form left through the nav once passed its draft's id to the next new survey, which overwrote it.
  it('is new for every new survey form, however the last one was left', async () => {
    const { store, open } = await load();
    const first = open();
    const a = saveDraft(store, 'Kos Satu');
    first.unmount();
    open();
    const b = saveDraft(store, 'Kos Dua');
    expect(a.id).toMatch(/^svy-/);
    expect(b.id).toMatch(/^svy-/);
    expect(b.id).not.toBe(a.id);
    expect(store.getState().surveys.filter((s) => s.kos.name.startsWith('Kos ')).length).toBeGreaterThanOrEqual(2);
  });

  it("stays the survey's own when it is edited", async () => {
    const { store, open } = await load();
    store.addSurvey(saved);
    const before = store.getState().surveys.length;
    open('svy-scored');
    type(screen.getByLabelText('Kos name'), 'Kos Scored Again');
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(store.getState().surveys).toHaveLength(before);
    expect(store.findSurvey('svy-scored').kos.name).toBe('Kos Scored Again');
  });
});

describe('saving and leaving', () => {
  it('holds a published survey to the publishing rules, naming each field and section', async () => {
    const { store, open } = await load();
    open();
    type(screen.getByLabelText('Kos name'), 'Kos Half');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(screen.getByRole('alert').textContent).toContain('fields need attention before this survey can be published.');
    expect(text(section(1).querySelector('[data-section-errors]'))).toBe('3 to fix');
    expect(text(section(2).querySelector('[data-section-errors]'))).toBe('2 to fix');
    expect(text(document.getElementById('error-rent'))).toBe('Enter the monthly rent in rupiah.');
    // The first problem in form order takes focus: the kos type's first choice.
    expect(document.activeElement).toBe(within(form().querySelector('fieldset[data-field="type"]')).getByLabelText('Male'));
    expect(store.getState().surveys.find((s) => s.kos.name === 'Kos Half')).toBeUndefined();
  });

  it('keeps a draft to the draft rules: only a name', async () => {
    const { store, open } = await load();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    expect(text(document.getElementById('error-name'))).toBe('Enter a name so you can find this kos later.');
    type(screen.getByLabelText('Kos name'), 'Kos Cukup');
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    expect(store.getState().surveys[0]).toMatchObject({ status: 'draft', kos: { name: 'Kos Cukup' } });
    expect(window.location.hash).toBe('#/surveys');
  });

  it('clears an error once its field is fixed and left, and counts the section down', async () => {
    const { open } = await load();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(text(section(1).querySelector('[data-section-errors]'))).toBe('4 to fix');
    const name = screen.getByLabelText('Kos name');
    fireEvent.input(name, { target: { value: 'Kos Fixed' } });
    expect(document.getElementById('error-name')).not.toBeNull();
    fireEvent.blur(name);
    expect(document.getElementById('error-name')).toBeNull();
    expect(text(section(1).querySelector('[data-section-errors]'))).toBe('3 to fix');
    fireEvent.click(within(form().querySelector('fieldset[data-field="type"]')).getByLabelText('Mixed'));
    expect(text(section(1).querySelector('[data-section-errors]'))).toBe('2 to fix');
  });

  it('asks before saving a second kos under a name already used', async () => {
    const { store, open } = await load();
    store.addSurvey(saved);
    open();
    type(screen.getByLabelText('Kos name'), 'kos scored');
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    expect(await screen.findByText('You already have a survey with this name')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save anyway' })));
    expect(store.getState().surveys.filter((s) => s.kos.name.toLowerCase() === 'kos scored')).toHaveLength(2);
  });

  it('leaves an untouched form without asking, and asks about a touched one', async () => {
    const { open } = await load();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(window.location.hash).toBe('#/surveys');
    expect(document.querySelector('dialog[open]')).toBeNull();

    window.location.hash = '#/surveys/new';
    document.body.innerHTML = '';
    const again = await load();
    again.open();
    fireEvent.input(screen.getByLabelText('Kos name'), { target: { value: 'Kos Setengah' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard your changes?')).toBeTruthy();
  });

  it('autosaves a new survey as a draft once it has a name, quietly', async () => {
    vi.useFakeTimers();
    const { store, open } = await load();
    open();
    const name = screen.getByLabelText('Kos name');
    fireEvent.input(name, { target: { value: 'Kos Otomatis' } });
    type(name, 'Kos Otomatis');
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(store.getState().surveys[0]).toMatchObject({ status: 'draft', kos: { name: 'Kos Otomatis' } });
    expect(screen.getByText(/^Draft saved/)).toBeTruthy();
  });

  it('never autosaves an edit: Cancel promises the saved version is untouched', async () => {
    vi.useFakeTimers();
    const { store, open } = await load();
    store.addSurvey(saved);
    open('svy-scored');
    fireEvent.input(screen.getByLabelText('Kos name'), { target: { value: 'Changed' } });
    type(screen.getByLabelText('Kos name'), 'Changed');
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(store.findSurvey('svy-scored').kos.name).toBe('Kos Scored');
  });
});
