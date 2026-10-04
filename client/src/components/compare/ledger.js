import { cx } from '../ui/styles.js';

/**
 * The ledger's classes: a table on wide screens, and at 900px and under each row stacked as a block
 * with its values under it (explicit ARIA roles keep it a table for screen readers).
 */

export const table = ({ sectioned = false } = {}) =>
  cx('min-w-160 rounded-none max-xl:block max-xl:min-w-0', sectioned && 'table-fixed');

/** The narrow layout hides the column headers from sight only. */
export const head = ({ hidden = false } = {}) => (hidden ? 'sr-only' : 'max-xl:sr-only');

export const body = ({ sectioned = false } = {}) =>
  sectioned
    ? 'max-xl:block max-xl:bg-surface'
    : 'max-xl:mb-4 max-xl:block max-xl:overflow-hidden max-xl:rounded-md max-xl:border max-xl:border-rule max-xl:bg-surface';

export const row = 'max-xl:block max-xl:border-b max-xl:border-rule max-xl:px-4 max-xl:py-3 max-xl:last:border-b-0';

const edges = (last) => cx('border-r border-rule last:border-r-0 max-xl:border-0', !last && 'border-b');

/** A column header; the criterion corner stays painted over the columns that scroll under it. */
export function columnHeader({ corner = false, rule = true } = {}) {
  return cx(
    'sticky top-0 border-r border-rule p-3 text-left align-top font-narrow text-xs font-semibold last:border-r-0',
    rule ? 'border-b-2 border-b-ink' : 'border-b-0',
    corner ? 'left-0 z-3 w-50 min-w-40 bg-paper text-muted' : 'z-2 bg-surface',
  );
}

/** The criterion column is chrome: tinted, and kept legible while the columns scroll under it. */
export function rowHeader({ last = false, differs = false, quiet = false } = {}) {
  let colour = 'font-normal text-muted max-xl:font-semibold max-xl:text-ink';
  if (quiet) colour = 'font-normal text-muted max-xl:font-semibold';
  // Differing rows: the label steps up to ink semibold; deliberately no bar or inset rule.
  else if (differs) colour = 'font-semibold text-ink max-xl:text-accent';
  return cx(
    edges(last),
    'sticky left-0 z-1 w-50 min-w-40 bg-paper p-3 text-left align-top',
    'max-xl:static max-xl:block max-xl:w-auto max-xl:min-w-0 max-xl:bg-transparent max-xl:px-0 max-xl:pt-0 max-xl:pb-2',
    colour,
  );
}

const LAYOUT = {
  value: 'max-xl:items-baseline max-xl:justify-between max-xl:gap-4 max-xl:py-1',
  prose: 'max-xl:flex-col max-xl:items-stretch max-xl:gap-1 max-xl:py-2',
  breakdown: 'max-xl:items-baseline max-xl:justify-start max-xl:gap-1 max-xl:py-1',
};

export function cell({ last = false, layout = 'value', className = '' } = {}) {
  return cx(edges(last), 'p-3 text-left align-top max-xl:flex max-xl:px-0', LAYOUT[layout], className);
}

/** The kos name beside each value, for the stacked layout only; aria-hidden, as the column header names it. */
export const cellLabel = ({ prose = false } = {}) =>
  cx('hidden font-narrow text-xs font-semibold text-muted max-xl:block', prose ? 'max-xl:flex-none' : 'max-xl:flex-1');

/** Notes keep their line breaks and wrap anywhere: a pasted link would otherwise overflow. */
export const cellValue = ({ prose = false } = {}) =>
  prose
    ? 'block leading-body whitespace-pre-wrap wrap-anywhere max-xl:max-w-notes max-xl:tabular-nums max-xl:lining-nums'
    : 'max-xl:shrink-0 max-xl:tabular-nums max-xl:lining-nums';
