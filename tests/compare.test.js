import { describe, it, expect, beforeEach, vi } from 'vitest';
import { comparisonTable } from '../src/components/comparisonTable.js';
import { candidatePickerDialog } from '../src/components/candidatePicker.js';
import { compareBar } from '../src/components/compareBar.js';
import { ownSurveys } from '../src/seed/ownSurveys.js';
import { communitySurveys } from '../src/seed/communitySurveys.js';
import {
  ROOM_FACILITIES,
  BATHROOM_FACILITIES,
  SHARED_FACILITIES,
  SURROUNDINGS,
  MAX_COMPARE,
} from '../src/constants.js';

const render = (markup) => {
  const host = document.createElement('div');
  host.innerHTML = String(markup);
  return host;
};

const three = ownSurveys.slice(0, 3);
const names = three.map((s) => s.kos.name);

describe('the comparison, one section per category', () => {
  const host = render(comparisonTable(three));
  const sections = [...host.querySelectorAll('section.ledger-section')];

  it('gives every category its own section, in the requirement order', () => {
    expect(sections.map((s) => s.querySelector('h2').textContent.trim())).toEqual([
      'Kos information',
      'Room',
      'Bathroom',
      'Shared facilities',
      'Surroundings',
      'Additional information',
    ]);
  });

  it('names each table by its section heading', () => {
    for (const section of sections) {
      const heading = section.querySelector('h2');
      expect(section.querySelector('table').getAttribute('aria-labelledby')).toBe(heading.id);
    }
  });

  // Rule 1 in CLAUDE.md: never truncated. Splitting the table must not drop rows.
  it('keeps every criterion and every facility row', () => {
    const labels = [...host.querySelectorAll('tbody th[scope="row"]')].map((th) => th.textContent.trim());
    for (const item of [...ROOM_FACILITIES, ...BATHROOM_FACILITIES, ...SHARED_FACILITIES, ...SURROUNDINGS]) {
      expect(labels).toContain(item);
    }
    expect(labels).toHaveLength(43);
  });

  it('gives every table the same column set, so the columns line up across sections', () => {
    const tables = [...host.querySelectorAll('table')];
    expect(tables).toHaveLength(sections.length + 1);
    for (const table of tables) {
      const cols = [...table.querySelectorAll('colgroup col')];
      expect(cols).toHaveLength(three.length + 1);
      expect(cols[0].classList.contains('ledger__col-criterion')).toBe(true);
    }
  });

  it('keeps column headers inside every section, for screen readers', () => {
    for (const section of sections) {
      const headers = [...section.querySelectorAll('thead th[scope="col"]')].map((th) =>
        th.querySelector('.ledger__kos')?.textContent.trim() ?? th.textContent.trim(),
      );
      expect(headers).toEqual(['Criterion', ...names]);
    }
  });

  it('treats notes as prose rather than figures, word for word', () => {
    const notes = [...host.querySelectorAll('tbody tr')].find((tr) => tr.querySelector('th').textContent.trim() === 'Notes');
    const cells = [...notes.querySelectorAll('td')];
    three.forEach((survey, i) => {
      if (!survey.additional.notes) return;
      expect(cells[i].classList.contains('ledger__prose')).toBe(true);
      expect(cells[i].classList.contains('numeric')).toBe(false);
      expect(cells[i].querySelector('.ledger__cell-value').textContent).toBe(survey.additional.notes);
    });
  });

  it("keeps a note's own line breaks in the text it renders", () => {
    const written = { ...three[0], additional: { ...three[0].additional, notes: 'Quiet street.\n\nGate locks at 10pm.' } };
    const cell = [...render(comparisonTable([written, three[1]])).querySelectorAll('td.ledger__prose')][0];
    expect(cell.querySelector('.ledger__cell-value').textContent).toBe('Quiet street.\n\nGate locks at 10pm.');
  });

  it('leaves removing a kos to the compare bar: the table carries no Remove', () => {
    expect(host.querySelectorAll('[data-action="remove-compare"]')).toHaveLength(0);
  });

  it('flags the whole comparison for the column reveal', () => {
    expect(host.querySelector('[data-reveal]').classList.contains('ledger-sections')).toBe(true);
  });
});

describe('the compare bar', () => {
  it('always holds one card per slot, filled or empty, so the row never changes shape', () => {
    for (let count = 0; count <= MAX_COMPARE; count++) {
      const host = render(compareBar(ownSurveys.slice(0, count), { shown: false }));
      expect(host.querySelectorAll('.compare-chip')).toHaveLength(MAX_COMPARE);
      expect(host.querySelectorAll('.compare-chip--empty')).toHaveLength(MAX_COMPARE - count);
    }
  });

  it('takes its number of equal columns from MAX_COMPARE', () => {
    const host = render(compareBar(three, { shown: true }));
    expect(host.querySelector('.compare-bar__chips').getAttribute('style')).toContain(`--slots: ${MAX_COMPARE}`);
  });

  it('shows each kos by name only, without the rent', () => {
    const host = render(compareBar(three, { shown: true }));
    const chips = host.querySelector('.compare-bar__chips');
    expect(chips.querySelector('.compare-chip__rent')).toBeNull();
    expect(chips.textContent).not.toMatch(/Rp/);
  });

  it('keeps the full name reachable when a long one is cut short', () => {
    const host = render(compareBar(three, { shown: true }));
    const names = [...host.querySelectorAll('.compare-chip__name')];
    expect(names.map((n) => n.getAttribute('title'))).toEqual(three.map((s) => s.kos.name));
  });
});

