import { ArrowLeftRight, Plus, X } from 'lucide-react';
import { MAX_COMPARE, MIN_COMPARE } from '../../constants.js';
import * as store from '../../data/store.js';
import { ICON } from '../ui/icons.js';
import { button, cx, meta } from '../ui/styles.js';
import { t } from '../../i18n/index.js';

/** Equal slots with names only, so a long name cannot grow its card; Compare opens at two. */

const chip = 'flex h-10 min-w-0 items-center gap-2 rounded-sm border border-rule pointer-coarse:h-target';
// The slot is the button, edge to edge, so the chip's left padding lives on it.
const pick = 'group flex min-w-0 flex-1 items-center gap-3 self-stretch pl-3 text-left';
// The size of a small button, centred in the 40px card.
const square = 'flex size-8 shrink-0 items-center justify-center rounded-sm';
const hint = cx(
  square,
  'ml-auto text-accent group-hover:bg-accent-tint group-hover:text-accent-press group-active:bg-accent-tint group-active:text-accent-press',
);

/** Each icon carries its words in a tooltip, and the button its name, since an icon names nothing. */
function Filled({ survey, index, onChange }) {
  return (
    <li className={cx(chip, 'bg-paper pr-1')}>
      <button
        className={pick}
        type="button"
        data-slot={index}
        aria-haspopup="dialog"
        aria-label={t('Change {name}', { name: survey.kos.name })}
        onClick={() => onChange(survey.id, index)}
      >
        <span className="min-w-0 flex-1 truncate font-semibold" title={survey.kos.name}>
          {survey.kos.name}
        </span>
        <span className={hint} aria-hidden="true" title={t('Change')}>
          <ArrowLeftRight {...ICON} />
        </span>
      </button>
      <button
        className={cx(square, 'touch-hit text-alert hover:bg-alert-bg hover:text-alert active:bg-alert-bg active:text-alert')}
        type="button"
        aria-label={t('Remove {name} from the comparison', { name: survey.kos.name })}
        title={t('Remove')}
        onClick={() => store.removeFromCompare(survey.id)}
      >
        <X {...ICON} />
      </button>
    </li>
  );
}

function Empty({ index, onAdd }) {
  return (
    <li className={cx(chip, 'border-dashed p-0')}>
      <button
        className={cx(pick, 'pr-1')}
        type="button"
        data-slot={index}
        aria-haspopup="dialog"
        aria-label={t('Add kos {index}', { index: index + 1 })}
        onClick={() => onAdd(index)}
      >
        <span className={meta}>{t('Kos {index}', { index: index + 1 })}</span>
        <span className={hint} aria-hidden="true" title={t('Add')}>
          <Plus {...ICON} />
        </span>
      </button>
    </li>
  );
}

/** "2 of 3 selected", and how many more a comparison needs; the picker says the same. */
export function selectedCount(count) {
  return count < MIN_COMPARE
    ? t('{count} of {max} selected, {more} more to compare.', { count, max: MAX_COMPARE, more: MIN_COMPARE - count })
    : t('{count} of {max} selected.', { count, max: MAX_COMPARE });
}

/** `--slots` comes from MAX_COMPARE, so the limit is written only in constants.js. */
export function CompareBar({ selected, shown, onAdd, onChange, onCompare, onStartOver, barRef }) {
  const ready = selected.length >= MIN_COMPARE;
  const empty = Array.from({ length: MAX_COMPARE - selected.length }, (_, offset) => selected.length + offset);

  return (
    <section
      ref={barRef}
      className="mb-10 flex flex-wrap items-center gap-4 rounded-md border border-rule bg-surface p-4 max-lg:flex-col max-lg:items-stretch"
      aria-label={t('Selected for comparison')}
    >
      <ul
        className="grid min-w-0 flex-[1_1_100%] grid-cols-[repeat(var(--slots),minmax(0,1fr))] gap-2 max-xl:grid-cols-[minmax(0,1fr)]"
        style={{ '--slots': MAX_COMPARE }}
        data-slots
      >
        {selected.map((survey, index) => (
          <Filled key={index} survey={survey} index={index} onChange={onChange} />
        ))}
        {empty.map((index) => (
          <Empty key={index} index={index} onAdd={onAdd} />
        ))}
      </ul>

      {/* Stacked on a phone, the button runs full width above the count. */}
      <div className="flex flex-[1_1_100%] items-center justify-end gap-3 max-lg:flex-col-reverse max-lg:items-stretch">
        <p className={cx(meta, 'mr-auto max-lg:mr-0')} role="status" aria-live="polite">
          {selectedCount(selected.length)}
        </p>
        {shown ? (
          <button className={button({ variant: 'quiet', className: 'max-lg:w-full' })} type="button" onClick={onStartOver}>
            {t('Start over')}
          </button>
        ) : (
          <button
            className={button({ variant: 'primary', className: 'max-lg:w-full' })}
            type="button"
            disabled={!ready}
            title={ready ? undefined : t('Select at least two kos')}
            onClick={onCompare}
          >
            {t('Compare')}
          </button>
        )}
      </div>
    </section>
  );
}
