export type SliderFormat = '$' | 'k' | '%' | 'yr' | 'n';

const MILLION_THRESHOLD_K = 1000;

/** Rounds half-away-from-zero, unlike toFixed's own binary-float-driven rounding, which can round
 *  down at exact .xx5 boundaries (e.g. plain (1.335).toFixed(2) gives "1.33", not "1.34"). */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Formats a non-negative value already expressed in thousands (K) as "500k", switching to
 *  "1.34M" once it reaches 1000k ($1M) - keeps large balances (home value, retirement savings,
 *  etc.) readable without a wall of digits. Display-only; never touches the underlying number. */
function formatK(kValue: number): string {
  if (kValue >= MILLION_THRESHOLD_K) {
    return `${roundTo(kValue / 1000, 2).toFixed(2)}M`;
  }
  return `${Math.round(kValue)}k`;
}

export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(amount)).toLocaleString()}`;
}

export function formatCurrencyCompact(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${formatK(Math.abs(amount) / 1000)}`;
}

export function formatSliderValue(value: number, format: SliderFormat): string {
  switch (format) {
    case 'k': {
      const sign = value < 0 ? '-' : '';
      return `${sign}$${formatK(Math.abs(value))}`;
    }
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
