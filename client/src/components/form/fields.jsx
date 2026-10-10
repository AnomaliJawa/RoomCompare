import { createContext, useContext, useEffect, useRef } from 'react';
import { Info } from 'lucide-react';
import { LIKERT } from '../../constants.js';
import { numberToCurrency, normalizeRentInput } from '../../utils/format.js';
import { ICON } from '../ui/icons.js';
import { choice, control, controlGroup, cx, fieldError, fieldHint, fieldLabel } from '../ui/styles.js';
import { attachCurrencyInput } from './currencyInput.js';
import { locale, t } from '../../i18n/index.js';

/** Every control has a real <label>, errors are tied by aria-describedby, groups are fieldsets. */

/** Opens the How to fill panel: (key, the ⓘ pressed). The survey form provides it. */
export const HowToContext = createContext(null);

const describedBy = (...ids) => ids.filter(Boolean).join(' ') || undefined;

export const errorId = (field) => `error-${field}`;

/** Quiet icons beside a label; on touch screens each takes a 44px hit area. */
export const iconButton = cx(
  'inline-grid touch-hit cursor-pointer place-items-center rounded-sm bg-transparent p-1 align-middle text-muted',
  'transition-[background-color,color] [-webkit-tap-highlight-color:transparent]',
  'hover:bg-accent-tint hover:text-accent active:bg-accent-tint active:text-accent-press',
);

/** Beside the label, not inside it: a <label> may not hold another control. */
export function InfoButton({ guide, className = '' }) {
  const open = useContext(HowToContext);
  if (!guide?.key || !guide.panel) return null;
  return (
    <button
      className={cx(iconButton, className)}
      type="button"
      aria-label={t('How to fill {field}', { field: guide.label })}
      aria-haspopup="dialog"
      data-guide={guide.key}
      onClick={(event) => open?.(guide.key, event.currentTarget)}
    >
      <Info {...ICON} className="block" />
    </button>
  );
}

const count = (n) => n.toLocaleString(locale());

function Counter({ id, max, length }) {
  const over = length > max;
  return (
    <span className={cx('shrink-0 text-xs tabular-nums lining-nums', over ? 'font-medium text-alert' : 'text-muted')} id={`${id}-count`} data-over={over ? 'true' : undefined}>
      {count(length)}/{count(max)}
    </span>
  );
}

/** The guide's helper and counter, or a plain hint; then the error, when there is one. */
function Support({ id, field, hint, guide, error, length = 0 }) {
  return (
    <>
      {guide ? (
        <div className="flex items-baseline justify-between gap-3">
          <span className={fieldHint} id={`${id}-hint`}>
            {guide.helper}
          </span>
          {guide.counter && <Counter id={id} max={guide.counter} length={length} />}
        </div>
      ) : (
        hint && (
          <span className={fieldHint} id={`${id}-hint`}>
            {hint}
          </span>
        )
      )}
      {error && (
        <span className={fieldError} id={errorId(field)}>
          {error}
        </span>
      )}
    </>
  );
}

function FieldLabel({ id, label, guide }) {
  const tag = (
    <label className={fieldLabel} htmlFor={id}>
      {label}
    </label>
  );
  if (!guide) return tag;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tag}
      <InfoButton guide={guide} />
    </div>
  );
}

const supportIds = (id, field, { hint, guide, error }) =>
  describedBy(guide || hint ? `${id}-hint` : null, guide?.counter ? `${id}-count` : null, error ? errorId(field) : null);

export function Field({ field, error, children, className = '' }) {
  return (
    <div className={cx('flex flex-col gap-2', className)} data-field={field} data-invalid={error ? 'true' : undefined}>
      {children}
    </div>
  );
}

