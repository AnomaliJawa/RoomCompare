import {
  GROUP_SEPARATOR,
  MAX_RENT_DIGITS,
  groupDigits,
  normalizeRentInput,
} from '../utils/format.js';

/**
 * Live Indonesian thousand separators on a text input: 1500000 -> 1.500.000.
 *
 * The field must be type="text". type="number" cannot hold a grouped value —
 * the spec requires a valid floating-point number, so browsers discard the
 * periods, and a period would mean a decimal point in any case.
 * inputmode="numeric" keeps the numeric keypad on phones.
 *
 * The canonical value is the digit string on input.dataset.value; the visible
 * value is presentation only. Read it with getValue(), never by parsing
 * input.value at the call site.
 */

const isDigit = (ch) => ch >= '0' && ch <= '9';

/** How many digits sit left of this caret position. */
function digitsBeforeCaret(text, caret) {
  let count = 0;
  for (let i = 0; i < caret && i < text.length; i += 1) {
    if (isDigit(text[i])) count += 1;
  }
  return count;
}

/** The caret position that sits just after the nth digit of text. */
function caretAfterNthDigit(text, n) {
  if (n <= 0) {
    let i = 0;
    while (i < text.length && !isDigit(text[i])) i += 1;
    return i;
  }
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (isDigit(text[i])) {
      seen += 1;
      if (seen === n) return i + 1;
    }
  }
  return text.length;
}

export function attachCurrencyInput(input, options = {}) {
  const maxDigits = options.maxDigits ?? MAX_RENT_DIGITS;
  const onChange = options.onChange;

  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.spellcheck = false;

  function publish(digits) {
    input.dataset.value = digits;
    if (onChange) onChange(digits === '' ? null : Number(digits));
  }

  function render(preserveCaret) {
    const before = input.value;
    const caret = input.selectionStart ?? before.length;
    const wanted = digitsBeforeCaret(before, caret);

    const digits = normalizeRentInput(before, maxDigits);
    const formatted = groupDigits(digits);

    if (formatted !== before) {
      input.value = formatted;
      if (preserveCaret) {
        // Anchor on the digit count, not the raw index: separators shift
        // every character to the right of the edit.
        const pos = caretAfterNthDigit(formatted, Math.min(wanted, digits.length));
        input.setSelectionRange(pos, pos);
      }
    }
    publish(digits);
  }

  function onInput() {
    render(true);
  }

  // Backspace onto a separator would otherwise delete the separator, which we
  // immediately re-derive — the caret appears stuck. Delete the digit the user
  // meant instead. The edit is applied here rather than by nudging the caret
  // and deferring to the browser, because changing the selection during
  // keydown suppresses the default deletion.
  function onKeydown(event) {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    const { selectionStart: start, selectionEnd: end, value } = input;
    if (start === null || start !== end) return;

    const back = event.key === 'Backspace';
    let index = back ? start - 1 : start;
    const step = back ? -1 : 1;

    while (index >= 0 && index < value.length && value[index] === GROUP_SEPARATOR) {
      index += step;
    }
    // Nothing left to delete, or the adjacent character is already a digit —
    // in which case the browser's own handling is correct.
    if (index < 0 || index >= value.length) return;
    if (index === (back ? start - 1 : start)) return;

    event.preventDefault();

    const next = value.slice(0, index) + value.slice(index + 1);
    const wanted = digitsBeforeCaret(next, index);
    const digits = normalizeRentInput(next, maxDigits);
    const formatted = groupDigits(digits);

    input.value = formatted;
    const pos = caretAfterNthDigit(formatted, Math.min(wanted, digits.length));
    input.setSelectionRange(pos, pos);
    publish(digits);
  }

  // Normalise without fighting the caret when focus leaves.
  function onBlur() {
    render(false);
  }

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeydown);
  input.addEventListener('blur', onBlur);

  // Format whatever the field was seeded with.
  render(false);

  return {
    /** The recorded value: a number, or null when the field is empty. */
    getValue() {
      const digits = input.dataset.value ?? '';
      return digits === '' ? null : Number(digits);
    },
    /** Set from stored data. Accepts a number or a digit string. */
    setValue(next) {
      const digits = normalizeRentInput(next, maxDigits);
      input.value = groupDigits(digits);
      publish(digits);
    },
    destroy() {
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKeydown);
      input.removeEventListener('blur', onBlur);
    },
  };
}
