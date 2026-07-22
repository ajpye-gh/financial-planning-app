export type SliderFormat = '$' | 'k' | '%' | 'yr' | 'n';

export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(amount)).toLocaleString()}`;
}

export function formatCurrencyCompact(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(amount) / 1000)}k`;
}

export function formatSliderValue(value: number, format: SliderFormat): string {
  switch (format) {
    case 'k':
      return `$${value}k`;
    case '$':
      return `$${value.toLocaleString()}`;
    case '%':
      return `${value.toFixed(1)}%`;
    case 'yr':
      return String(value);
    case 'n':
    default:
      return String(value);
  }
}
