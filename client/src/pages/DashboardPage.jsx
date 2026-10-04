import { useRef, useState } from 'react';
import * as store from '../data/store.js';
import { useStore } from '../hooks/useStore.js';
import { BEST_MATCH_CRITERIA, STATUS } from '../constants.js';
import { formatKosDistance, numberToCurrency } from '../utils/format.js';
import { isDefault } from '../utils/weights.js';
import { CriteriaDialog } from '../components/compare/CriteriaDialog.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { PageHead } from '../components/ui/PageHead.jsx';
import { button, cx, meta, panel, unrecorded } from '../components/ui/styles.js';

const stripCell = 'px-3 py-2 text-left align-top tabular-nums lining-nums';
const stripName = 'font-narrow text-xs font-semibold';

function Columns({ count }) {
  return (
    <colgroup>
      {Array.from({ length: count }, (_, index) => (
        <col key={index} />
      ))}
    </colgroup>
  );
}

// A long kos name wraps inside its column rather than widening it.
function Names({ surveys }) {
  return (
    <tr role="row">
      {surveys.map((s) => (
        <th key={s.id} className={cx(stripCell, stripName, 'wrap-anywhere')} scope="col" role="columnheader">
          {s.kos.name}
        </th>
      ))}
    </tr>
  );
}

