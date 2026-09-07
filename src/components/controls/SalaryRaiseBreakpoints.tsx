import { formatSliderValue } from '../../lib/format';
import { TrashIcon } from '../icons';
import { Slider } from './Slider';
import type { SalaryRaiseBreakpoint } from '../../lib/salaryRaises';

const HORIZON_YEARS = 18;
const RAISE_RANGE = { min: 0, max: 150, step: 5 };
const DEFAULT_JOB_LOSS_YEAR = 10;

export interface SalaryRaiseBreakpointsProps {
  breakpoints: SalaryRaiseBreakpoint[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Omit<SalaryRaiseBreakpoint, 'id'>>) => void;
  /** Permanent - once set, this stream's salary is $0 from this year on, overriding later raises. */
  jobLossYear?: number;
  onSetJobLoss: (year: number) => void;
  onClearJobLoss: () => void;
}

export function SalaryRaiseBreakpoints({
  breakpoints,
  onAdd,
  onRemove,
  onUpdate,
  jobLossYear,
  onSetJobLoss,
  onClearJobLoss,
}: Readonly<SalaryRaiseBreakpointsProps>) {
  const clampYear = (value: number) => Math.min(Math.max(Math.round(value), 1), HORIZON_YEARS);
  const sorted = [...breakpoints].sort((a, b) => a.year - b.year);

  return (
    <div className="salary-raises">
      <div className="salary-raises__label">Raises</div>
      {sorted.map((breakpoint, index) => {
        // Can't drag below the previous (earlier-year) breakpoint's raise - dragging this one above a
        // later breakpoint instead pushes that one up too, via applyRaiseUpdate (see onUpdate).
        const floor = index === 0 ? RAISE_RANGE.min : sorted[index - 1].raiseK;
        return (
          <div className="salary-raise-row" key={breakpoint.id}>
            <div className="salary-raise-row__top">
              <label className="salary-raise-row__year">
                Yr
                <input
                  type="number"
                  min={1}
                  max={HORIZON_YEARS}
                  value={breakpoint.year}
                  onChange={(event) => onUpdate(breakpoint.id, { year: clampYear(Number(event.target.value)) })}
                />
              </label>
              <button
                type="button"
                className="salary-raise-row__remove"
                onClick={() => onRemove(breakpoint.id)}
                aria-label={`Remove raise at year ${breakpoint.year}`}
              >
                <TrashIcon />
              </button>
            </div>
            <Slider
              id={`raise-${breakpoint.id}`}
              ariaLabel={`Raise at year ${breakpoint.year}`}
              range={{ min: floor, max: RAISE_RANGE.max, step: RAISE_RANGE.step }}
              value={breakpoint.raiseK}
              onChange={(value) => onUpdate(breakpoint.id, { raiseK: value })}
              valueLabel={formatSliderValue(breakpoint.raiseK, 'k')}
              formatBound={(bound) => formatSliderValue(bound, 'k')}
            />
          </div>
        );
      })}

      {jobLossYear !== undefined && (
        <div className="salary-raise-row">
          <div className="salary-raise-row__top">
            <label className="salary-raise-row__year">
              Job loss, yr
              <input
                type="number"
                min={1}
                max={HORIZON_YEARS}
                value={jobLossYear}
                onChange={(event) => onSetJobLoss(clampYear(Number(event.target.value)))}
              />
            </label>
            <button
              type="button"
              className="salary-raise-row__remove"
              onClick={onClearJobLoss}
              aria-label={`Remove job loss at year ${jobLossYear}`}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      )}

      <div className="salary-raises__actions">
        <button type="button" className="salary-raises__add" onClick={onAdd}>
          + Add raise
        </button>
        {jobLossYear === undefined && (
          <button type="button" className="salary-raises__add" onClick={() => onSetJobLoss(DEFAULT_JOB_LOSS_YEAR)}>
            + Job loss
          </button>
        )}
      </div>
    </div>
  );
}
