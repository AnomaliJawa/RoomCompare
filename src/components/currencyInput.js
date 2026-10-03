import {
  GROUP_SEPARATOR,
  MAX_RENT_DIGITS,
  groupDigits,
  normalizeRentInput,
} from '../utils/format.js';

/** type=text, not number: number inputs discard the grouping periods. Read it with getValue(). */

const isDigit = (ch) => ch >= '0' && ch <= '9';

function digitsBeforeCaret(text, caret) {
  let count = 0;
  for (let i = 0; i < caret && i < text.length; i += 1) {
    if (isDigit(text[i])) count += 1;
  }
  return count;
}

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
        // Anchor on the digit count: separators shift every character right of the edit.
        const pos = caretAfterNthDigit(formatted, Math.min(wanted, digits.length));
        input.setSelectionRange(pos, pos);
      }
    }
    publish(digits);
  }

  function onInput() {
    render(true);
  }

  // Backspace onto a separator deletes the digit instead, here: a keydown caret move cancels the default.
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

  function onBlur() {
    render(false);
  }

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeydown);
  input.addEventListener('blur', onBlur);

  render(false);

  return {
    getValue() {
      const digits = input.dataset.value ?? '';
      return digits === '' ? null : Number(digits);
    },
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
