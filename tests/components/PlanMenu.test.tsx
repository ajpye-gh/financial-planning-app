import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanMenu } from '@src/components/PlanMenu';
import { freshPlan, savePlan } from '@src/lib/plans';

beforeEach(() => {
  localStorage.clear();
});

describe('PlanMenu', () => {
  it('hides the plan controls until the hamburger trigger is clicked', async () => {
    const user = userEvent.setup();
    render(<PlanMenu onLoad={jest.fn()} planForSaving={() => freshPlan()} />);

    expect(screen.queryByRole('button', { name: 'Save Plan' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Plan menu' }));
    expect(screen.getByRole('button', { name: 'Save Plan' })).toBeInTheDocument();
  });

  it('closes the panel when the trigger is clicked again', async () => {
    const user = userEvent.setup();
    render(<PlanMenu onLoad={jest.fn()} planForSaving={() => freshPlan()} />);

    const trigger = screen.getByRole('button', { name: 'Plan menu' });
    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Save Plan' })).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByRole('button', { name: 'Save Plan' })).not.toBeInTheDocument();
  });

  it('closes the panel when clicking outside it', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <PlanMenu onLoad={jest.fn()} planForSaving={() => freshPlan()} />
        <div data-testid="outside">Outside</div>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Plan menu' }));
    expect(screen.getByRole('button', { name: 'Save Plan' })).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByRole('button', { name: 'Save Plan' })).not.toBeInTheDocument();
  });

  it('closes the panel after successfully loading a saved plan', async () => {
    const user = userEvent.setup();
    const plan = freshPlan();
    const onLoad = jest.fn();
    savePlan('Base case', plan);

    render(<PlanMenu onLoad={onLoad} planForSaving={() => plan} />);
    await user.click(screen.getByRole('button', { name: 'Plan menu' }));
    await user.click(screen.getByRole('button', { name: /Load Plan/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Base case' }));

    expect(onLoad).toHaveBeenCalledWith(plan);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});
