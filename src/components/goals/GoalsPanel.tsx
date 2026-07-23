import { useState } from 'react';
import { GoalCard } from './GoalCard';
import { GOAL_CATALOG, generateGoalId, type Goal } from '../../lib/goals';

interface GoalsPanelProps {
  goals: Goal[];
  runningTotals: Record<string, number>;
  cashRemaining: number;
  brokerageRemaining: number;
  homeEquity: number;
  onAdd: (goal: Goal) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Goal>) => void;
}

export function GoalsPanel({
  goals,
  runningTotals,
  cashRemaining,
  brokerageRemaining,
  homeEquity,
  onAdd,
  onRemove,
  onUpdate,
}: Readonly<GoalsPanelProps>) {
  // Goal cards default to collapsed (too many sliders otherwise) - except the one just added, so
  // the user can configure it right away without an extra click.
  const [newestGoalId, setNewestGoalId] = useState<string | null>(null);

  const handleAdd = (goal: Goal) => {
    setNewestGoalId(goal.id);
    onAdd(goal);
  };

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
              homeEquity={homeEquity}
              defaultExpanded={goal.id === newestGoalId}
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
            onClick={() => handleAdd(entry.create(generateGoalId()))}
          >
            + {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}
