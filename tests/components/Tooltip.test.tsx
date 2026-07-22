import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '@src/components/Tooltip';

describe('Tooltip', () => {
  it('does not render the bubble until hovered', () => {
    render(
      <Tooltip tip="Explains the field">
        <span>Field label</span>
      </Tooltip>,
    );

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the bubble on hover/focus and hides it after, rendered outside the trigger via portal', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip tip="Explains the field">
        <span>Field label</span>
      </Tooltip>,
    );

    await user.hover(screen.getByText('Field label'));
    const bubble = await screen.findByRole('tooltip');
    expect(bubble).toHaveTextContent('Explains the field');
    // Portalled to document.body, not nested under the trigger span.
    expect(bubble.closest('.tooltip')).toBeNull();

    await user.unhover(screen.getByText('Field label'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
