import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from './command';

describe('Command', () => {
  it('renders input and list items', () => {
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandGroup>
            <CommandItem>Alpha</CommandItem>
            <CommandItem>Beta</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('filters items as the user types', async () => {
    const user = userEvent.setup();
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandEmpty>None</CommandEmpty>
          <CommandGroup>
            <CommandItem>Apple</CommandItem>
            <CommandItem>Banana</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );
    await user.type(screen.getByPlaceholderText('Search'), 'ban');
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  });
});
