import { useState, type MouseEvent } from 'react';
import { formatCurrency, formatCurrencyCompact } from '../../lib/format';
import type { ChartSeries } from '../../lib/model';
import type { PrimarySeries } from '../../lib/chartSeries';

interface CashflowChartProps {
  chart: ChartSeries;
  primary: PrimarySeries;
}

type SeriesKey = 'unallocated' | 'primary' | 'cash' | 'target';

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 20, right: 58, bottom: 28, left: 58 };
const AXIS_TICK_COUNT = 4;
const AXIS_LABEL_STACK_OFFSET = 7;
const TOOLTIP_WIDTH = 148;
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

function legendItemClassName(visible: boolean): string {
  return visible ? 'cashflow-chart__legend-item' : 'cashflow-chart__legend-item cashflow-chart__legend-item--hidden';
}

export function CashflowChart({ chart, primary }: Readonly<CashflowChartProps>) {
  const { yearLabels, freeCash, unallocatedSavings } = chart;
  const primaryValues = primary.values;
  const hasPrimary = primaryValues.length > 0;
  const count = yearLabels.length;
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<ReadonlySet<SeriesKey>>(new Set());
  const toggleSeries = (key: SeriesKey) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const targetAmount = primary.targetAmount;
  const primaryMax = Math.max(...primaryValues, 0, targetAmount ?? 0);
  const primaryMin = Math.min(...primaryValues, 0);
  const primaryRange = primaryMax - primaryMin || 1;

  const unallocatedMax = Math.max(...unallocatedSavings, 0);
  const unallocatedMin = Math.min(...unallocatedSavings, 0);
  const unallocatedRange = unallocatedMax - unallocatedMin || 1;

  const cashMax = Math.max(...freeCash, 0);
  const cashMin = Math.min(...freeCash, 0);
  const cashRange = cashMax - cashMin || 1;

  const scaleX = (index: number) =>
    PADDING.left + (count === 1 ? innerWidth / 2 : (index / (count - 1)) * innerWidth);
  const scalePrimaryY = (value: number) => PADDING.top + innerHeight - ((value - primaryMin) / primaryRange) * innerHeight;
  const scaleUnallocatedY = (value: number) =>
    PADDING.top + innerHeight - ((value - unallocatedMin) / unallocatedRange) * innerHeight;
  const scaleCashY = (value: number) => PADDING.top + innerHeight - ((value - cashMin) / cashRange) * innerHeight;

  const showUnallocated = !hiddenSeries.has('unallocated');
  const showPrimary = hasPrimary && !hiddenSeries.has('primary');
  const showCash = !hiddenSeries.has('cash');
  const showTarget = targetAmount !== undefined && !hiddenSeries.has('target');

  const primaryLine = buildPath(primaryValues, scaleX, scalePrimaryY);
  const unallocatedLine = buildPath(unallocatedSavings, scaleX, scaleUnallocatedY);
  const cashLine = buildPath(freeCash, scaleX, scaleCashY);
  // Only worth calling out where $0 actually is if free cash dips below it somewhere - and only
  // while the free cash line itself is shown, since it's an annotation on that series.
  const cashEverNegative = showCash && freeCash.some((value) => value < 0);
  const zeroCashY = scaleCashY(0);

  const xTickIndexes = [0, Math.round((count - 1) / 3), Math.round(((count - 1) * 2) / 3), count - 1];
  const primaryTicks = axisTicks(primaryMin, primaryMax, AXIS_TICK_COUNT);
  const unallocatedTicks = axisTicks(unallocatedMin, unallocatedMax, AXIS_TICK_COUNT);
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

  const tooltipRows =
    hoverIndex === null
      ? []
      : [
          ...(showPrimary
            ? [{ text: `${primary.label}: ${formatCurrencyCompact(primaryValues[hoverIndex])}`, className: 'primary' }]
            : []),
          ...(showUnallocated
            ? [{ text: `Unallocated: ${formatCurrencyCompact(unallocatedSavings[hoverIndex])}`, className: 'unallocated' }]
            : []),
          ...(showCash ? [{ text: `Free cash: ${formatCurrency(freeCash[hoverIndex])}/mo`, className: 'cash' }] : []),
        ];
  const tooltipHeight = TOOLTIP_TOP_PADDING + tooltipRows.length * TOOLTIP_ROW_HEIGHT + TOOLTIP_BOTTOM_PADDING;

  const chartedSeriesLabel = hasPrimary
    ? `Unallocated savings, ${primary.label}, and monthly free cash`
    : 'Unallocated savings and monthly free cash';

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
        aria-label={`${chartedSeriesLabel} across ${count} years`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {unallocatedTicks.map((tick) => (
          <line
            key={`grid-${tick}`}
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={scaleUnallocatedY(tick)}
            y2={scaleUnallocatedY(tick)}
            className="cashflow-chart__gridline"
          />
        ))}

        {cashEverNegative && (
          <rect
            x={PADDING.left}
            y={zeroCashY}
            width={innerWidth}
            height={Math.max(HEIGHT - PADDING.bottom - zeroCashY, 0)}
            className="cashflow-chart__zero-area"
          />
        )}

        {showPrimary && <path d={primaryLine} className="cashflow-chart__line cashflow-chart__line--primary" />}
        {showUnallocated && <path d={unallocatedLine} className="cashflow-chart__line cashflow-chart__line--unallocated" />}
        {showCash && <path d={cashLine} className="cashflow-chart__line cashflow-chart__line--cash" />}
        {cashEverNegative && (
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={zeroCashY}
            y2={zeroCashY}
            className="cashflow-chart__line--zero-cash"
          />
        )}
        {targetAmount !== undefined && !hiddenSeries.has('target') && (
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

        {showUnallocated &&
          unallocatedTicks.map((tick) => (
            <text
              key={`unallocated-tick-${tick}`}
              x={PADDING.left - 8}
              y={scaleUnallocatedY(tick) - AXIS_LABEL_STACK_OFFSET}
              className="cashflow-chart__axis-label cashflow-chart__axis-label--unallocated"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {formatCurrencyCompact(tick)}
            </text>
          ))}

        {showPrimary &&
          primaryTicks.map((tick) => (
            <text
              key={`primary-tick-${tick}`}
              x={PADDING.left - 8}
              y={scalePrimaryY(tick) + AXIS_LABEL_STACK_OFFSET}
              className="cashflow-chart__axis-label cashflow-chart__axis-label--primary"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {formatCurrencyCompact(tick)}
            </text>
          ))}

        {showCash &&
          cashTicks.map((tick) => (
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

        {hoverIndex !== null && hoverX !== null && count > 0 && (
          <g className="cashflow-chart__hover">
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              className="cashflow-chart__crosshair"
            />
            {showPrimary && (
              <circle
                cx={hoverX}
                cy={scalePrimaryY(primaryValues[hoverIndex])}
                r={4}
                className="cashflow-chart__point cashflow-chart__point--primary"
              />
            )}
            {showUnallocated && (
              <circle
                cx={hoverX}
                cy={scaleUnallocatedY(unallocatedSavings[hoverIndex])}
                r={4}
                className="cashflow-chart__point cashflow-chart__point--unallocated"
              />
            )}
            {showCash && (
              <circle
                cx={hoverX}
                cy={scaleCashY(freeCash[hoverIndex])}
                r={4}
                className="cashflow-chart__point cashflow-chart__point--cash"
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
        <button
          type="button"
          className={legendItemClassName(showUnallocated)}
          aria-pressed={!showUnallocated}
          onClick={() => toggleSeries('unallocated')}
        >
          <span className="cashflow-chart__swatch cashflow-chart__swatch--unallocated" /> Unallocated savings
        </button>
        {hasPrimary && (
          <button
            type="button"
            className={legendItemClassName(showPrimary)}
            aria-pressed={!showPrimary}
            onClick={() => toggleSeries('primary')}
          >
            <span className="cashflow-chart__swatch cashflow-chart__swatch--primary" /> {primary.label}
          </button>
        )}
        <button
          type="button"
          className={legendItemClassName(showCash)}
          aria-pressed={!showCash}
          onClick={() => toggleSeries('cash')}
        >
          <span className="cashflow-chart__swatch cashflow-chart__swatch--cash" /> Monthly free cash
        </button>
        {targetAmount !== undefined && (
          <button
            type="button"
            className={legendItemClassName(showTarget)}
            aria-pressed={!showTarget}
            onClick={() => toggleSeries('target')}
          >
            <span className="cashflow-chart__swatch cashflow-chart__swatch--target" /> {primary.label} target
          </button>
        )}
      </div>
    </div>
  );
}
