import { describe, it, expect, beforeEach } from 'vitest';
import {
  criteriaDialog,
  readWeights,
  updateCriteriaTotal,
  stepWeight,
  fillWeights,
  openCriteria,
  initCriteriaDialog,
} from '../src/components/criteriaDialog.js';
import { DEFAULT_WEIGHTS } from '../src/utils/weights.js';
import { BEST_MATCH_CRITERIA } from '../src/constants.js';

const custom = { price: 35, facilities: 20, cleanliness: 15, location: 15, distance: 3, security: 12 };

// jsdom has no <dialog> behaviour: open and close as a browser would.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  document.body.innerHTML =
    '<button type="button" data-action="open-criteria">Edit criteria</button><dialog id="app-criteria"></dialog>';
});

const dialog = () => document.getElementById('app-criteria');
const form = () => dialog().querySelector('form');
const field = (key) => form().querySelector(`input[name="${key}"]`);
const total = () => form().querySelector('[data-criteria-total]');
const save = () => form().querySelector('[data-criteria-save]');
const text = (node) => node.textContent.replace(/\s+/g, ' ').trim();

function type(key, value) {
  field(key).value = value;
  return updateCriteriaTotal(form());
}

describe('the criteria dialog', () => {
  it('opens on the weights in use, one labelled, described row per criterion', () => {
    openCriteria(custom);
    expect(dialog().open).toBe(true);
    expect(text(dialog().querySelector('#criteria-dialog-title'))).toBe('Best Match criteria');

    const rows = [...form().querySelectorAll('.criteria-row')];
    expect(rows).toHaveLength(BEST_MATCH_CRITERIA.length);
    BEST_MATCH_CRITERIA.forEach((criterion, index) => {
      const input = rows[index].querySelector('input');
      expect(input.value).toBe(String(custom[criterion.key]));
      expect(text(rows[index].querySelector(`label[for="${input.id}"]`))).toBe(criterion.label);
      expect(text(document.getElementById(input.getAttribute('aria-describedby')))).toBe(criterion.description);
      expect(input.getAttribute('inputmode')).toBe('numeric');
    });
    expect(readWeights(form())).toEqual(custom);
  });

  it('can be saved as it opens, since what it shows totals 100%', () => {
    openCriteria(DEFAULT_WEIGHTS);
    expect(text(total())).toBe('Total 100%');
    expect(save().disabled).toBe(false);
  });

  it('says how far off 100% the total is, and holds Save until it is not', () => {
    openCriteria(DEFAULT_WEIGHTS);

    expect(type('price', '15').ok).toBe(false);
    expect(text(total())).toBe('Total 90% · 10% left to share');
    expect(save().disabled).toBe(true);
    expect(total().classList.contains('criteria-dialog__total--off')).toBe(true);

    type('price', '35');
    expect(text(total())).toBe('Total 110% · 10% over');
    expect(save().disabled).toBe(true);

    type('price', '25');
    expect(text(total())).toBe('Total 100%');
    expect(save().disabled).toBe(false);
    expect(total().classList.contains('criteria-dialog__total--off')).toBe(false);
  });

  it('points at a weight that is not a whole number from 0 to 100, blank included', () => {
    openCriteria(DEFAULT_WEIGHTS);
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

  it('moves a weight by 5 with − and +, never below 0 or above 100', () => {
    openCriteria(DEFAULT_WEIGHTS);
    stepWeight(form(), 'security', -5);
    expect(field('security').value).toBe('7');
    stepWeight(form(), 'security', -5);
    stepWeight(form(), 'security', -5);
    expect(field('security').value).toBe('0');

    type('price', '98');
    stepWeight(form(), 'price', 5);
    expect(field('price').value).toBe('100');
    expect(text(total())).toBe(`Total ${100 + 75 - 12}% · ${75 - 12}% over`);
  });

  it('labels − and + with the criterion they change', () => {
    openCriteria(DEFAULT_WEIGHTS);
    const steps = [...form().querySelectorAll('.criteria-row')][0].querySelectorAll('.stepper__step');
    expect([...steps].map((button) => button.getAttribute('aria-label'))).toEqual(['Decrease Price', 'Increase Price']);
    expect([...steps].every((button) => button.type === 'button')).toBe(true);
  });

  it('puts the defaults back on Reset, which still leaves saving to Save', () => {
    openCriteria(custom);
    fillWeights(form(), DEFAULT_WEIGHTS);
    expect(readWeights(form())).toEqual(DEFAULT_WEIGHTS);
    expect(text(total())).toBe('Total 100%');
    // Reset is an ordinary button: it does not submit the form.
    expect(form().querySelector('[data-action="criteria-reset"]').type).toBe('button');
  });

  it('forgets a draft on Close: it reopens on the weights in use', () => {
    openCriteria(custom);
    type('price', '50');
    dialog().close();
    openCriteria(custom);
    expect(readWeights(form())).toEqual(custom);
  });

  it('gives focus back to Edit criteria when it closes', () => {
    initCriteriaDialog();
    openCriteria(DEFAULT_WEIGHTS);
    dialog().close();
    expect(document.activeElement).toBe(document.querySelector('[data-action="open-criteria"]'));
  });

  it('starts from a set it cannot save with Save held, rather than failing', () => {
    document.body.innerHTML = '<dialog id="app-criteria"></dialog>';
    dialog().innerHTML = String(criteriaDialog({ ...DEFAULT_WEIGHTS, price: 30 }));
    expect(text(total())).toBe('Total 105% · 5% over');
    expect(save().disabled).toBe(true);
  });
});
