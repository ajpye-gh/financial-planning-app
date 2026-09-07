import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SalaryRaiseBreakpoints } from '@src/components/controls/SalaryRaiseBreakpoints';
import type { SalaryRaiseBreakpoint } from '@src/lib/salaryRaises';

const BREAKPOINTS: SalaryRaiseBreakpoint[] = [
  { id: 'r1', year: 1, incomeK: 75 },
  { id: 'r4', year: 4, incomeK: 90 },
];

function renderComponent(overrides: Partial<Parameters<typeof SalaryRaiseBreakpoints>[0]> = {}) {
  return render(
    <SalaryRaiseBreakpoints
      breakpoints={BREAKPOINTS}
      salaryY0K={70}
      onAdd={jest.fn()}
      onRemove={jest.fn()}
      onUpdate={jest.fn()}
      onSetJobLoss={jest.fn()}
      onClearJobLoss={jest.fn()}
      {...overrides}
    />,
  );
}

describe('SalaryRaiseBreakpoints raises', () => {
  it('renders one row per breakpoint, sorted by year', () => {
    renderComponent({ breakpoints: [BREAKPOINTS[1], BREAKPOINTS[0]] });

    const yearInputs = screen.getAllByLabelText('Yr') as HTMLInputElement[];
    expect(yearInputs.map((input) => input.value)).toEqual(['1', '4']);
  });

  it('calls onAdd when the add-income-milestone button is clicked', async () => {
    const user = userEvent.setup();
    const onAdd = jest.fn();
    renderComponent({ onAdd });

    await user.click(screen.getByRole('button', { name: '+ Add income milestone' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove with the breakpoint id when its trash icon is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = jest.fn();
    renderComponent({ onRemove });

    await user.click(screen.getByRole('button', { name: 'Remove income milestone at year 4' }));
    expect(onRemove).toHaveBeenCalledWith('r4');
  });

  it('calls onUpdate with a clamped year when the year input changes', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    renderComponent({ onUpdate });

    const yearInput = screen.getAllByLabelText('Yr')[0];
    await user.clear(yearInput);
    await user.type(yearInput, '99');

    // Each keystroke fires onChange; the last call should be for the final "9" (99 clamped to 18).
    const lastCall = onUpdate.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe('r1');
    expect(lastCall?.[1].year).toBe(18);
  });

  it('calls onUpdate with the new income when the slider changes', () => {
    const onUpdate = jest.fn();
    renderComponent({ onUpdate });

    const sliders = screen.getAllByRole('slider') as HTMLInputElement[];
    fireEventChange(sliders[0], '80');
    expect(onUpdate).toHaveBeenCalledWith('r1', { incomeK: 80 });
  });

  it("floors the first milestone's slider at the current starting salary", () => {
    renderComponent({ salaryY0K: 70 });

    const sliders = screen.getAllByRole('slider') as HTMLInputElement[];
    expect(sliders[0].min).toBe('70');
  });
});

describe('SalaryRaiseBreakpoints job loss', () => {
  it('shows "+ Job loss" and no job-loss row when unset', () => {
    renderComponent({ jobLossYear: undefined });

    expect(screen.getByRole('button', { name: '+ Job loss' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Job loss, yr')).not.toBeInTheDocument();
  });

  it('calls onSetJobLoss with a default year when "+ Job loss" is clicked', async () => {
    const user = userEvent.setup();
    const onSetJobLoss = jest.fn();
    renderComponent({ jobLossYear: undefined, onSetJobLoss });

    await user.click(screen.getByRole('button', { name: '+ Job loss' }));
    expect(onSetJobLoss).toHaveBeenCalledTimes(1);
    expect(onSetJobLoss.mock.calls[0][0]).toBeGreaterThanOrEqual(1);
  });

  it('shows a year row with a remove button once set, and hides "+ Job loss"', () => {
    renderComponent({ jobLossYear: 6 });

    expect(screen.getByLabelText('Job loss, yr')).toHaveValue(6);
    expect(screen.getByRole('button', { name: 'Remove job loss at year 6' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Job loss' })).not.toBeInTheDocument();
  });

  it('calls onClearJobLoss when the remove button is clicked', async () => {
    const user = userEvent.setup();
    const onClearJobLoss = jest.fn();
    renderComponent({ jobLossYear: 6, onClearJobLoss });

    await user.click(screen.getByRole('button', { name: 'Remove job loss at year 6' }));
    expect(onClearJobLoss).toHaveBeenCalledTimes(1);
  });

  it('calls onSetJobLoss with a clamped year when the job-loss year input changes', async () => {
    const user = userEvent.setup();
    const onSetJobLoss = jest.fn();
    renderComponent({ jobLossYear: 6, onSetJobLoss });

    const input = screen.getByLabelText('Job loss, yr');
    await user.clear(input);
    await user.type(input, '99');

    expect(onSetJobLoss.mock.calls.at(-1)?.[0]).toBe(18);
  });
});

function fireEventChange(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
