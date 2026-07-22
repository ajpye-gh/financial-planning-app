import type { ChartSeriesId, ChartSeriesOption } from '../../lib/chartSeries';

interface ChartToggleProps {
  options: ChartSeriesOption[];
  selected: ChartSeriesId | null;
  onSelect: (id: ChartSeriesId) => void;
}

export function ChartToggle({ options, selected, onSelect }: Readonly<ChartToggleProps>) {
  if (options.length <= 1) {
    return null;
  }
  return (
    <div className="chart-toggle">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={
            option.id === selected ? 'chart-toggle__tab chart-toggle__tab--active' : 'chart-toggle__tab'
          }
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
