import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RetirementPage } from '@src/components/retirement/RetirementPage';
import { DEFAULT_BASE_RANGES, baseDefaults, type BaseInputs } from '@src/lib/baseData';
import {
  buildRetirementVerdict,
  projectedBalanceAtRetirement,
  projectHouseholdRetirementIncome,
  projectRetirementBalance,
  socialSecurityAdjustmentFactor,
} from '@src/lib/retirement';
import { formatCurrency, formatCurrencyCompact, formatSliderValue } from '@src/lib/format';
import type { Answers } from '@src/lib/questions';

// Mirrors RetirementPage.tsx's own dollar -> rate conversion, so tests can build the exact same
// expected projection the component itself would, regardless of which dollar figure a given test
// chooses to exercise - see retirement.test.ts's "dollar <-> rate equivalence" suite for the math
// itself.
function derivedRatePct(startingBalance: number, contributionMo: number, investmentReturnPct: number, targetYearOffset: number, withdrawalMo: number): number {
  const balanceAtRetirement = projectedBalanceAtRetirement(startingBalance, contributionMo, investmentReturnPct, targetYearOffset);
  return balanceAtRetirement > 0 ? ((withdrawalMo * 12) / balanceAtRetirement) * 100 : 0;
}

const BASE_INPUTS: BaseInputs = {
  ...baseDefaults(DEFAULT_BASE_RANGES),
  investmentReturnPct: 6,
  inflationPct: 3,
  retirementRothSavingsTodayK: 500,
  retirementRothContributionMo: 500,
  retirementRothWithdrawalMo: 5700,
  retirementTraditionalSavingsTodayK: 300,
  retirementTraditionalContributionMo: 500,
  retirementTraditionalWithdrawalMo: 3700,
  // ~4% of the after-tax balance projected at this test suite's own 20-year accumulation window
  // (currentAge 35 -> targetAge 55) - Defaults.json's own $900 default is calibrated to a 30-year
  // window (age 35 -> 65) instead, which would imply a much more aggressive ~7% rate here and
  // deplete this pot in tests that don't mean to exercise depletion at all.
  retirementAfterTaxWithdrawalMo: 500,
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
  it('renders separate Roth, Traditional, and after-tax groups, each with their own savings/contribution/withdrawal sliders', () => {
    renderRetirementPage();

    expect(screen.getByRole('button', { name: /^Roth$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Traditional$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^After-tax$/ })).toBeInTheDocument();
    expect(screen.getByText('Current Roth savings')).toBeInTheDocument();
    expect(screen.getByText('Current Traditional savings')).toBeInTheDocument();
    expect(screen.getByText('Current after-tax savings')).toBeInTheDocument();
    expect(screen.getAllByText('Monthly contribution')).toHaveLength(3);
    expect(screen.getAllByText('Initial monthly withdrawal')).toHaveLength(3);
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

  it('calls onChange with the right field id for the Roth vs Traditional monthly-withdrawal sliders', () => {
    const onChange = jest.fn();
    renderRetirementPage({ onChange });

    const [rothSlider, traditionalSlider] = screen.getAllByLabelText('Initial monthly withdrawal') as HTMLInputElement[];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

    setter?.call(rothSlider, '6000');
    rothSlider.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('retirementRothWithdrawalMo', 6000);

    setter?.call(traditionalSlider, '4000');
    traditionalSlider.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('retirementTraditionalWithdrawalMo', 4000);
  });

  describe('dollar-primary, rate-secondary withdrawal sliders', () => {
    it("shows the monthly dollar amount as the slider's primary value, with the equivalent initial withdrawal rate alongside it in parentheses", () => {
      renderRetirementPage();

      // currentAge 35, targetAge 55 -> targetYearOffset 20.
      const rothRatePct = derivedRatePct(500000, 500, 6, 20, 5700);
      const traditionalRatePct = derivedRatePct(300000, 500, 6, 20, 3700);

      const rothSlider = screen.getAllByLabelText('Initial monthly withdrawal')[0].closest('.slider-field');
      expect(rothSlider).toHaveTextContent(formatSliderValue(5700, '$'));
      expect(rothSlider).toHaveTextContent(`(${formatSliderValue(rothRatePct, '%')})`);

      const traditionalSlider = screen.getAllByLabelText('Initial monthly withdrawal')[1].closest('.slider-field');
      expect(traditionalSlider).toHaveTextContent(formatSliderValue(3700, '$'));
      expect(traditionalSlider).toHaveTextContent(`(${formatSliderValue(traditionalRatePct, '%')})`);
    });

    it('is a single slider, not a second interactive control, for the derived rate', () => {
      renderRetirementPage();

      // Exactly one range input per pot for the withdrawal field - "Initial monthly withdrawal" is
      // the only label, and the % shown alongside it is plain text, not another <input type="range">.
      expect(screen.getAllByLabelText('Initial monthly withdrawal')).toHaveLength(3);
      expect(screen.queryByLabelText(/Initial withdrawal rate/)).not.toBeInTheDocument();
    });

    it('the displayed rate recalculates as the dollar amount changes, tracking whatever balance is currently projected', () => {
      const lowRate = derivedRatePct(500000, 500, 6, 20, 1000);
      const highRate = derivedRatePct(500000, 500, 6, 20, 10000);
      expect(highRate).toBeGreaterThan(lowRate);

      const { rerender } = renderRetirementPage({ baseInputs: { ...BASE_INPUTS, retirementRothWithdrawalMo: 1000 } });
      let rothSlider = screen.getAllByLabelText('Initial monthly withdrawal')[0].closest('.slider-field');
      expect(rothSlider).toHaveTextContent(`(${formatSliderValue(lowRate, '%')})`);

      rerender(
        <RetirementPage
          baseInputs={{ ...BASE_INPUTS, retirementRothWithdrawalMo: 10000 }}
          ranges={DEFAULT_BASE_RANGES}
          onChange={jest.fn()}
          answers={{}}
          onAnswer={jest.fn()}
        />,
      );
      rothSlider = screen.getAllByLabelText('Initial monthly withdrawal')[0].closest('.slider-field');
      expect(rothSlider).toHaveTextContent(`(${formatSliderValue(highRate, '%')})`);
    });
  });

  it('renders the Social Security field alongside a filing-status toggle and a Social Security on/off toggle', () => {
    renderRetirementPage();

    expect(screen.getByText('Social Security benefit')).toBeInTheDocument();
    expect(screen.getByText('Filing status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Single' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Married' })).toBeInTheDocument();
    expect(screen.getByText('Social Security', { selector: '.housing-toggle__label' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'On' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Off' })).toBeInTheDocument();
  });

  describe('Social Security start age', () => {
    it('renders the field and calls onChange with its field id when dragged', () => {
      const onChange = jest.fn();
      renderRetirementPage({ onChange });

      const startAgeSlider = screen.getByLabelText('Social Security start age') as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(startAgeSlider, '70');
      startAgeSlider.dispatchEvent(new Event('change', { bubbles: true }));

      expect(onChange).toHaveBeenCalledWith('retirementSocialSecurityStartAge', 70);
    });

    it('defaults to full retirement age (67)', () => {
      renderRetirementPage();
      const startAgeSlider = screen.getByLabelText('Social Security start age') as HTMLInputElement;
      expect(startAgeSlider.value).toBe('67');
    });

    it('disables the start-age slider once Social Security is turned off, same as the benefit slider', () => {
      renderRetirementPage({ answers: { socialSecurityEnabled: false } as Answers });
      const startAgeSlider = screen.getByLabelText('Social Security start age') as HTMLInputElement;
      expect(startAgeSlider).toBeDisabled();
    });

    it("its tooltip links to ssa.gov's delayed retirement credits page", async () => {
      const user = userEvent.setup();
      renderRetirementPage();

      await user.hover(screen.getByText('Social Security start age'));
      const tooltip = await screen.findByRole('tooltip');
      const link = tooltip.querySelector('a');
      expect(link).not.toBeNull();
      expect(link).toHaveAttribute('href', 'https://www.ssa.gov/benefits/retirement/planner/delayret.html');
      expect(tooltip).toHaveTextContent(/delayed retirement credits/i);
    });

    it.each([
      [62, 'earlier than full retirement age', socialSecurityAdjustmentFactor(62)],
      [67, 'at full retirement age', socialSecurityAdjustmentFactor(67)],
      [70, 'later than full retirement age', socialSecurityAdjustmentFactor(70)],
    ])('claiming at %i (%s) scales the shown Social Security income by the real SSA adjustment factor', (startAge, _label, factor) => {
      // currentAge = targetAge = inspectAge = 75, past every possible startAge in [62, 70] - so
      // Social Security has already started regardless of which one is chosen, isolating the
      // adjustment-factor effect from any start-timing difference.
      const alreadyRetired = {
        ...BASE_INPUTS,
        retirementCurrentAge: 75,
        retirementTargetAge: 75,
        retirementInspectAge: 75,
        retirementSocialSecurityStartAge: startAge,
      };
      renderRetirementPage({ baseInputs: alreadyRetired });

      const expected = formatCurrency(BASE_INPUTS.retirementSocialSecurityMo * 12 * factor);
      const ssRow = screen.getByText('Social Security, gross').closest('tr');
      expect(ssRow).toHaveTextContent(`${expected}/yr`);
    });
  });

  describe('Social Security on/off toggle', () => {
    it('defaults to On when unanswered, and the benefit slider is enabled', () => {
      renderRetirementPage();

      expect(screen.getByRole('button', { name: 'On' })).toHaveClass('chart-toggle__tab--active');
      const ssSlider = screen.getByLabelText('Social Security benefit') as HTMLInputElement;
      expect(ssSlider).not.toBeDisabled();
    });

    it('calls onAnswer with socialSecurityEnabled=false when Off is clicked', async () => {
      const user = userEvent.setup();
      const onAnswer = jest.fn();
      renderRetirementPage({ onAnswer });

      await user.click(screen.getByRole('button', { name: 'Off' }));
      expect(onAnswer).toHaveBeenCalledWith('socialSecurityEnabled', false);
    });

    it('calls onAnswer with socialSecurityEnabled=true when On is clicked from an off state', async () => {
      const user = userEvent.setup();
      const onAnswer = jest.fn();
      renderRetirementPage({ onAnswer, answers: { socialSecurityEnabled: false } as Answers });

      await user.click(screen.getByRole('button', { name: 'On' }));
      expect(onAnswer).toHaveBeenCalledWith('socialSecurityEnabled', true);
    });

    it('disables the benefit slider once turned off', () => {
      renderRetirementPage({ answers: { socialSecurityEnabled: false } as Answers });

      expect(screen.getByRole('button', { name: 'Off' })).toHaveClass('chart-toggle__tab--active');
      const ssSlider = screen.getByLabelText('Social Security benefit') as HTMLInputElement;
      expect(ssSlider).toBeDisabled();
    });

    it('drops Social Security from the income breakdown table entirely when off, rather than showing a $0 line', () => {
      renderRetirementPage({ answers: { socialSecurityEnabled: false } as Answers });

      expect(screen.getByText('Age 55 detail')).toBeInTheDocument();
      expect(screen.queryByText('Social Security, gross')).not.toBeInTheDocument();
      expect(screen.queryByText('— of which taxable Social Security')).not.toBeInTheDocument();
    });

    it('still shows Social Security, gross when on', () => {
      renderRetirementPage();
      expect(screen.getByText('Social Security, gross')).toBeInTheDocument();
    });

    it('contributes $0 to estimated income once turned off, even though the benefit slider still holds a nonzero value', () => {
      // Social Security start age set to match currentAge so it's actually active at the inspected
      // age immediately, rather than waiting for the default (full retirement age, 67).
      const alreadyRetired = {
        ...BASE_INPUTS,
        retirementCurrentAge: 65,
        retirementTargetAge: 65,
        retirementInspectAge: 65,
        retirementSocialSecurityStartAge: 65,
      };

      const onWithoutSS = renderRetirementPage({ baseInputs: alreadyRetired, answers: { socialSecurityEnabled: false } as Answers });
      const incomeWithoutSS = screen.getByText('Estimated income, inspect age').closest('.metric-card')?.querySelector('.metric-card__value')
        ?.textContent;
      onWithoutSS.unmount();

      renderRetirementPage({ baseInputs: alreadyRetired, answers: { socialSecurityEnabled: true } as Answers });
      const incomeWithSS = screen.getByText('Estimated income, inspect age').closest('.metric-card')?.querySelector('.metric-card__value')
        ?.textContent;

      // The stored benefit slider value ($2,000/mo) is unchanged between the two renders - only the
      // toggle differs - so a lower net income with SS off confirms it's actually excluded from the
      // model, not just hidden from the table.
      expect(incomeWithoutSS).not.toBe(incomeWithSS);
    });
  });

  describe('Social Security withdrawal bridge toggle', () => {
    // BASE_INPUTS retires at 55 (currentAge 35), well before Social Security's earliest claiming
    // age of 62 - a real gap to bridge, so the toggle should be offered.
    it('is offered when retiring before Social Security starts', () => {
      renderRetirementPage();
      expect(screen.getByText('Reduce Traditional withdrawals once Social Security starts')).toBeInTheDocument();
    });

    it('is not offered once Social Security is turned off entirely - there is nothing to bridge to', () => {
      renderRetirementPage({ answers: { socialSecurityEnabled: false } as Answers });
      expect(screen.queryByText('Reduce Traditional withdrawals once Social Security starts')).not.toBeInTheDocument();
    });

    it('is not offered when retiring at or after Social Security already starts - no gap to bridge', () => {
      const alreadyRetired = {
        ...BASE_INPUTS,
        retirementCurrentAge: 65,
        retirementTargetAge: 65,
        retirementInspectAge: 65,
        retirementSocialSecurityStartAge: 65,
      };
      renderRetirementPage({ baseInputs: alreadyRetired });
      expect(screen.queryByText('Reduce Traditional withdrawals once Social Security starts')).not.toBeInTheDocument();
    });

    it('defaults to Off when unanswered', () => {
      renderRetirementPage();
      expect(screen.getByRole('button', { name: 'Disable Social Security bridge' })).toHaveClass('chart-toggle__tab--active');
    });

    it('calls onAnswer with ssWithdrawalBridgeEnabled=true when On is clicked', async () => {
      const user = userEvent.setup();
      const onAnswer = jest.fn();
      renderRetirementPage({ onAnswer });

      await user.click(screen.getByRole('button', { name: 'Enable Social Security bridge' }));
      expect(onAnswer).toHaveBeenCalledWith('ssWithdrawalBridgeEnabled', true);
    });

    it('calls onAnswer with ssWithdrawalBridgeEnabled=false when Off is clicked from an on state', async () => {
      const user = userEvent.setup();
      const onAnswer = jest.fn();
      renderRetirementPage({ onAnswer, answers: { ssWithdrawalBridgeEnabled: true } as Answers });

      await user.click(screen.getByRole('button', { name: 'Disable Social Security bridge' }));
      expect(onAnswer).toHaveBeenCalledWith('ssWithdrawalBridgeEnabled', false);
    });

    it('reduces the Traditional withdrawal once Social Security starts, once enabled', () => {
      // Social Security explicitly set to start at 62, inspected at that same age - the year Social
      // Security (and the bridge's cutback) actually kicks in for this 35 -> 55 retiree.
      const atSsStart = { ...BASE_INPUTS, retirementInspectAge: 62, retirementSocialSecurityStartAge: 62 };

      const off = renderRetirementPage({ baseInputs: atSsStart });
      const withdrawalOff = screen.getByText('Traditional withdrawal, gross').closest('tr')?.textContent;
      off.unmount();

      renderRetirementPage({ baseInputs: atSsStart, answers: { ssWithdrawalBridgeEnabled: true } as Answers });
      const withdrawalOn = screen.getByText('Traditional withdrawal, gross').closest('tr')?.textContent;

      expect(withdrawalOn).not.toBe(withdrawalOff);
    });

    it('leaves the Traditional withdrawal unaffected before Social Security starts, even when enabled', () => {
      // Inspect age 55 (retirement itself) is still well before SS starts at 62 - the bridge has
      // nothing to cut back yet.
      const off = renderRetirementPage();
      const withdrawalOff = screen.getByText('Traditional withdrawal, gross').closest('tr')?.textContent;
      off.unmount();

      renderRetirementPage({ answers: { ssWithdrawalBridgeEnabled: true } as Answers });
      const withdrawalOn = screen.getByText('Traditional withdrawal, gross').closest('tr')?.textContent;

      expect(withdrawalOn).toBe(withdrawalOff);
    });
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
    const rothRatePct = derivedRatePct(500000, 500, 6, 20, 5700);
    const traditionalRatePct = derivedRatePct(300000, 500, 6, 20, 3700);
    const afterTaxRatePct = derivedRatePct(50000, 0, 6, 20, BASE_INPUTS.retirementAfterTaxWithdrawalMo);
    const roth = projectRetirementBalance(500000, 500, 6, 20, 65, rothRatePct, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 65, traditionalRatePct, 3);
    const afterTax = projectRetirementBalance(50000, 0, 6, 20, 65, afterTaxRatePct, 3);
    const combined = roth.balances[20] + traditional.balances[20] + afterTax.balances[20];

    expect(screen.getByText('Total balance, inspect age')).toBeInTheDocument();
    expect(container.querySelector('.metric-card__value')).toHaveTextContent(formatCurrencyCompact(combined));
  });

  it("shows net estimated income, nominal and in today's dollars, matching projectHouseholdRetirementIncome at the inspected age", () => {
    renderRetirementPage();

    // currentAge 35 -> finalYear = MAX_PROJECTION_AGE(100) - 35 = 65.
    const rothRatePct = derivedRatePct(500000, 500, 6, 20, 5700);
    const traditionalRatePct = derivedRatePct(300000, 500, 6, 20, 3700);
    const afterTaxRatePct = derivedRatePct(50000, 0, 6, 20, BASE_INPUTS.retirementAfterTaxWithdrawalMo);
    const roth = projectRetirementBalance(500000, 500, 6, 20, 65, rothRatePct, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 65, traditionalRatePct, 3);
    const afterTax = projectRetirementBalance(50000, 0, 6, 20, 65, afterTaxRatePct, 3);
    const income = projectHouseholdRetirementIncome({
      rothProjection: roth,
      traditionalProjection: traditional,
      afterTaxProjection: afterTax,
      afterTaxGainPct: 50,
      pensionMonthlyToday: 0,
      pensionStartAge: 65,
      ssMonthlyBenefitToday: 2000,
      ssStartAge: BASE_INPUTS.retirementSocialSecurityStartAge,
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
    const rothRatePct = derivedRatePct(500000, 500, 6, 20, 5700);
    const traditionalRatePct = derivedRatePct(300000, 500, 6, 20, 3700);
    const afterTaxRatePct = derivedRatePct(50000, 0, 6, 20, BASE_INPUTS.retirementAfterTaxWithdrawalMo);
    const roth = projectRetirementBalance(500000, 500, 6, 20, 65, rothRatePct, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 65, traditionalRatePct, 3);
    const afterTax = projectRetirementBalance(50000, 0, 6, 20, 65, afterTaxRatePct, 3);
    const series = projectHouseholdRetirementIncome({
      rothProjection: roth,
      traditionalProjection: traditional,
      afterTaxProjection: afterTax,
      afterTaxGainPct: 50,
      pensionMonthlyToday: 0,
      pensionStartAge: 65,
      ssMonthlyBenefitToday: 2000,
      ssStartAge: BASE_INPUTS.retirementSocialSecurityStartAge,
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

  it("shows each pot's current-year withdrawal as a % of its balance alongside the dollar figure, matching effectiveWithdrawalRatePct", () => {
    renderRetirementPage();

    // currentAge 35 -> finalYear = MAX_PROJECTION_AGE(100) - 35 = 65. Inspect index 20 = age 55.
    const rothRatePct = derivedRatePct(500000, 500, 6, 20, 5700);
    const traditionalRatePct = derivedRatePct(300000, 500, 6, 20, 3700);
    const roth = projectRetirementBalance(500000, 500, 6, 20, 65, rothRatePct, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 65, traditionalRatePct, 3, { currentAge: 35 });

    const rothRow = screen.getByText('Roth withdrawal').closest('tr');
    expect(rothRow).toHaveTextContent(formatSliderValue(roth.effectiveWithdrawalRatePct[20], '%'));
    const traditionalRow = screen.getByText('Traditional withdrawal, gross').closest('tr');
    expect(traditionalRow).toHaveTextContent(formatSliderValue(traditional.effectiveWithdrawalRatePct[20], '%'));
  });

  it('the displayed withdrawal-rate % drifts away from the Initial monthly withdrawal input over time, since the withdrawal grows with inflation but the balance follows investment return instead', () => {
    renderRetirementPage({ baseInputs: { ...BASE_INPUTS, retirementInspectAge: 90 } });

    // Age 90 is deep into decumulation - the initial ~4% rate implied by the $5,700/mo Roth target
    // should no longer be what's shown, since the withdrawal itself has compounded with inflation
    // for 35 years by then.
    const initialRatePct = derivedRatePct(500000, 500, 6, 20, 5700);
    const rothRow = screen.getByText('Roth withdrawal').closest('tr');
    expect(rothRow).not.toHaveTextContent(formatSliderValue(initialRatePct, '%'));
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
    const rothRatePct = derivedRatePct(500000, 500, 6, 20, 5700);
    const traditionalRatePct = derivedRatePct(300000, 500, 6, 20, 3700);
    const afterTaxRatePct = derivedRatePct(50000, 0, 6, 20, BASE_INPUTS.retirementAfterTaxWithdrawalMo);
    const roth = projectRetirementBalance(500000, 500, 6, 20, 65, rothRatePct, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 65, traditionalRatePct, 3);
    const afterTax = projectRetirementBalance(50000, 0, 6, 20, 65, afterTaxRatePct, 3);
    const income = projectHouseholdRetirementIncome({
      rothProjection: roth,
      traditionalProjection: traditional,
      afterTaxProjection: afterTax,
      afterTaxGainPct: 50,
      pensionMonthlyToday: 0,
      pensionStartAge: 65,
      ssMonthlyBenefitToday: 2000,
      ssStartAge: BASE_INPUTS.retirementSocialSecurityStartAge,
      currentAge: 35,
      filingStatus: 'marriedJoint',
      inflationPct: 3,
    })[20];

    expect(screen.getByText(`${formatCurrency(income.netMonthlyNominal)}/mo`)).toBeInTheDocument();
  });

  it('shows a verdict banner reflecting whether the savings last, matching buildRetirementVerdict', () => {
    renderRetirementPage();

    // currentAge 35 -> finalYear = MAX_PROJECTION_AGE(100) - 35 = 65.
    const rothRatePct = derivedRatePct(500000, 500, 6, 20, 5700);
    const traditionalRatePct = derivedRatePct(300000, 500, 6, 20, 3700);
    const afterTaxRatePct = derivedRatePct(50000, 0, 6, 20, BASE_INPUTS.retirementAfterTaxWithdrawalMo);
    const roth = projectRetirementBalance(500000, 500, 6, 20, 65, rothRatePct, 3);
    const traditional = projectRetirementBalance(300000, 500, 6, 20, 65, traditionalRatePct, 3);
    const afterTax = projectRetirementBalance(50000, 0, 6, 20, 65, afterTaxRatePct, 3);
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
        retirementRothWithdrawalMo: 250,
        retirementTraditionalSavingsTodayK: 10,
        retirementTraditionalContributionMo: 0,
        retirementTraditionalWithdrawalMo: 250,
        retirementAfterTaxSavingsTodayK: 10,
        retirementAfterTaxContributionMo: 0,
        retirementAfterTaxWithdrawalMo: 250,
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
        retirementRothWithdrawalMo: 250,
      },
    });

    expect(document.querySelector('.verdict-banner--warning')).toBeInTheDocument();
    expect(screen.getByText(/Roth runs out/)).toBeInTheDocument();
  });

  it('shows a clear early-withdrawal-penalty warning banner when retiring before age 60 with a Traditional withdrawal', () => {
    // BASE_INPUTS retires at 55 (< 60) with a nonzero Traditional balance/withdrawal by default.
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
        retirementSocialSecurityStartAge: 62,
      },
    });

    expect(screen.getByText('Age 55 detail')).toBeInTheDocument();
    const ssRow = screen.getByText('Social Security, gross').closest('tr');
    expect(ssRow).toHaveTextContent('$0/yr');
  });

  it('forces a Traditional withdrawal at least as large as the Required Minimum Distribution once age reaches 73', () => {
    // A ~2%-equivalent withdrawal target would normally take ~2% of the balance; at age 73 the RMD
    // (balance / 26.5) is much larger and should win instead.
    renderRetirementPage({
      baseInputs: {
        ...BASE_INPUTS,
        retirementTraditionalSavingsTodayK: 1000,
        retirementTraditionalContributionMo: 0,
        // targetYearOffset is 0 here (currentAge == targetAge), so balanceAtRetirement is exactly
        // the $1,000,000 starting balance - (1,000,000 * 2%) / 12 reproduces a ~2% initial rate.
        retirementTraditionalWithdrawalMo: (1000000 * 0.02) / 12,
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
