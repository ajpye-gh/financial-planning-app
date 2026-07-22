import { useState, type ChangeEvent } from 'react';
import { listSavedPlans, loadSavedPlan, savePlan, type Plan } from '../lib/plans';

interface PlanControlsProps {
  onLoad: (plan: Plan) => void;
  planForSaving: () => Plan;
}

/** Named Save/Load, backed by localStorage instead of a downloaded/uploaded file - the same two
 *  actions as `financial-planning`'s PlanFileControls, just a different transport. */
export function PlanControls({ onLoad, planForSaving }: Readonly<PlanControlsProps>) {
  const [savedPlans, setSavedPlans] = useState<string[]>(() => listSavedPlans());
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const name = window.prompt('Save plan as:', savedPlans[0] ?? 'My plan')?.trim();
    if (!name) {
      return;
    }
    try {
      savePlan(name, planForSaving());
      setSavedPlans(listSavedPlans());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save plan.');
    }
  };

  const handleLoad = (event: ChangeEvent<HTMLSelectElement>) => {
    const name = event.target.value;
    event.target.value = '';
    if (!name) {
      return;
    }
    const plan = loadSavedPlan(name);
    if (!plan) {
      setError(`Could not load "${name}".`);
      return;
    }
    onLoad(plan);
    setError(null);
  };

  return (
    <div className="plan-controls">
      <select className="plan-controls__load" defaultValue="" onChange={handleLoad} disabled={savedPlans.length === 0}>
        <option value="" disabled>
          {savedPlans.length === 0 ? 'No saved plans yet' : 'Load a saved plan…'}
        </option>
        {savedPlans.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <button type="button" onClick={handleSave}>
        Save plan
      </button>
      {error && (
        <span className="plan-controls__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
