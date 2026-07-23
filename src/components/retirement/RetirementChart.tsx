import { useState, type MouseEvent } from 'react';
import { formatCurrency, formatCurrencyCompact } from '../../lib/format';
import type { RetirementProjection } from '../../lib/retirement';

interface RetirementChartProps {
  rothProjection: RetirementProjection;
  traditionalProjection: RetirementProjection;
  /** Annual federal tax owed, one entry per year - a very different magnitude than the balance
   *  lines, so it gets its own right-side axis (same reasoning as CashflowChart's cash/primary
   *  split). */
  taxSeries: number[];
  /** The projections are indexed by year-offset-from-today internally; this converts the x-axis
   *  and tooltip to actual ages (index 0 = currentAge), which read far more naturally than a raw
   *  year count. */
  currentAge: number;
}

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 20, right: 58, bottom: 28, left: 58 };
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

/** A three-line chart for the Roth and Traditional retirement balances plus estimated income tax,
 *  reusing the `.cashflow-chart*` classes from CashflowChart.tsx instead of new CSS. Roth and
 *  Traditional share one (left) y-scale - same kind of quantity, a running balance. Tax gets its
 *  own (right) y-scale, same split CashflowChart already uses between its balance-like series and
 *  its very-differently-scaled monthly cashflow series. */
export function RetirementChart({ rothProjection, traditionalProjection, taxSeries, currentAge }: Readonly<RetirementChartProps>) {
  const { yearLabels, retirementYearIndex } = rothProjection;
  const rothBalances = rothProjection.balances;
  const traditionalBalances = traditionalProjection.balances;
  const count = yearLabels.length;
  const ageLabels = yearLabels.map((_, index) => String(currentAge + index));
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const balanceMax = Math.max(...rothBalances, ...traditionalBalances, 0);
  const balanceMin = Math.min(...rothBalances, ...traditionalBalances, 0);
  const balanceRange = balanceMax - balanceMin || 1;

  const taxMax = Math.max(...taxSeries, 0);
  const taxMin = Math.min(...taxSeries, 0);
  const taxRange = taxMax - taxMin || 1;

  const scaleX = (index: number) => PADDING.left + (count === 1 ? innerWidth / 2 : (index / (count - 1)) * innerWidth);
  const scaleBalanceY = (value: number) => PADDING.top + innerHeight - ((value - balanceMin) / balanceRange) * innerHeight;
  const scaleTaxY = (value: number) => PADDING.top + innerHeight - ((value - taxMin) / taxRange) * innerHeight;

  const rothLine = buildPath(rothBalances, scaleX, scaleBalanceY);
  const traditionalLine = buildPath(traditionalBalances, scaleX, scaleBalanceY);
  const taxLine = buildPath(taxSeries, scaleX, scaleTaxY);
  const balanceTicks = axisTicks(balanceMin, balanceMax, AXIS_TICK_COUNT);
  const taxTicks = axisTicks(taxMin, taxMax, AXIS_TICK_COUNT);
  const xTickIndexes = [0, Math.round((count - 1) / 3), Math.round(((count - 1) * 2) / 3), count - 1];

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
          { text: `Roth: ${formatCurrencyCompact(rothBalances[hoverIndex])}`, className: 'primary' },
          { text: `Traditional: ${formatCurrencyCompact(traditionalBalances[hoverIndex])}`, className: 'unallocated' },
          { text: `Tax: ${formatCurrency(taxSeries[hoverIndex])}/yr`, className: 'cash' },
        ];
  const tooltipHeight = TOOLTIP_TOP_PADDING + tooltipRows.length * TOOLTIP_ROW_HEIGHT + TOOLTIP_BOTTOM_PADDING;

  return (
    <div className="cashflow-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="cashflow-chart__svg"
        role="img"
        aria-label={`Projected Roth and Traditional retirement balances and estimated income tax from age ${currentAge} through age ${currentAge + count - 1}, including drawdown after retirement`}
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

        <path d={rothLine} className="cashflow-chart__line cashflow-chart__line--primary" />
        <path d={traditionalLine} className="cashflow-chart__line cashflow-chart__line--unallocated" />
        <path d={taxLine} className="cashflow-chart__line cashflow-chart__line--cash" />

        {retirementYearIndex > 0 && retirementYearIndex < count - 1 && (
          <>
            <line
              x1={scaleX(retirementYearIndex)}
              x2={scaleX(retirementYearIndex)}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              className="cashflow-chart__retirement-marker"
            />
            <text x={scaleX(retirementYearIndex) + 4} y={PADDING.top + 10} className="cashflow-chart__retirement-marker-label">
              Retirement
            </text>
          </>
        )}

        {xTickIndexes.map((index) => (
          <text key={index} x={scaleX(index)} y={HEIGHT - 8} className="cashflow-chart__tick" textAnchor="middle">
            {ageLabels[index]}
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

        {taxTicks.map((tick) => (
          <text
            key={`tax-tick-${tick}`}
            x={WIDTH - PADDING.right + 8}
            y={scaleTaxY(tick)}
            className="cashflow-chart__axis-label cashflow-chart__axis-label--cash"
            textAnchor="start"
            dominantBaseline="middle"
          >
            {formatCurrencyCompact(tick)}
          </text>
        ))}

        {hoverIndex !== null && hoverX !== null && count > 0 && (
          <g className="cashflow-chart__hover">
            <line x1={hoverX} x2={hoverX} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} className="cashflow-chart__crosshair" />
            <circle cx={hoverX} cy={scaleBalanceY(rothBalances[hoverIndex])} r={4} className="cashflow-chart__point cashflow-chart__point--primary" />
            <circle
              cx={hoverX}
              cy={scaleBalanceY(traditionalBalances[hoverIndex])}
              r={4}
              className="cashflow-chart__point cashflow-chart__point--unallocated"
            />
            <circle cx={hoverX} cy={scaleTaxY(taxSeries[hoverIndex])} r={4} className="cashflow-chart__point cashflow-chart__point--cash" />
            <g transform={`translate(${tooltipX}, ${PADDING.top})`} className="cashflow-chart__tooltip">
              <rect width={TOOLTIP_WIDTH} height={tooltipHeight} rx={8} className="cashflow-chart__tooltip-box" />
              <text x={10} y={TOOLTIP_TOP_PADDING} className="cashflow-chart__tooltip-title">
                Age {ageLabels[hoverIndex]}
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
          <span className="cashflow-chart__swatch cashflow-chart__swatch--primary" /> Roth
        </span>
        <span className="cashflow-chart__legend-item">
          <span className="cashflow-chart__swatch cashflow-chart__swatch--unallocated" /> Traditional
        </span>
        <span className="cashflow-chart__legend-item">
          <span className="cashflow-chart__swatch cashflow-chart__swatch--cash" /> Income tax
        </span>
      </div>
    </div>
  );
}
