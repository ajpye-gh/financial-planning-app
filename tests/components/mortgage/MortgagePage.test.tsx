import { render, screen, within } from '@testing-library/react';
import { MortgagePage } from '@src/components/mortgage/MortgagePage';
import { DEFAULT_BASE_RANGES, baseDefaults, type BaseInputs } from '@src/lib/baseData';
import { buildAmortizationSchedule, currentMonthlyPayment, formatPayoffDate } from '@src/lib/mortgage';
import { formatCurrency, formatCurrencyCompact } from '@src/lib/format';
import type { Answers } from '@src/lib/questions';

const OWNS_HOME: Answers = { housing: 'own' };
const RENTS: Answers = { housing: 'rent' };

const BASE_INPUTS: BaseInputs = {
  ...baseDefaults(DEFAULT_BASE_RANGES),
  homeValueK: 400,
  mortgageBalanceK: 300,
  currentMortgageRatePct: 6,
  mortgageTermYears: 30,
  mortgageInsuranceMo: 0,
  propertyTaxMo: 0,
  homeInsuranceMo: 0,
  mortgageExtraPrincipalMo: 0,
  inflationPct: 3,
};

function renderMortgagePage(overrides: Partial<Parameters<typeof MortgagePage>[0]> = {}) {
  return render(
    <MortgagePage baseInputs={BASE_INPUTS} ranges={DEFAULT_BASE_RANGES} onChange={jest.fn()} answers={OWNS_HOME} {...overrides} />,
  );
}

