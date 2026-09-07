import { render, screen, within } from '@testing-library/react';
import { ControlsPanel } from '@src/components/controls/ControlsPanel';
import { DEFAULT_BASE_RANGES, baseDefaults, type BaseInputs } from '@src/lib/baseData';
import { currentMonthlyPayment } from '@src/lib/mortgage';
import { formatCurrency, formatCurrencyCompact } from '@src/lib/format';
import type { Answers } from '@src/lib/questions';

const BASE_INPUTS: BaseInputs = {
  ...baseDefaults(DEFAULT_BASE_RANGES),
  homeValueK: 400,
  mortgageBalanceK: 300,
  currentMortgageRatePct: 6,
  mortgageTermYears: 30,
  mortgageInsuranceMo: 0,
  mortgageExtraPrincipalMo: 0,
  inflationPct: 3,
};

const NOOP_CONTROLS = {
  breakpoints: [],
  onAdd: jest.fn(),
  onRemove: jest.fn(),
  onUpdate: jest.fn(),
  jobLossYear: undefined,
  onSetJobLoss: jest.fn(),
  onClearJobLoss: jest.fn(),
};

function renderControlsPanel(answers: Answers, values: BaseInputs = BASE_INPUTS) {
  return render(
    <ControlsPanel
      answers={answers}
      onAnswer={jest.fn()}
      ranges={DEFAULT_BASE_RANGES}
      values={values}
      onChange={jest.fn()}
      primaryIncomeControls={NOOP_CONTROLS}
      partnerIncomeControls={NOOP_CONTROLS}
      childrenControls={{ kids: [], onAdd: jest.fn(), onRemove: jest.fn(), onUpdate: jest.fn() }}
    />,
  );
}

describe('ControlsPanel mortgage summary', () => {
  it('shows a mortgage summary block with monthly payment and remaining principal for an owner', () => {
    const { container } = renderControlsPanel({ housing: 'own' });

    const expectedPayment = currentMonthlyPayment({
      loanAmount: 300000,
      annualRatePct: 6,
      termYears: 30,
      homeValue: 400000,
      appreciationPct: 3,
      monthlyInsurance: 0,
      extraMonthlyPrincipal: 0,
    });

    const summary = container.querySelector('.mortgage-summary') as HTMLElement;
    expect(summary).toBeInTheDocument();
    expect(within(summary).getByText('Monthly payment')).toBeInTheDocument();
    expect(within(summary).getByText(`${formatCurrency(expectedPayment)}/mo`)).toBeInTheDocument();
    expect(within(summary).getByText('Remaining principal')).toBeInTheDocument();
    expect(within(summary).getByText(formatCurrencyCompact(300000))).toBeInTheDocument();
  });

  it('hides the mortgage summary block for a renter', () => {
    renderControlsPanel({ housing: 'rent' });

    expect(screen.queryByText('Monthly payment')).not.toBeInTheDocument();
    expect(screen.queryByText('Remaining principal')).not.toBeInTheDocument();
  });

  it('reflects a voluntary extra-principal payment in the summarized monthly payment', () => {
    renderControlsPanel({ housing: 'own' }, { ...BASE_INPUTS, mortgageExtraPrincipalMo: 300 });

    const expectedPayment = currentMonthlyPayment({
      loanAmount: 300000,
      annualRatePct: 6,
      termYears: 30,
      homeValue: 400000,
      appreciationPct: 3,
      monthlyInsurance: 0,
      extraMonthlyPrincipal: 300,
    });

    expect(screen.getByText(`${formatCurrency(expectedPayment)}/mo`)).toBeInTheDocument();
  });
});
