import { useState } from 'react';
import { GOAL_CATALOG, generateGoalId, type Goal } from '../../lib/goals';

interface AddGoalCardProps {
  onAdd: (goal: Goal) => void;
}

/** Sits as the last item in the same `.goals-panel` flex grid as the goal cards themselves (reuses
 *  the `.goal-card` sizing rules) - always last because it's simply the last child in DOM order,
 *  after every real goal. Two states: an idle "+ Add new" prompt, and (once clicked) an in-place
 *  catalog picker that reverts back to idle the moment a type is chosen. */
export function AddGoalCard({ onAdd }: Readonly<AddGoalCardProps>) {
  const [isPicking, setIsPicking] = useState(false);

  if (!isPicking) {
    return (
      <button type="button" className="goal-card add-goal-card" onClick={() => setIsPicking(true)}>
        <span className="add-goal-card__icon">+</span>
        Add new
      </button>
    );
  }

  return (
    <div className="goal-card add-goal-card add-goal-card--picking">
      <div className="add-goal-card__header">
        <span className="add-goal-card__title">Add a goal</span>
        <button type="button" className="add-goal-card__cancel" onClick={() => setIsPicking(false)} aria-label="Cancel">
          ×
        </button>
      </div>
      <div className="add-goal-card__options">
        {GOAL_CATALOG.map((entry) => (
          <button
            key={entry.label}
            type="button"
            className="add-goal-card__option"
            onClick={() => {
              onAdd(entry.create(generateGoalId()));
              setIsPicking(false);
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}
