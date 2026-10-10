import { useState } from 'react';
import * as store from '../../data/store.js';
import { BEST_MATCH_CRITERIA, criterionDescription, criterionLabel } from '../../constants.js';
import { t } from '../../i18n/index.js';
import { DEFAULT_WEIGHTS, checkWeights } from '../../utils/weights.js';
import { toast } from '../feedback/feedback.js';
import { Modal, useCloseModal } from '../ui/Modal.jsx';
import { button, control, cx, dialogBody, dialogFoot, dialogFrame, dialogHead, dialogTitle, meta } from '../ui/styles.js';

/** Save waits for exactly 100%; the draft lives in the dialog until then, and Close forgets it. */

const isWeight = (value) => Number.isInteger(value) && value >= 0 && value <= 100;

function totalMessage({ total, invalid }) {
  if (invalid.length) return t('Each weight is a whole number from 0 to 100.');
  if (total < 100) return t('Total {total}% · {left}% left to share', { total, left: 100 - total });
  if (total > 100) return t('Total {total}% · {over}% over', { total, over: total - 100 });
  return t('Total 100%');
}

/** A blank field reads as NaN, not 0, so it is reported rather than counted as nothing. */
export function readWeights(typed) {
  return Object.fromEntries(
    BEST_MATCH_CRITERIA.map(({ key }) => {
      const text = String(typed[key] ?? '').trim();
      return [key, text === '' ? Number.NaN : Number(text)];
    }),
  );
}

const asText = (weights) => Object.fromEntries(BEST_MATCH_CRITERIA.map(({ key }) => [key, String(weights[key])]));

const slider =
  'm-0 h-6 w-full cursor-pointer accent-accent hover:accent-accent-press active:accent-accent-press pointer-coarse:h-target';

/** The slider has no name: the typed field is the value read, and the slider follows it. */
function WeightRow({ criterion, typed, position, invalid, onType, onSlide }) {
  const id = `weight-${criterion.key}`;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0 not-first:border-t not-first:border-rule">
      <label className="col-start-1 row-start-1 font-semibold" id={`${id}-label`} htmlFor={id}>
        {criterionLabel(criterion)}
      </label>
      <div className="col-start-2 row-start-1 flex items-center gap-2">
        <input
          className={control({
            invalid,
            width: 'w-16',
            padding: 'px-3 py-0',
            className:
              'h-10 text-right tabular-nums lining-nums [appearance:textfield] ' +
              '[&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none ' +
              '[&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none',
          })}
          id={id}
          name={criterion.key}
          type="number"
          inputMode="numeric"
          min="0"
          max="100"
          step="1"
          value={typed}
          aria-describedby={`${id}-hint`}
          aria-invalid={invalid ? 'true' : 'false'}
          onChange={(event) => onType(criterion.key, event.target.value)}
        />
        <span className="text-muted" aria-hidden="true">
          %
        </span>
      </div>
      <input
        className={cx('col-span-2 row-start-2', slider)}
        type="range"
        min="0"
        max="100"
        step="1"
        value={position}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        data-key={criterion.key}
        onChange={(event) => onSlide(criterion.key, event.target.value)}
      />
      <p className="col-span-2 row-start-3 text-xs text-muted" id={`${id}-hint`}>
        {criterionDescription(criterion)}
      </p>
    </li>
  );
}

export function CriteriaForm({ weights }) {
  const close = useCloseModal();
  const [typed, setTyped] = useState(() => asText(weights));
  // A slider moves only to a valid typed weight; a blank or 101 leaves it where it was.
  const [positions, setPositions] = useState(() => asText(weights));
  const check = checkWeights(readWeights(typed));

  const type = (key, value) => {
    setTyped((now) => ({ ...now, [key]: value }));
    const number = value.trim() === '' ? Number.NaN : Number(value);
    if (isWeight(number)) setPositions((now) => ({ ...now, [key]: value }));
  };
  const slide = (key, value) => {
    setTyped((now) => ({ ...now, [key]: value }));
    setPositions((now) => ({ ...now, [key]: value }));
  };
  const reset = () => {
    setTyped(asText(DEFAULT_WEIGHTS));
    setPositions(asText(DEFAULT_WEIGHTS));
  };

  const save = (event) => {
    event.preventDefault();
    if (!check.ok) return;
    const { ok, kept } = store.setBestMatchWeights(readWeights(typed));
    if (!ok) return;
    close();
    toast(kept ? t('Best Match weights saved') : t('Weights applied, but this browser could not keep them'));
  };

  return (
    <form className={dialogFrame} noValidate onSubmit={save}>
      <div className={cx(dialogHead, 'criteria-head')}>
        <h2 className={dialogTitle} id="criteria-dialog-title">
          {t('Best Match criteria')}
        </h2>
        <button className={button({ variant: 'quiet', size: 'small' })} type="button" onClick={close}>
          {t('Close')}
        </button>
      </div>

      <div className={dialogBody}>
        <p className={meta}>
          {t("How much each criterion counts in each kos's Best Match score. The total must be 100%; 0% leaves a criterion out.")}
        </p>
        <ul>
          {BEST_MATCH_CRITERIA.map((criterion) => (
            <WeightRow
              key={criterion.key}
              criterion={criterion}
              typed={typed[criterion.key]}
              position={positions[criterion.key]}
              invalid={check.invalid.includes(criterion.key)}
              onType={type}
              onSlide={slide}
            />
          ))}
        </ul>
      </div>

      {/* On a phone the total leads, read before the buttons; Save sits above Reset. */}
      <div className={cx(dialogFoot, 'max-lg:flex-col max-lg:items-stretch max-lg:pb-[max(1rem,env(safe-area-inset-bottom))]')}>
        <p
          className={cx('font-semibold tabular-nums lining-nums', !check.ok && 'text-alert')}
          role="status"
          aria-live="polite"
          data-criteria-total
        >
          {totalMessage(check)}
        </p>
        <div className="flex items-center gap-3 max-lg:flex-col-reverse max-lg:items-stretch max-lg:*:w-full">
          <button className={button({ variant: 'quiet' })} type="button" onClick={reset}>
            {t('Reset to default')}
          </button>
          <button className={button({ variant: 'primary' })} type="submit" disabled={!check.ok}>
            {t('Save')}
          </button>
        </div>
      </div>
    </form>
  );
}

/** Opened from Edit on the Dashboard and Edit criteria in Best Match; focus goes back to that button. */
export function CriteriaDialog({ open, onClose, returnFocus }) {
  const closed = () => {
    onClose();
    returnFocus?.current?.focus();
  };
  return (
    <Modal open={open} onClose={closed} kind="criteria" sheetHandle=".criteria-head" aria-labelledby="criteria-dialog-title">
      <CriteriaForm weights={store.bestMatchWeights()} />
    </Modal>
  );
}
