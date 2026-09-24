import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { PlanToolbar } from '@src/components/PlanToolbar';
import { freshPlan, listSavedPlans, loadSavedPlan, savePlan, type Plan } from '@src/lib/plans';

beforeEach(() => {
  localStorage.clear();
});

function renderToolbar(overrides: Partial<ComponentProps<typeof PlanToolbar>> = {}) {
  const props: ComponentProps<typeof PlanToolbar> = {
    activePlanName: null,
    onPlanLoaded: jest.fn(),
    onPlanSaved: jest.fn(),
    onPlanDeleted: jest.fn(),
    onImportPlan: jest.fn(),
    planForSaving: () => freshPlan(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    canUndo: false,
    canRedo: false,
    isAutosaving: false,
    ...overrides,
  };
  render(<PlanToolbar {...props} />);
  return props;
}

/** Finds the (single) open prompt dialog and returns its input + a way to submit/cancel it. */
async function findPromptDialog() {
  const dialog = await screen.findByRole('dialog');
  return {
    dialog,
    input: within(dialog).getByRole('textbox') as HTMLInputElement,
    confirmWith: async (user: ReturnType<typeof userEvent.setup>, value: string, confirmLabel: string) => {
      const input = within(dialog).getByRole('textbox');
      await user.clear(input);
      if (value) {
        await user.type(input, value);
      }
      await user.click(within(dialog).getByRole('button', { name: confirmLabel }));
    },
    cancelWith: async (user: ReturnType<typeof userEvent.setup>, cancelLabel: string) => {
      await user.click(within(dialog).getByRole('button', { name: cancelLabel }));
    },
  };
}

/** Finds the (single) open confirm (alertdialog) and clicks one of its two labelled buttons. */
async function respondToConfirm(user: ReturnType<typeof userEvent.setup>, buttonLabel: string) {
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: buttonLabel }));
}

describe('PlanToolbar layout', () => {
  it('renders all toolbar actions directly, with no hamburger trigger to open first', () => {
    renderToolbar();

    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saved Plans' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import .pyf' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Plan menu' })).not.toBeInTheDocument();
  });

  it('disables/enables Undo and Redo per canUndo/canRedo, and wires clicks through', async () => {
    const user = userEvent.setup();
    const onUndo = jest.fn();
    const onRedo = jest.fn();

    renderToolbar({ canUndo: true, canRedo: false, onUndo, onRedo });

    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
  });

  it('shows a spinning indicator in place of the Save icon while autosaving, and stays clickable', async () => {
    const user = userEvent.setup();
    const onPlanSaved = jest.fn();
    renderToolbar({ isAutosaving: true, onPlanSaved });

    const saveButton = screen.getByRole('button', { name: 'Save Plan' });
    expect(saveButton).toBeEnabled();
    expect(saveButton).toHaveAttribute('title', 'Autosaving…');
    expect(saveButton.querySelector('svg.spin')).toBeInTheDocument();

    await user.click(saveButton);
    const { cancelWith } = await findPromptDialog();
    await cancelWith(user, 'Cancel');
  });

  it('shows the plain Save icon (no spinner) when not autosaving', () => {
    renderToolbar({ isAutosaving: false });

    const saveButton = screen.getByRole('button', { name: 'Save Plan' });
    expect(saveButton).toHaveAttribute('title', 'Save Plan');
    expect(saveButton.querySelector('svg.spin')).not.toBeInTheDocument();
  });
});

