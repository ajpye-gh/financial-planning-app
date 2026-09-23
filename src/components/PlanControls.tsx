import { useEffect, useRef, useState } from 'react';
import { listSavedPlans, loadSavedPlan, savePlan, type Plan } from '../lib/plans';
import { ChevronRightIcon } from './icons';

interface PlanControlsProps {
  onLoad: (plan: Plan) => void;
  planForSaving: () => Plan;
}

/** Small grace period between the pointer leaving the load item and the submenu actually closing -
 *  without this, a fast diagonal move from the trigger into the submenu (or, apparently, even the
 *  synthetic pointer path userEvent replays in tests) can register a leave/re-enter pair, closing
 *  the submenu out from under a click that was already in flight. Standard cascading-menu pattern. */
const CLOSE_DELAY_MS = 150;

/** Named Save/Load, backed by localStorage instead of a downloaded/uploaded file - the same two
 *  actions as `financial-planning`'s PlanFileControls, just a different transport. Load is a
 *  cascading submenu (hover/click "Load Plan" to reveal saved plans to the right) rather than a
 *  plain <select>, matching the native-menu look the rest of PlanMenu goes for. */
export function PlanControls({ onLoad, planForSaving }: Readonly<PlanControlsProps>) {
  const [savedPlans, setSavedPlans] = useState<string[]>(() => listSavedPlans());
  const [error, setError] = useState<string | null>(null);
  const [loadMenuOpen, setLoadMenuOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
  }, []);

  const openLoadMenu = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setLoadMenuOpen(true);
  };

  const scheduleCloseLoadMenu = () => {
    closeTimer.current = setTimeout(() => setLoadMenuOpen(false), CLOSE_DELAY_MS);
  };

  const handleSave = () => {
    const name = window.prompt('Save Plan As:', savedPlans[0] ?? 'My plan')?.trim();
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

  const handleLoad = (name: string) => {
    const plan = loadSavedPlan(name);
    if (!plan) {
      setError(`Could not load "${name}".`);
      return;
    }
    onLoad(plan);
    setError(null);
    setLoadMenuOpen(false);
  };

  return (
    <div className="plan-controls">
      <div className="plan-controls__load-item" onMouseEnter={openLoadMenu} onMouseLeave={scheduleCloseLoadMenu}>
        <button
          type="button"
          className="plan-controls__load-trigger"
          aria-haspopup="menu"
          aria-expanded={loadMenuOpen}
          onClick={openLoadMenu}
        >
          Load Plan
          <ChevronRightIcon size={14} />
        </button>
        {loadMenuOpen && (
          <div className="plan-controls__submenu" role="menu">
            {savedPlans.length === 0 ? (
              <span className="plan-controls__submenu-item plan-controls__submenu-item--disabled">(nothing saved)</span>
            ) : (
              savedPlans.map((name) => (
                <button key={name} type="button" role="menuitem" className="plan-controls__submenu-item" onClick={() => handleLoad(name)}>
                  {name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <button type="button" onClick={handleSave}>
        Save Plan
      </button>
      {error && (
        <span className="plan-controls__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
