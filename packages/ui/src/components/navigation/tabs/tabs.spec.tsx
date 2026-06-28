import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';

describe('Tabs', () => {
  it('renders the default panel and switches on click', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText('Panel A')).toBeInTheDocument();
    expect(screen.queryByText('Panel B')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'B' }));
    expect(screen.getByText('Panel B')).toBeInTheDocument();
  });

  it('respects disabled triggers', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b" disabled>
            Tab B
          </TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );
    const disabledTab = screen.getByRole('tab', { name: 'Tab B' });
    expect(disabledTab).toBeDisabled();
    await user.click(disabledTab);
    expect(screen.queryByText('Panel B')).not.toBeInTheDocument();
  });
});
