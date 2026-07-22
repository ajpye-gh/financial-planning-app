import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanControls } from '@src/components/PlanControls';
import { freshPlan, listSavedPlans, savePlan } from '@src/lib/plans';

beforeEach(() => {
  localStorage.clear();
});

describe('PlanControls save', () => {
  it('saves the current plan under the prompted name and adds it to the load list', async () => {
    const user = userEvent.setup();
    const plan = freshPlan();
    jest.spyOn(window, 'prompt').mockReturnValue('Base case');

    render(<PlanControls onLoad={jest.fn()} planForSaving={() => plan} />);
    await user.click(screen.getByRole('button', { name: 'Save plan' }));

    expect(listSavedPlans()).toEqual(['Base case']);
    expect(screen.getByRole('option', { name: 'Base case' })).toBeInTheDocument();
  });

  it('does nothing if the save prompt is cancelled or left blank', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'prompt').mockReturnValue(null);

    render(<PlanControls onLoad={jest.fn()} planForSaving={() => freshPlan()} />);
    await user.click(screen.getByRole('button', { name: 'Save plan' }));

    expect(listSavedPlans()).toEqual([]);
  });
});

describe('PlanControls load', () => {
  it('shows "No saved plans yet" and a disabled select when nothing is saved', () => {
    render(<PlanControls onLoad={jest.fn()} planForSaving={() => freshPlan()} />);

    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByText('No saved plans yet')).toBeInTheDocument();
  });

  it('calls onLoad with the selected saved plan', async () => {
    const user = userEvent.setup();
    const plan = freshPlan();
    savePlan('Base case', plan);
    const onLoad = jest.fn();

    render(<PlanControls onLoad={onLoad} planForSaving={() => freshPlan()} />);
    await user.selectOptions(screen.getByRole('combobox'), 'Base case');

    expect(onLoad).toHaveBeenCalledWith(plan);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
