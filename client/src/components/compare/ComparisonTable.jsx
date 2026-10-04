import { useEffect, useState } from 'react';
import { MISSING, buildGroups, rowDiffers, scoreGroup } from '../../utils/comparison.js';
import { cx, unrecorded } from '../ui/styles.js';
import * as ledger from './ledger.js';

/** Never truncated: every criterion and all 31 facilities, each with an explicit ✓ or —. */

/** The columns arrive left to right as the comparison opens; reduced motion skips it. */
function useReveal() {
  const [revealing, setRevealing] = useState(false);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    setRevealing(true);
    const timer = setTimeout(() => setRevealing(false), 900);
    return () => clearTimeout(timer);
  }, []);
  return (column) =>
    revealing ? { className: 'motion-safe:animate-ledger-in', style: { animationDelay: `${column * 120}ms` } } : { className: '' };
}

/** One column set for every table, so the columns line up across sections. */
function Columns({ count }) {
  return (
    <colgroup>
      <col className="w-50" />
      {Array.from({ length: count }, (_, index) => (
        <col key={index} />
      ))}
    </colgroup>
  );
}

// Names only: a kos is removed from its chip or the picker, never from the table.
function HeaderRow({ names, rule = true, reveal = null }) {
  return (
    <tr role="row">
      <th className={ledger.columnHeader({ corner: true, rule })} scope="col" role="columnheader">
        Criterion
      </th>
      {names.map((name, index) => {
        const motion = reveal?.(index) ?? { className: '' };
        return (
          <th key={index} className={cx(ledger.columnHeader({ rule }), motion.className)} style={motion.style} scope="col" role="columnheader">
            <span className="text-base font-semibold text-ink" data-kos-name>
              {name}
            </span>
          </th>
        );
      })}
    </tr>
  );
}

function Value({ row, value, index, name, last, reveal }) {
  const motion = reveal(index);
  const label = (prose = false) => (
    <span className={ledger.cellLabel({ prose })} aria-hidden="true" data-cell-label>
      {name}
    </span>
  );
  const td = (content, { prose = false, best = false, className = '' } = {}) => (
    <td
      className={cx(ledger.cell({ last, layout: prose ? 'prose' : 'value' }), className, motion.className)}
      style={motion.style}
      role="cell"
      data-best={best ? 'true' : undefined}
    >
      {label(prose)}
      <span className={ledger.cellValue({ prose })} data-cell-value>
        {content}
      </span>
    </td>
  );

  if (row.kind === 'facility') {
    return value
      ? td(<>✓<span className="sr-only"> present</span></>, { className: 'font-semibold text-accent' })
      : td(<>—<span className="sr-only"> not available</span></>, { className: 'text-muted' });
  }
  if (row.kind === 'score') {
    const score = row.scores[index];
    if (score.total === null) {
      return td(<span className={unrecorded}>Score unavailable — {score.missing} not recorded</span>);
    }
    return td(score.total, { best: score.leader, className: cx('tabular-nums lining-nums', score.leader && 'font-semibold text-accent') });
  }
  if (value === MISSING) return td(<span className={unrecorded}>Not recorded</span>);
  const best = row.best === index;
  return td(value, {
    prose: row.prose,
    best,
    className: cx(!row.prose && 'tabular-nums lining-nums', best && 'font-semibold text-accent'),
  });
}

const card = 'min-w-160 overflow-clip rounded-md border border-rule bg-surface max-xl:min-w-0';

/** Each table repeats its column headers for assistive technology; they show once, above. */
function Section({ group, index, names, reveal }) {
  const id = `ledger-group-${index}`;
  return (
    <section className={card} aria-labelledby={id}>
      <h2 className="border-b-2 border-ink bg-accent-tint px-4 py-3 text-md leading-snug font-bold text-ink" id={id}>
        {group.label}
      </h2>
      <table className={ledger.table({ sectioned: true })} role="table" aria-labelledby={id}>
        <Columns count={names.length} />
        <thead className={ledger.head({ hidden: true })} role="rowgroup">
          <HeaderRow names={names} />
        </thead>
        <tbody className={ledger.body({ sectioned: true })} role="rowgroup">
          {group.rows.map((row, rowIndex) => {
            // The card's border closes each section; a last-row rule would double it.
            const last = rowIndex === group.rows.length - 1;
            const differs = rowDiffers(row);
            return (
              <tr key={row.label} className={ledger.row} role="row" data-differs={differs ? 'true' : 'false'}>
                <th className={ledger.rowHeader({ last, differs })} scope="row" role="rowheader">
                  {row.label}
                </th>
                {row.values.map((value, valueIndex) => (
                  <Value
                    key={valueIndex}
                    row={row}
                    value={value}
                    index={valueIndex}
                    name={names[valueIndex]}
                    last={last}
                    reveal={reveal}
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/** `scores`: each kos's Best Match `{ total, leader, missing }`; omitted, there is no score section. */
export function ComparisonTable({ surveys, scores = null }) {
  const reveal = useReveal();
  const groups = [...(scores ? [scoreGroup(scores)] : []), ...buildGroups(surveys)];
  const names = surveys.map((survey) => survey.kos.name);

  // One scroller for every section, so the columns stay lined up when it scrolls.
  return (
    <div className="flex flex-col gap-4 overflow-x-auto max-xl:overflow-x-visible" data-comparison>
      <div className={cx(card, 'max-xl:hidden')}>
        <table className={ledger.table({ sectioned: true })} role="table" aria-label="Kos in this comparison">
          <Columns count={names.length} />
          <thead role="rowgroup">
            {/* The names card is its own frame, so the heavy group rule would double it. */}
            <HeaderRow names={names} rule={false} reveal={reveal} />
          </thead>
        </table>
      </div>
      {groups.map((group, index) => (
        <Section key={group.label} group={group} index={index} names={names} reveal={reveal} />
      ))}
    </div>
  );
}