/** Explicit ARIA roles keep the tables tables when the narrow layout turns them into blocks. */
function HeroStrip({ surveys }) {
  const cheapest = Math.min(...surveys.map((s) => s.kos.rent ?? Infinity));
  const nearest = Math.min(...surveys.map((s) => s.kos.distanceKm ?? Infinity));
  const criteria = [
    {
      id: 'strip-rent',
      label: 'Monthly rent',
      value: (s) => (s.kos.rent == null ? null : numberToCurrency(s.kos.rent)),
      best: (s) => s.kos.rent === cheapest,
    },
    {
      id: 'strip-distance',
      label: 'To campus',
      value: (s) => (s.kos.distanceKm == null ? null : formatKosDistance(s.kos)),
      best: (s) => s.kos.distanceKm === nearest,
    },
  ];

  // Below 500px three columns would split "Rp 1.850.000"; each card lists its kos instead.
  const section = 'overflow-clip rounded-md border border-rule bg-surface';
  const table = 'table-fixed max-md:block';

  return (
    <section className="grid grid-cols-[1fr_1.2fr] items-center gap-10 rounded-md border border-rule bg-surface px-6 py-10 max-xl:grid-cols-1 *:min-w-0">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl tracking-tight">Your last {surveys.length} visits, side by side</h2>
        <p>
          Everything you recorded in one place, so you can weigh the options without opening your gallery, your notes
          and a chat thread at once.
        </p>
      </div>
      <div data-hero-strip>
        <div className="mb-4 flex justify-end">
          <a className={button({ variant: 'primary' })} href="#/compare">
            Compare kos
          </a>
        </div>
        <div className="flex flex-col gap-3">
          <div className={cx(section, 'max-md:hidden')} aria-hidden="true" data-strip-names>
            <table className="table-fixed">
              <Columns count={surveys.length} />
              <thead>
                <Names surveys={surveys} />
              </thead>
            </table>
          </div>
          {criteria.map((criterion) => (
            <section key={criterion.id} className={section} aria-labelledby={criterion.id} data-strip>
              <h3
                className="border-b-2 border-ink bg-accent-tint px-3 py-2 text-base leading-snug font-bold text-ink"
                id={criterion.id}
              >
                {criterion.label}
              </h3>
              <table className={table} role="table" aria-labelledby={criterion.id}>
                <Columns count={surveys.length} />
                <thead className="sr-only" role="rowgroup">
                  <Names surveys={surveys} />
                </thead>
                <tbody className="max-md:block" role="rowgroup">
                  <tr className="max-md:block" role="row">
                    {surveys.map((s) => {
                      const value = criterion.value(s);
                      const best = criterion.best(s);
                      return (
                        <td
                          key={s.id}
                          className={cx(
                            stripCell,
                            'max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-4 max-md:border-b max-md:border-rule max-md:last:border-b-0',
                            best && 'font-semibold text-accent',
                          )}
                          role="cell"
                          data-best={best ? 'true' : undefined}
                        >
                          <span className={cx('hidden text-muted wrap-anywhere max-md:block', stripName)} aria-hidden="true" data-strip-kos>
                            {s.kos.name}
                          </span>
                          {value === null ? (
                            <span className={cx('max-md:shrink-0', unrecorded)} data-strip-value>
                              Not recorded
                            </span>
                          ) : (
                            <span className="max-md:shrink-0" data-strip-value>
                              {value}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

const sectionHead = 'mb-4 flex items-center justify-between gap-4 border-b border-rule pb-3';
const listing = 'relative flex items-center justify-between gap-4 border-b border-rule pb-3 tabular-nums lining-nums last:border-b-0 last:pb-0';

export function DashboardPage() {
  const { surveys } = useStore();
  const recent = [...surveys].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 3);
  const drafts = surveys.filter((s) => s.status === STATUS.DRAFT).length;
  const weights = store.bestMatchWeights();
  const [editing, setEditing] = useState(false);
  const edit = useRef(null);

  return (
    <>
      <PageHead title="Dashboard" lede="Survey, record, organize, compare." />

      {recent.length ? (
        <HeroStrip surveys={recent} />
      ) : (
        <EmptyState
          title="No kos recorded yet"
          body={
            'Start with the first kos you visited. Record what you saw, add photos and ' +
            'notes, then compare your options side by side when you have two or more.'
          }
          actions={[{ label: 'Add survey', href: '#/surveys/new' }]}
        />
      )}

      <div className="mt-6 grid grid-cols-[2fr_1fr] gap-6 max-xl:grid-cols-1">
        <section className={panel}>
          <div className={sectionHead}>
            <h2>Recent surveys</h2>
            <a className={button({ variant: 'quiet', size: 'small' })} href="#/surveys">
              View all
            </a>
          </div>
          {recent.length ? (
            <ul className="flex flex-col gap-3">
              {recent.map((s) => (
                <li key={s.id} className={listing}>
                  <div>
                    {/* A title-only row opens from anywhere on it: the name alone was a 17px target. */}
                    <a className="font-semibold text-ink no-underline after:absolute after:inset-0 hover:underline" href={`#/surveys/${s.id}`}>
                      {s.kos.name}
                    </a>
                    <p className={meta}>{s.kos.kosLocation?.label}</p>
                  </div>
                  <span className="tabular-nums lining-nums">{numberToCurrency(s.kos.rent)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={meta}>Nothing recorded yet.</p>
          )}
          {drafts > 0 && (
            <p className={cx(meta, 'mt-4')}>
              {drafts} draft{drafts === 1 ? '' : 's'} still to finish.
            </p>
          )}
        </section>

        <section className={panel}>
          <div className={sectionHead}>
            <h2>Best Match criteria</h2>
            <button
              ref={edit}
              className={button({ variant: 'secondary', size: 'small' })}
              type="button"
              aria-haspopup="dialog"
              aria-label="Edit Best Match criteria"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          </div>
          <p className={meta} data-weights-note>
            How much each criterion counts in each kos's Best Match score when you compare.{' '}
            {isDefault(weights) ? 'These are the defaults.' : 'These are your own.'}
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {BEST_MATCH_CRITERIA.map((c) => (
              <li key={c.key} className={listing}>
                <span>{c.label}</span>
                <span className="tabular-nums lining-nums">{weights[c.key]}%</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <CriteriaDialog open={editing} onClose={() => setEditing(false)} returnFocus={edit} />
    </>
  );
}
