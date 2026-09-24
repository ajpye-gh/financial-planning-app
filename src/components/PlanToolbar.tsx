import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { useDialog } from '../hooks/useDialog';
import { deletePlan, listSavedPlans, loadSavedPlan, savePlan, type Plan } from '../lib/plans';
import { exportPlanFile, parsePlanFile, PYF_EXTENSION } from '../lib/planFiles';
import { DownloadIcon, FolderIcon, PinwheelIcon, RedoIcon, SaveIcon, TrashIcon, UndoIcon, UploadIcon } from './icons';

/** Small grace period between the pointer leaving the Saved Plans trigger and the panel actually
 *  closing - without this, a fast diagonal move from the trigger toward the panel can register a
 *  leave/re-enter pair, closing it out from under a click that was already in flight. */
const CLOSE_DELAY_MS = 150;

interface PlanToolbarProps {
  /** Name of the saved plan the current draft was loaded from/saved as, or null if untitled. */
  activePlanName: string | null;
  onPlanLoaded: (name: string, plan: Plan) => void;
  onPlanSaved: (name: string, plan: Plan) => void;
  onPlanDeleted: (name: string) => void;
  onImportPlan: (plan: Plan) => void;
  planForSaving: () => Plan;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isAutosaving: boolean;
}

/** Undo/Redo + Saved Plans/Save/Import, as a row of icon buttons rather than a hamburger menu -
 *  lives at the top right of the header, directly right of the active-plan indicator. */
