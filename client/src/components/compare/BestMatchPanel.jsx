import { useRef, useState } from 'react';
import * as store from '../../data/store.js';
import { useStore } from '../../hooks/useStore.js';
import { AMENITY_COUNT, BEST_MATCH_CRITERIA, TOTAL_FACILITY_COUNT, criterionLabel } from '../../constants.js';
import { t } from '../../i18n/index.js';
import { computeBestMatch, joinList } from '../../utils/bestMatch.js';
import { isDefault } from '../../utils/weights.js';
import { button, cx, meta, narrowLabel, unrecorded } from '../ui/styles.js';
import { CriteriaDialog } from './CriteriaDialog.jsx';
import * as ledger from './ledger.js';

/**
 * Optional, collapsed, and below the comparison. It imports nothing from the comparison, and reads
 * the weights from the store itself, so removing it from ComparePage is the import, the panel and
 * the `scores` passed to the table.
 */

/** For the comparison: each kos's total (null where an input is missing), whether it leads, and what is missing. */
export function bestMatchScores(surveys, weights = store.bestMatchWeights()) {
  const { scored, leaders } = computeBestMatch(surveys, weights);
  return scored.map((item) => ({
    total: item.total,
    leader: leaders.includes(item.survey.id),
    missing: item.missing.length ? joinList(item.missing) : null,
  }));
}

/** Names each figure on narrow screens; aria-hidden, as the column header names the cell. */
function CellLabel({ name, weight = false, quiet = false }) {
  return (
    <span
      className={cx(
        'hidden max-xl:flex max-xl:min-w-0 max-xl:flex-[0_1_auto]',
        weight
          ? 'max-xl:font-narrow max-xl:text-xs max-xl:font-semibold max-xl:text-muted'
          : cx('max-xl:font-sans max-xl:text-base max-xl:font-medium', quiet ? 'max-xl:text-muted' : 'max-xl:text-ink'),
      )}
      aria-hidden="true"
      data-cell-label
    >
      <span className="max-xl:truncate">{name}</span>:
    </span>
  );
}

const value = (weight) =>
  cx('max-xl:shrink-0 max-xl:tabular-nums max-xl:lining-nums', weight ? 'max-xl:font-narrow max-xl:text-xs max-xl:font-semibold max-xl:text-muted' : 'max-xl:font-semibold');

function PartCell({ part, name, quiet }) {
  const shown = part === null ? <span className={unrecorded}>—</span> : Math.round(part);
  return (
    <td className={cx(ledger.cell({ layout: 'breakdown' }), part !== null && 'tabular-nums lining-nums', quiet && 'text-muted')} role="cell">
      <CellLabel name={name} quiet={quiet} />
      <span className={value(false)} data-cell-value>
        {shown}
      </span>
    </td>
  );
}

function Score({ item, leaders }) {
  if (item.total === null) {
    return <span className={unrecorded}>{t('Score unavailable — {missing} not recorded', { missing: joinList(item.missing) })}</span>;
  }
  const leader = leaders.includes(item.survey.id);
  return (
    <span className={cx('inline-flex items-baseline gap-3 text-md font-semibold tabular-nums lining-nums', leader && 'text-accent')}>
      {item.total}
      {leader && <span className={cx(narrowLabel, 'border-l-2 border-accent pl-2')}>{t('Best match')}</span>}
    </span>
  );
}

const summary = cx(
  'relative flex cursor-pointer list-none flex-col gap-1 p-4 [&::-webkit-details-marker]:hidden',
  'after:absolute after:right-4 after:text-xs after:font-semibold after:text-accent',
  // The words come from the summary's data attributes, so they follow the language.
  'after:content-[attr(data-show)] group-open:after:content-[attr(data-hide)] focus-visible:-outline-offset-2',
);

