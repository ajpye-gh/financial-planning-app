import { GoalCard } from './GoalCard';
import { GOAL_CATALOG, generateGoalId, type Goal } from '../../lib/goals';

interface GoalsPanelProps {
  goals: Goal[];
  runningTotals: Record<string, number>;
  cashRemaining: number;
  brokerageRemaining: number;
  onAdd: (goal: Goal) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Goal>) => void;
}

export function GoalsPanel({
  goals,
  runningTotals,
  cashRemaining,
  brokerageRemaining,
  onAdd,
  onRemove,
  onUpdate,
}: Readonly<GoalsPanelProps>) {
  return (
    <div>
      {goals.length > 0 && (
        <div className="goals-panel">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              runningTotal={runningTotals[goal.id]}
              cashRemaining={cashRemaining}
              brokerageRemaining={brokerageRemaining}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
      <div className="goal-catalog">
        {GOAL_CATALOG.map((entry) => (
          <button
            key={entry.label}
            type="button"
            className="goal-catalog__item"
            onClick={() => onAdd(entry.create(generateGoalId()))}
          >
            + {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}
