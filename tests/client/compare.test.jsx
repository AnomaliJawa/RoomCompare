import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ComparisonTable } from '../../client/src/components/compare/ComparisonTable.jsx';
import { PickerContent } from '../../client/src/components/compare/CandidatePicker.jsx';
import { CompareBar } from '../../client/src/components/compare/CompareBar.jsx';
import { ownSurveys } from '../../client/src/seed/ownSurveys.js';
import { communitySurveys } from '../../client/src/seed/communitySurveys.js';
import { formatDistance } from '../../client/src/utils/format.js';
import {
  ROOM_FACILITIES,
  BATHROOM_FACILITIES,
  SHARED_FACILITIES,
  SURROUNDINGS,
  MAX_COMPARE,
  MIN_COMPARE,
} from '../../client/src/constants.js';

const three = ownSurveys.slice(0, 3);
const names = three.map((s) => s.kos.name);
const text = (node) => node.textContent.replace(/\s+/g, ' ').trim();

const sectionsOf = (container) => [...container.querySelectorAll('section[aria-labelledby]')];
const rowLabels = (container) => [...container.querySelectorAll('tbody th[scope="row"]')].map(text);
const rowNamed = (container, label) => [...container.querySelectorAll('tbody tr')].find((tr) => text(tr.querySelector('th')) === label);
const values = (row) => [...row.querySelectorAll('[data-cell-value]')].map((value) => value.textContent.trim());

