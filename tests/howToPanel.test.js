import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FIELD_GUIDE, PANEL_PARTS, RUBRICS } from '../src/content/guidance.js';
import { renderHowTo, openHowTo, placeHowTo, initHowTo } from '../src/components/howToPanel.js';

/** Fresh modules for each test: the store reads storage once, at import. */
async function loadForm() {
  vi.resetModules();
  await import('../src/store.js');
  return import('../src/features/surveyForm.js');
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
  document.body.innerHTML = '<button id="trigger">i</button><dialog id="app-howto"></dialog>';
});

const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim();

function panel(key) {
  const host = document.createElement('div');
  host.innerHTML = String(renderHowTo(key));
  return host;
}

const headings = (host) => [...host.querySelectorAll('.howto__heading')].map(text);

function rect({ top = 0, left = 0, width = 0, height = 0 }) {
  return { top, left, width, height, right: left + width, bottom: top + height, x: left, y: top };
}

describe('the How to fill panel', () => {
  it('has a panel for every field, titled for it, in the same order every time', () => {
    const order = PANEL_PARTS.map(([, heading]) => heading);
    for (const [key, guide] of Object.entries(FIELD_GUIDE)) {
      const host = panel(key);
      expect(text(host.querySelector('#howto-title')), key).toBe(`How to fill ${guide.label}`);

      const parts = headings(host).filter((heading) => order.includes(heading));
      expect(parts, key).toEqual(order.filter((heading) => parts.includes(heading)));
      // Every panel says what the field is, where the answer comes from, and its rules.
      expect(parts, key).toEqual(expect.arrayContaining(['What to fill', 'How to find it', 'Rules']));
    }
  });

  it('lists all four levels of each score, with the download speed for internet', () => {
    for (const key of Object.keys(RUBRICS)) {
      const host = panel(key);
      expect(headings(host)).toContain('Scores');
      expect([...host.querySelectorAll('.howto__score dt')].map(text)).toEqual(
        RUBRICS[key].map((level) => `${level.score} ${level.label}`),
      );
    }
    expect([...panel('internet').querySelectorAll('.howto__benchmark')].map(text)).toEqual([
      'Average Download < 3 Mbps',
      'Average Download 3–10 Mbps',
      'Average Download 10–25 Mbps',
      'Average Download > 25 Mbps',
    ]);
  });

  it('lists what to photograph for room, bathroom and shared facility photos', () => {
    for (const key of ['roomPhotos', 'bathroomPhotos', 'sharedPhotos']) {
      const host = panel(key);
      expect(headings(host)).toContain('Suggested shots');
      expect([...host.querySelectorAll('.howto__shots li')].map(text)).toEqual(FIELD_GUIDE[key].photos);
    }
  });

  it('opens for a field and closes back to the ⓘ that opened it', () => {
    initHowTo();
    const trigger = document.getElementById('trigger');
    const dialog = document.getElementById('app-howto');

    expect(openHowTo('rent', trigger)).toBe(true);
    expect(dialog.open).toBe(true);
    expect(text(dialog.querySelector('#howto-title'))).toBe('How to fill Monthly rent');

    // Only one panel: opening another field's replaces the content.
    openHowTo('type', trigger);
    expect(dialog.querySelectorAll('.howto')).toHaveLength(1);
    expect(text(dialog.querySelector('#howto-title'))).toBe('How to fill Kos type');

    dialog.close();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when the backdrop is clicked, but not when the panel itself is', () => {
    initHowTo();
    const dialog = document.getElementById('app-howto');
    openHowTo('name', document.getElementById('trigger'));

    dialog.querySelector('.howto__body').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.open).toBe(true);
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.open).toBe(false);
  });

  it('keeps the ⓘ that opened it when it is reopened before the last close lands', () => {
    initHowTo();
    const dialog = document.getElementById('app-howto');
    const first = document.getElementById('trigger');
    const second = document.createElement('button');
    document.body.append(second);

    // A browser fires `close` a moment after the dialog shuts.
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
      queueMicrotask(() => this.dispatchEvent(new Event('close')));
    };
    openHowTo('name', first);
    dialog.close();
    openHowTo('rent', second);
    return Promise.resolve().then(() => {
      expect(dialog.open).toBe(true);
      // An open dialog holds focus inside itself.
      dialog.querySelector('[data-action="close-howto"]').focus();
      dialog.close();
      return Promise.resolve().then(() => expect(document.activeElement).toBe(second));
    });
  });

  it('sits below the ⓘ, above it when there is no room below, and inside the window', () => {
    const dialog = document.getElementById('app-howto');
    const trigger = document.getElementById('trigger');
    // Its layout size, which the arrival animation's scaling does not change.
    Object.defineProperty(dialog, 'offsetWidth', { value: 360, configurable: true });
    Object.defineProperty(dialog, 'offsetHeight', { value: 300, configurable: true });
    const at = (box) => {
      vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect(box));
      placeHowTo(dialog, trigger);
      return [parseInt(dialog.style.top, 10), parseInt(dialog.style.left, 10)];
    };

    // jsdom's window is 1024 × 768.
    expect(at({ top: 100, left: 200, width: 28, height: 28 })).toEqual([136, 200]);
    expect(at({ top: 600, left: 200, width: 28, height: 28 })).toEqual([292, 200]);
    expect(at({ top: 100, left: 900, width: 28, height: 28 })).toEqual([136, 1024 - 16 - 360]);
    expect(dialog.style.maxHeight).toBe('');
  });

  it('scrolls on the roomier side when it fits neither, rather than covering the ⓘ', () => {
    const dialog = document.getElementById('app-howto');
    const trigger = document.getElementById('trigger');
    Object.defineProperty(dialog, 'offsetWidth', { value: 360, configurable: true });
    Object.defineProperty(dialog, 'offsetHeight', { value: 600, configurable: true });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect({ top: 360, left: 200, width: 28, height: 28 }));

    placeHowTo(dialog, trigger);
    // Below: 768 - 16 - (388 + 8) = 356. Above: 360 - 8 - 16 = 336.
    expect(dialog.style.top).toBe('396px');
    expect(dialog.style.maxHeight).toBe('356px');
  });
});

