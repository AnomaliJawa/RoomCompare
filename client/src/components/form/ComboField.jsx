import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ICON } from '../ui/icons.js';
import { control, controlGroup, cx, fieldError, fieldHint, fieldLabel } from '../ui/styles.js';
import { Field, InfoButton, errorId } from './fields.jsx';
import { t } from '../../i18n/index.js';

/** Digits and one dot, a comma read as the dot: what the number field it replaced let through. */
export function cleanDecimal(text) {
  const [whole, ...rest] = text.replace(/,/g, '.').replace(/[^0-9.]/g, '').split('.');
  return rest.length ? `${whole}.${rest.join('')}` : whole;
}

const option = cx(
  'cursor-pointer px-3 py-2 tabular-nums lining-nums hover:bg-accent-tint active:bg-accent-tint',
  'pointer-coarse:flex pointer-coarse:min-h-target pointer-coarse:items-center',
);

/**
 * One field that takes a typed number or one picked from its list (an ARIA combobox). `onChange`
 * hears the text; `onPick` is told when a choice from the list is made, as a change committed.
 */
export function ComboField({ name, label, value = '', onChange, onPick, values, unit, id = `f-${name}`, guide = null, error = '' }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef(null);
  const input = useRef(null);
  const options = useRef([]);
  // Cleaning a keystroke rewrites the value, so the caret is put back where the typing left it.
  const caret = useRef(null);
  const listId = `${id}-list`;
  const typed = value.trim() === '' ? Number.NaN : Number(value);
  const selected = values.findIndex((choice) => choice === typed);

  // A tap outside closes it even when the field never took focus, as on a phone opened from the chevron.
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => {
      if (!box.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) options.current[active]?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  useLayoutEffect(() => {
    if (caret.current === null) return;
    input.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  const show = (index) => {
    setOpen(true);
    setActive(index ?? (selected >= 0 ? selected : 0));
  };
  const hide = () => {
    setOpen(false);
    setActive(-1);
  };
  const pick = (choice) => {
    onChange(String(choice));
    hide();
    onPick?.();
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (event.altKey) {
        if (event.key === 'ArrowDown') show();
        else hide();
      } else if (!open) {
        show(event.key === 'ArrowUp' ? values.length - 1 : undefined);
      } else {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive((now) => Math.min(values.length - 1, Math.max(0, now + step)));
      }
    } else if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault();
      pick(values[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      hide();
    }
  };

  return (
    <Field field={name} error={error}>
      {guide ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className={fieldLabel} htmlFor={id}>
            {label}
          </label>
          <InfoButton guide={guide} />
        </div>
      ) : (
        <label className={fieldLabel} htmlFor={id}>
          {label}
        </label>
      )}
      <div
        ref={box}
        className={controlGroup({ invalid: Boolean(error), className: 'relative' })}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) hide();
        }}
      >
        <input
          ref={input}
          className={control({ grouped: true, className: 'tabular-nums lining-nums' })}
          id={id}
          name={name}
          type="text"
          inputMode="decimal"
          value={value}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="none"
          aria-expanded={open ? 'true' : 'false'}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? `${listId}-${values[active]}` : undefined}
          aria-describedby={cx(guide && `${id}-hint`, error && errorId(name)) || undefined}
          aria-invalid={error ? 'true' : undefined}
          onKeyDown={onKeyDown}
          onChange={(event) => {
            const field = event.target;
            const cleaned = cleanDecimal(field.value);
            if (cleaned !== field.value) {
              caret.current = cleanDecimal(field.value.slice(0, field.selectionStart ?? field.value.length)).length;
            }
            onChange(cleaned);
          }}
        />
        {/* The affix's chrome, on the right: it opens the list, the field stays the place to type. */}
        <button
          className="flex w-10 flex-none items-center justify-center border-l border-rule bg-paper p-0 text-muted hover:text-ink active:bg-accent-tint active:text-accent pointer-coarse:w-target"
          type="button"
          tabIndex={-1}
          aria-label={t('Show {label} options', { label })}
          aria-controls={listId}
          aria-expanded={open ? 'true' : 'false'}
          // Pressing the chevron or an option must not pull focus out of the field.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => (open ? hide() : show())}
        >
          <ChevronDown {...ICON} className={cx('block', open && 'rotate-180')} />
        </button>
        {/* Over the fields below it, under the sticky nav. */}
        <ul
          className="absolute top-[calc(100%_+_0.25rem)] -right-px -left-px z-4 m-0 max-h-60 list-none overflow-y-auto overscroll-contain rounded-sm border border-rule bg-surface py-1 shadow-dialog"
          id={listId}
          role="listbox"
          aria-label={label}
          hidden={!open}
          onMouseDown={(event) => event.preventDefault()}
        >
          {values.map((choice, index) => (
            <li
              key={choice}
              ref={(node) => {
                options.current[index] = node;
              }}
              className={cx(option, index === active && 'bg-accent-tint', index === selected && 'font-semibold text-accent')}
              id={`${listId}-${choice}`}
              role="option"
              data-value={choice}
              aria-selected={index === selected ? 'true' : 'false'}
              onClick={() => pick(choice)}
            >
              {choice} {unit}
            </li>
          ))}
        </ul>
      </div>
      {guide && (
        <div className="flex items-baseline justify-between gap-3">
          <span className={fieldHint} id={`${id}-hint`}>
            {guide.helper}
          </span>
        </div>
      )}
      {error && (
        <span className={fieldError} id={errorId(name)}>
          {error}
        </span>
      )}
    </Field>
  );
}
