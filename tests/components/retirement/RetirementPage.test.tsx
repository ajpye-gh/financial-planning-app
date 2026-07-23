import { render, screen } from '@testing-library/react';
import { RetirementPage } from '@src/components/retirement/RetirementPage';
import { DEFAULT_BASE_RANGES, baseDefaults } from '@src/lib/baseData';
import { estimateRetirementIncome, projectRetirementBalance } from '@src/lib/retirement';
import { formatCurrency, formatCurrencyCompact } from '@src/lib/format';

const BASE_INPUTS = {
  ...baseDefaults(DEFAULT_BASE_RANGES),
  investmentReturnPct: 6,
  inflationPct: 3,
  retirementSavingsTodayK: 100,
  retirementContributionMo: 1000,
  retirementTargetYear: 20,
  retirementWithdrawalRatePct: 4,
};

describe('RetirementPage', () => {
  it('renders the sidebar inputs and the target-year slider', () => {
    render(<RetirementPage baseInputs={BASE_INPUTS} ranges={DEFAULT_BASE_RANGES} onChange={jest.fn()} />);

    expect(screen.getByText('Current retirement savings')).toBeInTheDocument();
    expect(screen.getByText('Monthly contribution')).toBeInTheDocument();
    expect(screen.getByText('Target year')).toBeInTheDocument();
    expect(screen.getByText('Withdrawal rate')).toBeInTheDocument();
  });

  it('calls onChange with the field id when the withdrawal-rate slider is dragged', () => {
    const onChange = jest.fn();
    render(<RetirementPage baseInputs={BASE_INPUTS} ranges={DEFAULT_BASE_RANGES} onChange={onChange} />);

    const slider = screen.getByLabelText('Withdrawal rate') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(slider, '5');
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith('retirementWithdrawalRatePct', 5);
  });

  it('renders the shared Assumptions group (inflation, investment return) in the sidebar', () => {
    render(<RetirementPage baseInputs={BASE_INPUTS} ranges={DEFAULT_BASE_RANGES} onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: /Assumptions/ })).toBeInTheDocument();
    expect(screen.getByText('Inflation')).toBeInTheDocument();
    expect(screen.getByText('Investment return')).toBeInTheDocument();
  });

  it('calls onChange with the field id when the investment-return slider (shared with the primary page) changes', () => {
    const onChange = jest.fn();
    render(<RetirementPage baseInputs={BASE_INPUTS} ranges={DEFAULT_BASE_RANGES} onChange={onChange} />);

    const slider = screen.getByLabelText('Investment return') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(slider, '8');
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith('investmentReturnPct', 8);
  });

  it('calls onChange with the field id when a slider is dragged', () => {
    const onChange = jest.fn();
    render(<RetirementPage baseInputs={BASE_INPUTS} ranges={DEFAULT_BASE_RANGES} onChange={onChange} />);

    const slider = screen.getByLabelText('Target year') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(slider, '25');
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith('retirementTargetYear', 25);
  });

  it('shows the projected balance at the target year, matching projectRetirementBalance', () => {
    const { container } = render(<RetirementPage baseInputs={BASE_INPUTS} ranges={DEFAULT_BASE_RANGES} onChange={jest.fn()} />);

    const projection = projectRetirementBalance(100000, 1000, 6, 20);
    const expected = formatCurrencyCompact(projection.balances.at(-1) ?? 0);

    expect(screen.getByText('Projected balance, year 20')).toBeInTheDocument();
    expect(container.querySelector('.metric-card__value')).toHaveTextContent(expected);
  });

  it("shows estimated retirement income, nominal and in today's dollars, matching estimateRetirementIncome", () => {
    render(<RetirementPage baseInputs={BASE_INPUTS} ranges={DEFAULT_BASE_RANGES} onChange={jest.fn()} />);

    const projection = projectRetirementBalance(100000, 1000, 6, 20);
    const income = estimateRetirementIncome(projection.balances.at(-1) ?? 0, 4, 3, 20);

    expect(screen.getByText('Estimated income, year 20')).toBeInTheDocument();
    expect(screen.getByText(`${formatCurrency(income.monthlyIncomeNominal)}/mo`)).toBeInTheDocument();

    expect(screen.getByText("— in today's dollars")).toBeInTheDocument();
    expect(screen.getByText(`${formatCurrency(income.monthlyIncomeReal)}/mo`)).toBeInTheDocument();
  });
});
