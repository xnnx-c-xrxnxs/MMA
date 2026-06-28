import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, toast } from './toast';

describe('Toast', () => {
  it('renders the Toaster mount point', () => {
    render(<Toaster />);
    // sonner mounts a section with aria-label "Notifications" once initialized.
    expect(document.querySelector('section[aria-label*="otifications"]')).not.toBeNull();
  });

  it('emits a toast on demand and the message becomes visible', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Toaster />
        <button onClick={() => toast('Hello there')}>Fire</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Fire' }));
    expect(await screen.findByText('Hello there')).toBeInTheDocument();
  });
});
