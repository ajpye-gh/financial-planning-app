import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SliderField } from '@src/components/controls/SliderField';
import type { BaseFieldMeta } from '@src/lib/baseFields';

const META: BaseFieldMeta = {
  id: 'salaryY0K',
  label: 'Salary, yr 0 (today)',
  format: 'k',
  tooltip: 'Your current gross base salary.',
};

const RANGE = { min: 0, max: 500, step: 5, default: 100 };

function fireSliderChange(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('SliderField', () => {
  it('renders the meta label/tooltip and formats the value using meta.format', async () => {
    const user = userEvent.setup();
    render(<SliderField meta={META} range={RANGE} value={120} onChange={jest.fn()} />);

    expect(screen.getByText('Salary, yr 0 (today)')).toBeInTheDocument();
    expect(screen.getByText('$120k')).toBeInTheDocument();

    await user.hover(screen.getByText('Salary, yr 0 (today)'));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Your current gross base salary.');
  });

  it('calls onChange with the field id and new value when dragged', () => {
    const onChange = jest.fn();
    render(<SliderField meta={META} range={RANGE} value={120} onChange={onChange} />);

    const slider = screen.getByRole('slider', { name: 'Salary, yr 0 (today)' }) as HTMLInputElement;
    fireSliderChange(slider, '200');

    expect(onChange).toHaveBeenCalledWith('salaryY0K', 200);
  });

  it('uses an explicit valueLabel override instead of the formatted value', () => {
    render(<SliderField meta={META} range={RANGE} value={120} onChange={jest.fn()} valueLabel="custom label" />);
    expect(screen.getByText('custom label')).toBeInTheDocument();
    expect(screen.queryByText('$120k')).not.toBeInTheDocument();
  });

  it('double-clicking the value swaps it for an input and commits a new value via onChange with the field id', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<SliderField meta={META} range={RANGE} value={120} onChange={onChange} />);

    await user.dblClick(screen.getByText('$120k'));
    const input = screen.getByLabelText('Salary, yr 0 (today) value');
    await user.clear(input);
    await user.type(input, '300{Enter}');

    expect(onChange).toHaveBeenCalledWith('salaryY0K', 300);
  });

  it('double-clicking a bound formats it with meta.format and clamps the value into the new range', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<SliderField meta={META} range={RANGE} value={450} onChange={onChange} />);

    expect(screen.getByText('$500k')).toBeInTheDocument();

    await user.dblClick(screen.getByText('$500k'));
    const input = screen.getByLabelText('Salary, yr 0 (today) maximum');
    await user.clear(input);
    await user.type(input, '400{Enter}');

    expect(onChange).toHaveBeenCalledWith('salaryY0K', 400);
  });
});