describe('PlanToolbar save', () => {
  it('saves the current plan under the prompted name, notifies the parent, and adds it to the list', async () => {
    const user = userEvent.setup();
    const plan = freshPlan();
    const onPlanSaved = jest.fn();

    renderToolbar({ planForSaving: () => plan, onPlanSaved });
    await user.click(screen.getByRole('button', { name: 'Save Plan' }));
    const { confirmWith } = await findPromptDialog();
    await confirmWith(user, 'Base case', 'Save');

    expect(listSavedPlans()).toEqual(['Base case']);
    expect(onPlanSaved).toHaveBeenCalledWith('Base case', plan);
    await user.click(screen.getByRole('button', { name: 'Saved Plans' }));
    expect(screen.getByRole('menuitem', { name: 'Base case' })).toBeInTheDocument();
  });

  it('does nothing if the save dialog is cancelled', async () => {
    const user = userEvent.setup();
    const onPlanSaved = jest.fn();

    renderToolbar({ onPlanSaved });
    await user.click(screen.getByRole('button', { name: 'Save Plan' }));
    const { cancelWith } = await findPromptDialog();
    await cancelWith(user, 'Cancel');

    expect(onPlanSaved).not.toHaveBeenCalled();
    expect(listSavedPlans()).toEqual([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('defaults the save prompt to the active plan name', async () => {
    const user = userEvent.setup();

    renderToolbar({ activePlanName: 'Retirement' });
    await user.click(screen.getByRole('button', { name: 'Save Plan' }));
    const { dialog, input } = await findPromptDialog();

    expect(within(dialog).getByText('Save Plan As:')).toBeInTheDocument();
    expect(input.value).toBe('Retirement');
  });

  it('re-saves the active plan under its own name without an overwrite prompt', async () => {
    const user = userEvent.setup();
    savePlan('Base case', freshPlan());
    const updated: Plan = { ...freshPlan(), answers: { housing: 'rent' } };
    const onPlanSaved = jest.fn();

    renderToolbar({ activePlanName: 'Base case', planForSaving: () => updated, onPlanSaved });
    await user.click(screen.getByRole('button', { name: 'Save Plan' }));
    const { confirmWith } = await findPromptDialog();
    await confirmWith(user, 'Base case', 'Save');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(loadSavedPlan('Base case')).toEqual(updated);
    expect(onPlanSaved).toHaveBeenCalledWith('Base case', updated);
  });

  it('asks to confirm before overwriting a plan that already exists, and overwrites when confirmed', async () => {
    const user = userEvent.setup();
    const original = freshPlan();
    const updated: Plan = { ...freshPlan(), answers: { housing: 'rent' } };
    savePlan('Base case', original);
    const onPlanSaved = jest.fn();

    renderToolbar({ planForSaving: () => updated, onPlanSaved });
    await user.click(screen.getByRole('button', { name: 'Save Plan' }));
    const { confirmWith } = await findPromptDialog();
    await confirmWith(user, 'Base case', 'Save');

    const overwriteDialog = await screen.findByRole('alertdialog');
    expect(within(overwriteDialog).getByText('A plan named "Base case" already exists. Overwrite it?')).toBeInTheDocument();
    await user.click(within(overwriteDialog).getByRole('button', { name: 'Overwrite' }));

    expect(loadSavedPlan('Base case')).toEqual(updated);
    expect(onPlanSaved).toHaveBeenCalledWith('Base case', updated);
  });

  it('re-prompts for a different name when the user declines to overwrite', async () => {
    const user = userEvent.setup();
    const original = freshPlan();
    savePlan('Base case', original);
    const updated: Plan = { ...freshPlan(), answers: { housing: 'rent' } };
    const onPlanSaved = jest.fn();

    renderToolbar({ planForSaving: () => updated, onPlanSaved });
    await user.click(screen.getByRole('button', { name: 'Save Plan' }));
    const firstPrompt = await findPromptDialog();
    await firstPrompt.confirmWith(user, 'Base case', 'Save');

    await respondToConfirm(user, 'Choose a different name');

    const secondPrompt = await findPromptDialog();
    expect(secondPrompt.input.value).toBe('Base case');
    await secondPrompt.confirmWith(user, 'Base case 2', 'Save');

    expect(loadSavedPlan('Base case')).toEqual(original);
    expect(loadSavedPlan('Base case 2')).toEqual(updated);
    expect(onPlanSaved).toHaveBeenCalledWith('Base case 2', updated);
  });

  it('shows a save error outside the Saved Plans panel (since Save has no dropdown of its own)', async () => {
    const user = userEvent.setup();
    const onPlanSaved = jest.fn();

    renderToolbar({
      onPlanSaved,
      planForSaving: () => {
        throw new Error('boom');
      },
    });
    await user.click(screen.getByRole('button', { name: 'Save Plan' }));
    const { confirmWith } = await findPromptDialog();
    await confirmWith(user, 'Base case', 'Save');

    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
    expect(onPlanSaved).not.toHaveBeenCalled();
  });
});

describe('PlanToolbar Saved Plans (load)', () => {
  it('shows a disabled "(nothing saved)" item when nothing is saved', async () => {
    const user = userEvent.setup();
    renderToolbar();

    expect(screen.queryByText('(nothing saved)')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Saved Plans' }));

    expect(screen.getByText('(nothing saved)')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('does not show "(nothing saved)" once a plan exists', async () => {
    const user = userEvent.setup();
    savePlan('Base case', freshPlan());

    renderToolbar();
    await user.click(screen.getByRole('button', { name: 'Saved Plans' }));

    expect(screen.queryByText('(nothing saved)')).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Base case' })).toBeInTheDocument();
  });

  it('calls onPlanLoaded with the selected saved plan and closes the panel, without prompting when a plan is already active', async () => {
    const user = userEvent.setup();
    const plan = freshPlan();
    savePlan('Base case', plan);
    const onPlanLoaded = jest.fn();

    renderToolbar({ activePlanName: 'Something else', onPlanLoaded });
    await user.click(screen.getByRole('button', { name: 'Saved Plans' }));
    await user.click(screen.getByRole('menuitem', { name: 'Base case' }));

    expect(onPlanLoaded).toHaveBeenCalledWith('Base case', plan);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('marks the active plan in the list', async () => {
    const user = userEvent.setup();
    savePlan('Base case', freshPlan());
    savePlan('Other', freshPlan());

    renderToolbar({ activePlanName: 'Other' });
    await user.click(screen.getByRole('button', { name: 'Saved Plans' }));

    expect(screen.getByRole('menuitem', { name: 'Other' })).toHaveClass('plan-toolbar__item--active');
    expect(screen.getByRole('menuitem', { name: 'Base case' })).not.toHaveClass('plan-toolbar__item--active');
  });

  it('offers to back up an untitled draft before loading, and saves it under the confirmed name', async () => {
    const user = userEvent.setup();
    const plan = freshPlan();
    savePlan('Base case', plan);
    const onPlanLoaded = jest.fn();
    const onPlanSaved = jest.fn();
    const currentDraft: Plan = { ...freshPlan(), answers: { housing: 'rent' } };

    renderToolbar({ activePlanName: null, onPlanLoaded, onPlanSaved, planForSaving: () => currentDraft });
    await user.click(screen.getByRole('button', { name: 'Saved Plans' }));
    await user.click(screen.getByRole('menuitem', { name: 'Base case' }));

    const backupConfirm = await screen.findByRole('alertdialog');
    expect(within(backupConfirm).getByText('Save your current changes as a new plan before loading?')).toBeInTheDocument();
    await user.click(within(backupConfirm).getByRole('button', { name: 'Save as new plan' }));

    const { confirmWith } = await findPromptDialog();
    await confirmWith(user, 'My backup', 'Save');

    expect(loadSavedPlan('My backup')).toEqual(currentDraft);
    expect(onPlanSaved).toHaveBeenCalledWith('My backup', currentDraft);
    expect(onPlanLoaded).toHaveBeenCalledWith('Base case', plan);
  });

  it('skips the backup and still loads if the user discards the untitled draft', async () => {
    const user = userEvent.setup();
    const plan = freshPlan();
    savePlan('Base case', plan);
    const onPlanLoaded = jest.fn();

    renderToolbar({ activePlanName: null, onPlanLoaded });
    await user.click(screen.getByRole('button', { name: 'Saved Plans' }));
    await user.click(screen.getByRole('menuitem', { name: 'Base case' }));

    await respondToConfirm(user, 'Discard changes');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onPlanLoaded).toHaveBeenCalledWith('Base case', plan);
  });
});

describe('PlanToolbar delete', () => {
  it('deletes a plan after confirming, and notifies the parent only if it was the active plan', async () => {
    const user = userEvent.setup();
    savePlan('Base case', freshPlan());
    const onPlanDeleted = jest.fn();

    renderToolbar({ activePlanName: 'Base case', onPlanDeleted });
    await user.click(screen.getByRole('button', { name: 'Saved Plans' }));
    await user.click(screen.getByRole('button', { name: 'Delete "Base case"' }));

    const confirmDeleteDialog = await screen.findByRole('alertdialog');
    expect(within(confirmDeleteDialog).getByText('Delete "Base case"?')).toBeInTheDocument();
    await user.click(within(confirmDeleteDialog).getByRole('button', { name: 'Delete' }));

    expect(listSavedPlans()).toEqual([]);
    expect(onPlanDeleted).toHaveBeenCalledWith('Base case');
  });

  it('does not delete when the confirmation is declined', async () => {
    const user = userEvent.setup();
    savePlan('Base case', freshPlan());

    renderToolbar();
    await user.click(screen.getByRole('button', { name: 'Saved Plans' }));
    await user.click(screen.getByRole('button', { name: 'Delete "Base case"' }));

    await respondToConfirm(user, 'Cancel');

    expect(listSavedPlans()).toEqual(['Base case']);
  });
});

describe('PlanToolbar import', () => {
  it('suggests the file name (minus extension) as the save name, and saves+loads it under whatever name is confirmed', async () => {
    const user = userEvent.setup();
    const plan = freshPlan();
    const onPlanLoaded = jest.fn();
    const file = new File([JSON.stringify(plan)], 'My plan.pyf', { type: 'application/json' });

    renderToolbar({ onPlanLoaded });
    const fileInput = document.querySelector('.plan-toolbar__file-input') as HTMLInputElement;
    await user.upload(fileInput, file);

    const { dialog, confirmWith } = await findPromptDialog();
    expect(within(dialog).getByText('Import as:')).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox')).toHaveValue('My plan');
    await confirmWith(user, 'My imported plan', 'Import');

    expect(loadSavedPlan('My imported plan')).toEqual(plan);
    expect(onPlanLoaded).toHaveBeenCalledWith('My imported plan', plan);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks to confirm before an import overwrites an existing plan with the same name', async () => {
    const user = userEvent.setup();
    savePlan('Base case', freshPlan());
    const imported: Plan = { ...freshPlan(), answers: { housing: 'rent' } };
    const onPlanLoaded = jest.fn();
    const file = new File([JSON.stringify(imported)], 'Base case.pyf', { type: 'application/json' });

    renderToolbar({ onPlanLoaded });
    const fileInput = document.querySelector('.plan-toolbar__file-input') as HTMLInputElement;
    await user.upload(fileInput, file);

    const { confirmWith } = await findPromptDialog();
    await confirmWith(user, 'Base case', 'Import');

    const overwriteDialog = await screen.findByRole('alertdialog');
    expect(within(overwriteDialog).getByText('A plan named "Base case" already exists. Overwrite it?')).toBeInTheDocument();
    await user.click(within(overwriteDialog).getByRole('button', { name: 'Overwrite' }));

    expect(loadSavedPlan('Base case')).toEqual(imported);
    expect(onPlanLoaded).toHaveBeenCalledWith('Base case', imported);
  });

  it('falls back to an untitled (unsaved) view of the plan if naming is cancelled', async () => {
    const user = userEvent.setup();
    const plan = freshPlan();
    const onImportPlan = jest.fn();
    const onPlanLoaded = jest.fn();
    const file = new File([JSON.stringify(plan)], 'My plan.pyf', { type: 'application/json' });

    renderToolbar({ onImportPlan, onPlanLoaded });
    const fileInput = document.querySelector('.plan-toolbar__file-input') as HTMLInputElement;
    await user.upload(fileInput, file);

    const { cancelWith } = await findPromptDialog();
    await cancelWith(user, 'Cancel');

    expect(onImportPlan).toHaveBeenCalledWith(plan);
    expect(onPlanLoaded).not.toHaveBeenCalled();
    expect(listSavedPlans()).toEqual([]);
  });

  it('shows an error for a file that is not a valid plan, without prompting for a name', async () => {
    const user = userEvent.setup();
    const onImportPlan = jest.fn();
    const file = new File(['not json'], 'broken.pyf', { type: 'application/json' });

    renderToolbar({ onImportPlan });
    const fileInput = document.querySelector('.plan-toolbar__file-input') as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid JSON/);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onImportPlan).not.toHaveBeenCalled();
  });
});
