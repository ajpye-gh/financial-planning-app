import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoalCard } from '@src/components/goals/GoalCard';
import type { Goal } from '@src/lib/goals';

const baseGoal: Goal = {
  kind: 'recurring',
  id: 'goal-1',
  name: 'Travel fund',
  mode: 'accumulate',
  monthlyAmount: 200,
  monthlyAmountRange: { min: 0, max: 1000, step: 10 },
  startYear: 1,
  endYear: 5,
};

describe('GoalCard name editing', () => {
  it('renders the name as static text until the edit icon is clicked', () => {
    render(<GoalCard goal={baseGoal} onUpdate={jest.fn()} onRemove={jest.fn()} />);

    expect(screen.getByText('Travel fund')).toBeInTheDocument();
    expect(screen.queryByLabelText('Goal name')).not.toBeInTheDocument();
  });

  it('switches to an input on rename click and back to static text on save', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    render(<GoalCard goal={baseGoal} onUpdate={onUpdate} onRemove={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Rename Travel fund' }));
    const input = screen.getByLabelText('Goal name');
    await user.clear(input);
    await user.type(input, 'Europe trip');
    await user.click(screen.getByRole('button', { name: 'Save Travel fund' }));

    expect(onUpdate).toHaveBeenCalledWith('goal-1', { name: 'Europe trip' });
    expect(screen.queryByLabelText('Goal name')).not.toBeInTheDocument();
  });

  it('commits the rename on Enter', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    render(<GoalCard goal={baseGoal} onUpdate={onUpdate} onRemove={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Rename Travel fund' }));
    const input = screen.getByLabelText('Goal name');
    await user.clear(input);
    await user.type(input, 'Europe trip{Enter}');

    expect(onUpdate).toHaveBeenCalledWith('goal-1', { name: 'Europe trip' });
  });

  it('ignores a blank rename and keeps the original name', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    render(<GoalCard goal={baseGoal} onUpdate={onUpdate} onRemove={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Rename Travel fund' }));
    const input = screen.getByLabelText('Goal name');
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Save Travel fund' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Travel fund')).toBeInTheDocument();
  });
});

describe('GoalCard balance', () => {
  it('shows a tooltip explaining the "current / target" split when a target is set', async () => {
    const user = userEvent.setup();
    const goalWithTarget: Goal = { ...baseGoal, targetAmount: 80000 };
    render(<GoalCard goal={goalWithTarget} runningTotal={54000} onUpdate={jest.fn()} onRemove={jest.fn()} />);

    expect(screen.getByText('$54k')).toBeInTheDocument();
    expect(screen.getByText(/\$80k/)).toBeInTheDocument();

    await user.hover(screen.getByText('$54k'));
    const tooltip = await screen.findByRole('tooltip');
    // baseGoal's endYear is 5, not the 18-year model horizon.
    expect(tooltip).toHaveTextContent('Projected balance at your end year (5), against the $80k target');
  });

  it('renders just the balance, with no tooltip, when the goal has no target', () => {
    render(<GoalCard goal={baseGoal} runningTotal={54000} onUpdate={jest.fn()} onRemove={jest.fn()} />);

    expect(screen.getByText('$54k')).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('GoalCard target amount', () => {
  it('shows "No target" and a zeroed slider when the goal has none set', () => {
    render(<GoalCard goal={baseGoal} onUpdate={jest.fn()} onRemove={jest.fn()} />);

    expect(screen.getByText('No target')).toBeInTheDocument();
    const targetSlider = screen.getByText('Target amount').parentElement?.querySelector('input[type="range"]');
    expect((targetSlider as HTMLInputElement).value).toBe('0');
  });

  it('shows the formatted target amount when one is set', () => {
    const goalWithTarget: Goal = { ...baseGoal, targetAmount: 80000 };
    render(<GoalCard goal={goalWithTarget} onUpdate={jest.fn()} onRemove={jest.fn()} />);

    expect(screen.getByText('$80,000')).toBeInTheDocument();
  });

  it('sets a target amount when the slider is dragged above zero', () => {
    const onUpdate = jest.fn();
    render(<GoalCard goal={baseGoal} onUpdate={onUpdate} onRemove={jest.fn()} />);

    const targetSlider = screen.getByText('Target amount').parentElement?.querySelector('input[type="range"]');
    fireSliderChange(targetSlider as HTMLInputElement, '150000');

    expect(onUpdate).toHaveBeenCalledWith('goal-1', { targetAmount: 150000 });
  });

  it('clears the target amount when the slider is dragged back to zero', () => {
    const onUpdate = jest.fn();
    const goalWithTarget: Goal = { ...baseGoal, targetAmount: 80000 };
    render(<GoalCard goal={goalWithTarget} onUpdate={onUpdate} onRemove={jest.fn()} />);

    const targetSlider = screen.getByText('Target amount').parentElement?.querySelector('input[type="range"]');
    fireSliderChange(targetSlider as HTMLInputElement, '0');

    expect(onUpdate).toHaveBeenCalledWith('goal-1', { targetAmount: undefined });
  });

  it('does not render for a consume-mode (spending) goal', () => {
    const spendingGoal: Goal = { ...baseGoal, mode: 'consume' };
    render(<GoalCard goal={spendingGoal} onUpdate={jest.fn()} onRemove={jest.fn()} />);

    expect(screen.queryByText('Target amount')).not.toBeInTheDocument();
  });
});

function fireSliderChange(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
