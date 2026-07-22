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
