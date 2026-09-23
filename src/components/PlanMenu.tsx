import { useEffect, useRef, useState } from 'react';
import { PlanControls } from './PlanControls';
import { MenuIcon } from './icons';
import type { Plan } from '../lib/plans';

interface PlanMenuProps {
  onLoad: (plan: Plan) => void;
  planForSaving: () => Plan;
}

/** Hamburger trigger + dropdown panel wrapping PlanControls (Save/Load) - previously rendered
 *  inline in the header; now tucked behind a menu so the header can lead with the logo instead. */
export function PlanMenu({ onLoad, planForSaving }: Readonly<PlanMenuProps>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="plan-menu" ref={rootRef}>
      <button
        type="button"
        className="plan-menu__trigger"
        aria-label="Plan menu"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <MenuIcon size={18} />
      </button>
      {open && (
        <div className="plan-menu__panel">
          <PlanControls
            onLoad={(plan) => {
              onLoad(plan);
              setOpen(false);
            }}
            planForSaving={planForSaving}
          />
        </div>
      )}
    </div>
  );
}
