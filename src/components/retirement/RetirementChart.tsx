import { useState, type MouseEvent } from 'react';
import { formatCurrencyCompact } from '../../lib/format';
import type { RetirementProjection } from '../../lib/retirement';

interface RetirementChartProps {
  projection: RetirementProjection;
}

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 20, right: 24, bottom: 28, left: 58 };
const AXIS_TICK_COUNT = 4;
const AXIS_LABEL_STACK_OFFSET = 7;
const TOOLTIP_WIDTH = 120;
const TOOLTIP_HEIGHT = 44;

function buildPath(values: number[], scaleX: (index: number) => number, scaleY: (value: number) => number): string {
  return values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(index)} ${scaleY(value)}`).join(' ');
}

function axisTicks(min: number, max: number, count: number): number[] {
  if (max === min) {
    return [min];
  }
  return Array.from({ length: count }, (_, i) => min + ((max - min) * i) / (count - 1));
}

/** A minimal single-series line chart for the retirement balance projection, reusing the
 *  `.cashflow-chart*` classes from CashflowChart.tsx (gridlines, line, ticks, tooltip) instead of
 *  new CSS - CashflowChart itself isn't reusable as a component here since its scaling logic is
 *  hard-wired to three named series (primary/unallocated/cash), not a generic one-series chart. */
export function RetirementChart({ projection }: Readonly<RetirementChartProps>) {
  const { yearLabels, balances, retirementYearIndex } = projection;
  const count = balances.length;
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const max = Math.max(...balances, 0);
  const min = Math.min(...balances, 0);
  const range = max - min || 1;

  const scaleX = (index: number) => PADDING.left + (count === 1 ? innerWidth / 2 : (index / (count - 1)) * innerWidth);
  const scaleY = (value: number) => PADDING.top + innerHeight - ((value - min) / range) * innerHeight;

  const line = buildPath(balances, scaleX, scaleY);
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

  return (
    <div className="cashflow-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="cashflow-chart__svg"
        role="img"
        aria-label={`Projected retirement balance across ${count} years, including drawdown after retirement`}
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

        <path d={line} className="cashflow-chart__line cashflow-chart__line--primary" />

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
            <circle cx={hoverX} cy={scaleY(balances[hoverIndex])} r={4} className="cashflow-chart__point cashflow-chart__point--primary" />
            <g transform={`translate(${tooltipX}, ${PADDING.top})`} className="cashflow-chart__tooltip">
              <rect width={TOOLTIP_WIDTH} height={TOOLTIP_HEIGHT} rx={8} className="cashflow-chart__tooltip-box" />
              <text x={10} y={18} className="cashflow-chart__tooltip-title">
                {yearLabels[hoverIndex]}
              </text>
              <text x={10} y={36} className="cashflow-chart__tooltip-row cashflow-chart__tooltip-row--primary">
                {formatCurrencyCompact(balances[hoverIndex])}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