describe('MortgagePage', () => {
  it('renders the mortgage sidebar fields: home value, balance, rate, and term', () => {
    renderMortgagePage();

    expect(screen.getByRole('button', { name: /Mortgage/ })).toBeInTheDocument();
    expect(screen.getByText('Home value (current)')).toBeInTheDocument();
    expect(screen.getByText('Mortgage balance (current)')).toBeInTheDocument();
    expect(screen.getByText('Mortgage rate (current)')).toBeInTheDocument();
    expect(screen.getByText('Loan term')).toBeInTheDocument();
  });

  it('renders property tax, home insurance, and PMI sliders under Taxes & insurance', () => {
    renderMortgagePage();

    expect(screen.getByRole('button', { name: /Taxes & insurance/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Property tax')).toBeInTheDocument();
    expect(screen.getByLabelText('Homeowners insurance')).toBeInTheDocument();
    expect(screen.getByLabelText('Mortgage insurance')).toBeInTheDocument();
  });

  it('renders the extra-principal slider under its own Extra payments group', () => {
    renderMortgagePage();

    expect(screen.getByRole('button', { name: /Extra payments/ })).toBeInTheDocument();
    expect(screen.getByText('Extra principal /mo')).toBeInTheDocument();
  });

  it('renders the shared Inflation assumption, but not Investment return (irrelevant to a mortgage)', () => {
    renderMortgagePage();

    expect(screen.getByRole('button', { name: /Assumptions/ })).toBeInTheDocument();
    expect(screen.getByText('Inflation')).toBeInTheDocument();
    expect(screen.queryByText('Investment return')).not.toBeInTheDocument();
  });

  it('calls onChange with the right field id when the extra-principal slider is dragged', () => {
    const onChange = jest.fn();
    renderMortgagePage({ onChange });

    const slider = screen.getByLabelText('Extra principal /mo') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(slider, '300');
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith('mortgageExtraPrincipalMo', 300);
  });

  it('calls onChange with the right field id when the loan-term slider is dragged', () => {
    const onChange = jest.fn();
    renderMortgagePage({ onChange });

    const slider = screen.getByLabelText('Loan term') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(slider, '15');
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith('mortgageTermYears', 15);
  });

  it('shows the current monthly payment, matching currentMonthlyPayment', () => {
    const { container } = renderMortgagePage();

    const expectedPayment = currentMonthlyPayment({
      loanAmount: 300000,
      annualRatePct: 6,
      termYears: 30,
      homeValue: 400000,
      appreciationPct: 3,
      monthlyInsurance: 0,
      extraMonthlyPrincipal: 0,
    });

    const metricRow = container.querySelector('.metric-row') as HTMLElement;
    expect(within(metricRow).getByText('Current monthly payment')).toBeInTheDocument();
    expect(within(metricRow).getByText(`${formatCurrency(expectedPayment)}/mo`)).toBeInTheDocument();
  });

  it('folds property tax and home insurance into the current monthly payment', () => {
    const { container } = renderMortgagePage({
      baseInputs: { ...BASE_INPUTS, propertyTaxMo: 300, homeInsuranceMo: 120 },
    });

    const expectedPayment = currentMonthlyPayment({
      loanAmount: 300000,
      annualRatePct: 6,
      termYears: 30,
      homeValue: 400000,
      appreciationPct: 3,
      monthlyInsurance: 0,
      monthlyPropertyTax: 300,
      monthlyHomeInsurance: 120,
      extraMonthlyPrincipal: 0,
    });

    const metricRow = container.querySelector('.metric-row') as HTMLElement;
    expect(within(metricRow).getByText(`${formatCurrency(expectedPayment)}/mo`)).toBeInTheDocument();
  });

  it('shows property tax and home insurance amounts in the loan summary, and "None" when unset', () => {
    const { container, rerender } = renderMortgagePage();

    const table = container.querySelector('.breakdown-table-wrap') as HTMLElement;
    expect(within(table).getByText('Property tax')).toBeInTheDocument();
    expect(within(table).getByText('Homeowners insurance')).toBeInTheDocument();

    rerender(
      <MortgagePage
        baseInputs={{ ...BASE_INPUTS, propertyTaxMo: 300, homeInsuranceMo: 120 }}
        ranges={DEFAULT_BASE_RANGES}
        onChange={jest.fn()}
        answers={OWNS_HOME}
      />,
    );
    expect(within(table).getByText(`${formatCurrency(300)}/mo`)).toBeInTheDocument();
    expect(within(table).getByText(`${formatCurrency(120)}/mo`)).toBeInTheDocument();
  });

  it("shows remaining principal as today's mortgage balance", () => {
    const { container } = renderMortgagePage();

    const metricRow = container.querySelector('.metric-row') as HTMLElement;
    expect(within(metricRow).getByText('Remaining principal')).toBeInTheDocument();
    expect(within(metricRow).getByText(formatCurrencyCompact(300000))).toBeInTheDocument();
  });

  it('shows a payoff date matching the amortization schedule', () => {
    renderMortgagePage();

    const schedule = buildAmortizationSchedule({
      loanAmount: 300000,
      annualRatePct: 6,
      termYears: 30,
      homeValue: 400000,
      appreciationPct: 3,
      monthlyInsurance: 0,
    });

    expect(screen.getByText('Payoff date')).toBeInTheDocument();
    expect(screen.getByText(formatPayoffDate(schedule.payoffMonths))).toBeInTheDocument();
  });

  it('does not show a second "payoff date, with extra" metric when no extra payment is set', () => {
    renderMortgagePage();
    expect(screen.queryByText('Payoff date, with extra')).not.toBeInTheDocument();
  });

  it('shows a second, earlier payoff date once an extra payment is set', () => {
    renderMortgagePage({ baseInputs: { ...BASE_INPUTS, mortgageExtraPrincipalMo: 500 } });

    const original = buildAmortizationSchedule({
      loanAmount: 300000,
      annualRatePct: 6,
      termYears: 30,
      homeValue: 400000,
      appreciationPct: 3,
      monthlyInsurance: 0,
    });
    const withExtra = buildAmortizationSchedule({
      loanAmount: 300000,
      annualRatePct: 6,
      termYears: 30,
      homeValue: 400000,
      appreciationPct: 3,
      monthlyInsurance: 0,
      extraMonthlyPrincipal: 500,
    });

    expect(screen.getByText('Payoff date, with extra')).toBeInTheDocument();
    expect(withExtra.payoffMonths).toBeLessThan(original.payoffMonths);
  });

  it('renders a loan summary table with P&I, insurance, and total interest figures', () => {
    const { container } = renderMortgagePage();

    const table = container.querySelector('.breakdown-table-wrap') as HTMLElement;
    expect(screen.getByText('Loan summary')).toBeInTheDocument();
    expect(within(table).getByText('Principal & interest')).toBeInTheDocument();
    expect(within(table).getByText('Mortgage insurance')).toBeInTheDocument();
    expect(within(table).getAllByText('None').length).toBeGreaterThan(0);
    expect(within(table).getByText('Total interest, original schedule')).toBeInTheDocument();
  });

  it('shows an "interest saved" line only once an extra payment is set', () => {
    const { rerender } = renderMortgagePage();
    expect(screen.queryByText('Interest saved')).not.toBeInTheDocument();

    rerender(
      <MortgagePage
        baseInputs={{ ...BASE_INPUTS, mortgageExtraPrincipalMo: 500 }}
        ranges={DEFAULT_BASE_RANGES}
        onChange={jest.fn()}
        answers={OWNS_HOME}
      />,
    );
    expect(screen.getByText('Interest saved')).toBeInTheDocument();
  });

  it('renders the mortgage balance chart', () => {
    const { container } = renderMortgagePage();
    expect(container.querySelector('.cashflow-chart__svg')).toBeInTheDocument();
    expect(screen.getByText('Original schedule')).toBeInTheDocument();
  });

  it('shows a renter empty state instead of the calculator when housing is not "own"', () => {
    renderMortgagePage({ answers: RENTS });

    expect(screen.getByText(/mortgage calculator applies once you own a home/)).toBeInTheDocument();
    expect(screen.queryByText('Home value (current)')).not.toBeInTheDocument();
    expect(screen.queryByText('Current monthly payment')).not.toBeInTheDocument();
  });
});
