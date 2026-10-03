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
    expect(helpers).toHaveLength(20);
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

describe('the area a kos and its campus are in', () => {
  const read = (form) => {
    const { kosLocation, campusLocation } = readSurveyForm(form).kos;
    return [kosLocation?.label, campusLocation?.label];
  };
  let readSurveyForm;

  it('has no field to type it in', async () => {
    const { renderSurveyForm } = await load();
    const page = show(renderSurveyForm());
    expect(page.querySelector('#f-kosLocation')).toBeNull();
    expect(page.querySelector('#f-campusLocation')).toBeNull();
    expect(page.textContent).not.toMatch(/Kos location name|Campus name/);
  });

  it('keeps the area of a saved survey through an edit', async () => {
    const loaded = await load();
    ({ readSurveyForm } = loaded);
    loaded.store.addSurvey(saved);
    const form = show(loaded.renderSurveyForm({ id: 'svy-scored' })).querySelector('#survey-form');
    expect(read(form)).toEqual(['Lowokwaru, Malang', 'Universitas Brawijaya']);
  });

  it('falls back to the typed address when nothing was looked up', async () => {
    const loaded = await load();
    ({ readSurveyForm } = loaded);
    const form = show(loaded.renderSurveyForm()).querySelector('#survey-form');
    type(form.querySelector('#kosLocation-address'), 'Jl. Sumbersari 12, Malang');
    expect(readSurveyForm(form).kos.kosLocation).toMatchObject({ label: 'Jl. Sumbersari 12, Malang', address: 'Jl. Sumbersari 12, Malang' });
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

describe('the monthly rent', () => {
  async function rentForm(id) {
    const loaded = await load();
    if (id) loaded.store.addSurvey(saved);
    const form = show(loaded.renderSurveyForm(id ? { id } : undefined)).querySelector('#survey-form');
    loaded.attachRent(form);
    const field = form.querySelector('#f-rent');
    const slider = form.querySelector('[data-slider-for="f-rent"]');
    return { ...loaded, form, field, slider };
  }

  it('has a slider from Rp 0 to Rp 10.000.000 under the typed field, read by nothing', async () => {
    const { form, field, slider, readSurveyForm } = await rentForm();
    expect([slider.type, slider.min, slider.max, slider.step]).toEqual(['range', '0', '10000000', '50000']);
    expect(slider.getAttribute('aria-label')).toBe('Monthly rent');
    expect(slider.name).toBe('');
    expect(slider.closest('[data-field]')).toBe(field.closest('[data-field]'));
    expect([...form.querySelectorAll('.field__scale span')].map(text)).toEqual(['Rp 0', 'Rp 10.000.000']);
    expect(readSurveyForm(form).kos.rent).toBeNull();
  });

  it('types the amount the slider is moved to', async () => {
    const { form, field, slider, readSurveyForm } = await rentForm();
    type(slider, '1500000');
    expect(field.value).toBe('1.500.000');
    expect(readSurveyForm(form).kos.rent).toBe(1_500_000);
    expect(slider.getAttribute('aria-valuetext')).toBe('Rp 1.500.000');
  });

  it('follows a typed amount, resting at its end past Rp 10.000.000 while the field keeps the figure', async () => {
    const { form, field, slider, readSurveyForm } = await rentForm();
    type(field, '2500000');
    expect(slider.value).toBe('2500000');
    type(field, '15000000');
    expect(slider.value).toBe('10000000');
    expect(field.value).toBe('15.000.000');
    expect(readSurveyForm(form).kos.rent).toBe(15_000_000);
    expect(slider.getAttribute('aria-valuetext')).toBe('Rp 15.000.000');
  });

  it('opens a saved survey with the slider at its rent', async () => {
    const { slider } = await rentForm('svy-scored');
    expect(slider.value).toBe('1250000');
    expect(slider.getAttribute('aria-valuetext')).toBe('Rp 1.250.000');
  });
});

describe('the room length and width', () => {
  async function sizeForm(id) {
    const loaded = await load();
    if (id) loaded.store.addSurvey(saved);
    const form = show(loaded.renderSurveyForm(id ? { id } : undefined)).querySelector('#survey-form');
    const { mountComboboxes } = await import('../src/components/combobox.js');
    mountComboboxes(form);
    const field = (key) => form.querySelector(`#f-${key}`);
    const list = (key) => form.querySelector(`#f-${key}-list`);
    const toggle = (key) => field(key).closest('[data-combo]').querySelector('[data-combo-toggle]');
    const selected = (key) => [...list(key).querySelectorAll('[aria-selected="true"]')].map((o) => o.dataset.value);
    const key = (control, name, init = {}) =>
      control.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }));
    return { ...loaded, form, field, list, toggle, selected, key };
  }

  it('is one field each, with a 1–10 m list it opens, and no second control to read', async () => {
    const { form, field, list, toggle, readSurveyForm } = await sizeForm();
    for (const name of ['lengthM', 'widthM']) {
      const input = field(name);
      expect([input.type, input.inputMode, input.getAttribute('role'), input.name]).toEqual(['text', 'decimal', 'combobox', name]);
      expect(input.getAttribute('aria-controls')).toBe(list(name).id);
      expect(input.getAttribute('aria-expanded')).toBe('false');
      expect(list(name).hidden).toBe(true);
      expect([...list(name).querySelectorAll('[role="option"]')].map(text)).toEqual(
        Array.from({ length: 10 }, (_, index) => `${index + 1} m`),
      );
      expect(toggle(name).tabIndex).toBe(-1);
    }
    expect(form.querySelector('select')).toBeNull();
    expect(readSurveyForm(form).room).toMatchObject({ lengthM: null, widthM: null });
  });

  it('opens from the chevron, and types the metres picked', async () => {
    const { form, field, list, toggle, selected, readSurveyForm } = await sizeForm();
    const heard = [];
    form.addEventListener('input', () => heard.push('input'));
    form.addEventListener('change', () => heard.push('change'));
    toggle('lengthM').click();
    expect(list('lengthM').hidden).toBe(false);
    expect(field('lengthM').getAttribute('aria-expanded')).toBe('true');
    list('lengthM').querySelector('[data-value="3"]').click();
    expect(field('lengthM').value).toBe('3');
    expect(list('lengthM').hidden).toBe(true);
    expect(selected('lengthM')).toEqual(['3']);
    expect(heard).toEqual(['input', 'change']);
    expect(readSurveyForm(form).room.lengthM).toBe(3);
  });

  it('takes a typed size the list does not hold, like the number field it replaced', async () => {
    const { form, field, selected, readSurveyForm } = await sizeForm();
    type(field('widthM'), '4');
    expect(selected('widthM')).toEqual(['4']);
    type(field('widthM'), '3,5');
    expect(field('widthM').value).toBe('3.5');
    expect(selected('widthM')).toEqual([]);
    type(field('widthM'), '9.5m');
    expect(field('widthM').value).toBe('9.5');
    expect(readSurveyForm(form).room.widthM).toBe(9.5);
  });

  it('works from the keyboard: ↓ opens on the current size, Enter picks, Escape leaves it be', async () => {
    const { field, list, key } = await sizeForm();
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
    const { field, selected } = await sizeForm('svy-scored');
    expect([field('lengthM').value, field('widthM').value]).toEqual(['3', '4']);
    expect([selected('lengthM'), selected('widthM')]).toEqual([['3'], ['4']]);
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
