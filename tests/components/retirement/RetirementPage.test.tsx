import { render, screen } from '@testing-library/react';
import { RetirementPage } from '@src/components/retirement/RetirementPage';
import { DEFAULT_BASE_RANGES, baseDefaults } from '@src/lib/baseData';
import { projectRetirementBalance } from '@src/lib/retirement';
import { formatCurrencyCompact } from '@src/lib/format';

const BASE_INPUTS = {
  ...baseDefaults(DEFAULT_BASE_RANGES),
  investmentReturnPct: 6,
  retirementSavingsTodayK: 100,
  retirementContributionMo: 1000,
  retirementTargetYear: 20,
};

describe('RetirementPage', () => {
  it('renders the sidebar inputs and the target-year slider', () => {
    render(<RetirementPage baseInputs={BASE_INPUTS} ranges={DEFAULT_BASE_RANGES} onChange={jest.fn()} />);

    expect(screen.getByText('Current retirement savings')).toBeInTheDocument();
    expect(screen.getByText('Monthly contribution')).toBeInTheDocument();
    expect(screen.getByText('Target year')).toBeInTheDocument();
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
});
