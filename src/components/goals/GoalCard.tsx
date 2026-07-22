import { HORIZON_YEARS } from '../../lib/model';
import { formatCurrency, formatCurrencyCompact } from '../../lib/format';
import type { Goal } from '../../lib/goals';

interface GoalCardProps {
  goal: Goal;
  runningTotal?: number;
  onUpdate: (id: string, patch: Partial<Goal>) => void;
  onRemove: (id: string) => void;
}

export function GoalCard({ goal, runningTotal, onUpdate, onRemove }: Readonly<GoalCardProps>) {
  const clampYear = (value: number) => Math.min(Math.max(Math.round(value), 1), HORIZON_YEARS);

  const handleStartYearChange = (value: number) => {
    const startYear = clampYear(value);
    onUpdate(goal.id, { startYear, endYear: Math.max(startYear, goal.endYear) });
  };

  const handleEndYearChange = (value: number) => {
    const endYear = clampYear(value);
    onUpdate(goal.id, { endYear, startYear: Math.min(endYear, goal.startYear) });
  };

  return (
    <div className="goal-card">
      <div className="goal-card__header">
        <input
          type="text"
          className="goal-card__name-input"
          value={goal.name}
          onChange={(event) => onUpdate(goal.id, { name: event.target.value })}
          aria-label="Goal name"
        />
        <button
          type="button"
          className="goal-card__remove"
          onClick={() => onRemove(goal.id)}
          aria-label={`Remove ${goal.name}`}
        >
          ×
        </button>
      </div>

      <span className={`goal-card__mode-badge goal-card__mode-badge--${goal.mode}`}>
        {goal.mode === 'accumulate' ? 'saving' : 'spending'}
      </span>

      <div className="slider-field">
        <span className="slider-field__label">Monthly amount</span>
        <div className="slider-field__control">
          <input
            type="range"
            min={goal.monthlyAmountRange.min}
            max={goal.monthlyAmountRange.max}
            step={goal.monthlyAmountRange.step}
            value={goal.monthlyAmount}
            onChange={(event) => onUpdate(goal.id, { monthlyAmount: Number(event.target.value) })}
          />
          <span className="slider-field__value">{formatCurrency(goal.monthlyAmount)}/mo</span>
        </div>
      </div>

      <div className="goal-card__years">
        <label className="goal-card__year-field">
          Start yr
          <input
            type="number"
            min={1}
            max={HORIZON_YEARS}
            value={goal.startYear}
            onChange={(event) => handleStartYearChange(Number(event.target.value))}
          />
        </label>
        <label className="goal-card__year-field">
          End yr
          <input
            type="number"
            min={1}
            max={HORIZON_YEARS}
            value={goal.endYear}
            onChange={(event) => handleEndYearChange(Number(event.target.value))}
          />
        </label>
      </div>

      {goal.mode === 'accumulate' && runningTotal !== undefined && (
        <div className="goal-card__total">
          Balance: <span className="goal-card__total-value">{formatCurrencyCompact(runningTotal)}</span>
          {goal.targetAmount !== undefined ? ` / ${formatCurrencyCompact(goal.targetAmount)}` : null}
        </div>
      )}
    </div>
  );
}
