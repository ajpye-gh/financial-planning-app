import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RetirementPage } from '@src/components/retirement/RetirementPage';
import { DEFAULT_BASE_RANGES, baseDefaults, type BaseInputs } from '@src/lib/baseData';
import { buildRetirementVerdict, projectHouseholdRetirementIncome, projectRetirementBalance } from '@src/lib/retirement';
import { formatCurrency, formatCurrencyCompact } from '@src/lib/format';
import type { Answers } from '@src/lib/questions';

const BASE_INPUTS: BaseInputs = {
  ...baseDefaults(DEFAULT_BASE_RANGES),
  investmentReturnPct: 6,
  inflationPct: 3,
  retirementRothSavingsTodayK: 500,
  retirementRothContributionMo: 500,
  retirementRothWithdrawalRatePct: 4,
  retirementTraditionalSavingsTodayK: 300,
  retirementTraditionalContributionMo: 500,
  retirementTraditionalWithdrawalRatePct: 4,
  retirementSocialSecurityMo: 2000,
  retirementTargetYear: 20,
  retirementInspectYear: 20,
};

function renderRetirementPage(overrides: Partial<Parameters<typeof RetirementPage>[0]> = {}) {
  return render(
    <RetirementPage
      baseInputs={BASE_INPUTS}
      ranges={DEFAULT_BASE_RANGES}
      onChange={jest.fn()}
      answers={{}}
      onAnswer={jest.fn()}
      {...overrides}
    />,
  );
}

