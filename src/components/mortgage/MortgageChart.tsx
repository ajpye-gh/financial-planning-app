import { useState, type MouseEvent } from 'react';
import { formatCurrencyCompact } from '../../lib/format';

interface MortgageChartProps {
  /** Year-indexed remaining-balance series (index 0 = today), both already padded to the same
   *  length by the caller so they share one x-axis - see MortgagePage's padToLength. */
  originalBalances: number[];
  withExtraBalances: number[];
  /** Whether an extra-payment amount is actually set - hides the second line/legend/marker when 0,
   *  same "only show a series if there's something to show" pattern as CashflowChart's target line. */
  hasExtraPayment: boolean;
  /** Year index (from today) each schedule reaches $0 - drives the vertical payoff markers. */
  originalPayoffYear: number;
  withExtraPayoffYear: number;
}

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 20, right: 20, bottom: 28, left: 58 };
const AXIS_TICK_COUNT = 4;
const AXIS_LABEL_STACK_OFFSET = 7;
const TOOLTIP_WIDTH = 150;
const TOOLTIP_ROW_HEIGHT = 18;
const TOOLTIP_TOP_PADDING = 18;
const TOOLTIP_BOTTOM_PADDING = 10;

function buildPath(values: number[], scaleX: (index: number) => number, scaleY: (value: number) => number): string {
  return values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(index)} ${scaleY(value)}`).join(' ');
}

function axisTicks(min: number, max: number, count: number): number[] {
  if (max === min) {
    return [min];
  }
  return Array.from({ length: count }, (_, i) => min + ((max - min) * i) / (count - 1));
}

/** Remaining-balance chart for the current mortgage - reuses `.cashflow-chart*` classes rather than
 *  new CSS (same reuse RetirementChart.tsx already established), and reuses the `primary`/`unallocated`
 *  color roles for the original-vs-with-extra-payments lines the same way RetirementChart reuses them
 *  for Roth/Traditional. */
export function MortgageChart({
  originalBalances,
  withExtraBalances,
  hasExtraPayment,
  originalPayoffYear,
  withExtraPayoffYear,
}: Readonly<MortgageChartProps>) {
  const count = originalBalances.length;
  const yearLabels = originalBalances.map((_, index) => `Y${index}`);
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const balanceMax = Math.max(...originalBalances, ...withExtraBalances, 0);
  const scaleX = (index: number) => PADDING.left + (count === 1 ? innerWidth / 2 : (index / (count - 1)) * innerWidth);
  const scaleBalanceY = (value: number) => PADDING.top + innerHeight - (balanceMax === 0 ? 0 : (value / balanceMax) * innerHeight);

  const originalLine = buildPath(originalBalances, scaleX, scaleBalanceY);
  const withExtraLine = buildPath(withExtraBalances, scaleX, scaleBalanceY);
  const balanceTicks = axisTicks(0, balanceMax, AXIS_TICK_COUNT);
  // Deduplicated - a very short schedule (e.g. an already-tiny or already-paid-off balance) can
  // otherwise produce repeated indexes here, which would render duplicate-keyed ticks.
  const xTickIndexes = [...new Set([0, Math.round((count - 1) / 3), Math.round(((count - 1) * 2) / 3), count - 1])];

  const indexFromClientX = (svg: SVGSVGElement, clientX: number): number => {
    const rect = svg.getBoundingClientRect();
    const scaleFactor = rect.width === 0 ? 1 : WIDTH / rect.width;
    const xInViewBox = (clientX - rect.left) * scaleFactor;
    const clamped = Math.min(Math.max(xInViewBox, PADDING.left), WIDTH - PADDING.right);
    const ratio = innerWidth === 0 ? 0 : (clamped - PADDING.left) / innerWidth;
    return Math.min(Math.max(Math.round(ratio * (count - 1)), 0), count - 1);
  };

  const handleMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    setHoverIndex(indexFromClientX(event.currentTarget, event.clientX));
  };

  const hoverX = hoverIndex === null ? null : scaleX(hoverIndex);
  let tooltipX = 0;
  if (hoverX !== null) {
    const tooltipFlipped = hoverX + 12 + TOOLTIP_WIDTH > WIDTH - PADDING.right;
    tooltipX = tooltipFlipped ? hoverX - 12 - TOOLTIP_WIDTH : hoverX + 12;
  }

  const tooltipRows =
    hoverIndex === null
      ? []
      : [
          { text: `Original: ${formatCurrencyCompact(originalBalances[hoverIndex])}`, className: 'primary' },
          ...(hasExtraPayment
            ? [{ text: `With extra: ${formatCurrencyCompact(withExtraBalances[hoverIndex])}`, className: 'unallocated' }]
            : []),
        ];
  const tooltipHeight = TOOLTIP_TOP_PADDING + tooltipRows.length * TOOLTIP_ROW_HEIGHT + TOOLTIP_BOTTOM_PADDING;

  return (
    <div className="cashflow-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="cashflow-chart__svg"
        role="img"
        aria-label={`Remaining mortgage balance over ${count - 1} years, original schedule${hasExtraPayment ? ' vs. with extra principal payments' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {balanceTicks.map((tick) => (
          <line
            key={`grid-${tick}`}
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={scaleBalanceY(tick)}
            y2={scaleBalanceY(tick)}
            className="cashflow-chart__gridline"
          />
        ))}

        <path d={originalLine} className="cashflow-chart__line cashflow-chart__line--primary" />
        {hasExtraPayment && <path d={withExtraLine} className="cashflow-chart__line cashflow-chart__line--unallocated" />}

        {originalPayoffYear > 0 && originalPayoffYear < count - 1 && (
          <line
            x1={scaleX(originalPayoffYear)}
            x2={scaleX(originalPayoffYear)}
            y1={PADDING.top}
            y2={HEIGHT - PADDING.bottom}
            className="cashflow-chart__marker cashflow-chart__marker--primary"
          />
        )}
        {hasExtraPayment && withExtraPayoffYear > 0 && withExtraPayoffYear < count - 1 && (
          <line
            x1={scaleX(withExtraPayoffYear)}
            x2={scaleX(withExtraPayoffYear)}
            y1={PADDING.top}
            y2={HEIGHT - PADDING.bottom}
            className="cashflow-chart__marker cashflow-chart__marker--unallocated"
          />
        )}

        {xTickIndexes.map((index) => (
          <text key={index} x={scaleX(index)} y={HEIGHT - 8} className="cashflow-chart__tick" textAnchor="middle">
            {yearLabels[index]}
          </text>
        ))}

        {balanceTicks.map((tick) => (
          <text
            key={`balance-tick-${tick}`}
            x={PADDING.left - 8}
            y={scaleBalanceY(tick) + AXIS_LABEL_STACK_OFFSET}
            className="cashflow-chart__axis-label cashflow-chart__axis-label--primary"
            textAnchor="end"
            dominantBaseline="middle"
          >
            {formatCurrencyCompact(tick)}
          </text>
        ))}

        {hoverIndex !== null && hoverX !== null && count > 0 && (
          <g className="cashflow-chart__hover">
            <line x1={hoverX} x2={hoverX} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} className="cashflow-chart__crosshair" />
            <circle cx={hoverX} cy={scaleBalanceY(originalBalances[hoverIndex])} r={4} className="cashflow-chart__point cashflow-chart__point--primary" />
            {hasExtraPayment && (
              <circle
                cx={hoverX}
                cy={scaleBalanceY(withExtraBalances[hoverIndex])}
                r={4}
                className="cashflow-chart__point cashflow-chart__point--unallocated"
              />
            )}
            <g transform={`translate(${tooltipX}, ${PADDING.top})`} className="cashflow-chart__tooltip">
              <rect width={TOOLTIP_WIDTH} height={tooltipHeight} rx={8} className="cashflow-chart__tooltip-box" />
              <text x={10} y={TOOLTIP_TOP_PADDING} className="cashflow-chart__tooltip-title">
                {yearLabels[hoverIndex]}
              </text>
              {tooltipRows.map((row, index) => (
                <text
                  key={row.className}
                  x={10}
                  y={TOOLTIP_TOP_PADDING + (index + 1) * TOOLTIP_ROW_HEIGHT}
                  className={`cashflow-chart__tooltip-row cashflow-chart__tooltip-row--${row.className}`}
                >
                  {row.text}
                </text>
              ))}
            </g>
          </g>
        )}
      </svg>
      <div className="cashflow-chart__legend">
        <span className="cashflow-chart__legend-item">
          <span className="cashflow-chart__swatch cashflow-chart__swatch--primary" /> Original schedule
        </span>
        {hasExtraPayment && (
          <span className="cashflow-chart__legend-item">
            <span className="cashflow-chart__swatch cashflow-chart__swatch--unallocated" /> With extra payments
          </span>
        )}
      </div>
    </div>
  );
}
