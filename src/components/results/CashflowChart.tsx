import { useState, type MouseEvent } from 'react';
import { formatCurrency, formatCurrencyCompact } from '../../lib/format';
import type { ChartSeries } from '../../lib/model';
import type { PrimarySeries } from '../../lib/chartSeries';

interface CashflowChartProps {
  chart: ChartSeries;
  primary: PrimarySeries;
}

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 20, right: 58, bottom: 28, left: 58 };
const AXIS_TICK_COUNT = 4;
const TOOLTIP_WIDTH = 148;
const TOOLTIP_HEIGHT = 62;

function buildPath(values: number[], scaleX: (index: number) => number, scaleY: (value: number) => number): string {
  return values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(index)} ${scaleY(value)}`).join(' ');
}

function axisTicks(min: number, max: number, count: number): number[] {
  if (max === min) {
    return [min];
  }
  return Array.from({ length: count }, (_, i) => min + ((max - min) * i) / (count - 1));
}

export function CashflowChart({ chart, primary }: Readonly<CashflowChartProps>) {
  const { yearLabels, freeCash } = chart;
  const primaryValues = primary.values;
  const count = yearLabels.length;
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const targetAmount = primary.targetAmount;
  const primaryMax = Math.max(...primaryValues, 0, targetAmount ?? 0);
  const primaryMin = Math.min(...primaryValues, 0);
  const primaryRange = primaryMax - primaryMin || 1;

  const cashMax = Math.max(...freeCash, 0);
  const cashMin = Math.min(...freeCash, 0);
  const cashRange = cashMax - cashMin || 1;

  const scaleX = (index: number) =>
    PADDING.left + (count === 1 ? innerWidth / 2 : (index / (count - 1)) * innerWidth);
  const scalePrimaryY = (value: number) => PADDING.top + innerHeight - ((value - primaryMin) / primaryRange) * innerHeight;
  const scaleCashY = (value: number) => PADDING.top + innerHeight - ((value - cashMin) / cashRange) * innerHeight;

  const primaryLine = buildPath(primaryValues, scaleX, scalePrimaryY);
  const primaryBaseline = scalePrimaryY(Math.max(primaryMin, 0));
  const primaryArea =
    primaryValues.length > 0
      ? `${primaryLine} L ${scaleX(count - 1)} ${primaryBaseline} L ${scaleX(0)} ${primaryBaseline} Z`
      : '';
  const cashLine = buildPath(freeCash, scaleX, scaleCashY);

  const xTickIndexes = [0, Math.round((count - 1) / 3), Math.round(((count - 1) * 2) / 3), count - 1];
  const primaryTicks = axisTicks(primaryMin, primaryMax, AXIS_TICK_COUNT);
  const cashTicks = axisTicks(cashMin, cashMax, AXIS_TICK_COUNT);

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
        aria-label={`${primary.label} and monthly free cash across ${count} years`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {primaryTicks.map((tick) => (
          <line
            key={`grid-${tick}`}
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={scalePrimaryY(tick)}
            y2={scalePrimaryY(tick)}
            className="cashflow-chart__gridline"
          />
        ))}

        {primaryArea && <path d={primaryArea} className="cashflow-chart__area" />}
        <path d={primaryLine} className="cashflow-chart__line cashflow-chart__line--primary" />
        <path d={cashLine} className="cashflow-chart__line cashflow-chart__line--cash" />
        {targetAmount !== undefined && (
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={scalePrimaryY(targetAmount)}
            y2={scalePrimaryY(targetAmount)}
            className="cashflow-chart__line--target"
          />
        )}

        {xTickIndexes.map((index) => (
          <text key={index} x={scaleX(index)} y={HEIGHT - 8} className="cashflow-chart__tick" textAnchor="middle">
            {yearLabels[index]}
          </text>
        ))}

        {primaryTicks.map((tick) => (
          <text
            key={`primary-tick-${tick}`}
            x={PADDING.left - 8}
            y={scalePrimaryY(tick)}
            className="cashflow-chart__axis-label cashflow-chart__axis-label--primary"
            textAnchor="end"
            dominantBaseline="middle"
          >
            {formatCurrencyCompact(tick)}
          </text>
        ))}

        {cashTicks.map((tick) => (
          <text
            key={`cash-tick-${tick}`}
            x={WIDTH - PADDING.right + 8}
            y={scaleCashY(tick)}
            className="cashflow-chart__axis-label cashflow-chart__axis-label--cash"
            textAnchor="start"
            dominantBaseline="middle"
          >
            {formatCurrency(tick)}
          </text>
        ))}

        {hoverIndex !== null && hoverX !== null && primaryValues.length > 0 && (
          <g className="cashflow-chart__hover">
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              className="cashflow-chart__crosshair"
            />
            <circle
              cx={hoverX}
              cy={scalePrimaryY(primaryValues[hoverIndex])}
              r={4}
              className="cashflow-chart__point cashflow-chart__point--primary"
            />
            <circle
              cx={hoverX}
              cy={scaleCashY(freeCash[hoverIndex])}
              r={4}
              className="cashflow-chart__point cashflow-chart__point--cash"
            />
            <g transform={`translate(${tooltipX}, ${PADDING.top})`} className="cashflow-chart__tooltip">
              <rect width={TOOLTIP_WIDTH} height={TOOLTIP_HEIGHT} rx={8} className="cashflow-chart__tooltip-box" />
              <text x={10} y={18} className="cashflow-chart__tooltip-title">
                {yearLabels[hoverIndex]}
              </text>
              <text x={10} y={36} className="cashflow-chart__tooltip-row cashflow-chart__tooltip-row--primary">
                {primary.label}: {formatCurrencyCompact(primaryValues[hoverIndex])}
              </text>
              <text x={10} y={52} className="cashflow-chart__tooltip-row cashflow-chart__tooltip-row--cash">
                Free cash: {formatCurrency(freeCash[hoverIndex])}/mo
              </text>
            </g>
          </g>
        )}
      </svg>
      <div className="cashflow-chart__legend">
        <span className="cashflow-chart__legend-item">
          <span className="cashflow-chart__swatch cashflow-chart__swatch--primary" /> {primary.label}
        </span>
        <span className="cashflow-chart__legend-item">
          <span className="cashflow-chart__swatch cashflow-chart__swatch--cash" /> Monthly free cash
        </span>
      </div>
    </div>
  );
}
