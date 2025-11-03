import { expect, it, describe, afterAll } from '@jest/globals';

Object.defineProperty(global, 'navigator', {
  value: { language: 'en-US' },
  configurable: true,
});

import {
  currencyFormatterWithoutSymbol,
  formatCurrencyWithoutSymbol,
  currencyFormatter,
  formatCurrency,
  formatCryptoAmount,
} from './number-formatters';

describe('currencyFormatterWithoutSymbol', () => {
  it('formats number with two decimals and no symbol', () => {
    expect(currencyFormatterWithoutSymbol.format(1234.567)).toBe('1,234.57');
  });
});

describe('formatCurrencyWithoutSymbol', () => {
  it('formats valid number', () => {
    expect(formatCurrencyWithoutSymbol(1234.567)).toBe('1,234.57');
  });

  it('returns "-" for undefined', () => {
    expect(formatCurrencyWithoutSymbol(undefined as unknown as number)).toBe(
      '-'
    );
  });

  it('returns "-" for NaN', () => {
    expect(formatCurrencyWithoutSymbol(NaN)).toBe('-');
  });
});

describe('currencyFormatter', () => {
  it('returns a formatter for given currency', () => {
    const formatter = currencyFormatter('usd');
    expect(formatter.format(12.3)).toMatch(/12\.30|\$12\.30|\u20AC12\.30/); // Covers various locales
  });
});

describe('formatCurrency', () => {
  it('formats a valid currency value', () => {
    expect(formatCurrency(1234.5, 'USD')).toMatch(/\$1,234\.50/);
  });

  it('returns "-" for undefined value', () => {
    expect(formatCurrency(undefined as unknown as number, 'USD')).toBe('-');
  });

  it('returns "-" for NaN', () => {
    expect(formatCurrency(NaN, 'USD')).toBe('-');
  });
});

describe('formatCryptoAmount', () => {
  it('formats value >= 1M without decimal', () => {
    expect(formatCryptoAmount(1500000)).toBe('1,500,000');
  });

  it('formats value >= 1 with two decimals', () => {
    expect(formatCryptoAmount(1234.5678)).toBe('1,234.57');
  });

  it('formats value >= 0.01 with 3-4 decimals', () => {
    expect(formatCryptoAmount(0.01234)).toMatch(/0\.0123|0\.0124/);
  });

  it('formats value >= 0.0001 with 4-6 decimals', () => {
    expect(formatCryptoAmount(0.000123)).toMatch(/0\.000123|0\.000124/);
  });
});

afterAll(() => {
  delete (global as any).navigator;
});
