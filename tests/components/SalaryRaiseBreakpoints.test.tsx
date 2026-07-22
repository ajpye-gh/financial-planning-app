import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SalaryRaiseBreakpoints } from '@src/components/controls/SalaryRaiseBreakpoints';
import type { SalaryRaiseBreakpoint } from '@src/lib/salaryRaises';

const BREAKPOINTS: SalaryRaiseBreakpoint[] = [
  { id: 'r1', year: 1, raiseK: 5 },
  { id: 'r4', year: 4, raiseK: 20 },
];

describe('SalaryRaiseBreakpoints', () => {
  it('renders one row per breakpoint, sorted by year', () => {
    render(
      <SalaryRaiseBreakpoints
        breakpoints={[BREAKPOINTS[1], BREAKPOINTS[0]]}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    const yearInputs = screen.getAllByLabelText('Yr') as HTMLInputElement[];
    expect(yearInputs.map((input) => input.value)).toEqual(['1', '4']);
  });

  it('calls onAdd when the add button is clicked', async () => {
    const user = userEvent.setup();
    const onAdd = jest.fn();
    render(<SalaryRaiseBreakpoints breakpoints={BREAKPOINTS} onAdd={onAdd} onRemove={jest.fn()} onUpdate={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: '+ Add raise' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove with the breakpoint id when its trash icon is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = jest.fn();
    render(<SalaryRaiseBreakpoints breakpoints={BREAKPOINTS} onAdd={jest.fn()} onRemove={onRemove} onUpdate={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Remove raise at year 4' }));
    expect(onRemove).toHaveBeenCalledWith('r4');
  });

  it('calls onUpdate with a clamped year when the year input changes', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    render(<SalaryRaiseBreakpoints breakpoints={BREAKPOINTS} onAdd={jest.fn()} onRemove={jest.fn()} onUpdate={onUpdate} />);

    const yearInput = screen.getAllByLabelText('Yr')[0];
    await user.clear(yearInput);
    await user.type(yearInput, '99');

    // Each keystroke fires onChange; the last call should be for the final "9" (99 clamped to 18).
    const lastCall = onUpdate.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe('r1');
    expect(lastCall?.[1].year).toBe(18);
  });

  it('calls onUpdate with the raise amount when the slider changes', () => {
    const onUpdate = jest.fn();
    render(<SalaryRaiseBreakpoints breakpoints={BREAKPOINTS} onAdd={jest.fn()} onRemove={jest.fn()} onUpdate={onUpdate} />);

    const sliders = screen.getAllByRole('slider') as HTMLInputElement[];
    fireEventChange(sliders[0], '40');
    expect(onUpdate).toHaveBeenCalledWith('r1', { raiseK: 40 });
  });
});

function fireEventChange(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