describe('the kos picker dialog', () => {
  const candidates = { own: ownSurveys.slice(0, 5), community: communitySurveys.slice(0, 4) };
  const everyKos = [...candidates.own, ...candidates.community];
  const text = (node) => node.textContent.trim();
  const listed = (group) => [...group.querySelectorAll('.listing__title')].map(text);

  it('is titled for the dialog and counts the selection', () => {
    const host = render(candidatePickerDialog(candidates, [candidates.own[0].id]));
    expect(host.querySelector('#picker-dialog-title').textContent.trim()).toBe('Add kos');
    expect(host.querySelector('[role="status"]').textContent.trim()).toBe(`1 of ${MAX_COMPARE} selected.`);
  });

  it('lists your own surveys and every community survey, each under its source', () => {
    const host = render(candidatePickerDialog(candidates, []));
    const groups = [...host.querySelectorAll('.picker-group')];
    // Each group is named by its own heading.
    const titles = groups.map((group) => group.querySelector(`#${group.getAttribute('aria-labelledby')}`));
    expect(titles.map(text)).toEqual(['My surveys', 'Community']);
    expect(listed(groups[0])).toEqual(candidates.own.map((s) => s.kos.name));
    expect(listed(groups[1])).toEqual(candidates.community.map((s) => s.kos.name));
  });

  it('lets kos from both sources be picked together', () => {
    const picked = [candidates.own[0].id, candidates.community[0].id];
    const host = render(candidatePickerDialog(candidates, picked));
    const selected = [...host.querySelectorAll('[data-action="toggle-compare"]')]
      .filter((button) => text(button) === 'Selected')
      .map((button) => button.dataset.id);
    expect(selected).toEqual(picked);
  });

  it('says what to do when you have no surveys of your own', () => {
    const host = render(candidatePickerDialog({ own: [], community: candidates.community }, []));
    const [own, community] = host.querySelectorAll('.picker-group');
    expect(own.querySelector('.listing')).toBeNull();
    expect(text(own.querySelector('.meta'))).toBe('You have not recorded a kos yet.');
    // It leaves the Compare page, so it closes the dialog on the way.
    const add = own.querySelector('a[href="#/surveys/new"]');
    expect(text(add)).toBe('Add survey');
    expect(add.dataset.action).toBe('close-picker');
    expect(listed(community)).toEqual(candidates.community.map((s) => s.kos.name));
  });

  it('says so when there are no community surveys', () => {
    const host = render(candidatePickerDialog({ own: candidates.own, community: [] }, []));
    const community = host.querySelectorAll('.picker-group')[1];
    expect(community.querySelector('.listing')).toBeNull();
    expect(text(community.querySelector('.meta'))).toBe('No community surveys to show right now.');
  });

  it('refuses a fourth kos with a reason, rather than dropping one', () => {
    const picked = everyKos.slice(0, MAX_COMPARE).map((s) => s.id);
    const host = render(candidatePickerDialog(candidates, picked));
    const blocked = [...host.querySelectorAll('[data-action="toggle-compare"][disabled]')];
    expect(blocked).toHaveLength(everyKos.length - MAX_COMPARE);
    for (const button of blocked) expect(button.textContent.trim()).toBe(`Maximum of ${MAX_COMPARE}`);
  });

  it('can be closed from its head and its foot', () => {
    const host = render(candidatePickerDialog(candidates, []));
    expect(host.querySelectorAll('[data-action="close-picker"]')).toHaveLength(2);
  });
});

describe('the compare page', () => {
  beforeEach(() => localStorage.clear());

  // The store reads storage once at import, so each render gets a fresh copy.
  async function renderWith(count, shown) {
    vi.resetModules();
    const store = await import('../src/store.js');
    const { renderCompare } = await import('../src/features/compare.js');
    store.getState().surveys.slice(0, count).forEach((s) => store.toggleCompare(s.id));
    if (shown) store.showComparison();
    return render(renderCompare());
  }

  it('puts Add kos in the compare bar instead of a picker beside the table', async () => {
    const host = await renderWith(3, true);
    const buttons = [...host.querySelectorAll('[data-action="open-picker"]')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent.trim()).toBe('Add kos');
    expect(buttons[0].closest('.compare-bar__actions')).not.toBeNull();
    expect(host.querySelector('.compare-layout')).toBeNull();
    expect(host.querySelector('[data-action="toggle-compare"]')).toBeNull();
  });

  it('still lets every kos be removed without leaving the page, from its chip', async () => {
    const host = await renderWith(3, true);
    const removes = [...host.querySelectorAll('[data-action="remove-compare"]')];
    expect(removes).toHaveLength(3);
    for (const button of removes) expect(button.closest('.compare-chip')).not.toBeNull();
  });

  it('keeps Compare last, as the primary action, while choosing', async () => {
    const host = await renderWith(2, false);
    const actions = [...host.querySelectorAll('.compare-bar__actions .btn')].map((b) => b.dataset.action);
    expect(actions).toEqual(['open-picker', 'show-comparison']);
  });

  it('keeps Add kos reachable before anything is selected', async () => {
    const host = await renderWith(0, false);
    expect(host.querySelector('.compare-bar [data-action="open-picker"]')).not.toBeNull();
    expect(host.textContent).toContain('Use Add kos');
  });
});
