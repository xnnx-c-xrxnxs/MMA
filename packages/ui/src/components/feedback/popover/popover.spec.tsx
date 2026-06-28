import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover, PopoverTrigger, PopoverContent } from './popover';

describe('Popover', () => {
  it('shows content when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent>Content</PopoverContent>
      </Popover>,
    );
    await user.click(screen.getByText('Trigger'));
    expect(await screen.findByText('Content')).toBeInTheDocument();
  });

  it('renders content when defaultOpen', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>t</PopoverTrigger>
        <PopoverContent>Visible</PopoverContent>
      </Popover>,
    );
    expect(screen.getByText('Visible')).toBeInTheDocument();
  });
});
