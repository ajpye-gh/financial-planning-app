import { formatCurrency, formatCurrencyCompact } from '../../lib/format';
import type { Goal } from '../../lib/goals';

interface GoalCardProps {
  goal: Goal;
  runningTotal?: number;
  onChangeAmount: (id: string, amount: number) => void;
  onRemove: (id: string) => void;
}

export function GoalCard({ goal, runningTotal, onChangeAmount, onRemove }: Readonly<GoalCardProps>) {
  return (
    <div className="goal-card">
      <div className="goal-card__header">
        <span className="goal-card__name">
          {goal.name} <span className="goal-card__mode">({goal.mode === 'accumulate' ? 'saving' : 'spending'})</span>
        </span>
        <button type="button" className="goal-card__remove" onClick={() => onRemove(goal.id)}>
          Remove
        </button>
      </div>
      <div className="slider-field">
        <span className="slider-field__label">Monthly amount</span>
        <input
          type="range"
          min={goal.monthlyAmountRange.min}
          max={goal.monthlyAmountRange.max}
          step={goal.monthlyAmountRange.step}
          value={goal.monthlyAmount}
          onChange={(event) => onChangeAmount(goal.id, Number(event.target.value))}
        />
        <span className="slider-field__value">{formatCurrency(goal.monthlyAmount)}/mo</span>
      </div>
      {goal.mode === 'accumulate' && runningTotal !== undefined && (
        <div className="goal-card__total">
          Projected balance: <span className="goal-card__total-value">{formatCurrencyCompact(runningTotal)}</span>
          {goal.targetAmount !== undefined ? ` of ${formatCurrencyCompact(goal.targetAmount)} target` : null}
        </div>
      )}
    </div>
  );
}
