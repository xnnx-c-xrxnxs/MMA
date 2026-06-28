import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './select';

describe('Select', () => {
  it('renders options and reflects defaultValue', () => {
    render(
      <Select defaultValue="b">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    );
    expect(screen.getByRole('combobox')).toHaveValue('b');
  });

  it('responds to user selection', async () => {
    const user = userEvent.setup();
    render(
      <Select defaultValue="a">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    );
    await user.selectOptions(screen.getByRole('combobox'), 'b');
    expect(screen.getByRole('combobox')).toHaveValue('b');
  });

  it('respects disabled prop', () => {
    render(
      <Select disabled defaultValue="a">
        <option value="a">Alpha</option>
      </Select>,
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
