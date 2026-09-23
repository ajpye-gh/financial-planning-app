import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Slider } from '@src/components/controls/Slider';

const RANGE = { min: 0, max: 100, step: 1 };

function renderSlider(overrides: Partial<Parameters<typeof Slider>[0]> = {}) {
  const onChange = jest.fn();
  const utils = render(
    <Slider id="amount" label="Amount" range={RANGE} value={50} onChange={onChange} valueLabel="50" {...overrides} />,
  );
  return { onChange, ...utils };
}

/** Range inputs aren't reliably drag-able via userEvent in jsdom (no pointer geometry) - set the
 *  value through the native setter and dispatch a change event, same as a real drag would. */
function fireSliderChange(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Slider basic interaction', () => {
  it('renders a labeled range input at the given value', () => {
    renderSlider();

    const slider = screen.getByRole('slider', { name: 'Amount' }) as HTMLInputElement;
    expect(slider.value).toBe('50');
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('100');
  });

  it('calls onChange with the new value when dragged', () => {
    const { onChange } = renderSlider();

    const slider = screen.getByRole('slider', { name: 'Amount' }) as HTMLInputElement;
    fireSliderChange(slider, '75');

    expect(onChange).toHaveBeenCalledWith(75);
  });

  it('shows the given valueLabel text, not the raw numeric value', () => {
    renderSlider({ valueLabel: '$50/mo' });
    expect(screen.getByText('$50/mo')).toBeInTheDocument();
  });
});

describe('Slider bound editing', () => {
  it('double-clicking the max bound opens a number input prefilled with the current max', async () => {
    const user = userEvent.setup();
    renderSlider();

    await user.dblClick(screen.getByText('100'));
    const input = screen.getByLabelText('Amount maximum') as HTMLInputElement;
    expect(input.value).toBe('100');
  });

  it('committing a new max on Enter narrows the effective range and clamps the value via onChange', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSlider({ value: 90, valueLabel: '90' });

    await user.dblClick(screen.getByText('100'));
    const input = screen.getByLabelText('Amount maximum');
    await user.clear(input);
    await user.type(input, '60{Enter}');

    expect(onChange).toHaveBeenCalledWith(60);
    const slider = screen.getByRole('slider', { name: 'Amount' }) as HTMLInputElement;
    expect(slider.max).toBe('60');
  });

  it('does not clamp when the current value is already within the new max', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSlider({ value: 20, valueLabel: '20' });

    await user.dblClick(screen.getByText('100'));
    const input = screen.getByLabelText('Amount maximum');
    await user.clear(input);
    await user.type(input, '60{Enter}');

    expect(onChange).not.toHaveBeenCalled();
    const slider = screen.getByRole('slider', { name: 'Amount' }) as HTMLInputElement;
    expect(slider.max).toBe('60');
  });

  it('committing a new min narrows the effective range and clamps a too-low value via onChange', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSlider({ value: 5, valueLabel: '5' });

    await user.dblClick(screen.getByText('0'));
    const input = screen.getByLabelText('Amount minimum');
    await user.clear(input);
    await user.type(input, '10{Enter}');

    expect(onChange).toHaveBeenCalledWith(10);
    const slider = screen.getByRole('slider', { name: 'Amount' }) as HTMLInputElement;
    expect(slider.min).toBe('10');
  });

  it('ignores an invalid bound (min >= max) and closes the editor without changing the range', async () => {
    const user = userEvent.setup();
    renderSlider();

    await user.dblClick(screen.getByText('100'));
    const input = screen.getByLabelText('Amount maximum');
    await user.clear(input);
    await user.type(input, '0{Enter}');

    expect(screen.queryByLabelText('Amount maximum')).not.toBeInTheDocument();
    const slider = screen.getByRole('slider', { name: 'Amount' }) as HTMLInputElement;
    expect(slider.max).toBe('100');
  });

  it('commits a bound on blur as well as Enter', async () => {
    const user = userEvent.setup();
    renderSlider({ value: 90, valueLabel: '90' });

    await user.dblClick(screen.getByText('100'));
    const input = screen.getByLabelText('Amount maximum');
    await user.clear(input);
    await user.type(input, '70');
    await user.tab();

    const slider = screen.getByRole('slider', { name: 'Amount' }) as HTMLInputElement;
    expect(slider.max).toBe('70');
  });
});

describe('Slider value editing', () => {
  it('double-clicking the value display swaps it for a text input prefilled with the current value', async () => {
    const user = userEvent.setup();
    renderSlider({ value: 42, valueLabel: '42' });

    await user.dblClick(screen.getByText('42'));
    const input = screen.getByLabelText('Amount value') as HTMLInputElement;
    expect(input.value).toBe('42');
  });

  it('typing a new value and pressing Enter commits it via onChange', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSlider({ value: 42, valueLabel: '42' });

    await user.dblClick(screen.getByText('42'));
    const input = screen.getByLabelText('Amount value');
    await user.clear(input);
    await user.type(input, '88{Enter}');

    expect(onChange).toHaveBeenCalledWith(88);
    expect(screen.queryByLabelText('Amount value')).not.toBeInTheDocument();
  });

  it('clamps a typed value that overshoots the effective range', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSlider({ value: 42, valueLabel: '42' });

    await user.dblClick(screen.getByText('42'));
    const input = screen.getByLabelText('Amount value');
    await user.clear(input);
    await user.type(input, '999{Enter}');

    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('commits on blur too', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSlider({ value: 42, valueLabel: '42' });

    await user.dblClick(screen.getByText('42'));
    const input = screen.getByLabelText('Amount value');
    await user.clear(input);
    await user.type(input, '55');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(55);
  });

  it('Escape cancels editing without calling onChange', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSlider({ value: 42, valueLabel: '42' });

    await user.dblClick(screen.getByText('42'));
    const input = screen.getByLabelText('Amount value');
    await user.clear(input);
    await user.type(input, '999{Escape}');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Amount value')).not.toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('a plain single click does not open the editor', async () => {
    const user = userEvent.setup();
    renderSlider({ value: 42, valueLabel: '42' });

    await user.click(screen.getByText('42'));
    expect(screen.queryByLabelText('Amount value')).not.toBeInTheDocument();
  });
});
