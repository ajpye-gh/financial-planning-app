import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CashflowChart } from '@src/components/results/CashflowChart';
import type { ChartSeries } from '@src/lib/model';
import type { PrimarySeries } from '@src/lib/chartSeries';

const CHART: ChartSeries = {
  yearLabels: ['Y1', 'Y2', 'Y3'],
  unallocatedSavings: [10000, 20000, 30000],
  freeCash: [100, 200, 300],
  goalBalances: {},
};

const PRIMARY: PrimarySeries = {
  label: 'College savings',
  values: [1000, 2000, 3000],
  targetAmount: 80000,
};

describe('CashflowChart legend', () => {
  it('renders an entry per series, including target only when the goal has one', () => {
    const { container } = render(<CashflowChart chart={CHART} primary={PRIMARY} />);

    expect(screen.getByRole('button', { name: /Unallocated savings/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'College savings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Monthly free cash/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'College savings target' })).toBeInTheDocument();

    expect(container.querySelector('.cashflow-chart__line--unallocated')).not.toBeNull();
    expect(container.querySelector('.cashflow-chart__line--primary')).not.toBeNull();
    expect(container.querySelector('.cashflow-chart__line--cash')).not.toBeNull();
    expect(container.querySelector('.cashflow-chart__line--target')).not.toBeNull();
  });

  it('omits the target legend entry when the goal has no target', () => {
    render(<CashflowChart chart={CHART} primary={{ ...PRIMARY, targetAmount: undefined }} />);
    expect(screen.queryByRole('button', { name: /target/ })).not.toBeInTheDocument();
  });

  it('omits the primary legend entry entirely when no goal is selected', () => {
    render(<CashflowChart chart={CHART} primary={{ label: '', values: [] }} />);
    expect(screen.queryByRole('button', { name: 'College savings' })).not.toBeInTheDocument();
  });

  it('clicking a legend entry hides its line and axis labels, and clicking again restores them', async () => {
    const user = userEvent.setup();
    const { container } = render(<CashflowChart chart={CHART} primary={PRIMARY} />);

    const unallocatedButton = screen.getByRole('button', { name: /Unallocated savings/ });
    expect(unallocatedButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(unallocatedButton);
    expect(unallocatedButton).toHaveAttribute('aria-pressed', 'true');
    expect(unallocatedButton).toHaveClass('cashflow-chart__legend-item--hidden');
    expect(container.querySelector('.cashflow-chart__line--unallocated')).toBeNull();
    expect(container.querySelector('.cashflow-chart__axis-label--unallocated')).toBeNull();
    // Other series are unaffected.
    expect(container.querySelector('.cashflow-chart__line--primary')).not.toBeNull();

    await user.click(unallocatedButton);
    expect(unallocatedButton).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelector('.cashflow-chart__line--unallocated')).not.toBeNull();
    expect(container.querySelector('.cashflow-chart__axis-label--unallocated')).not.toBeNull();
  });

  it('hides only the target line when the target legend entry is toggled off', async () => {
    const user = userEvent.setup();
    const { container } = render(<CashflowChart chart={CHART} primary={PRIMARY} />);

    await user.click(screen.getByRole('button', { name: 'College savings target' }));

    expect(container.querySelector('.cashflow-chart__line--target')).toBeNull();
    expect(container.querySelector('.cashflow-chart__line--primary')).not.toBeNull();
  });

  it('hides the $0 reference line and its shaded region along with the free cash line', async () => {
    const user = userEvent.setup();
    const negativeChart: ChartSeries = { ...CHART, freeCash: [100, -50, 300] };
    const { container } = render(<CashflowChart chart={negativeChart} primary={PRIMARY} />);

    expect(container.querySelector('.cashflow-chart__line--zero-cash')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /Monthly free cash/ }));

    expect(container.querySelector('.cashflow-chart__line--cash')).toBeNull();
    expect(container.querySelector('.cashflow-chart__line--zero-cash')).toBeNull();
    expect(container.querySelector('.cashflow-chart__zero-area')).toBeNull();
  });
});
