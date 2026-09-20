import { describe, it, expect } from 'vitest';
import {
  groupDigits,
  normalizeRentInput,
  stripLeadingZeros,
  digitsOnly,
  parseRent,
  formatRent,
  numberToCurrency,
  formatDistance,
} from '../src/utils/format.js';

describe('groupDigits', () => {
  it('groups thousands with a period, Indonesian style', () => {
    expect(groupDigits('1500000')).toBe('1.500.000');
    expect(groupDigits('1000')).toBe('1.000');
    expect(groupDigits('100000000')).toBe('100.000.000');
  });

  it('leaves values below a thousand alone', () => {
    expect(groupDigits('500')).toBe('500');
    expect(groupDigits('1')).toBe('1');
  });

  it('returns nothing for an empty string', () => {
    expect(groupDigits('')).toBe('');
  });

  it('agrees with the platform formatter for id-ID', () => {
    // If these ever diverge, a typed value and a displayed value would differ.
    expect(groupDigits('1500000')).toBe(new Intl.NumberFormat('id-ID').format(1500000));
    expect(groupDigits('987654321')).toBe(new Intl.NumberFormat('id-ID').format(987654321));
  });
});

describe('normalizeRentInput', () => {
  it('keeps only digits', () => {
    expect(normalizeRentInput('Rp 1.500.000')).toBe('1500000');
    expect(normalizeRentInput('1,250,000')).toBe('1250000');
    expect(normalizeRentInput('abc')).toBe('');
  });

  it('strips leading zeros but keeps a single zero', () => {
    expect(stripLeadingZeros('007')).toBe('7');
    expect(stripLeadingZeros('000')).toBe('0');
    expect(stripLeadingZeros('')).toBe('');
  });

  it('caps the digit count', () => {
    expect(normalizeRentInput('123456789012345')).toBe('123456789012');
    expect(normalizeRentInput('123456789012345', 4)).toBe('1234');
  });

  it('tolerates null and undefined', () => {
    expect(digitsOnly(null)).toBe('');
    expect(digitsOnly(undefined)).toBe('');
  });
});

describe('parseRent and formatRent', () => {
  it('round-trips a typed amount', () => {
    expect(parseRent('Rp 1.500.000')).toBe(1500000);
    expect(formatRent(1500000)).toBe('1.500.000');
  });

  it('returns null when there is no number at all', () => {
    expect(parseRent('')).toBeNull();
    expect(parseRent('abc')).toBeNull();
  });

  it('formats zero rather than treating it as absent', () => {
    expect(formatRent(0)).toBe('0');
    expect(parseRent('0')).toBe(0);
  });
});

describe('numberToCurrency', () => {
  it('prefixes rupiah and groups thousands', () => {
    expect(numberToCurrency(1350000)).toBe('Rp 1.350.000');
  });

  it('formats zero as an amount, not as missing', () => {
    expect(numberToCurrency(0)).toBe('Rp 0');
  });

  it('reads "Not recorded" for absent or unusable values', () => {
    // The prototype rendered "Rp NaN" here.
    expect(numberToCurrency(null)).toBe('Not recorded');
    expect(numberToCurrency(undefined)).toBe('Not recorded');
    expect(numberToCurrency(NaN)).toBe('Not recorded');
    expect(numberToCurrency(Infinity)).toBe('Not recorded');
  });
});

describe('formatDistance', () => {
  it('uses one decimal and an Indonesian decimal comma', () => {
    expect(formatDistance(1.8)).toBe('1,8 km');
    expect(formatDistance(2)).toBe('2,0 km');
    expect(formatDistance(1.84)).toBe('1,8 km');
    expect(formatDistance(1.85)).toBe('1,9 km');
  });

  it('formats zero distance rather than hiding it', () => {
    expect(formatDistance(0)).toBe('0,0 km');
  });

  it('reads "Not recorded" for absent values', () => {
    expect(formatDistance(null)).toBe('Not recorded');
    expect(formatDistance(undefined)).toBe('Not recorded');
    expect(formatDistance(NaN)).toBe('Not recorded');
  });
});