describe('RetirementPage', () => {
  it('renders separate Roth and Traditional groups, each with their own savings/contribution/withdrawal-rate sliders', () => {
    renderRetirementPage();

    expect(screen.getByRole('button', { name: /Roth/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Traditional/ })).toBeInTheDocument();
    expect(screen.getByText('Current Roth savings')).toBeInTheDocument();
    expect(screen.getByText('Current Traditional savings')).toBeInTheDocument();
    expect(screen.getAllByText('Monthly contribution')).toHaveLength(2);
    expect(screen.getAllByText('Withdrawal rate')).toHaveLength(2);
    expect(screen.getByText('Target year')).toBeInTheDocument();
  });

  it('calls onChange with the right field id for the Roth vs Traditional withdrawal-rate sliders', () => {
    const onChange = jest.fn();
    renderRetirementPage({ onChange });

    const [rothSlider, traditionalSlider] = screen.getAllByLabelText('Withdrawal rate') as HTMLInputElement[];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

    setter?.call(rothSlider, '5');
    rothSlider.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('retirementRothWithdrawalRatePct', 5);

    setter?.call(traditionalSlider, '3');
    traditionalSlider.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('retirementTraditionalWithdrawalRatePct', 3);
  });

  it('renders the Social Security field alongside a filing-status toggle', () => {
    renderRetirementPage();

    expect(screen.getByText('Social Security benefit')).toBeInTheDocument();
    expect(screen.getByText('Filing status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Single' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Married' })).toBeInTheDocument();
  });

  it('defaults the filing-status toggle to Single, and calls onAnswer when Married is clicked', async () => {
    const user = userEvent.setup();
    const onAnswer = jest.fn();
    renderRetirementPage({ onAnswer });

    expect(screen.getByRole('button', { name: 'Single' })).toHaveClass('chart-toggle__tab--active');

    await user.click(screen.getByRole('button', { name: 'Married' }));
    expect(onAnswer).toHaveBeenCalledWith('filingStatus', 'marriedJoint');
  });

  it('reflects an already-married answer by marking Married active', () => {
    renderRetirementPage({ answers: { filingStatus: 'marriedJoint' } as Answers });
    expect(screen.getByRole('button', { name: 'Married' })).toHaveClass('chart-toggle__tab--active');
  });

  it('renders the shared Assumptions group (inflation, investment return) in the sidebar', () => {
    renderRetirementPage();

    expect(screen.getByRole('button', { name: /Assumptions/ })).toBeInTheDocument();
    expect(screen.getByText('Inflation')).toBeInTheDocument();
    expect(screen.getByText('Investment return')).toBeInTheDocument();
  });

  it('calls onChange with the field id when the target-year slider is dragged', () => {
    const onChange = jest.fn();
    renderRetirementPage({ onChange });

    const slider = screen.getByLabelText('Target year') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(slider, '25');
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith('retirementTargetYear', 25);
  });

  it('shows the combined Roth+Traditional balance at the inspected year, matching projectRetirementBalance for each pot', () => {
    const { container } = renderRetirementPage();

    const roth = projectRetirementBalance(500000, 500, 6, 20, 4, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 4, 3);
    const combined = roth.balances[20] + traditional.balances[20];

    expect(screen.getByText('Total balance, inspect yr')).toBeInTheDocument();
    expect(container.querySelector('.metric-card__value')).toHaveTextContent(formatCurrencyCompact(combined));
  });

  it("shows net estimated income, nominal and in today's dollars, matching projectHouseholdRetirementIncome at the inspected year", () => {
    renderRetirementPage();

    const roth = projectRetirementBalance(500000, 500, 6, 20, 4, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 4, 3);
    const income = projectHouseholdRetirementIncome(roth, traditional, 2000, 'single', 3)[20];

    expect(screen.getByText('Estimated income, inspect yr')).toBeInTheDocument();
    expect(screen.getByText(`${formatCurrency(income.netMonthlyNominal)}/mo`)).toBeInTheDocument();

    expect(screen.getAllByText("— in today's dollars").length).toBeGreaterThan(0);
    expect(screen.getByText(`${formatCurrency(income.netMonthlyReal)}/mo`)).toBeInTheDocument();
  });

  it('shows a full income breakdown table at the inspected year, replacing the old cramped tooltip', () => {
    renderRetirementPage();

    expect(screen.getByText('Year 20 detail')).toBeInTheDocument();
    expect(screen.getByText('Traditional withdrawal, gross')).toBeInTheDocument();
    expect(screen.getByText('Social Security, gross')).toBeInTheDocument();
    expect(screen.getByText('Standard deduction')).toBeInTheDocument();
    expect(screen.getByText('Federal tax')).toBeInTheDocument();
  });

  it('renders an Inspect year slider separate from Target year, and calls onChange when dragged', () => {
    const onChange = jest.fn();
    renderRetirementPage({ onChange });

    const slider = screen.getByLabelText('Inspect year') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(slider, '10');
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith('retirementInspectYear', 10);
  });

  it('changing the inspected year changes the breakdown table shown, since income can change once a pot depletes', () => {
    renderRetirementPage({ baseInputs: { ...BASE_INPUTS, retirementInspectYear: 5 } });

    expect(screen.getByText('Year 5 detail')).toBeInTheDocument();
    expect(screen.queryByText('Year 20 detail')).not.toBeInTheDocument();
  });

  it('uses married-filing-jointly brackets in the income estimate once that toggle is selected', () => {
    renderRetirementPage({ answers: { filingStatus: 'marriedJoint' } as Answers });

    const roth = projectRetirementBalance(500000, 500, 6, 20, 4, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 4, 3);
    const income = projectHouseholdRetirementIncome(roth, traditional, 2000, 'marriedJoint', 3)[20];

    expect(screen.getByText(`${formatCurrency(income.netMonthlyNominal)}/mo`)).toBeInTheDocument();
  });

  it('shows a verdict banner reflecting whether the savings last, matching buildRetirementVerdict', () => {
    renderRetirementPage();

    const roth = projectRetirementBalance(500000, 500, 6, 20, 4, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 4, 3);
    const verdict = buildRetirementVerdict(roth, traditional);

    expect(screen.getByText(verdict.headline)).toBeInTheDocument();
    expect(document.querySelector(`.verdict-banner--${verdict.tone}`)).toBeInTheDocument();
  });

  it('shows a danger verdict when both pots are drained to depletion', () => {
    renderRetirementPage({
      baseInputs: {
        ...BASE_INPUTS,
        retirementRothSavingsTodayK: 10,
        retirementRothContributionMo: 0,
        retirementRothWithdrawalRatePct: 8,
        retirementTraditionalSavingsTodayK: 10,
        retirementTraditionalContributionMo: 0,
        retirementTraditionalWithdrawalRatePct: 8,
      },
    });

    expect(document.querySelector('.verdict-banner--danger')).toBeInTheDocument();
  });

  it('shows a warning verdict when only one pot is drained to depletion', () => {
    renderRetirementPage({
      baseInputs: {
        ...BASE_INPUTS,
        retirementRothSavingsTodayK: 10,
        retirementRothContributionMo: 0,
        retirementRothWithdrawalRatePct: 8,
      },
    });

    expect(document.querySelector('.verdict-banner--warning')).toBeInTheDocument();
    expect(screen.getByText(/Roth runs out/)).toBeInTheDocument();
  });
});
