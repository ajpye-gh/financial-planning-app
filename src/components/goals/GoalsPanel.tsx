import { useState } from 'react';
import { AddGoalCard } from './AddGoalCard';
import { GoalCard } from './GoalCard';
import type { BaseInputs } from '../../lib/baseData';
import type { Goal } from '../../lib/goals';

interface GoalsPanelProps {
  goals: Goal[];
  runningTotals: Record<string, number>;
  cashRemaining: number;
  brokerageRemaining: number;
  base: BaseInputs;
  ownsHome: boolean;
  onAdd: (goal: Goal) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Goal>) => void;
}

export function GoalsPanel({
  goals,
  runningTotals,
  cashRemaining,
  brokerageRemaining,
  base,
  ownsHome,
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
    <div className="goals-panel">
      {goals.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          runningTotal={runningTotals[goal.id]}
          cashRemaining={cashRemaining}
          brokerageRemaining={brokerageRemaining}
          base={base}
          ownsHome={ownsHome}
          defaultExpanded={goal.id === newestGoalId}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
      <AddGoalCard onAdd={handleAdd} />
    </div>
  );
}