export function TextField({
  name,
  label,
  value = '',
  onChange,
  type = 'text',
  placeholder = '',
  hint = '',
  error = '',
  numeric = false,
  id = `f-${name}`,
  // The kos location has a name field and a map pin; only one can own "kosLocation".
  field = name,
  // Autocomplete off for survey fields; account fields name their purpose for password managers.
  autoComplete = 'off',
  inputMode,
  plain = false,
  guide = null,
  ...rest
}) {
  return (
    <Field field={field} error={error}>
      <FieldLabel id={id} label={label} guide={guide} />
      <input
        className={control({ invalid: Boolean(error), className: cx(numeric && 'tabular-nums lining-nums') })}
        id={id}
        name={name}
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoCapitalize={plain ? 'none' : undefined}
        spellCheck={plain ? false : undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={supportIds(id, field, { hint, guide, error })}
        onChange={(event) => onChange?.(event.target.value)}
        {...rest}
      />
      <Support id={id} field={field} hint={hint} guide={guide} error={error} length={String(value ?? '').length} />
    </Field>
  );
}

export function TextareaField({ name, label, value = '', onChange, rows = 4, placeholder = '', error = '', id = `f-${name}`, guide = null }) {
  return (
    <Field field={name} error={error}>
      <FieldLabel id={id} label={label} guide={guide} />
      <textarea
        className={control({ invalid: Boolean(error) })}
        id={id}
        name={name}
        rows={rows}
        placeholder={placeholder}
        value={value ?? ''}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={supportIds(id, name, { guide, error })}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <Support id={id} field={name} guide={guide} error={error} length={String(value ?? '').length} />
    </Field>
  );
}

export function SelectField({ name, label, value = '', onChange, options, id = `f-${name}` }) {
  return (
    <div className="flex flex-col gap-2">
      <label className={fieldLabel} htmlFor={id}>
        {label}
      </label>
      <select className={control()} id={id} name={name} value={value} onChange={(event) => onChange?.(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.label)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The amount a value stands for, typed digits or a number alike; null for none. */
const asAmount = (value) => (value === null || value === undefined || value === '' ? null : Number(normalizeRentInput(value)));

const affix = 'flex items-center border-r border-rule bg-paper px-3 font-narrow text-xs font-semibold text-muted';

const slider =
  'm-0 h-6 w-full cursor-pointer accent-accent hover:accent-accent-press active:accent-accent-press pointer-coarse:h-target';

/**
 * Rupiah, grouped as typed: type=text, as number inputs discard the separators. `onChange` hears the
 * amount, or null. `slider`: { max, step } adds an unnamed range under it; the typed field stays the value.
 */
export function CurrencyField({ name, label, value = null, onChange, error = '', id = `f-${name}`, guide = null, slider: range = null }) {
  const input = useRef(null);
  const handle = useRef(null);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  useEffect(() => {
    // Filled before attaching, so the first reading is the saved amount, not an empty field.
    input.current.value = latest.current.value ?? '';
    handle.current = attachCurrencyInput(input.current, {
      onChange: (next) => {
        if (next !== asAmount(latest.current.value)) latest.current.onChange?.(next);
      },
    });
    return () => handle.current.destroy();
  }, []);

  // A value set from outside (a slider, a cleared filter) is shown as typed would be.
  useEffect(() => {
    const now = handle.current;
    if (!now) return;
    if (now.getValue() !== asAmount(value)) now.setValue(value ?? '');
  }, [value]);

  const amount = value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
  return (
    <Field field={name} error={error}>
      <FieldLabel id={id} label={label} guide={guide} />
      <div className={controlGroup({ invalid: Boolean(error) })}>
        <span className={affix} aria-hidden="true">
          Rp
        </span>
        <input
          ref={input}
          className={control({ grouped: true, className: 'tabular-nums lining-nums' })}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={supportIds(id, name, { guide, error })}
        />
      </div>
      {range && (
        <>
          {/* Past the slider's end the thumb rests there; the field and the spoken value keep the real figure. */}
          <input
            className={slider}
            type="range"
            min="0"
            max={range.max}
            step={range.step}
            value={Math.min(amount ?? 0, range.max)}
            aria-label={label}
            aria-valuetext={numberToCurrency(amount)}
            data-slider-for={id}
            onChange={(event) => handle.current?.setValue(event.target.value)}
          />
          <div className="flex justify-between text-xs text-muted tabular-nums lining-nums" aria-hidden="true">
            <span>{numberToCurrency(0)}</span>
            <span>{numberToCurrency(range.max)}</span>
          </div>
        </>
      )}
      <Support id={id} field={name} guide={guide} error={error} />
    </Field>
  );
}

/** The name sits in its own span, so the ⓘ stays out of the group's accessible name. */
function Legend({ name, legend, guide, invalid }) {
  return (
    <legend className={cx('mb-3 p-0 text-xs font-medium', invalid ? 'text-alert' : 'text-muted')}>
      {guide ? (
        <>
          <span id={`${name}-legend`}>{legend}</span>
          <InfoButton guide={guide} className="ml-1" />
        </>
      ) : (
        legend
      )}
    </legend>
  );
}

function Group({ name, legend, guide, rubric = null, error, children }) {
  const described = guide ? describedBy(`${name}-hint`, rubric !== null ? `${name}-rubric` : null) : undefined;
  return (
    <fieldset
      className="m-0 border-0 p-0"
      data-field={name}
      data-invalid={error ? 'true' : undefined}
      aria-labelledby={guide ? `${name}-legend` : undefined}
      aria-describedby={described}
    >
      <Legend name={name} legend={legend} guide={guide} invalid={Boolean(error)} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">{children}</div>
      {guide && (
        <p className={cx(fieldHint, 'mt-3')} id={`${name}-hint`}>
          {guide.helper}
        </p>
      )}
      {/* Always present and empty until chosen, so a screen reader announces each new description. */}
      {rubric !== null && (
        <p
          className="mt-2 max-w-measure border-l-2 border-accent pl-3 text-xs text-ink empty:m-0 empty:border-0 empty:p-0"
          id={`${name}-rubric`}
          aria-live="polite"
          data-rubric={name}
        >
          {rubric}
        </p>
      )}
      {error && (
        <span className={fieldError} id={errorId(name)}>
          {error}
        </span>
      )}
    </fieldset>
  );
}

/** The first box carries the error, as the place focus lands. */
const firstErrorProps = (index, name, error) =>
  index === 0 && error ? { 'aria-invalid': 'true', 'aria-describedby': errorId(name) } : {};

export function CheckboxGroup({ name, legend, options, selected = [], onChange, guide = null, error = '' }) {
  const chosen = new Set(selected);
  const toggle = (option) => onChange?.(chosen.has(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  return (
    <Group name={name} legend={legend} guide={guide} error={error}>
      {options.map((option, index) => (
        <label key={option} className={choice({ checked: chosen.has(option), invalid: Boolean(error) })}>
          <input
            type="checkbox"
            name={name}
            value={option}
            checked={chosen.has(option)}
            onChange={() => toggle(option)}
            {...firstErrorProps(index, name, error)}
          />
          {t(option)}
        </label>
      ))}
    </Group>
  );
}

export function RadioGroup({ name, legend, options, value = null, onChange, guide = null, rubric = null, error = '' }) {
  return (
    <Group name={name} legend={legend} guide={guide} rubric={rubric} error={error}>
      {options.map((option, index) => (
        <label key={option.value} className={choice({ checked: option.value === value, invalid: Boolean(error) })}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange?.(option.value)}
            {...firstErrorProps(index, name, error)}
          />
          {t(option.label)}
        </label>
      ))}
    </Group>
  );
}

export function LikertField({ name, legend, value = null, onChange, guide = null, rubric = null, error = '' }) {
  return (
    <RadioGroup
      name={name}
      legend={legend}
      guide={guide}
      rubric={rubric}
      error={error}
      value={value === null || value === undefined ? null : Number(value)}
      onChange={onChange}
      options={LIKERT.map((step) => ({ value: step.value, label: `${step.value} ${t(step.label)}` }))}
    />
  );
}
