import { GoalCard } from './GoalCard';
import { GOAL_CATALOG, generateGoalId, type Goal } from '../../lib/goals';

interface GoalsPanelProps {
  goals: Goal[];
  runningTotals: Record<string, number>;
  onAdd: (goal: Goal) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Goal>) => void;
}

export function GoalsPanel({ goals, runningTotals, onAdd, onRemove, onUpdate }: Readonly<GoalsPanelProps>) {
  return (
    <div>
      {goals.length > 0 && (
        <div className="goals-panel">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} runningTotal={runningTotals[goal.id]} onUpdate={onUpdate} onRemove={onRemove} />
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
