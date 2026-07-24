import { formatCurrency, formatCurrencyCompact, formatSliderValue } from '@src/lib/format';

describe('formatCurrency', () => {
  it('formats positive and negative amounts with thousands separators', () => {
    expect(formatCurrency(1234.6)).toBe('$1,235');
    expect(formatCurrency(-1234.6)).toBe('-$1,235');
    expect(formatCurrency(0)).toBe('$0');
  });
});

describe('formatCurrencyCompact', () => {
  it('rounds to the nearest thousand and appends k below $1M', () => {
    expect(formatCurrencyCompact(923550)).toBe('$924k');
    expect(formatCurrencyCompact(-1500)).toBe('-$2k');
  });

  it('switches to millions with 2 decimal places at $1M and above', () => {
    expect(formatCurrencyCompact(1335000)).toBe('$1.34M');
    expect(formatCurrencyCompact(1000000)).toBe('$1.00M');
    expect(formatCurrencyCompact(-2500000)).toBe('-$2.50M');
  });

  it('does not affect the underlying value, only its display', () => {
    const amount = 1335000;
    formatCurrencyCompact(amount);
    expect(amount).toBe(1335000);
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

  it("switches 'k'-format values to millions at 1000k ($1M) and above, same threshold as formatCurrencyCompact", () => {
    expect(formatSliderValue(1335, 'k')).toBe('$1.34M');
    expect(formatSliderValue(2000, 'k')).toBe('$2.00M');
    expect(formatSliderValue(999, 'k')).toBe('$999k');
  });
});