/** Once opened it stays open: React keeps the element, and with it the open state. */
export function BestMatchPanel({ surveys }) {
  useStore();
  const weights = store.bestMatchWeights();
  const { scored, leaders } = computeBestMatch(surveys, weights);
  const tied = leaders.length > 1;
  const [editing, setEditing] = useState(false);
  const edit = useRef(null);

  return (
    <>
    <details className="group mt-6 rounded-md border border-rule bg-surface" data-best-match>
      <summary className={summary} data-show={t('Show')} data-hide={t('Hide')}>
        <span className="font-semibold">{t('Optional: weighted score')}</span>{' '}
        <span className={meta}>{t('A guide, not a recommendation. The decision stays yours.')}</span>
      </summary>

      <div className="flex flex-col gap-4 border-t border-rule p-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <p className={cx(meta, 'max-w-measure flex-[1_1_280px]')} data-best-match-note>
            {t('Scores are relative to these {count} kos, not to kos in general: the cheapest of three is not necessarily cheap.', {
              count: surveys.length,
            })}{' '}
            {isDefault(weights) ? t('The weights are the defaults.') : t('The weights are your own.')}
            {tied ? ` ${t('Two kos scored the same, so both are marked.')}` : ''}
          </p>
          <button
            ref={edit}
            className={button({ variant: 'secondary', size: 'small' })}
            type="button"
            aria-haspopup="dialog"
            onClick={() => setEditing(true)}
          >
            {t('Edit criteria')}
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {scored.map((item) => (
            <li key={item.survey.id} className="flex items-baseline justify-between gap-4 border-b border-rule pb-2 last:border-b-0">
              <span className="font-medium">{item.survey.kos.name}</span>
              <Score item={item} leaders={leaders} />
            </li>
          ))}
        </ul>

        <div className="overflow-x-auto rounded-md border border-rule bg-surface max-xl:overflow-x-visible max-xl:rounded-none max-xl:border-0 max-xl:bg-transparent">
          <table className={ledger.table()} role="table" data-breakdown>
            <thead className={ledger.head()} role="rowgroup">
              <tr role="row">
                <th className={ledger.columnHeader({ corner: true })} scope="col" role="columnheader">
                  {t('Criterion')}
                </th>
                <th className={cx(ledger.columnHeader(), 'tabular-nums lining-nums')} scope="col" role="columnheader">
                  {t('Weight')}
                </th>
                {surveys.map((survey) => (
                  <th key={survey.id} className={ledger.columnHeader()} scope="col" role="columnheader">
                    {survey.kos.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={ledger.body()} role="rowgroup">
              {BEST_MATCH_CRITERIA.map((criterion) => {
                // A criterion at 0% stays in the table, quieter: out of the score, not hidden.
                const off = weights[criterion.key] === 0;
                return (
                  <tr key={criterion.key} className={ledger.row} role="row" data-off={off ? 'true' : undefined}>
                    <th className={ledger.rowHeader({ quiet: off })} scope="row" role="rowheader">
                      {criterionLabel(criterion)}
                    </th>
                    <td className={cx(ledger.cell({ layout: 'breakdown' }), 'tabular-nums lining-nums', off && 'text-muted')} role="cell" data-weight>
                      <CellLabel name={t('Weight')} weight />
                      <span className={value(true)} data-cell-value>
                        {weights[criterion.key]}%
                      </span>
                    </td>
                    {scored.map((item) => (
                      <PartCell key={item.survey.id} part={item.parts[criterion.key]} name={item.survey.kos.name} quiet={off} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <dl className="my-[1em] grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-rule pt-3 text-xs max-lg:grid-cols-1 max-lg:gap-x-0 max-lg:gap-y-1 [&_dd]:max-w-measure [&_dd]:text-muted max-lg:[&_dd]:mb-2 [&_dt]:font-narrow [&_dt]:font-semibold [&_dt]:text-ink">
          <dt>{t('Price and distance')}</dt>
          <dd>{t('Ranked against the other kos here. Best value scores 100.')}</dd>
          <dt>{t('Facilities')}</dt>
          <dd>
            {t('Recorded facilities out of {facilities}: room and shared, a water heater, and an indoor bathroom.', {
              facilities: TOTAL_FACILITY_COUNT,
            })}
          </dd>
          <dt>{t('Cleanliness and security')}</dt>
          <dd>{t('The 1–4 rating, where 1 scores 0 and 4 scores 100.')}</dd>
          <dt>{t('Location')}</dt>
          <dd>
            {t(
              'Half nearness to campus, ranked as distance is, and half recorded surroundings out of {amenities}, any place of worship counting once. It needs the distance to campus recorded.',
              { amenities: AMENITY_COUNT },
            )}
          </dd>
          <dt>{t('Weights')}</dt>
          <dd>
            {t('Set with Edit criteria, as whole percentages that total 100%. A criterion at 0% is left out of the score, so it does not need to be recorded.')}
          </dd>
        </dl>
      </div>
    </details>
    <CriteriaDialog open={editing} onClose={() => setEditing(false)} returnFocus={edit} />
    </>
  );
}
