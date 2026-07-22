import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChildBreakpoints } from '@src/components/controls/ChildBreakpoints';
import type { Child } from '@src/lib/children';

const KIDS: Child[] = [
  { id: 'c1', year: 0 },
  { id: 'c2', year: 4 },
];

function renderComponent(overrides: Partial<Parameters<typeof ChildBreakpoints>[0]> = {}) {
  return render(<ChildBreakpoints kids={KIDS} onAdd={jest.fn()} onRemove={jest.fn()} onUpdate={jest.fn()} {...overrides} />);
}

describe('ChildBreakpoints', () => {
  it('renders one row per child, sorted by year', () => {
    renderComponent({ kids: [KIDS[1], KIDS[0]] });

    const yearInputs = screen.getAllByLabelText('Yr') as HTMLInputElement[];
    expect(yearInputs.map((input) => input.value)).toEqual(['0', '4']);
  });

  it('calls onAdd when the add-child button is clicked', async () => {
    const user = userEvent.setup();
    const onAdd = jest.fn();
    renderComponent({ onAdd });

    await user.click(screen.getByRole('button', { name: '+ Add child' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove with the child id when its trash icon is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = jest.fn();
    renderComponent({ onRemove });

    await user.click(screen.getByRole('button', { name: 'Remove child at year 4' }));
    expect(onRemove).toHaveBeenCalledWith('c2');
  });

  it('calls onUpdate with a clamped year when the year input changes above the 18-year horizon', () => {
    const onUpdate = jest.fn();
    renderComponent({ onUpdate });

    const yearInput = screen.getAllByLabelText('Yr')[0] as HTMLInputElement;
    fireEventChange(yearInput, '99');

    expect(onUpdate).toHaveBeenCalledWith('c1', 18);
  });

  it('calls onUpdate with a clamped year when the year input changes below 0', () => {
    const onUpdate = jest.fn();
    renderComponent({ onUpdate });

    const yearInput = screen.getAllByLabelText('Yr')[0] as HTMLInputElement;
    fireEventChange(yearInput, '-5');

    expect(onUpdate).toHaveBeenCalledWith('c1', 0);
  });
});

function fireEventChange(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