export function PlanToolbar({
  activePlanName,
  onPlanLoaded,
  onPlanSaved,
  onPlanDeleted,
  onImportPlan,
  planForSaving,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isAutosaving,
}: Readonly<PlanToolbarProps>) {
  const [savedPlans, setSavedPlans] = useState<string[]>(() => listSavedPlans());
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, prompt, dialog } = useDialog();

  useEffect(() => {
    if (!panelOpen) {
      return undefined;
    }
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [panelOpen]);

  useEffect(() => () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
  }, []);

  const openPanel = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setPanelOpen(true);
  };

  const schedulePanelClose = () => {
    closeTimer.current = setTimeout(() => setPanelOpen(false), CLOSE_DELAY_MS);
  };

  /** Prompts for a save name, re-prompting on collision until the user either picks a name that's
   *  free, explicitly confirms overwriting an existing plan, or cancels (blank/Escape at any point).
   *  `exemptName` skips the collision check for one name - re-saving the plan you're already
   *  editing under its own name is just "save my changes", not an overwrite to confirm. */
  const resolveSaveName = async (
    promptMessage: string,
    initialDefault: string,
    { confirmLabel = 'Save', exemptName = null }: { confirmLabel?: string; exemptName?: string | null } = {},
  ): Promise<string | null> => {
    let name = (await prompt(promptMessage, initialDefault, { confirmLabel }))?.trim();
    while (name) {
      if (name === exemptName || !listSavedPlans().includes(name)) {
        return name;
      }
      const overwrite = await confirm(`A plan named "${name}" already exists. Overwrite it?`, {
        confirmLabel: 'Overwrite',
        cancelLabel: 'Choose a different name',
        tone: 'danger',
      });
      if (overwrite) {
        return name;
      }
      name = (await prompt(promptMessage, name, { confirmLabel }))?.trim();
    }
    return null;
  };

  const handleSave = async () => {
    const name = await resolveSaveName('Save Plan As:', activePlanName ?? 'My plan', { exemptName: activePlanName });
    if (!name) {
      return;
    }
    try {
      const plan = planForSaving();
      savePlan(name, plan);
      setSavedPlans(listSavedPlans());
      onPlanSaved(name, plan);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save plan.');
    }
  };

  /** If the draft isn't tied to any saved plan, offer to stash it under a new name before it gets
   *  clobbered by the incoming Load - otherwise those changes just vanish with no way back. */
  const backupUntitledDraft = async () => {
    if (activePlanName !== null) {
      return;
    }
    const shouldBackup = await confirm('Save your current changes as a new plan before loading?', {
      confirmLabel: 'Save as new plan',
      cancelLabel: 'Discard changes',
    });
    if (!shouldBackup) {
      return;
    }
    const backupName = await resolveSaveName('Save current plan as:', 'My plan');
    if (!backupName) {
      return;
    }
    try {
      const current = planForSaving();
      savePlan(backupName, current);
      setSavedPlans(listSavedPlans());
      onPlanSaved(backupName, current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save current plan.');
    }
  };

  const handleLoad = async (name: string) => {
    const plan = loadSavedPlan(name);
    if (!plan) {
      setError(`Could not load "${name}".`);
      return;
    }
    await backupUntitledDraft();
    onPlanLoaded(name, plan);
    setError(null);
    setPanelOpen(false);
  };

  const handleDelete = async (name: string, event: MouseEvent) => {
    event.stopPropagation();
    const shouldDelete = await confirm(`Delete "${name}"?`, { confirmLabel: 'Delete', cancelLabel: 'Cancel', tone: 'danger' });
    if (!shouldDelete) {
      return;
    }
    deletePlan(name);
    setSavedPlans(listSavedPlans());
    if (name === activePlanName) {
      onPlanDeleted(name);
    }
  };

  const handleExport = (name: string, event: MouseEvent) => {
    event.stopPropagation();
    const plan = loadSavedPlan(name);
    if (!plan) {
      setError(`Could not export "${name}".`);
      return;
    }
    exportPlanFile(name, plan).catch((err) => {
      setError(err instanceof Error ? err.message : 'Could not export plan.');
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    let plan: Plan;
    try {
      plan = await parsePlanFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import plan.');
      return;
    }
    // The file's name is just a starting suggestion, not an assumed plan name - the user picks (or
    // overwrites) the actual name via the same prompt Save uses.
    const suggestedName = file.name.replace(/\.pyf$/i, '');
    const name = await resolveSaveName('Import as:', suggestedName, { confirmLabel: 'Import' });
    if (!name) {
      // Cancelled naming - still show the imported plan, just not tied to any saved slot yet.
      onImportPlan(plan);
      setError(null);
      return;
    }
    try {
      savePlan(name, plan);
      setSavedPlans(listSavedPlans());
      onPlanLoaded(name, plan);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save imported plan.');
    }
  };

  return (
    <div className="plan-toolbar">
      <button type="button" className="plan-toolbar__btn" title="Undo" aria-label="Undo" onClick={onUndo} disabled={!canUndo}>
        <UndoIcon size={16} />
      </button>
      <button type="button" className="plan-toolbar__btn" title="Redo" aria-label="Redo" onClick={onRedo} disabled={!canRedo}>
        <RedoIcon size={16} />
      </button>

      <div className="plan-toolbar__divider" />

      <div
        className="plan-toolbar__dropdown-wrap"
        ref={dropdownRef}
        onMouseEnter={openPanel}
        onMouseLeave={schedulePanelClose}
      >
        <button
          type="button"
          className="plan-toolbar__btn"
          title="Saved Plans"
          aria-label="Saved Plans"
          aria-haspopup="menu"
          aria-expanded={panelOpen}
          onClick={openPanel}
        >
          <FolderIcon size={16} />
        </button>
        {panelOpen && (
          <div className="plan-toolbar__panel" role="menu">
            {savedPlans.length === 0 ? (
              <span className="plan-toolbar__item plan-toolbar__item--disabled">(nothing saved)</span>
            ) : (
              savedPlans.map((name) => (
                <div className="plan-toolbar__row" key={name}>
                  <button
                    type="button"
                    role="menuitem"
                    className={
                      name === activePlanName ? 'plan-toolbar__item plan-toolbar__item--active' : 'plan-toolbar__item'
                    }
                    onClick={() => handleLoad(name)}
                  >
                    {name}
                  </button>
                  <button
                    type="button"
                    className="plan-toolbar__row-btn"
                    aria-label={`Export "${name}"`}
                    onClick={(event) => handleExport(name, event)}
                  >
                    <DownloadIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="plan-toolbar__row-btn"
                    aria-label={`Delete "${name}"`}
                    onClick={(event) => handleDelete(name, event)}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))
            )}
            {error && (
              <span className="plan-toolbar__panel-error" role="alert">
                {error}
              </span>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        className="plan-toolbar__btn"
        title={isAutosaving ? 'Autosaving…' : 'Save Plan'}
        aria-label="Save Plan"
        onClick={handleSave}
      >
        {isAutosaving ? <PinwheelIcon size={16} /> : <SaveIcon size={16} />}
      </button>
      <button type="button" className="plan-toolbar__btn" title="Import .pyf" aria-label="Import .pyf" onClick={handleImportClick}>
        <UploadIcon size={16} />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={PYF_EXTENSION}
        className="plan-toolbar__file-input"
        onChange={handleFileChange}
      />

      {!panelOpen && error && (
        <div className="plan-toolbar__error" role="alert">
          {error}
        </div>
      )}
      {dialog}
    </div>
  );
}
