import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoalCard } from '@src/components/goals/GoalCard';
import { DEFAULT_BASE_RANGES, baseDefaults, type BaseInputs } from '@src/lib/baseData';
import { formatCurrency } from '@src/lib/format';
import { monthlyMortgagePayment, projectHomeEquity } from '@src/lib/model';
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
  isPurchase: false,
};

const BASE_INPUTS: BaseInputs = baseDefaults(DEFAULT_BASE_RANGES);

// Fixture with a mortgage that actually amortizes within a few years, for equity-projection tests.
const OWNED_BASE_INPUTS: BaseInputs = {
  ...BASE_INPUTS,
  homeValueK: 350,
  mortgageBalanceK: 250,
  currentMortgageRatePct: 3,
  housingPrincipalInterestMo: 1200,
  inflationPct: 3,
};

/** Expanded by default so the existing field-level tests below don't each need to click the
 *  expand toggle first - the collapse/expand behavior itself is covered by its own describe block. */
function renderCard(overrides: Partial<Parameters<typeof GoalCard>[0]> = {}) {
  return render(
    <GoalCard
      goal={baseGoal}
      cashRemaining={1000}
      brokerageRemaining={1000}
      base={BASE_INPUTS}
      ownsHome={false}
      defaultExpanded
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
  // baseGoal.endYear is 5 - the projection is computed at the goal's own endYear.
  const projectedEquity = projectHomeEquity(OWNED_BASE_INPUTS, true, 5).equity;

  it('shows the equity checkbox only for a property goal with nonzero projected equity, labeled with the projected amount', () => {
    renderCard({ goal: { ...baseGoal, category: 'property' }, base: OWNED_BASE_INPUTS, ownsHome: true });
    expect(screen.getByText(`(${formatCurrency(projectedEquity)} projected)`)).toBeInTheDocument();
  });

  it('hides the equity checkbox for a non-property goal', () => {
    renderCard({ goal: { ...baseGoal, category: 'other' }, base: OWNED_BASE_INPUTS, ownsHome: true });
    expect(screen.queryByText(/Use home equity/)).not.toBeInTheDocument();
  });

  it('hides the equity checkbox when renting (no current home to project equity from)', () => {
    renderCard({ goal: { ...baseGoal, category: 'property' }, base: OWNED_BASE_INPUTS, ownsHome: false });
    expect(screen.queryByText(/Use home equity/)).not.toBeInTheDocument();
  });

  it('calls onUpdate with equityAllocated when the checkbox is toggled', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    renderCard({ goal: { ...baseGoal, category: 'property' }, base: OWNED_BASE_INPUTS, ownsHome: true, onUpdate });

    await user.click(screen.getByRole('checkbox'));

    expect(onUpdate).toHaveBeenCalledWith('goal-1', { equityAllocated: true });
  });

  it('shows a breakdown tooltip explaining the projection', async () => {
    const user = userEvent.setup();
    renderCard({ goal: { ...baseGoal, category: 'property' }, base: OWNED_BASE_INPUTS, ownsHome: true });

    await user.hover(screen.getByText('Use home equity'));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('home value');
    expect(tooltip).toHaveTextContent('remaining mortgage');
    expect(tooltip).toHaveTextContent('market investment return');
  });
});

