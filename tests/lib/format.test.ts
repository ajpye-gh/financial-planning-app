import { formatCurrency, formatCurrencyCompact, formatSliderValue } from '@src/lib/format';

describe('formatCurrency', () => {
  it('formats positive and negative amounts with thousands separators', () => {
    expect(formatCurrency(1234.6)).toBe('$1,235');
    expect(formatCurrency(-1234.6)).toBe('-$1,235');
    expect(formatCurrency(0)).toBe('$0');
  });
});

describe('formatCurrencyCompact', () => {
  it('rounds to the nearest thousand and appends k', () => {
    expect(formatCurrencyCompact(923550)).toBe('$924k');
    expect(formatCurrencyCompact(-1500)).toBe('-$2k');
  });
});

describe('formatSliderValue', () => {
  it('formats each slider unit', () => {
    expect(formatSliderValue(475, 'k')).toBe('$475k');
    expect(formatSliderValue(10500, '$')).toBe('$10,500');
    expect(formatSliderValue(2.5, '%')).toBe('2.5%');
    expect(formatSliderValue(10, 'yr')).toBe('10');
    expect(formatSliderValue(2, 'n')).toBe('2');
  });
});
