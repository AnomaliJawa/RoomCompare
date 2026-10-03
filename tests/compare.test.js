import { describe, it, expect, beforeEach, vi } from 'vitest';
import { comparisonTable } from '../src/components/comparisonTable.js';
import { candidatePickerDialog } from '../src/components/candidatePicker.js';
import { compareBar } from '../src/components/compareBar.js';
import { ownSurveys } from '../src/seed/ownSurveys.js';
import { communitySurveys } from '../src/seed/communitySurveys.js';
import { formatDistance } from '../src/utils/format.js';
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

  // Never truncated: splitting the table must not drop rows.
  it('keeps every criterion and every facility row', () => {
    const labels = [...host.querySelectorAll('tbody th[scope="row"]')].map((th) => th.textContent.trim());
    for (const item of [...ROOM_FACILITIES, ...BATHROOM_FACILITIES, ...SHARED_FACILITIES, ...SURROUNDINGS]) {
      expect(labels).toContain(item);
    }
    expect(labels).toHaveLength(42);
  });

  it('leaves out draft or published, which describes the record rather than the kos', () => {
    const labels = [...host.querySelectorAll('tbody th[scope="row"]')].map((th) => th.textContent.trim());
    expect(labels).not.toContain('Status');
    expect(host.textContent).not.toMatch(/\b(Draft|Published)\b/);
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

  it('marks a distance that is only a straight line, so it is not read as a walk beside the others', () => {
    const older = { ...three[0], kos: { ...three[0].kos, distanceBasis: undefined } };
    const row = [...render(comparisonTable([older, three[1]])).querySelectorAll('tbody tr')].find(
      (tr) => tr.querySelector('th').textContent.trim() === 'Distance to campus',
    );
    expect([...row.querySelectorAll('.ledger__cell-value')].map((value) => value.textContent.trim())).toEqual([
      `${formatDistance(older.kos.distanceKm)} (straight\u00a0line)`,
      formatDistance(three[1].kos.distanceKm),
    ]);
  });

  const scores = [
    { total: 65, leader: false, missing: null },
    { total: null, leader: false, missing: 'security and monthly rent' },
    { total: 80, leader: true, missing: null },
  ];

  it('opens with a Best Match score section above Kos information when given scores', () => {
    const scored = render(comparisonTable(three, { scores }));
    const titles = [...scored.querySelectorAll('section.ledger-section h2')].map((h) => h.textContent.trim());
    expect(titles.slice(0, 2)).toEqual(['Best Match score', 'Kos information']);
    const cells = [...scored.querySelector('section.ledger-section tbody tr').querySelectorAll('td')];
    expect(cells.map((td) => td.querySelector('.ledger__cell-value').textContent.trim())).toEqual([
      '65',
      'Score unavailable — security and monthly rent not recorded',
      '80',
    ]);
    expect(cells.map((td) => td.classList.contains('ledger__best'))).toEqual([false, false, true]);
    expect(cells[1].querySelector('.unrecorded')).not.toBeNull();
  });

  it('has no score section without scores', () => {
    expect(host.textContent).not.toContain('Best Match score');
  });

  it('keeps the score in its section: the kos names carry none', () => {
    const scored = render(comparisonTable(three, { scores }));
    const headers = [...scored.querySelectorAll('.ledger__kos')].map((n) => n.textContent.trim());
    expect(new Set(headers)).toEqual(new Set(names));
    const firstRow = scored.querySelector('section.ledger-section tbody tr');
    expect(firstRow.querySelector('th').textContent.trim()).toBe('Score');
    expect([...firstRow.querySelectorAll('.ledger__cell-label')].map((n) => n.textContent.trim())).toEqual(names);
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

  it('makes every slot a button: an empty one adds a kos, a filled one changes its kos', () => {
    const host = render(compareBar(ownSurveys.slice(0, 1), { shown: false }));
    const picks = [...host.querySelectorAll('.compare-chip__pick')];
    expect(picks).toHaveLength(MAX_COMPARE);
    expect(picks.map((b) => [b.dataset.action, b.dataset.slot])).toEqual([
      ['change-compare', '0'],
      ['open-picker', '1'],
      ['open-picker', '2'],
    ]);
    expect(picks[0].dataset.id).toBe(ownSurveys[0].id);
    expect(picks[0].getAttribute('aria-label')).toBe(`Change ${ownSurveys[0].kos.name}`);
    expect(picks[1].getAttribute('aria-label')).toBe('Add kos 2');
    for (const pick of picks) expect(pick.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('shows Add, Change and Remove as icons, named for screen readers and in a tooltip', () => {
    const host = render(compareBar(ownSurveys.slice(0, 1), { shown: false }));
    const [filled, empty] = host.querySelectorAll('.compare-chip');
    expect(filled.textContent.trim()).toBe(ownSurveys[0].kos.name);
    expect(empty.textContent.trim()).toBe('Kos 2');
    const icons = [
      filled.querySelector('.compare-chip__hint'),
      filled.querySelector('.compare-chip__remove'),
      empty.querySelector('.compare-chip__hint'),
    ];
    expect(icons.map((node) => node.getAttribute('title'))).toEqual(['Change', 'Remove', 'Add']);
    for (const node of icons) expect(node.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(filled.querySelector('.compare-chip__remove').getAttribute('aria-label')).toBe(
      `Remove ${ownSurveys[0].kos.name} from the comparison`,
    );
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

  it('says how many drafts it leaves out, and that publishing one makes it comparable', () => {
    const host = render(candidatePickerDialog({ ...candidates, drafts: 2 }, []));
    const own = host.querySelector('.picker-group');
    expect(text(own.querySelector('.picker-group__note'))).toBe('2 drafts aren’t listed. Publish a survey to compare it.');
    expect(listed(own)).toEqual(candidates.own.map((s) => s.kos.name));
    expect(text(host.querySelector('.picker-dialog__body > .meta'))).toBe('Your published surveys and the community’s. Up to 3 at once.');
  });

  it('says so when every survey of your own is still a draft', () => {
    const host = render(candidatePickerDialog({ own: [], community: candidates.community, drafts: 1 }, []));
    const own = host.querySelector('.picker-group');
    expect(own.querySelector('.listing')).toBeNull();
    expect(text(own.querySelector('.meta'))).toBe('One draft isn’t listed: only published surveys can be compared.');
    const link = own.querySelector('a[href="#/surveys"]');
    expect(text(link)).toBe('Go to my surveys');
    expect(link.dataset.action).toBe('close-picker');
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

  describe('opened from a filled slot', () => {
    const [current, other] = candidates.own;
    const third = candidates.community[0];
    const host = render(candidatePickerDialog(candidates, [current.id, other.id], { replacing: current }));
    const buttonFor = (id) => host.querySelector(`.listing [data-id="${id}"]`);

    it('says which kos it changes', () => {
      expect(text(host.querySelector('#picker-dialog-title'))).toBe('Change kos');
      expect(text(host.querySelector('.picker-dialog__body > .meta'))).toBe(
        `Choose a kos to compare in place of ${current.kos.name}, or remove it.`,
      );
    });

    it('swaps in any kos not already compared, and holds the rest', () => {
      expect(text(buttonFor(current.id))).toBe('Current');
      expect(buttonFor(current.id).disabled).toBe(true);
      expect(text(buttonFor(other.id))).toBe('Selected');
      expect(buttonFor(other.id).disabled).toBe(true);
      expect(text(buttonFor(third.id))).toBe('Choose');
      expect(buttonFor(third.id).dataset.action).toBe('replace-compare');
      expect(host.querySelector('[data-action="toggle-compare"]')).toBeNull();
    });

    it('removes the kos, or leaves it be, from its foot', () => {
      const foot = host.querySelector('.picker-dialog__foot');
      const remove = foot.querySelector('[data-action="remove-compare"]');
      expect(text(remove)).toBe(`Remove ${current.kos.name}`);
      expect(remove.dataset.id).toBe(current.id);
      expect(text(foot.querySelector('[data-action="close-picker"]'))).toBe('Cancel');
    });
  });
});

describe('the compare page', () => {
  beforeEach(() => localStorage.clear());

  // The store reads storage once at import, so each render gets a fresh copy.
  async function renderWith(count, shown) {
    vi.resetModules();
    const store = await import('../src/store.js');
    const { renderCompare } = await import('../src/features/compare.js');
    store.compareCandidates().own.slice(0, count).forEach((s) => store.toggleCompare(s.id));
    if (shown) store.showComparison();
    return render(renderCompare());
  }

  it('picks kos from the slots, with no Add kos button and no picker beside the table', async () => {
    const host = await renderWith(3, true);
    expect(host.querySelectorAll('.compare-bar [data-action="change-compare"]')).toHaveLength(3);
    expect(host.querySelector('[data-action="open-picker"]')).toBeNull();
    expect(host.querySelector('.compare-bar__actions').textContent).not.toContain('Add kos');
    expect(host.querySelector('.compare-layout')).toBeNull();
    expect(host.querySelector('[data-action="toggle-compare"]')).toBeNull();
  });

  it('still lets every kos be removed without leaving the page, from its chip', async () => {
    const host = await renderWith(3, true);
    const removes = [...host.querySelectorAll('[data-action="remove-compare"]')];
    expect(removes).toHaveLength(3);
    for (const button of removes) expect(button.closest('.compare-chip')).not.toBeNull();
  });

  it('leaves Compare as the one action while choosing', async () => {
    const host = await renderWith(2, false);
    const actions = [...host.querySelectorAll('.compare-bar__actions .btn')].map((b) => b.dataset.action);
    expect(actions).toEqual(['show-comparison']);
  });

  it('scores each kos in the score section as the Best Match panel does', async () => {
    const host = await renderWith(3, true);
    const { computeBestMatch } = await import('../src/features/bestMatch.js');
    const store = await import('../src/store.js');
    const selected = store.selectedForCompare();
    const totals = computeBestMatch(selected, store.bestMatchWeights()).scored.map((item) => item.total);
    const section = host.querySelector('section.ledger-section');
    expect(section.querySelector('h2').textContent.trim()).toBe('Best Match score');
    const values = [...section.querySelectorAll('td .ledger__cell-value')].map((v) => v.textContent.trim());
    totals.forEach((total, i) => {
      if (total !== null) expect(values[i]).toBe(String(total));
      else expect(values[i]).toMatch(/^Score unavailable — .+ not recorded$/);
    });
  });

  it('points to the empty slots before anything is selected', async () => {
    const host = await renderWith(0, false);
    expect(host.querySelectorAll('.compare-bar [data-action="open-picker"]')).toHaveLength(MAX_COMPARE);
    expect(host.textContent).toContain('Choose an empty slot above to pick');
  });
});
