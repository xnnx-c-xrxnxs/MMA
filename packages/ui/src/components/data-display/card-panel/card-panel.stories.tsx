import type { Meta, StoryObj } from '@storybook/react';
import { CardPanel, CardPanelHeader, CardPanelContent } from './card-panel';

const meta: Meta<typeof CardPanel> = {
  title: 'Data Display/CardPanel',
  component: CardPanel,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CardPanel>;

export const Default: Story = {
  render: () => (
    <CardPanel>
      <CardPanelHeader>CardPanel header</CardPanelHeader>
      <CardPanelContent>CardPanel content</CardPanelContent>
    </CardPanel>
  ),
};
