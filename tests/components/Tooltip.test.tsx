import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MouseEvent } from 'react';
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
    // Hidden on a short delay, not instantly - see the next test for why.
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('stays visible while the pointer moves into the bubble itself, rather than hiding the instant it leaves the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip tip={<a href="https://example.com">A link</a>}>
        <span>Field label</span>
      </Tooltip>,
    );

    await user.hover(screen.getByText('Field label'));
    const bubble = await screen.findByRole('tooltip');

    await user.unhover(screen.getByText('Field label'));
    await user.hover(bubble);
    // Give the (canceled) hide timeout a chance to have fired if it wasn't actually canceled.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.unhover(bubble);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('renders interactive content (e.g. a link) that can actually be clicked, not just displayed', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn((event: MouseEvent) => event.preventDefault());
    render(
      <Tooltip
        tip={
          <a href="https://example.com" onClick={onClick}>
            A link
          </a>
        }
      >
        <span>Field label</span>
      </Tooltip>,
    );

    await user.hover(screen.getByText('Field label'));
    const link = await screen.findByRole('link', { name: 'A link' });
    await user.click(link);
    expect(onClick).toHaveBeenCalled();
  });
});
