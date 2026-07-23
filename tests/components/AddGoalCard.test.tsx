import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddGoalCard } from '@src/components/goals/AddGoalCard';
import { GOAL_CATALOG } from '@src/lib/goals';

describe('AddGoalCard', () => {
  it('starts idle, showing just the "Add new" prompt with no catalog options', () => {
    render(<AddGoalCard onAdd={jest.fn()} />);

    expect(screen.getByRole('button', { name: /Add new/ })).toBeInTheDocument();
    expect(screen.queryByText(GOAL_CATALOG[0].label)).not.toBeInTheDocument();
  });

  it('shows every catalog entry as an option once clicked', async () => {
    const user = userEvent.setup();
    render(<AddGoalCard onAdd={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /Add new/ }));

    for (const entry of GOAL_CATALOG) {
      expect(screen.getByRole('button', { name: entry.label })).toBeInTheDocument();
    }
  });

  it('calls onAdd with a freshly created goal of the chosen type, then reverts to idle', async () => {
    const user = userEvent.setup();
    const onAdd = jest.fn();
    render(<AddGoalCard onAdd={onAdd} />);

    const chosen = GOAL_CATALOG[0];
    await user.click(screen.getByRole('button', { name: /Add new/ }));
    await user.click(screen.getByRole('button', { name: chosen.label }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({ name: chosen.create('x').name, category: chosen.create('x').category });
    expect(screen.getByRole('button', { name: /Add new/ })).toBeInTheDocument();
    expect(screen.queryByText(chosen.label)).not.toBeInTheDocument();
  });

  it('reverts to idle without calling onAdd when cancelled', async () => {
    const user = userEvent.setup();
    const onAdd = jest.fn();
    render(<AddGoalCard onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: /Add new/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Add new/ })).toBeInTheDocument();
  });
});
