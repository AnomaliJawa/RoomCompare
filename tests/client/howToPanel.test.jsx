import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { FIELD_GUIDE, PANEL_PARTS, RUBRICS } from '../../client/src/content/guidance.js';
import { HowToContent, HowToPanel, placeHowTo } from '../../client/src/components/form/HowToPanel.jsx';

const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim();
const headings = (container) => [...container.querySelectorAll('h3')].map(text);

function rect({ top = 0, left = 0, width = 0, height = 0 }) {
  return { top, left, width, height, right: left + width, bottom: top + height, x: left, y: top };
}

/** An ⓘ per key and the one panel they share, as the survey form has. */
function Field({ keys }) {
  const [open, setOpen] = useState(null);
  return (
    <>
      {keys.map((key) => (
        <button key={key} type="button" onClick={(event) => setOpen({ key, trigger: event.currentTarget })}>
          {`ⓘ ${key}`}
        </button>
      ))}
      <HowToPanel open={open} onClose={() => setOpen(null)} />
    </>
  );
}

beforeEach(() => localStorage.clear());

describe('the How to fill panel', () => {
  it('has a panel for every field, titled for it, in the same order every time', () => {
    const order = PANEL_PARTS.map(([, heading]) => heading);
    for (const [key, guide] of Object.entries(FIELD_GUIDE)) {
      const { container, unmount } = render(<HowToContent guideKey={key} />);
      expect(text(container.querySelector('#howto-title')), key).toBe(`How to fill ${guide.label}`);
      const parts = headings(container).filter((heading) => order.includes(heading));
      expect(parts, key).toEqual(order.filter((heading) => parts.includes(heading)));
      // Every panel says what the field is, where the answer comes from, and its rules.
      expect(parts, key).toEqual(expect.arrayContaining(['What to fill', 'How to find it', 'Rules']));
      unmount();
    }
  });

  it('lists all four levels of each score, with the download speed for internet', () => {
    for (const key of Object.keys(RUBRICS)) {
      const { container, unmount } = render(<HowToContent guideKey={key} />);
      expect(headings(container)).toContain('Scores');
      expect([...container.querySelectorAll('[data-score] dt')].map(text)).toEqual(
        RUBRICS[key].map((level) => `${level.score} ${level.label}`),
      );
      unmount();
    }
    const { container } = render(<HowToContent guideKey="internet" />);
    expect([...container.querySelectorAll('[data-benchmark]')].map(text)).toEqual([
      'Average Download < 3 Mbps',
      'Average Download 3–10 Mbps',
      'Average Download 10–25 Mbps',
      'Average Download > 25 Mbps',
    ]);
  });

  it('lists what to photograph for room, bathroom and shared facility photos', () => {
    for (const key of ['roomPhotos', 'bathroomPhotos', 'sharedPhotos']) {
      const { container, unmount } = render(<HowToContent guideKey={key} />);
      expect(headings(container)).toContain('Suggested shots');
      expect([...container.querySelectorAll('ul li')].map(text)).toEqual(FIELD_GUIDE[key].photos);
      unmount();
    }
  });

  it('opens for a field and closes back to the ⓘ that opened it', () => {
    render(<Field keys={['rent', 'type']} />);
    const trigger = screen.getByRole('button', { name: 'ⓘ rent' });
    fireEvent.click(trigger);
    const dialog = document.querySelector('dialog');
    expect(dialog.open).toBe(true);
    expect(text(dialog.querySelector('#howto-title'))).toBe('How to fill Monthly rent');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('shows one panel at a time, for the ⓘ pressed last', () => {
    render(<Field keys={['rent', 'type']} />);
    fireEvent.click(screen.getByRole('button', { name: 'ⓘ rent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'ⓘ type' }));
    expect(document.querySelectorAll('#howto-title')).toHaveLength(1);
    expect(text(document.querySelector('#howto-title'))).toBe('How to fill Kos type');
  });

  it('closes when the backdrop is clicked, but not when the panel itself is', () => {
    render(<Field keys={['name']} />);
    fireEvent.click(screen.getByRole('button', { name: 'ⓘ name' }));
    const dialog = document.querySelector('dialog');
    fireEvent.click(screen.getByText('What to fill'));
    expect(dialog.open).toBe(true);
    fireEvent.click(dialog);
    expect(dialog.open).toBe(false);
  });

  describe('placed beside its ⓘ', () => {
    let dialog;
    let trigger;

    beforeEach(() => {
      dialog = document.createElement('dialog');
      trigger = document.createElement('button');
      document.body.append(dialog, trigger);
    });

    afterEach(() => {
      dialog.remove();
      trigger.remove();
    });

    it('sits below the ⓘ, above it when there is no room below, and inside the window', () => {
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
      Object.defineProperty(dialog, 'offsetWidth', { value: 360, configurable: true });
      Object.defineProperty(dialog, 'offsetHeight', { value: 600, configurable: true });
      vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect({ top: 360, left: 200, width: 28, height: 28 }));
      placeHowTo(dialog, trigger);
      // Below: 768 - 16 - (388 + 8) = 356. Above: 360 - 8 - 16 = 336.
      expect(dialog.style.top).toBe('396px');
      expect(dialog.style.maxHeight).toBe('356px');
    });
  });
});

describe('the ⓘ on the survey form', () => {
  async function form() {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => null })));
    localStorage.setItem('roomcompare:survey-guide-seen', 'true');
    await import('../../client/src/data/store.js');
    const { SurveyFormPage } = await import('../../client/src/pages/SurveyFormPage.jsx');
    return render(<SurveyFormPage params={{}} />);
  }

  afterEach(() => vi.unstubAllGlobals());

  it('sits beside every field, named for the field it explains', async () => {
    const { container } = await form();
    const buttons = [...container.querySelectorAll('button[data-guide]')];
    expect(buttons.map((button) => button.dataset.guide).sort()).toEqual(Object.keys(FIELD_GUIDE).sort());
    for (const button of buttons) {
      expect(button.getAttribute('aria-label')).toBe(`How to fill ${FIELD_GUIDE[button.dataset.guide].label}`);
      expect(button.type).toBe('button');
    }
    // A group is named by its legend's label span, so its ⓘ is not read as part of the name.
    const group = container.querySelector('fieldset[data-field="security"]');
    const name = document.getElementById(group.getAttribute('aria-labelledby'));
    expect(name.querySelector('button')).toBeNull();
  });

  it('opens the panel for its own field', async () => {
    await form();
    fireEvent.click(screen.getByRole('button', { name: 'How to fill Monthly rent' }));
    expect(text(document.querySelector('dialog[open] #howto-title'))).toBe('How to fill Monthly rent');
  });

  it('is never where an error sends focus', async () => {
    const { container } = await form();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(document.activeElement.dataset.guide).toBeUndefined();
    expect(container.querySelector('button[data-guide][aria-invalid]')).toBeNull();
  });
});
