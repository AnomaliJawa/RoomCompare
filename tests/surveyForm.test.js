import { describe, it, expect, beforeEach, vi } from 'vitest';

/** Fresh modules for each test: the store reads storage once, at import. */
async function load() {
  vi.resetModules();
  const store = await import('../src/store.js');
  const form = await import('../src/features/surveyForm.js');
  const guidance = await import('../src/content/guidance.js');
  return { store, ...form, ...guidance };
}

function show(markup) {
  document.body.innerHTML = String(markup);
  return document.body;
}

const text = (node) => node?.textContent.trim();

function type(control, value) {
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
}

function choose(form, name, value) {
  const radio = form.querySelector(`input[name="${name}"][value="${value}"]`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}

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

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('guidance on the survey form', () => {
  it('introduces every section, and puts a helper line under each field but the distance', async () => {
    const { renderSurveyForm, SECTION_INTROS, FIELD_GUIDE } = await load();
    const page = show(renderSurveyForm());

    expect([...page.querySelectorAll('.form-section__guide')].map(text)).toEqual(Object.values(SECTION_INTROS));

    const helpers = [...page.querySelectorAll('.field__hint, .uploader__drop-hint')].map(text).filter(Boolean);
    expect(helpers.sort()).toEqual(Object.values(FIELD_GUIDE).map((guide) => guide.helper).filter(Boolean).sort());
    expect(helpers).toHaveLength(22);
    // Removed at the user's request: only the status line describes the distance.
    const distance = page.querySelector('#f-distanceKm');
    expect(distance.getAttribute('aria-describedby')).toBe('f-distanceKm-status');
    expect(text(distance.closest('.field').querySelector('.field__hint'))).toBe('');
  });

  it('names each field by its label alone, with no required badges', async () => {
    const { renderSurveyForm } = await load();
    const page = show(renderSurveyForm());

    expect(page.querySelector('.req-badge')).toBeNull();
    expect(text(page.querySelector('label[for="f-name"]'))).toBe('Kos name');
    expect(text(page.querySelector('#kosLocation-label'))).toBe('Pin the kos');
    const group = page.querySelector('fieldset[data-field="cleanliness"]');
    expect(text(document.getElementById(group.getAttribute('aria-labelledby')))).toBe('Cleanliness');
  });

  it('counts the name and the notes as the user types, and flags going over', async () => {
    const { renderSurveyForm, attachGuidance } = await load();
    const page = show(renderSurveyForm());
    attachGuidance(page.querySelector('#survey-form'));

    expect(text(page.querySelector('#f-name-count'))).toBe('0/80');
    type(page.querySelector('#f-name'), 'Kos Melati');
    expect(text(page.querySelector('#f-name-count'))).toBe('10/80');

    const notes = page.querySelector('#f-notes-count');
    expect(text(notes)).toBe('0/1,000');
    type(page.querySelector('#f-notes'), 'x'.repeat(1001));
    expect(text(notes)).toBe('1,001/1,000');
    expect(notes.classList.contains('field__count--over')).toBe(true);
    type(page.querySelector('#f-notes'), 'x'.repeat(1000));
    expect(notes.classList.contains('field__count--over')).toBe(false);
  });

  it('says what the chosen score means, and changes the description with the choice', async () => {
    const { renderSurveyForm, attachGuidance, rubricText } = await load();
    const page = show(renderSurveyForm());
    const form = page.querySelector('#survey-form');
    attachGuidance(form);

    const rubric = page.querySelector('[data-rubric="cleanliness"]');
    expect(text(rubric)).toBe('');
    choose(form, 'cleanliness', 3);
    expect(text(rubric)).toBe(rubricText('cleanliness', 3));
    choose(form, 'cleanliness', 1);
    expect(text(rubric)).toBe(rubricText('cleanliness', 1));

    choose(form, 'internet', 2);
    expect(text(page.querySelector('[data-rubric="internet"]'))).toMatch(/Average Download 3–10 Mbps\.$/);
    // Choosing one score leaves the others' descriptions alone.
    expect(text(rubric)).toBe(rubricText('cleanliness', 1));
  });

  it('reopens a saved survey with its scores described and its distance shown', async () => {
    const { store, renderSurveyForm, rubricText } = await load();
    store.addSurvey(saved);
    const page = show(renderSurveyForm({ id: 'svy-scored' }));

    expect(text(page.querySelector('[data-rubric="cleanliness"]'))).toBe(rubricText('cleanliness', 4));
    expect(text(page.querySelector('[data-rubric="security"]'))).toBe(rubricText('security', 2));
    expect(text(page.querySelector('[data-rubric="internet"]'))).toBe('');
    expect(page.querySelector('#f-distanceKm').value).toBe('1,8 km');
    expect(text(page.querySelector('#f-notes-count'))).toBe('13/1,000');
  });

  it('leaves the distance empty until both pins are set', async () => {
    const { renderSurveyForm } = await load();
    const distance = show(renderSurveyForm()).querySelector('#f-distanceKm');
    expect(distance.value).toBe('');
    expect(distance.placeholder).toBe('Fills in once both pins are set');
  });

  it('marks a distance saved as a straight line, as every older survey is', async () => {
    const { store, renderSurveyForm } = await load();
    const { distanceBasis, ...older } = saved.kos;
    store.addSurvey({ ...saved, kos: older });
    const page = show(renderSurveyForm({ id: 'svy-scored' }));
    expect(page.querySelector('#f-distanceKm').value).toBe('1,8 km (straight\u00a0line)');
  });

  // OpenStreetMap's licence asks for its attribution wherever its data is used.
  it('credits OpenStreetMap for the route', async () => {
    const { renderSurveyForm } = await load();
    const credit = show(renderSurveyForm()).querySelector('#f-distanceKm').closest('.field').querySelector('.field__credit');
    expect(text(credit)).toBe('Route data © OpenStreetMap contributors');
    // "Fix the map" was removed at the user's request.
    expect(credit.querySelector('a')).toBeNull();
  });
});

describe('the distance a survey is saved with', () => {
  it('is the straight line, saying so, until a walking route is known for its pins', async () => {
    const { store, renderSurveyForm, readSurveyForm } = await load();
    store.addSurvey(saved);
    const form = show(renderSurveyForm({ id: 'svy-scored' })).querySelector('#survey-form');
    expect(readSurveyForm(form).kos).toMatchObject({ distanceKm: 0.5, distanceBasis: 'straight' });

    const { rememberWalkingKm } = await import('../src/utils/route.js');
    rememberWalkingKm(saved.kos.kosLocation, saved.kos.campusLocation, 1.8);
    expect(readSurveyForm(form).kos).toMatchObject({ distanceKm: 1.8, distanceBasis: 'walking' });
  });

  it('is nothing at all without both pins', async () => {
    const { renderSurveyForm, readSurveyForm } = await load();
    const form = show(renderSurveyForm()).querySelector('#survey-form');
    expect(readSurveyForm(form).kos).toMatchObject({ distanceKm: null, distanceBasis: null });
  });
});

describe('the owner or security phone', () => {
  it('is a phone field in the Kos information section', async () => {
    const { renderSurveyForm } = await load();
    const page = show(renderSurveyForm());
    const input = page.querySelector('#f-contactPhone');
    expect(input.getAttribute('type')).toBe('tel');
    expect(input.getAttribute('inputmode')).toBe('tel');
    expect(input.closest('[data-section]').dataset.section).toBe('1');
    expect(text(page.querySelector('label[for="f-contactPhone"]'))).toBe('Owner or security phone');
  });

  it('reads the number as typed, and null when left blank', async () => {
    const { renderSurveyForm, readSurveyForm } = await load();
    const form = show(renderSurveyForm()).querySelector('#survey-form');
    expect(readSurveyForm(form).kos.contactPhone).toBeNull();
    type(form.querySelector('#f-contactPhone'), '  0812-3456-7890 ');
    expect(readSurveyForm(form).kos.contactPhone).toBe('0812-3456-7890');
  });

  it('reopens a saved survey with its number shown', async () => {
    const { store, renderSurveyForm } = await load();
    store.addSurvey({ ...saved, kos: { ...saved.kos, contactPhone: '0899-1122-3344' } });
    const page = show(renderSurveyForm({ id: 'svy-scored' }));
    expect(page.querySelector('#f-contactPhone').value).toBe('0899-1122-3344');
  });
});

describe('the survey id', () => {
  const formId = (markup) => show(markup).querySelector('#survey-form').dataset.surveyId;

  // A form left through the nav once passed its draft's id to the next new survey, which overwrote it.
  it('is new for every new survey form, however the last one was left', async () => {
    const { renderSurveyForm } = await load();
    const first = formId(renderSurveyForm());
    const second = formId(renderSurveyForm());
    expect(first).toMatch(/^svy-/);
    expect(second).toMatch(/^svy-/);
    expect(second).not.toBe(first);
  });

  it("stays the survey's own when it is edited", async () => {
    const { store, renderSurveyForm } = await load();
    store.addSurvey(saved);
    expect(formId(renderSurveyForm({ id: 'svy-scored' }))).toBe('svy-scored');
  });
});
