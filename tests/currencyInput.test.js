import { describe, it, expect, beforeEach } from 'vitest';
import { attachCurrencyInput } from '../src/components/currencyInput.js';

/**
 * The caret is the hard part: inserting a separator shifts every character to
 * its right, so anchoring on the raw index sends the caret to the end while
 * someone is still typing.
 */

let input;
let handle;

function type(text) {
  for (const char of text) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.slice(0, start) + char + input.value.slice(end);
    input.setSelectionRange(start + 1, start + 1);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
  }
}

/** What a browser does: fire keydown, then apply the default edit if allowed. */
function press(key) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  const proceed = input.dispatchEvent(event);
  if (!proceed) return;

  const start = input.selectionStart;
  const end = input.selectionEnd;
  const value = input.value;
  let next;
  let caret;

  if (start !== end) {
    next = value.slice(0, start) + value.slice(end);
    caret = start;
  } else if (key === 'Backspace') {
    if (start === 0) return;
    next = value.slice(0, start - 1) + value.slice(start);
    caret = start - 1;
  } else {
    if (start >= value.length) return;
    next = value.slice(0, start) + value.slice(start + 1);
    caret = start;
  }

  input.value = next;
  input.setSelectionRange(caret, caret);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
}

function paste(text) {
  input.value = text;
  input.setSelectionRange(text.length, text.length);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
}

beforeEach(() => {
  document.body.innerHTML = '<input id="rent" type="text" />';
  input = document.getElementById('rent');
  handle = attachCurrencyInput(input);
});

describe('setup', () => {
  it('uses a text field, since type=number cannot hold a grouped value', () => {
    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('numeric');
  });
});

describe('typing', () => {
  it('groups thousands as digits arrive', () => {
    const seen = [];
    for (const char of '1500000') {
      type(char);
      seen.push(input.value);
    }
    expect(seen).toEqual(['1', '15', '150', '1.500', '15.000', '150.000', '1.500.000']);
  });

  it('leaves the caret at the end while typing forwards', () => {
    type('1500000');
    expect(input.selectionStart).toBe(input.value.length);
  });

  it('keeps the caret beside the digit just typed mid-string', () => {
    handle.setValue(1500000);
    input.setSelectionRange(1, 1);
    type('2');
    expect(input.value).toBe('12.500.000');
    expect(input.selectionStart).toBe(2);
  });

  it('exposes the number separately from the display value', () => {
    type('1500000');
    expect(input.value).toBe('1.500.000');
    expect(input.dataset.value).toBe('1500000');
    expect(handle.getValue()).toBe(1500000);
  });
});

describe('deleting', () => {
  it('removes one digit at a time from the end', () => {
    handle.setValue(1500000);
    input.setSelectionRange(input.value.length, input.value.length);
    const seen = [];
    for (let i = 0; i < 4; i += 1) {
      press('Backspace');
      seen.push(input.value);
    }
    expect(seen).toEqual(['150.000', '15.000', '1.500', '150']);
  });

  it('deletes the digit behind a separator, not the separator itself', () => {
    // Removing the separator alone leaves the same digits, so it is re-derived
    // and the caret appears stuck.
    handle.setValue(1500000);
    input.setSelectionRange(2, 2);
    press('Backspace');
    expect(input.value).toBe('500.000');
    expect(input.selectionStart).toBe(0);
  });

  it('deletes forward past a separator', () => {
    handle.setValue(1500000);
    input.setSelectionRange(1, 1);
    press('Delete');
    expect(input.value).toBe('100.000');
    expect(input.selectionStart).toBe(1);
  });

  it('clears to empty and reports null', () => {
    handle.setValue(1500000);
    input.setSelectionRange(0, input.value.length);
    press('Backspace');
    expect(input.value).toBe('');
    expect(handle.getValue()).toBeNull();
  });
});

describe('pasting', () => {
  it('accepts a formatted rupiah string', () => {
    paste('Rp 1.500.000');
    expect(input.value).toBe('1.500.000');
    expect(handle.getValue()).toBe(1500000);
  });

  it('accepts a comma-grouped string', () => {
    paste('1,250,000');
    expect(handle.getValue()).toBe(1250000);
  });

  it('discards anything that is not a digit', () => {
    paste('abc');
    expect(input.value).toBe('');
    expect(handle.getValue()).toBeNull();
  });
});

describe('limits', () => {
  it('strips leading zeros', () => {
    type('00042');
    expect(input.value).toBe('42');
  });

  it('stops at the digit cap', () => {
    type('123456789012345');
    expect(input.dataset.value).toBe('123456789012');
  });
});

describe('setValue', () => {
  it('formats a stored number for display', () => {
    handle.setValue(880000);
    expect(input.value).toBe('880.000');
    expect(handle.getValue()).toBe(880000);
  });

  it('clears on an empty value', () => {
    handle.setValue(880000);
    handle.setValue('');
    expect(input.value).toBe('');
    expect(handle.getValue()).toBeNull();
  });
});