describe('GoalCard collapse/expand', () => {
  it('is collapsed by default, showing only monthly amount and projected final value', () => {
    render(
      <GoalCard goal={baseGoal} cashRemaining={0} brokerageRemaining={0} base={BASE_INPUTS} ownsHome={false} runningTotal={54000} onUpdate={jest.fn()} onRemove={jest.fn()} />,
    );

    expect(screen.getByText('$200/mo')).toBeInTheDocument();
    expect(screen.getByText('→ $54k')).toBeInTheDocument();
    expect(screen.queryByText('Target amount')).not.toBeInTheDocument();
    expect(screen.queryByText('saving')).not.toBeInTheDocument();
  });

  it('hides the mode badge while collapsed, shows it once expanded', async () => {
    const user = userEvent.setup();
    render(
      <GoalCard goal={baseGoal} cashRemaining={0} brokerageRemaining={0} base={BASE_INPUTS} ownsHome={false} onUpdate={jest.fn()} onRemove={jest.fn()} />,
    );

    expect(screen.queryByText('saving')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand Travel fund' }));
    expect(screen.getByText('saving')).toBeInTheDocument();
  });

  it('shows no second figure when collapsed for a consume-mode goal (no balance)', () => {
    render(
      <GoalCard goal={{ ...baseGoal, mode: 'consume' }} cashRemaining={0} brokerageRemaining={0} base={BASE_INPUTS} ownsHome={false} onUpdate={jest.fn()} onRemove={jest.fn()} />,
    );

    expect(screen.getByText('$200/mo')).toBeInTheDocument();
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it('starts expanded when defaultExpanded is set (e.g. a just-added goal)', () => {
    renderCard();
    expect(screen.getByText('Target amount')).toBeInTheDocument();
  });

  it('toggles between collapsed and expanded on click, independent of defaultExpanded', async () => {
    const user = userEvent.setup();
    render(
      <GoalCard goal={baseGoal} cashRemaining={0} brokerageRemaining={0} base={BASE_INPUTS} ownsHome={false} onUpdate={jest.fn()} onRemove={jest.fn()} />,
    );

    expect(screen.queryByText('Target amount')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand Travel fund' }));
    expect(screen.getByText('Target amount')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Collapse Travel fund' }));
    expect(screen.queryByText('Target amount')).not.toBeInTheDocument();
  });

  it('hides the rename (edit) icon while collapsed, shows it once expanded', async () => {
    const user = userEvent.setup();
    render(
      <GoalCard goal={baseGoal} cashRemaining={0} brokerageRemaining={0} base={BASE_INPUTS} ownsHome={false} onUpdate={jest.fn()} onRemove={jest.fn()} />,
    );

    expect(screen.queryByRole('button', { name: 'Rename Travel fund' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand Travel fund' }));
    expect(screen.getByRole('button', { name: 'Rename Travel fund' })).toBeInTheDocument();
  });

  it('only shows the Delete button while expanded, and it calls onRemove', async () => {
    const user = userEvent.setup();
    const onRemove = jest.fn();
    render(
      <GoalCard goal={baseGoal} cashRemaining={0} brokerageRemaining={0} base={BASE_INPUTS} ownsHome={false} onUpdate={jest.fn()} onRemove={onRemove} />,
    );

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand Travel fund' }));
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton).toBeInTheDocument();

    await user.click(deleteButton);
    expect(onRemove).toHaveBeenCalledWith('goal-1');
  });
});

describe('GoalCard property purchase fields', () => {
  const propertyGoal: Goal = { ...baseGoal, category: 'property', isPurchase: true, purchasePriceK: 400, mortgageRatePct: 6 };

  it('shows Total property price and Mortgage rate sliders only for a property goal', () => {
    renderCard({ goal: propertyGoal });

    expect(screen.getByText('Total property price')).toBeInTheDocument();
    expect(screen.getByText('Mortgage rate')).toBeInTheDocument();
  });

  it('hides property fields for a non-property goal', () => {
    renderCard({ goal: { ...baseGoal, category: 'other' } });

    expect(screen.queryByText('Total property price')).not.toBeInTheDocument();
    expect(screen.queryByText('Mortgage rate')).not.toBeInTheDocument();
  });

  it('shows an estimated mortgage payment using the projected balance as the down payment', () => {
    renderCard({ goal: propertyGoal, runningTotal: 60000 });

    // loan = 400000 price - 60000 projected balance = 340000 @ 6%/30yr.
    expect(screen.getByText(/Estimated mortgage payment/)).toBeInTheDocument();
    expect(screen.getByText(`${formatCurrency(monthlyMortgagePayment(340000, 6, 30))}/mo`)).toBeInTheDocument();
  });

  it('a larger projected balance lowers the estimated payment - no separate target amount to set instead', () => {
    const { rerender } = renderCard({ goal: propertyGoal, runningTotal: 40000 });
    expect(screen.getByText(`${formatCurrency(monthlyMortgagePayment(360000, 6, 30))}/mo`)).toBeInTheDocument();

    rerender(
      <GoalCard
        goal={propertyGoal}
        cashRemaining={1000}
        brokerageRemaining={1000}
        base={BASE_INPUTS}
        ownsHome={false}
        defaultExpanded
        runningTotal={100000}
        onUpdate={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    expect(screen.getByText(`${formatCurrency(monthlyMortgagePayment(300000, 6, 30))}/mo`)).toBeInTheDocument();
  });

  it('does not render a Target amount slider for a property goal - Total property price already covers it', () => {
    renderCard({ goal: propertyGoal });
    expect(screen.queryByText('Target amount')).not.toBeInTheDocument();
  });

  it('shows a breakdown tooltip on the mortgage estimate', async () => {
    const user = userEvent.setup();
    renderCard({ goal: propertyGoal, runningTotal: 60000 });

    await user.hover(screen.getByText('Estimated mortgage payment'));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('$400,000 price');
    expect(tooltip).toHaveTextContent('$60,000 down payment');
    expect(tooltip).toHaveTextContent('$340,000 loan');
    expect(tooltip).toHaveTextContent('6.00%');
    expect(tooltip).toHaveTextContent('30yr');
  });

  it('does not show the "ends in a purchase" checkbox for a property goal - it is always a purchase', () => {
    renderCard({ goal: propertyGoal });
    expect(screen.queryByText('This ends in a purchase')).not.toBeInTheDocument();
  });

  it('calls onUpdate with purchasePriceK when the price slider changes', () => {
    const onUpdate = jest.fn();
    renderCard({ goal: propertyGoal, onUpdate });

    const slider = screen.getByText('Total property price').parentElement?.querySelector('input[type="range"]') as HTMLInputElement;
    fireSliderChange(slider, '500');

    expect(onUpdate).toHaveBeenCalledWith('goal-1', { purchasePriceK: 500 });
  });
});

describe('GoalCard generic purchase toggle', () => {
  it('shows "This ends in a purchase" checkbox for a non-property accumulate goal', () => {
    renderCard();
    expect(screen.getByText('This ends in a purchase')).toBeInTheDocument();
  });

  it('hides it for a consume-mode goal', () => {
    renderCard({ goal: { ...baseGoal, mode: 'consume' } });
    expect(screen.queryByText('This ends in a purchase')).not.toBeInTheDocument();
  });

  it('shows the post-purchase monthly cost slider only when isPurchase is set', () => {
    renderCard({ goal: { ...baseGoal, isPurchase: false } });
    expect(screen.queryByText('Post-purchase monthly cost')).not.toBeInTheDocument();

    renderCard({ goal: { ...baseGoal, isPurchase: true } });
    expect(screen.getByText('Post-purchase monthly cost')).toBeInTheDocument();
  });

  it('calls onUpdate with isPurchase when the checkbox is toggled', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    renderCard({ goal: { ...baseGoal, isPurchase: false }, onUpdate });

    await user.click(screen.getByRole('checkbox', { name: 'This ends in a purchase' }));

    expect(onUpdate).toHaveBeenCalledWith('goal-1', { isPurchase: true });
  });
});

function fireSliderChange(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
