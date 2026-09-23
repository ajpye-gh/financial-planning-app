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
    await user.click(screen.getByRole('button', { name: 'Save Plan' }));

    expect(listSavedPlans()).toEqual(['Base case']);
    await user.click(screen.getByRole('button', { name: /Load Plan/ }));
    expect(screen.getByRole('menuitem', { name: 'Base case' })).toBeInTheDocument();
  });

  it('does nothing if the save prompt is cancelled or left blank', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'prompt').mockReturnValue(null);

    render(<PlanControls onLoad={jest.fn()} planForSaving={() => freshPlan()} />);
    await user.click(screen.getByRole('button', { name: 'Save Plan' }));

    expect(listSavedPlans()).toEqual([]);
  });
});

describe('PlanControls load', () => {
  it('shows a disabled "(nothing saved)" item when nothing is saved', async () => {
    const user = userEvent.setup();
    render(<PlanControls onLoad={jest.fn()} planForSaving={() => freshPlan()} />);

    expect(screen.queryByText('(nothing saved)')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Load Plan/ }));

    expect(screen.getByText('(nothing saved)')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('does not show "(nothing saved)" once a plan exists', async () => {
    const user = userEvent.setup();
    savePlan('Base case', freshPlan());

    render(<PlanControls onLoad={jest.fn()} planForSaving={() => freshPlan()} />);
    await user.click(screen.getByRole('button', { name: /Load Plan/ }));

    expect(screen.queryByText('(nothing saved)')).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Base case' })).toBeInTheDocument();
  });

  it('calls onLoad with the selected saved plan and closes the submenu', async () => {
    const user = userEvent.setup();
    const plan = freshPlan();
    savePlan('Base case', plan);
    const onLoad = jest.fn();

    render(<PlanControls onLoad={onLoad} planForSaving={() => freshPlan()} />);
    await user.click(screen.getByRole('button', { name: /Load Plan/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Base case' }));

    expect(onLoad).toHaveBeenCalledWith(plan);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});
