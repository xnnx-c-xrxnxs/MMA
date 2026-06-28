import { render, screen } from '@testing-library/react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip';

describe('Tooltip', () => {
  it('renders the trigger and forwards children', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover</TooltipTrigger>
          <TooltipContent>Hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByText('Hover')).toBeInTheDocument();
  });

  it('shows content when defaultOpen', async () => {
    render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger>t</TooltipTrigger>
          <TooltipContent>Visible hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    // Radix portals tooltip — assert via findAllByText to allow async portal mount
    const matches = await screen.findAllByText('Visible hint');
    expect(matches.length).toBeGreaterThan(0);
  });
});
