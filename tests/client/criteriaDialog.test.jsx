import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { BEST_MATCH_CRITERIA, criterionDescription } from '../../client/src/constants.js';
import { DEFAULT_WEIGHTS } from '../../client/src/utils/weights.js';

const custom = { price: 35, facilities: 20, cleanliness: 15, location: 15, distance: 3, security: 12 };

/** A fresh store, logged in, with `weights` as the account's own, and an Edit button that opens the dialog. */
async function setUp(weights = null) {
  vi.resetModules();
  const store = await import('../../client/src/data/store.js');
  const { CriteriaDialog, CriteriaForm } = await import('../../client/src/components/compare/CriteriaDialog.jsx');
  const { ToastRegion } = await import('../../client/src/components/feedback/ToastRegion.jsx');
  store.setUser({ id: 'u1', email: 'a@example.test', name: 'A' });
  if (weights) store.setBestMatchWeights(weights);

  function Page() {
    const [open, setOpen] = useState(false);
    const edit = useRef(null);
    return (
      <>
        <button ref={edit} type="button" onClick={() => setOpen(true)}>
          Edit criteria
        </button>
        <CriteriaDialog open={open} onClose={() => setOpen(false)} returnFocus={edit} />
        <ToastRegion />
      </>
    );
  }
  render(<Page />);
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Edit criteria' }));
  return { store, open, CriteriaForm };
}

const dialog = () => document.querySelector('dialog');
const field = (key) => dialog().querySelector(`input[name="${key}"]`);
const slider = (key) => dialog().querySelector(`input[type="range"][data-key="${key}"]`);
const total = () => dialog().querySelector('[data-criteria-total]');
const save = () => screen.getByRole('button', { name: 'Save' });
const text = (node) => node.textContent.replace(/\s+/g, ' ').trim();
const type = (key, value) => fireEvent.change(field(key), { target: { value } });
const slide = (key, value) => fireEvent.change(slider(key), { target: { value } });
const typed = () => Object.fromEntries(BEST_MATCH_CRITERIA.map(({ key }) => [key, Number(field(key).value)]));

beforeEach(() => localStorage.clear());

describe('the criteria dialog', () => {
  it('opens on the weights in use, one labelled, described row per criterion', async () => {
    const { open } = await setUp(custom);
    open();
    expect(dialog().open).toBe(true);
    expect(text(document.getElementById('criteria-dialog-title'))).toBe('Best Match criteria');

    BEST_MATCH_CRITERIA.forEach((criterion) => {
      const input = field(criterion.key);
      expect(input.value).toBe(String(custom[criterion.key]));
      expect(text(dialog().querySelector(`label[for="${input.id}"]`))).toBe(criterion.label);
      expect(text(document.getElementById(input.getAttribute('aria-describedby')))).toBe(criterionDescription(criterion));
      expect(input.getAttribute('inputmode')).toBe('numeric');
    });
    expect(typed()).toEqual(custom);
  });

  it('can be saved as it opens, since what it shows totals 100%', async () => {
    const { open } = await setUp();
    open();
    expect(text(total())).toBe('Total 100%');
    expect(save().disabled).toBe(false);
  });

  it('says how far off 100% the total is, and holds Save until it is not', async () => {
    const { open } = await setUp();
    open();

    type('price', '15');
    expect(text(total())).toBe('Total 90% · 10% left to share');
    expect(save().disabled).toBe(true);
    expect(total().className).toContain('text-alert');

    type('price', '35');
    expect(text(total())).toBe('Total 110% · 10% over');
    expect(save().disabled).toBe(true);

    type('price', '25');
    expect(text(total())).toBe('Total 100%');
    expect(save().disabled).toBe(false);
    expect(total().className).not.toContain('text-alert');
  });

  it('points at a weight that is not a whole number from 0 to 100, blank included', async () => {
    const { open } = await setUp();
    open();
    for (const value of ['', '12.5', '-5', '101']) {
      type('distance', value);
      expect(text(total())).toBe('Each weight is a whole number from 0 to 100.');
      expect(field('distance').getAttribute('aria-invalid')).toBe('true');
      expect(field('price').getAttribute('aria-invalid')).toBe('false');
      expect(save().disabled).toBe(true);
    }
    type('distance', '13');
    expect(field('distance').getAttribute('aria-invalid')).toBe('false');
  });

  it('gives each weight a slider from 0 to 100 beside the field, starting where the field does', async () => {
    const { open } = await setUp(custom);
    open();
    for (const { key, label } of BEST_MATCH_CRITERIA) {
      const range = slider(key);
      expect([range.type, range.min, range.max, range.step]).toEqual(['range', '0', '100', '1']);
      expect(range.value).toBe(String(custom[key]));
      expect(text(document.getElementById(range.getAttribute('aria-labelledby')))).toBe(label);
      expect(range.getAttribute('aria-describedby')).toBe(field(key).getAttribute('aria-describedby'));
      // Unnamed, so the typed field stays the one value read.
      expect(range.name).toBe('');
    }
  });

  it('types what the slider is moved to, and totals it', async () => {
    const { open } = await setUp();
    open();
    slide('security', '2');
    expect(field('security').value).toBe('2');
    expect(text(total())).toBe('Total 90% · 10% left to share');
    slide('price', '35');
    expect(text(total())).toBe('Total 100%');
    expect(save().disabled).toBe(false);
  });

  it('moves the slider to a typed weight, and leaves it be for one it cannot show', async () => {
    const { open } = await setUp();
    open();
    type('distance', '40');
    expect(slider('distance').value).toBe('40');
    for (const value of ['', '101', '12.5']) {
      type('distance', value);
      expect(slider('distance').value).toBe('40');
    }
  });

  it('puts the defaults back on Reset, which still leaves saving to Save', async () => {
    const { open, store } = await setUp(custom);
    open();
    const reset = screen.getByRole('button', { name: 'Reset to default' });
    // Reset is an ordinary button: it does not submit the form.
    expect(reset.type).toBe('button');
    fireEvent.click(reset);
    expect(typed()).toEqual(DEFAULT_WEIGHTS);
    expect(slider('price').value).toBe(String(DEFAULT_WEIGHTS.price));
    expect(text(total())).toBe('Total 100%');
    expect(store.bestMatchWeights()).toEqual(custom);
  });

  it('saves the account’s weights, closes, and says so', async () => {
    const { open, store } = await setUp();
    open();
    type('price', '35');
    type('distance', '3');
    fireEvent.click(save());
    expect(store.bestMatchWeights()).toEqual(custom);
    expect(dialog().open).toBe(false);
    expect(await screen.findByText('Best Match weights saved')).toBeTruthy();
  });

  it('forgets a draft on Close: it reopens on the weights in use', async () => {
    const { open } = await setUp(custom);
    open();
    type('price', '50');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(dialog().open).toBe(false);
    open();
    expect(typed()).toEqual(custom);
  });

  it('gives focus back to Edit criteria when it closes', async () => {
    const { open } = await setUp();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit criteria' }));
  });

  it('starts from a set it cannot save with Save held, rather than failing', async () => {
    const { CriteriaForm } = await setUp();
    render(<CriteriaForm weights={{ ...DEFAULT_WEIGHTS, price: 30 }} />);
    const forms = document.querySelectorAll('form');
    const form = forms[forms.length - 1];
    expect(text(form.querySelector('[data-criteria-total]'))).toBe('Total 105% · 5% over');
    expect(form.querySelector('button[type="submit"]').disabled).toBe(true);
  });
});