describe('the ⓘ on the survey form', () => {
  it('sits beside every field, named for the field it explains', async () => {
    const { renderSurveyForm } = await loadForm();
    document.body.innerHTML = String(renderSurveyForm());

    const buttons = [...document.querySelectorAll('[data-action="open-howto"]')];
    expect(buttons.map((button) => button.dataset.guide).sort()).toEqual(Object.keys(FIELD_GUIDE).sort());
    for (const button of buttons) {
      expect(button.getAttribute('aria-label')).toBe(`How to fill ${FIELD_GUIDE[button.dataset.guide].label}`);
      expect(button.type).toBe('button');
    }

    // A group is named by its legend's label span, so its ⓘ is not read as part of the name.
    const group = document.querySelector('fieldset[data-field="security"]');
    const name = document.getElementById(group.getAttribute('aria-labelledby'));
    expect(name.querySelector('.field__info')).toBeNull();
  });

  it('is never where an error sends focus', async () => {
    const { renderSurveyForm } = await loadForm();
    const { showErrors } = await import('../src/components/formErrors.js');
    Element.prototype.scrollIntoView = () => {};
    document.body.innerHTML = String(renderSurveyForm());
    const form = document.getElementById('survey-form');

    showErrors(form, {
      ok: false,
      errors: { kosLocation: 'Pin the kos location on the map, or search its address.' },
      firstField: 'kosLocation',
      sectionCounts: { 1: 1 },
    });
    expect(document.activeElement.classList.contains('field__info')).toBe(false);
    expect(document.querySelector('.field__info[aria-invalid]')).toBeNull();
  });
});
