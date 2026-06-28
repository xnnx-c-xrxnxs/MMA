import type { Meta, StoryObj } from '@storybook/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';

const meta: Meta<typeof Tabs> = {
  title: 'Navigation/Tabs',
  component: Tabs,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-96">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="text-sm">Project overview content.</p>
      </TabsContent>
      <TabsContent value="activity">
        <p className="text-sm">Recent activity feed.</p>
      </TabsContent>
      <TabsContent value="settings">
        <p className="text-sm">Project settings.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const WithDisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="a" className="w-96">
      <TabsList>
        <TabsTrigger value="a">Available</TabsTrigger>
        <TabsTrigger value="b" disabled>
          Disabled
        </TabsTrigger>
      </TabsList>
      <TabsContent value="a">A panel</TabsContent>
      <TabsContent value="b">B panel</TabsContent>
    </Tabs>
  ),
};