describe('the comparison, one section per category', () => {
  it('gives every category its own section, in the requirement order', () => {
    const { container } = render(<ComparisonTable surveys={three} />);
    expect(sectionsOf(container).map((s) => text(s.querySelector('h2')))).toEqual([
      'Kos information',
      'Room',
      'Bathroom',
      'Shared facilities',
      'Surroundings',
      'Additional information',
    ]);
  });

  it('names each table by its section heading', () => {
    const { container } = render(<ComparisonTable surveys={three} />);
    for (const section of sectionsOf(container)) {
      expect(section.querySelector('table').getAttribute('aria-labelledby')).toBe(section.querySelector('h2').id);
    }
  });

  // Never truncated: splitting the table must not drop rows.
  it('keeps every criterion and every facility row', () => {
    const { container } = render(<ComparisonTable surveys={three} />);
    const labels = rowLabels(container);
    for (const item of [...ROOM_FACILITIES, ...BATHROOM_FACILITIES, ...SHARED_FACILITIES, ...SURROUNDINGS]) {
      expect(labels).toContain(item);
    }
    expect(labels).toHaveLength(42);
  });

  it('marks every facility present ✓ or absent —, saying which to a screen reader', () => {
    const { container } = render(<ComparisonTable surveys={three} />);
    const marks = values(rowNamed(container, 'Wifi'));
    for (const mark of marks) expect(['✓ present', '— not available']).toContain(mark);
  });

  it('leaves out draft or published, which describes the record rather than the kos', () => {
    const { container } = render(<ComparisonTable surveys={three} />);
    expect(rowLabels(container)).not.toContain('Status');
    expect(container.textContent).not.toMatch(/\b(Draft|Published)\b/);
  });

  it('gives every table the same column set, so the columns line up across sections', () => {
    const { container } = render(<ComparisonTable surveys={three} />);
    const tables = [...container.querySelectorAll('table')];
    expect(tables).toHaveLength(sectionsOf(container).length + 1);
    for (const table of tables) expect(table.querySelectorAll('colgroup col')).toHaveLength(three.length + 1);
  });

  it('keeps column headers inside every section, for screen readers', () => {
    const { container } = render(<ComparisonTable surveys={three} />);
    for (const section of sectionsOf(container)) {
      expect([...section.querySelectorAll('thead th[scope="col"]')].map(text)).toEqual(['Criterion', ...names]);
    }
  });

  it('treats notes as prose rather than figures, word for word', () => {
    const { container } = render(<ComparisonTable surveys={three} />);
    const cells = [...rowNamed(container, 'Notes').querySelectorAll('td')];
    three.forEach((survey, i) => {
      if (!survey.additional.notes) return;
      const value = cells[i].querySelector('[data-cell-value]');
      expect(value.textContent).toBe(survey.additional.notes);
      expect(value.className).toContain('whitespace-pre-wrap');
      expect(cells[i].className).not.toContain('tabular-nums');
    });
  });

  it("keeps a note's own line breaks in the text it renders", () => {
    const written = { ...three[0], additional: { ...three[0].additional, notes: 'Quiet street.\n\nGate locks at 10pm.' } };
    const { container } = render(<ComparisonTable surveys={[written, three[1]]} />);
    expect(rowNamed(container, 'Notes').querySelector('[data-cell-value]').textContent).toBe('Quiet street.\n\nGate locks at 10pm.');
  });

  it('marks a distance that is only a straight line, so it is not read as a walk beside the others', () => {
    const older = { ...three[0], kos: { ...three[0].kos, distanceBasis: undefined } };
    const { container } = render(<ComparisonTable surveys={[older, three[1]]} />);
    expect(values(rowNamed(container, 'Distance to campus'))).toEqual([
      `${formatDistance(older.kos.distanceKm)} (straight line)`,
      formatDistance(three[1].kos.distanceKm),
    ]);
  });

  it('reads "Not recorded" where nothing was captured, never a blank', () => {
    const bare = { ...three[0], kos: { ...three[0].kos, type: null, rent: null } };
    const { container } = render(<ComparisonTable surveys={[bare, three[1]]} />);
    expect(values(rowNamed(container, 'Type'))[0]).toBe('Not recorded');
    expect(values(rowNamed(container, 'Monthly rent'))[0]).toBe('Not recorded');
  });

  it('marks the lowest rent as the best value, and none when there is no difference', () => {
    const { container } = render(<ComparisonTable surveys={three} />);
    const rents = three.map((s) => s.kos.rent);
    const best = [...rowNamed(container, 'Monthly rent').querySelectorAll('td')].map((td) => td.dataset.best === 'true');
    expect(best).toEqual(rents.map((rent) => rent === Math.min(...rents)));

    const same = render(<ComparisonTable surveys={[three[0], three[0]]} />);
    expect(rowNamed(same.container, 'Monthly rent').querySelector('[data-best]')).toBeNull();
  });

  it('marks the label of a row whose values differ, and only those', () => {
    const { container } = render(<ComparisonTable surveys={three} />);
    expect(rowNamed(container, 'Monthly rent').dataset.differs).toBe('true');
    const { container: alike } = render(<ComparisonTable surveys={[three[0], three[0]]} />);
    expect(rowNamed(alike, 'Monthly rent').dataset.differs).toBe('false');
  });

  const scores = [
    { total: 65, leader: false, missing: null },
    { total: null, leader: false, missing: 'security and monthly rent' },
    { total: 80, leader: true, missing: null },
  ];

  it('opens with a Best Match score section above Kos information when given scores', () => {
    const { container } = render(<ComparisonTable surveys={three} scores={scores} />);
    expect(sectionsOf(container).slice(0, 2).map((s) => text(s.querySelector('h2')))).toEqual(['Best Match score', 'Kos information']);
    const cells = [...sectionsOf(container)[0].querySelectorAll('tbody td')];
    expect(cells.map((td) => td.querySelector('[data-cell-value]').textContent.trim())).toEqual([
      '65',
      'Score unavailable — security and monthly rent not recorded',
      '80',
    ]);
    expect(cells.map((td) => td.dataset.best === 'true')).toEqual([false, false, true]);
  });

  it('has no score section without scores', () => {
    const { container } = render(<ComparisonTable surveys={three} />);
    expect(container.textContent).not.toContain('Best Match score');
  });

  it('keeps the score in its section: the kos names carry none', () => {
    const { container } = render(<ComparisonTable surveys={three} scores={scores} />);
    expect(new Set([...container.querySelectorAll('[data-kos-name]')].map(text))).toEqual(new Set(names));
    const firstRow = sectionsOf(container)[0].querySelector('tbody tr');
    expect(text(firstRow.querySelector('th'))).toBe('Score');
    expect([...firstRow.querySelectorAll('[data-cell-label]')].map(text)).toEqual(names);
  });

  it('leaves removing a kos to the compare bar: the table carries no Remove', () => {
    render(<ComparisonTable surveys={three} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  describe('as it opens', () => {
    afterEach(() => {
      vi.useRealTimers();
      delete window.matchMedia;
    });

    it('brings its columns in one after another, then settles', () => {
      vi.useFakeTimers();
      window.matchMedia = () => ({ matches: false });
      const { container } = render(<ComparisonTable surveys={three} />);
      const cells = [...rowNamed(container, 'Type').querySelectorAll('td')];
      expect(cells.map((td) => td.style.animationDelay)).toEqual(['0ms', '120ms', '240ms']);
      act(() => vi.advanceTimersByTime(900));
      expect(cells.every((td) => !td.className.includes('animate-'))).toBe(true);
    });

    it('stays still under reduced motion', () => {
      window.matchMedia = (query) => ({ matches: query.includes('reduce') });
      const { container } = render(<ComparisonTable surveys={three} />);
      expect(container.querySelector('[class*="animate-"]')).toBeNull();
    });
  });
});

describe('the compare bar', () => {
  const bar = (selected, props = {}) =>
    render(<CompareBar selected={selected} shown={false} onAdd={() => {}} onChange={() => {}} onCompare={() => {}} onStartOver={() => {}} {...props} />);

  it('always holds one card per slot, filled or empty, so the row never changes shape', () => {
    for (let count = 0; count <= MAX_COMPARE; count++) {
      const { container, unmount } = bar(ownSurveys.slice(0, count));
      expect(container.querySelectorAll('[data-slots] > li')).toHaveLength(MAX_COMPARE);
      expect(container.querySelectorAll('[aria-label^="Add kos"]')).toHaveLength(MAX_COMPARE - count);
      unmount();
    }
  });

  it('takes its number of equal columns from MAX_COMPARE', () => {
    const { container } = bar(three, { shown: true });
    expect(container.querySelector('[data-slots]').getAttribute('style')).toContain(`--slots: ${MAX_COMPARE}`);
  });

  it('shows each kos by name only, without the rent', () => {
    const { container } = bar(three, { shown: true });
    expect(container.querySelector('[data-slots]').textContent).not.toMatch(/Rp/);
  });

  it('keeps the full name reachable when a long one is cut short', () => {
    bar(three, { shown: true });
    for (const name of names) expect(screen.getByText(name).getAttribute('title')).toBe(name);
  });

  it('makes every slot a button: an empty one adds a kos, a filled one changes its kos', () => {
    const onAdd = vi.fn();
    const onChange = vi.fn();
    const { container } = bar(ownSurveys.slice(0, 1), { onAdd, onChange });
    const picks = [...container.querySelectorAll('[data-slot]')];
    expect(picks.map((b) => [b.getAttribute('aria-label'), b.dataset.slot])).toEqual([
      [`Change ${ownSurveys[0].kos.name}`, '0'],
      ['Add kos 2', '1'],
      ['Add kos 3', '2'],
    ]);
    for (const pick of picks) expect(pick.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(picks[0]);
    fireEvent.click(picks[2]);
    expect(onChange).toHaveBeenCalledWith(ownSurveys[0].id, 0);
    expect(onAdd).toHaveBeenCalledWith(2);
  });

  it('shows Add, Change and Remove as icons, named for screen readers and in a tooltip', () => {
    const { container } = bar(ownSurveys.slice(0, 1));
    const [filled, empty] = container.querySelectorAll('[data-slots] > li');
    expect(text(filled)).toBe(ownSurveys[0].kos.name);
    expect(text(empty)).toBe('Kos 2');
    const icons = [filled.querySelector('[title="Change"]'), filled.querySelector('[title="Remove"]'), empty.querySelector('[title="Add"]')];
    for (const node of icons) expect(node.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(filled.querySelector('[title="Remove"]').getAttribute('aria-label')).toBe(`Remove ${ownSurveys[0].kos.name} from the comparison`);
  });

  it('opens the comparison only with two, and offers Start over once it is open', () => {
    const one = bar(ownSurveys.slice(0, 1));
    expect(screen.getByRole('button', { name: 'Compare' }).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('1 of 3 selected, 1 more to compare.');
    one.unmount();
    bar(three, { shown: true });
    expect(screen.queryByRole('button', { name: 'Compare' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Start over' })).toBeTruthy();
  });
});

describe('the kos picker', () => {
  const candidates = { own: ownSurveys.slice(0, 5), community: communitySurveys.slice(0, 4) };
  const everyKos = [...candidates.own, ...candidates.community];
  const picker = (props) => render(<PickerContent candidates={candidates} selection={[]} {...props} />);
  const groups = (container) => [...container.querySelectorAll('section[aria-labelledby]')];
  const listed = (group) => [...group.querySelectorAll('[data-candidate]')].map(text);

  it('is titled for the dialog and counts the selection', () => {
    picker({ selection: [candidates.own[0].id] });
    expect(text(document.getElementById('picker-dialog-title'))).toBe('Add kos');
    expect(screen.getByRole('status').textContent.trim()).toBe(`1 of ${MAX_COMPARE} selected, 1 more to compare.`);
  });

  it('lists your own surveys and every community survey, each under its source', () => {
    const { container } = picker();
    const titles = groups(container).map((group) => document.getElementById(group.getAttribute('aria-labelledby')));
    expect(titles.map(text)).toEqual(['My surveys', 'Community']);
    expect(listed(groups(container)[0])).toEqual(candidates.own.map((s) => s.kos.name));
    expect(listed(groups(container)[1])).toEqual(candidates.community.map((s) => s.kos.name));
  });

  it('lets kos from both sources be picked together', () => {
    const picked = [candidates.own[0].id, candidates.community[0].id];
    picker({ selection: picked });
    expect(screen.getAllByRole('button', { name: 'Selected' }).map((button) => button.dataset.id)).toEqual(picked);
  });

  it('says what to do when you have no surveys of your own, closing as it leaves', () => {
    const { container } = render(<PickerContent candidates={{ own: [], community: candidates.community }} selection={[]} />);
    const [own, community] = groups(container);
    expect(own.querySelector('[data-candidate]')).toBeNull();
    expect(within(own).getByText('You have not recorded a kos yet.')).toBeTruthy();
    expect(within(own).getByRole('link', { name: 'Add survey' }).getAttribute('href')).toBe('#/surveys/new');
    expect(listed(community)).toEqual(candidates.community.map((s) => s.kos.name));
  });

  it('says how many drafts it leaves out, and that publishing one makes it comparable', () => {
    const { container } = render(<PickerContent candidates={{ ...candidates, drafts: 2 }} selection={[]} />);
    expect(within(groups(container)[0]).getByText('2 drafts aren’t listed. Publish a survey to compare it.')).toBeTruthy();
    expect(listed(groups(container)[0])).toEqual(candidates.own.map((s) => s.kos.name));
    expect(text(container.querySelector('[data-picker-intro]'))).toBe('Your published surveys and the community’s. Up to 3 at once.');
  });

  it('says so when every survey of your own is still a draft', () => {
    const { container } = render(<PickerContent candidates={{ own: [], community: candidates.community, drafts: 1 }} selection={[]} />);
    const own = groups(container)[0];
    expect(within(own).getByText('One draft isn’t listed: only published surveys can be compared.')).toBeTruthy();
    expect(within(own).getByRole('link', { name: 'Go to my surveys' }).getAttribute('href')).toBe('#/surveys');
  });

  it('says so when there are no community surveys', () => {
    const { container } = render(<PickerContent candidates={{ own: candidates.own, community: [] }} selection={[]} />);
    expect(within(groups(container)[1]).getByText('No community surveys to show right now.')).toBeTruthy();
  });

  it('refuses a fourth kos with a reason, rather than dropping one', () => {
    picker({ selection: everyKos.slice(0, MAX_COMPARE).map((s) => s.id) });
    const blocked = screen.getAllByRole('button', { name: `Maximum of ${MAX_COMPARE}` });
    expect(blocked).toHaveLength(everyKos.length - MAX_COMPARE);
    for (const button of blocked) expect(button.disabled).toBe(true);
  });

  it('closes from its head, and compares from its foot only once two are picked', () => {
    const first = picker();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Compare' }).disabled).toBe(true);
    first.unmount();
    picker({ selection: everyKos.slice(0, MIN_COMPARE).map((s) => s.id) });
    expect(screen.getByRole('button', { name: 'Compare' }).disabled).toBe(false);
  });

  describe('opened from a filled slot', () => {
    const [current, other] = candidates.own;
    const third = candidates.community[0];
    const changing = (props = {}) => picker({ selection: [current.id, other.id], replacing: current, ...props });
    const buttonFor = (container, id) => container.querySelector(`li [data-id="${id}"]`);

    it('says which kos it changes', () => {
      const { container } = changing();
      expect(text(document.getElementById('picker-dialog-title'))).toBe('Change kos');
      expect(text(container.querySelector('[data-picker-intro]'))).toBe(`Choose a kos to compare in place of ${current.kos.name}, or remove it.`);
    });

    it('swaps in any kos not already compared, and holds the rest', () => {
      const onReplace = vi.fn();
      const { container } = changing({ onReplace });
      expect([text(buttonFor(container, current.id)), buttonFor(container, current.id).disabled]).toEqual(['Current', true]);
      expect([text(buttonFor(container, other.id)), buttonFor(container, other.id).disabled]).toEqual(['Selected', true]);
      expect(text(buttonFor(container, third.id))).toBe('Choose');
      fireEvent.click(buttonFor(container, third.id));
      expect(onReplace).toHaveBeenCalledWith(third.id);
      expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    });

    it('removes the kos, or leaves it be, from its foot', () => {
      const onRemove = vi.fn();
      changing({ onRemove });
      fireEvent.click(screen.getByRole('button', { name: `Remove ${current.kos.name}` }));
      expect(onRemove).toHaveBeenCalledWith(current.id);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    });
  });
});

describe('the compare page', () => {
  beforeEach(() => localStorage.clear());

  // The store reads storage once at import, so each render gets a fresh copy.
  async function page(count, shown) {
    vi.resetModules();
    const store = await import('../../client/src/data/store.js');
    const { ComparePage } = await import('../../client/src/pages/ComparePage.jsx');
    store.compareCandidates().own.slice(0, count).forEach((s) => store.toggleCompare(s.id));
    if (shown) store.showComparison();
    return { ...render(<ComparePage />), store };
  }

  it('picks kos from the slots, with no Add kos button and no picker beside the table', async () => {
    await page(3, true);
    const bar = screen.getByRole('region', { name: 'Selected for comparison' });
    expect(within(bar).getAllByRole('button', { name: /^Change / })).toHaveLength(3);
    expect(within(bar).queryByRole('button', { name: /^Add kos/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add to compare' })).toBeNull();
  });

  it('still lets every kos be removed without leaving the page, from its chip', async () => {
    await page(3, true);
    const bar = screen.getByRole('region', { name: 'Selected for comparison' });
    expect(within(bar).getAllByRole('button', { name: /from the comparison$/ })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /from the comparison$/ })).toHaveLength(3);
  });

  it('leaves Compare as the one action while choosing', async () => {
    await page(2, false);
    const bar = screen.getByRole('region', { name: 'Selected for comparison' });
    const actions = within(bar).getAllByRole('button').filter((button) => !button.dataset.slot && !button.title);
    expect(actions.map(text)).toEqual(['Compare']);
    expect(screen.getByRole('button', { name: 'Compare 2 kos' })).toBeTruthy();
  });

  it('scores each kos in the score section as the Best Match panel does', async () => {
    const { container, store } = await page(3, true);
    const { computeBestMatch } = await import('../../client/src/utils/bestMatch.js');
    const totals = computeBestMatch(store.selectedForCompare(), store.bestMatchWeights()).scored.map((item) => item.total);
    const section = sectionsOf(container).find((s) => text(s.querySelector('h2')) === 'Best Match score');
    const shown = [...section.querySelectorAll('td [data-cell-value]')].map((v) => v.textContent.trim());
    totals.forEach((total, i) => {
      if (total !== null) expect(shown[i]).toBe(String(total));
      else expect(shown[i]).toMatch(/^Score unavailable — .+ not recorded$/);
    });
  });

  it('points to the empty slots before anything is selected', async () => {
    const { container } = await page(0, false);
    expect(screen.getAllByRole('button', { name: /^Add kos \d$/ })).toHaveLength(MAX_COMPARE);
    expect(container.textContent).toContain('Choose an empty slot above to pick');
  });

  it('opens the picker from an empty slot, adds from it, and gives focus back to that slot', async () => {
    const { store } = await page(0, false);
    const slot = screen.getByRole('button', { name: 'Add kos 1' });
    fireEvent.click(slot);
    const dialog = document.querySelector('dialog[open]');
    expect(text(dialog.querySelector('#picker-dialog-title'))).toBe('Add kos');
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Add' })[0]);
    expect(store.getState().compareSelection).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(document.activeElement.dataset.slot).toBe('0');
  });

  it('compares straight from the picker once two kos are added', async () => {
    const { store } = await page(0, false);
    fireEvent.click(screen.getByRole('button', { name: 'Add kos 1' }));
    const dialog = document.querySelector('dialog[open]');
    const compare = () => within(dialog).getByRole('button', { name: 'Compare' });
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Add' })[0]);
    expect(compare().disabled).toBe(true);
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Add' })[0]);
    expect(compare().disabled).toBe(false);
    fireEvent.click(compare());
    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(store.getState().compareShown).toBe(true);
    expect(document.querySelector('[data-compare-result] table')).not.toBeNull();
  });

  it('changes a kos in its own slot, so the others keep their columns', async () => {
    const { store } = await page(2, true);
    const [first, second] = store.getState().compareSelection;
    fireEvent.click(screen.getByRole('button', { name: `Change ${store.findSurvey(first).kos.name}` }));
    const dialog = document.querySelector('dialog[open]');
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Choose' })[0]);
    const [now, kept] = store.getState().compareSelection;
    expect(now).not.toBe(first);
    expect(kept).toBe(second);
    expect(document.querySelector('dialog[open]')).toBeNull();
  });

  it('starts over with an Undo that brings the comparison back', async () => {
    const { store } = await page(3, true);
    const { ToastRegion } = await import('../../client/src/components/feedback/ToastRegion.jsx');
    render(<ToastRegion />);
    const before = [...store.getState().compareSelection];
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(store.getState().compareSelection).toEqual([]);
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(store.getState().compareSelection).toEqual(before);
    expect(store.getState().compareShown).toBe(true);
  });
});
