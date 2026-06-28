import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetDescription } from './sheet';

describe('Sheet', () => {
  it('opens on trigger click', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetTitle>Panel</SheetTitle>
          <SheetDescription>desc</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    await user.click(screen.getByText('Open'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Panel')).toBeInTheDocument();
  });

  it('renders open by default', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>t</SheetTitle>
          <SheetDescription>d</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
