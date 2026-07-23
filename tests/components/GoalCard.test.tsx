import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoalCard } from '@src/components/goals/GoalCard';
import type { Goal } from '@src/lib/goals';

const baseGoal: Goal = {
  kind: 'recurring',
  id: 'goal-1',
  name: 'Travel fund',
  mode: 'accumulate',
  category: 'other',
  monthlyAmount: 200,
  monthlyAmountRange: { min: 0, max: 1000, step: 10 },
  startYear: 1,
  endYear: 5,
  cashAllocated: 0,
  brokerageAllocated: 0,
  equityAllocated: false,
};

function renderCard(overrides: Partial<Parameters<typeof GoalCard>[0]> = {}) {
  return render(
    <GoalCard
      goal={baseGoal}
      cashRemaining={1000}
      brokerageRemaining={1000}
      homeEquity={0}
      onUpdate={jest.fn()}
      onRemove={jest.fn()}
      {...overrides}
    />,
  );
}

describe('GoalCard name editing', () => {
  it('renders the name as static text until the edit icon is clicked', () => {
    renderCard();

    expect(screen.getByText('Travel fund')).toBeInTheDocument();
    expect(screen.queryByLabelText('Goal name')).not.toBeInTheDocument();
  });

  it('switches to an input on rename click and back to static text on save', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    renderCard({ onUpdate });

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
    renderCard({ onUpdate });

    await user.click(screen.getByRole('button', { name: 'Rename Travel fund' }));
    const input = screen.getByLabelText('Goal name');
    await user.clear(input);
    await user.type(input, 'Europe trip{Enter}');

    expect(onUpdate).toHaveBeenCalledWith('goal-1', { name: 'Europe trip' });
  });

  it('ignores a blank rename and keeps the original name', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    renderCard({ onUpdate });

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
    renderCard({ goal: goalWithTarget, runningTotal: 54000 });

    expect(screen.getByText('$54k')).toBeInTheDocument();
    expect(screen.getByText(/\$80k/)).toBeInTheDocument();

    await user.hover(screen.getByText('$54k'));
    const tooltip = await screen.findByRole('tooltip');
    // baseGoal's endYear is 5, not the 18-year model horizon.
    expect(tooltip).toHaveTextContent('Projected balance at your end year (5), against the $80k target');
  });

  it('renders just the balance, with no tooltip, when the goal has no target', () => {
    renderCard({ runningTotal: 54000 });

    expect(screen.getByText('$54k')).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('GoalCard target amount', () => {
  it('shows "No target" and a zeroed slider when the goal has none set', () => {
    renderCard();

    expect(screen.getByText('No target')).toBeInTheDocument();
    const targetSlider = screen.getByText('Target amount').parentElement?.querySelector('input[type="range"]');
    expect((targetSlider as HTMLInputElement).value).toBe('0');
  });

  it('shows the formatted target amount when one is set', () => {
    const goalWithTarget: Goal = { ...baseGoal, targetAmount: 80000 };
    renderCard({ goal: goalWithTarget });

    expect(screen.getByText('$80,000')).toBeInTheDocument();
  });

  it('sets a target amount when the slider is dragged above zero', () => {
    const onUpdate = jest.fn();
    renderCard({ onUpdate });

    const targetSlider = screen.getByText('Target amount').parentElement?.querySelector('input[type="range"]');
    fireSliderChange(targetSlider as HTMLInputElement, '150000');

    expect(onUpdate).toHaveBeenCalledWith('goal-1', { targetAmount: 150000 });
  });

  it('clears the target amount when the slider is dragged back to zero', () => {
    const onUpdate = jest.fn();
    const goalWithTarget: Goal = { ...baseGoal, targetAmount: 80000 };
    renderCard({ goal: goalWithTarget, onUpdate });

    const targetSlider = screen.getByText('Target amount').parentElement?.querySelector('input[type="range"]');
    fireSliderChange(targetSlider as HTMLInputElement, '0');

    expect(onUpdate).toHaveBeenCalledWith('goal-1', { targetAmount: undefined });
  });

  it('does not render for a consume-mode (spending) goal', () => {
    const spendingGoal: Goal = { ...baseGoal, mode: 'consume' };
    renderCard({ goal: spendingGoal });

    expect(screen.queryByText('Target amount')).not.toBeInTheDocument();
  });
});

describe('GoalCard asset allocation', () => {
  it('shows a "From cash today" slider only for the emergency-fund category', () => {
    const emergencyGoal: Goal = { ...baseGoal, category: 'emergency' };
    renderCard({ goal: emergencyGoal });

    expect(screen.getByText('From cash today')).toBeInTheDocument();
  });

  it('hides "From cash today" for any non-emergency category', () => {
    renderCard({ goal: { ...baseGoal, category: 'other' } });
    expect(screen.queryByText('From cash today')).not.toBeInTheDocument();

    renderCard({ goal: { ...baseGoal, category: 'retirement' } });
    expect(screen.queryByText('From cash today')).not.toBeInTheDocument();
  });

  it('hides "From brokerage today" only for the retirement category', () => {
    renderCard({ goal: { ...baseGoal, category: 'retirement' } });
    expect(screen.queryByText('From brokerage today')).not.toBeInTheDocument();

    renderCard({ goal: { ...baseGoal, category: 'other' } });
    expect(screen.getAllByText('From brokerage today').length).toBeGreaterThan(0);
  });

  it('hides both allocation sliders for a consume-mode goal, regardless of category', () => {
    renderCard({ goal: { ...baseGoal, mode: 'consume', category: 'emergency' } });

    expect(screen.queryByText('From cash today')).not.toBeInTheDocument();
    expect(screen.queryByText('From brokerage today')).not.toBeInTheDocument();
  });

  it("caps the brokerage slider at what's remaining plus the goal's own current allocation", () => {
    const goal: Goal = { ...baseGoal, category: 'other', brokerageAllocated: 300 };
    renderCard({ goal, brokerageRemaining: 700 });

    const slider = screen.getByText('From brokerage today').parentElement?.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.max).toBe('1000');
    expect(slider.value).toBe('300');
  });

  it('calls onUpdate with the new cashAllocated amount when the cash slider changes', () => {
    const onUpdate = jest.fn();
    renderCard({ goal: { ...baseGoal, category: 'emergency' }, cashRemaining: 5000, onUpdate });

    const slider = screen.getByText('From cash today').parentElement?.querySelector('input[type="range"]') as HTMLInputElement;
    fireSliderChange(slider, '4000');

    expect(onUpdate).toHaveBeenCalledWith('goal-1', { cashAllocated: 4000 });
  });
});

describe('GoalCard equity allocation', () => {
  it('shows the equity checkbox only for a property goal with nonzero home equity', () => {
    renderCard({ goal: { ...baseGoal, category: 'property' }, homeEquity: 50000 });
    expect(screen.getByText('Use home equity ($50,000)')).toBeInTheDocument();
  });

  it('hides the equity checkbox for a non-property goal', () => {
    renderCard({ goal: { ...baseGoal, category: 'other' }, homeEquity: 50000 });
    expect(screen.queryByText(/Use home equity/)).not.toBeInTheDocument();
  });

  it('hides the equity checkbox when there is no home equity', () => {
    renderCard({ goal: { ...baseGoal, category: 'property' }, homeEquity: 0 });
    expect(screen.queryByText(/Use home equity/)).not.toBeInTheDocument();
  });

  it('calls onUpdate with equityAllocated when the checkbox is toggled', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    renderCard({ goal: { ...baseGoal, category: 'property' }, homeEquity: 50000, onUpdate });

    await user.click(screen.getByRole('checkbox'));

    expect(onUpdate).toHaveBeenCalledWith('goal-1', { equityAllocated: true });
  });
});

function fireSliderChange(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
