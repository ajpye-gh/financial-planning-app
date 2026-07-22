import { TrashIcon } from '../icons';
import type { Child } from '../../lib/children';

const HORIZON_YEARS = 18;

export interface ChildBreakpointsProps {
  kids: Child[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, year: number) => void;
}

export function ChildBreakpoints({ kids, onAdd, onRemove, onUpdate }: Readonly<ChildBreakpointsProps>) {
  const clampYear = (value: number) => Math.min(Math.max(Math.round(value), 0), HORIZON_YEARS);
  const sorted = [...kids].sort((a, b) => a.year - b.year);

  return (
    <div className="salary-raises">
      <div className="salary-raises__label">Children</div>
      {sorted.map((child) => (
        <div className="salary-raise-row" key={child.id}>
          <div className="salary-raise-row__top">
            <label className="salary-raise-row__year">
              Yr
              <input
                type="number"
                min={0}
                max={HORIZON_YEARS}
                value={child.year}
                title="0 = already part of your household today"
                onChange={(event) => onUpdate(child.id, clampYear(Number(event.target.value)))}
              />
            </label>
            <button
              type="button"
              className="salary-raise-row__remove"
              onClick={() => onRemove(child.id)}
              aria-label={`Remove child at year ${child.year}`}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      ))}

      <div className="salary-raises__actions">
        <button type="button" className="salary-raises__add" onClick={onAdd}>
          + Add child
        </button>
      </div>
    </div>
  );
}
