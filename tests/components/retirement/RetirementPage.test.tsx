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
  retirementCurrentAge: 35,
  retirementTargetAge: 55,
  retirementInspectAge: 55,
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
  it('renders separate Roth, Traditional, and after-tax groups, each with their own savings/contribution/withdrawal-rate sliders', () => {
    renderRetirementPage();

    expect(screen.getByRole('button', { name: /^Roth$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Traditional$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^After-tax$/ })).toBeInTheDocument();
    expect(screen.getByText('Current Roth savings')).toBeInTheDocument();
    expect(screen.getByText('Current Traditional savings')).toBeInTheDocument();
    expect(screen.getByText('Current after-tax savings')).toBeInTheDocument();
    expect(screen.getAllByText('Monthly contribution')).toHaveLength(3);
    expect(screen.getAllByText('Initial withdrawal rate')).toHaveLength(3);
    expect(screen.getByText('Taxable gain %')).toBeInTheDocument();
    expect(screen.getByText('Target retirement age')).toBeInTheDocument();
  });

  it('renders Current age and Target age together in their own sidebar group, not the main content area', () => {
    const { container } = renderRetirementPage();

    expect(screen.getByRole('button', { name: /Age/ })).toBeInTheDocument();
    const sidebar = container.querySelector('.app-shell__sidebar');
    expect(sidebar).toContainElement(screen.getByLabelText('Current age'));
    expect(sidebar).toContainElement(screen.getByLabelText('Target retirement age'));
  });

  it('calls onChange with the right field id for the Roth vs Traditional withdrawal-rate sliders', () => {
    const onChange = jest.fn();
    renderRetirementPage({ onChange });

    const [rothSlider, traditionalSlider] = screen.getAllByLabelText('Initial withdrawal rate') as HTMLInputElement[];
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

  it('calls onChange with the field id when the target-age slider is dragged', () => {
    const onChange = jest.fn();
    renderRetirementPage({ onChange });

    const slider = screen.getByLabelText('Target retirement age') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(slider, '60');
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith('retirementTargetAge', 60);
  });

  it('renders a Current age slider and calls onChange with the field id when dragged', () => {
    const onChange = jest.fn();
    renderRetirementPage({ onChange });

    const slider = screen.getByLabelText('Current age') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(slider, '40');
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith('retirementCurrentAge', 40);
  });

  it('shows the combined Roth+Traditional+after-tax balance at the inspected age, matching projectRetirementBalance for each pot', () => {
    const { container } = renderRetirementPage();

    // currentAge 35 -> finalYear = MAX_PROJECTION_AGE(100) - 35 = 65.
    const roth = projectRetirementBalance(500000, 500, 6, 20, 65, 4, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 65, 4, 3);
    const afterTax = projectRetirementBalance(50000, 0, 6, 20, 65, 4, 3);
    const combined = roth.balances[20] + traditional.balances[20] + afterTax.balances[20];

    expect(screen.getByText('Total balance, inspect age')).toBeInTheDocument();
    expect(container.querySelector('.metric-card__value')).toHaveTextContent(formatCurrencyCompact(combined));
  });

  it("shows net estimated income, nominal and in today's dollars, matching projectHouseholdRetirementIncome at the inspected age", () => {
    renderRetirementPage();

    // currentAge 35 -> finalYear = MAX_PROJECTION_AGE(100) - 35 = 65.
    const roth = projectRetirementBalance(500000, 500, 6, 20, 65, 4, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 65, 4, 3);
    // Matches BASE_INPUTS's default after-tax savings ($50k, contribution $0, 4% rate).
    const afterTax = projectRetirementBalance(50000, 0, 6, 20, 65, 4, 3);
    const income = projectHouseholdRetirementIncome({
      rothProjection: roth,
      traditionalProjection: traditional,
      afterTaxProjection: afterTax,
      afterTaxGainPct: 50,
      pensionMonthlyToday: 0,
      pensionStartAge: 65,
      ssMonthlyBenefitToday: 2000,
      currentAge: 35,
      filingStatus: 'single',
      inflationPct: 3,
    })[20];

    expect(screen.getByText('Estimated income, inspect age')).toBeInTheDocument();
    expect(screen.getByText(`${formatCurrency(income.netMonthlyNominal)}/mo`)).toBeInTheDocument();

    expect(screen.getAllByText("— in today's dollars").length).toBeGreaterThan(0);
    expect(screen.getByText(`${formatCurrency(income.netMonthlyReal)}/mo`)).toBeInTheDocument();
  });

  it('shows total retirement income taxes paid, summed in nominal dollars across the whole projection', () => {
    renderRetirementPage();

    // currentAge 35 -> finalYear = MAX_PROJECTION_AGE(100) - 35 = 65.
    const roth = projectRetirementBalance(500000, 500, 6, 20, 65, 4, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 65, 4, 3);
    const afterTax = projectRetirementBalance(50000, 0, 6, 20, 65, 4, 3);
    const series = projectHouseholdRetirementIncome({
      rothProjection: roth,
      traditionalProjection: traditional,
      afterTaxProjection: afterTax,
      afterTaxGainPct: 50,
      pensionMonthlyToday: 0,
      pensionStartAge: 65,
      ssMonthlyBenefitToday: 2000,
      currentAge: 35,
      filingStatus: 'single',
      inflationPct: 3,
    });
    const totalTaxPaid = series.reduce((sum, entry) => sum + entry.tax.tax, 0);

    expect(screen.getByText('Total taxes paid')).toBeInTheDocument();
    expect(screen.getByText(formatCurrencyCompact(totalTaxPaid))).toBeInTheDocument();
  });

  it('shows a full income breakdown table at the inspected age, replacing the old cramped tooltip', () => {
    renderRetirementPage();

    // currentAge 35 + inspect index 20 (retirementInspectAge 55 - retirementCurrentAge 35) = age 55.
    expect(screen.getByText('Age 55 detail')).toBeInTheDocument();
    expect(screen.getByText('Traditional withdrawal, gross')).toBeInTheDocument();
    expect(screen.getByText('Social Security, gross')).toBeInTheDocument();
    expect(screen.getByText('Standard deduction')).toBeInTheDocument();
    expect(screen.getByText('Federal tax, total')).toBeInTheDocument();
  });

  it("shows a nonzero Traditional withdrawal and tax immediately when already retired (Current age == Target retirement age), not just starting the year after", () => {
    renderRetirementPage({
      baseInputs: {
        ...BASE_INPUTS,
        // A large enough Traditional balance that the withdrawal clears the standard deduction -
        // otherwise a small first-year withdrawal can legitimately owe $0 tax (same reason a
        // Social-Security-only retiree often does), which would make this assertion ambiguous.
        retirementTraditionalSavingsTodayK: 2000,
        retirementCurrentAge: 65,
        retirementTargetAge: 65,
        retirementInspectAge: 65,
      },
    });

    expect(screen.getByText('Age 65 detail')).toBeInTheDocument();
    const traditionalRow = screen.getByText('Traditional withdrawal, gross').closest('tr');
    expect(traditionalRow).not.toHaveTextContent('$0/yr');
    const taxRow = screen.getByText('Federal tax, total').closest('tr');
    expect(taxRow).not.toHaveTextContent('$0/yr');
  });

  it('explains on hover why the income-tax line climbs even at a fixed withdrawal rate', async () => {
    const user = userEvent.setup();
    renderRetirementPage();

    await user.hover(screen.getByText('Income tax'));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('grows with inflation');
    expect(tooltip).toHaveTextContent('fixed in nominal dollars');
  });

  it('renders an Inspect age slider separate from Target age, and calls onChange when dragged', () => {
    const onChange = jest.fn();
    renderRetirementPage({ onChange });

    const slider = screen.getByLabelText('Inspect age') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(slider, '40');
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith('retirementInspectAge', 40);
  });

  it("Inspect age slider's minimum tracks Current age instead of the static Defaults.json floor", () => {
    renderRetirementPage({ baseInputs: { ...BASE_INPUTS, retirementCurrentAge: 50 } });

    const slider = screen.getByLabelText('Inspect age') as HTMLInputElement;
    expect(slider.min).toBe('50');
  });

  it('changing the inspected age changes the breakdown table shown, since income can change once a pot depletes', () => {
    // currentAge 35 + 5 = age 40, instead of the default inspect age 55.
    renderRetirementPage({ baseInputs: { ...BASE_INPUTS, retirementInspectAge: 40 } });

    expect(screen.getByText('Age 40 detail')).toBeInTheDocument();
    expect(screen.queryByText('Age 55 detail')).not.toBeInTheDocument();
  });

  it('uses married-filing-jointly brackets in the income estimate once that toggle is selected', () => {
    renderRetirementPage({ answers: { filingStatus: 'marriedJoint' } as Answers });

    // currentAge 35 -> finalYear = MAX_PROJECTION_AGE(100) - 35 = 65.
    const roth = projectRetirementBalance(500000, 500, 6, 20, 65, 4, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 65, 4, 3);
    const afterTax = projectRetirementBalance(50000, 0, 6, 20, 65, 4, 3);
    const income = projectHouseholdRetirementIncome({
      rothProjection: roth,
      traditionalProjection: traditional,
      afterTaxProjection: afterTax,
      afterTaxGainPct: 50,
      pensionMonthlyToday: 0,
      pensionStartAge: 65,
      ssMonthlyBenefitToday: 2000,
      currentAge: 35,
      filingStatus: 'marriedJoint',
      inflationPct: 3,
    })[20];

    expect(screen.getByText(`${formatCurrency(income.netMonthlyNominal)}/mo`)).toBeInTheDocument();
  });

  it('shows a verdict banner reflecting whether the savings last, matching buildRetirementVerdict', () => {
    renderRetirementPage();

    // currentAge 35 -> finalYear = MAX_PROJECTION_AGE(100) - 35 = 65.
    const roth = projectRetirementBalance(500000, 500, 6, 20, 65, 4, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 65, 4, 3);
    const afterTax = projectRetirementBalance(50000, 0, 6, 20, 65, 4, 3);
    const verdict = buildRetirementVerdict(
      [
        { name: 'Roth', projection: roth },
        { name: 'Traditional', projection: traditional },
        { name: 'After-tax', projection: afterTax },
      ],
      BASE_INPUTS.retirementCurrentAge,
    );

    expect(screen.getByText(verdict.headline)).toBeInTheDocument();
    expect(document.querySelector(`.verdict-banner--${verdict.tone}`)).toBeInTheDocument();
  });

  it('shows a danger verdict when every pot is drained to depletion', () => {
    renderRetirementPage({
      baseInputs: {
        ...BASE_INPUTS,
        retirementRothSavingsTodayK: 10,
        retirementRothContributionMo: 0,
        retirementRothWithdrawalRatePct: 8,
        retirementTraditionalSavingsTodayK: 10,
        retirementTraditionalContributionMo: 0,
        retirementTraditionalWithdrawalRatePct: 8,
        retirementAfterTaxSavingsTodayK: 10,
        retirementAfterTaxContributionMo: 0,
        retirementAfterTaxWithdrawalRatePct: 8,
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

  it('shows a clear early-withdrawal-penalty warning banner when retiring before age 60 with a Traditional withdrawal', () => {
    // BASE_INPUTS retires at 55 (< 60) with a nonzero Traditional balance/rate by default.
    renderRetirementPage();

    expect(screen.getByText(/10% early-withdrawal penalty applies/)).toBeInTheDocument();
    expect(screen.getByText(/59½/)).toBeInTheDocument();
  });

  it('does not show the early-withdrawal-penalty warning when retiring at or after age 60', () => {
    renderRetirementPage({
      baseInputs: { ...BASE_INPUTS, retirementCurrentAge: 60, retirementTargetAge: 60, retirementInspectAge: 60 },
    });

    expect(screen.queryByText(/early-withdrawal penalty/)).not.toBeInTheDocument();
  });

  it("shows $0 Social Security before age 62 even though already retired, matching the real earliest claiming age", () => {
    renderRetirementPage({
      baseInputs: {
        ...BASE_INPUTS,
        retirementCurrentAge: 55,
        retirementTargetAge: 55,
        retirementInspectAge: 55,
      },
    });

    expect(screen.getByText('Age 55 detail')).toBeInTheDocument();
    const ssRow = screen.getByText('Social Security, gross').closest('tr');
    expect(ssRow).toHaveTextContent('$0/yr');
  });

  it('forces a Traditional withdrawal at least as large as the Required Minimum Distribution once age reaches 73', () => {
    // A 2% withdrawal rate would normally take 2% of the balance; at age 73 the RMD (balance /
    // 26.5) is much larger and should win instead.
    renderRetirementPage({
      baseInputs: {
        ...BASE_INPUTS,
        retirementTraditionalSavingsTodayK: 1000,
        retirementTraditionalContributionMo: 0,
        retirementTraditionalWithdrawalRatePct: 2,
        retirementCurrentAge: 73,
        retirementTargetAge: 73,
        retirementInspectAge: 73,
      },
    });

    expect(screen.getByText('Age 73 detail')).toBeInTheDocument();
    const traditionalRow = screen.getByText('Traditional withdrawal, gross').closest('tr');
    // currentAge=targetAge=73 -> finalYear = MAX_PROJECTION_AGE(100) - 73 = 27.
    const expected = projectRetirementBalance(1000000, 0, 6, 0, 27, 2, 3, { currentAge: 73 });
    expect(traditionalRow).toHaveTextContent(formatCurrency(expected.withdrawals[0]));
    // 2% of $1,000,000 would only be $20,000 - confirms the RMD, not the chosen rate, actually won.
    expect(expected.withdrawals[0]).toBeGreaterThan(20000);
  });
});
