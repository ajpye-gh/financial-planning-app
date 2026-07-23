import { useState, type MouseEvent } from 'react';
import { formatCurrencyCompact } from '../../lib/format';
import type { RetirementProjection } from '../../lib/retirement';

interface RetirementChartProps {
  rothProjection: RetirementProjection;
  traditionalProjection: RetirementProjection;
}

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 20, right: 24, bottom: 28, left: 58 };
const AXIS_TICK_COUNT = 4;
const AXIS_LABEL_STACK_OFFSET = 7;
const TOOLTIP_WIDTH = 140;
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

/** A two-line chart for the Roth vs Traditional retirement balance projections, reusing the
 *  `.cashflow-chart*` classes from CashflowChart.tsx (gridlines, lines, ticks, tooltip, legend)
 *  instead of new CSS. Unlike CashflowChart's deliberately-separate scales for genuinely different
 *  units (dollars vs. monthly cashflow), Roth and Traditional are the same kind of quantity, so both
 *  lines share one y-scale here. */
export function RetirementChart({ rothProjection, traditionalProjection }: Readonly<RetirementChartProps>) {
  const { yearLabels, retirementYearIndex } = rothProjection;
  const rothBalances = rothProjection.balances;
  const traditionalBalances = traditionalProjection.balances;
  const count = yearLabels.length;
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const max = Math.max(...rothBalances, ...traditionalBalances, 0);
  const min = Math.min(...rothBalances, ...traditionalBalances, 0);
  const range = max - min || 1;

  const scaleX = (index: number) => PADDING.left + (count === 1 ? innerWidth / 2 : (index / (count - 1)) * innerWidth);
  const scaleY = (value: number) => PADDING.top + innerHeight - ((value - min) / range) * innerHeight;

  const rothLine = buildPath(rothBalances, scaleX, scaleY);
  const traditionalLine = buildPath(traditionalBalances, scaleX, scaleY);
  const ticks = axisTicks(min, max, AXIS_TICK_COUNT);
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
          { text: `Total: ${formatCurrencyCompact(rothBalances[hoverIndex] + traditionalBalances[hoverIndex])}`, className: 'cash' },
        ];
  const tooltipHeight = TOOLTIP_TOP_PADDING + tooltipRows.length * TOOLTIP_ROW_HEIGHT + TOOLTIP_BOTTOM_PADDING;

  return (
    <div className="cashflow-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="cashflow-chart__svg"
        role="img"
        aria-label={`Projected Roth and Traditional retirement balances across ${count} years, including drawdown after retirement`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {ticks.map((tick) => (
          <line
            key={`grid-${tick}`}
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={scaleY(tick)}
            y2={scaleY(tick)}
            className="cashflow-chart__gridline"
          />
        ))}

        <path d={rothLine} className="cashflow-chart__line cashflow-chart__line--primary" />
        <path d={traditionalLine} className="cashflow-chart__line cashflow-chart__line--unallocated" />

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
            {yearLabels[index]}
          </text>
        ))}

        {ticks.map((tick) => (
          <text
            key={`tick-${tick}`}
            x={PADDING.left - 8}
            y={scaleY(tick) + AXIS_LABEL_STACK_OFFSET}
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
            <circle cx={hoverX} cy={scaleY(rothBalances[hoverIndex])} r={4} className="cashflow-chart__point cashflow-chart__point--primary" />
            <circle
              cx={hoverX}
              cy={scaleY(traditionalBalances[hoverIndex])}
              r={4}
              className="cashflow-chart__point cashflow-chart__point--unallocated"
            />
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
          <span className="cashflow-chart__swatch cashflow-chart__swatch--primary" /> Roth
        </span>
        <span className="cashflow-chart__legend-item">
          <span className="cashflow-chart__swatch cashflow-chart__swatch--unallocated" /> Traditional
        </span>
      </div>
    </div>
  );
}
