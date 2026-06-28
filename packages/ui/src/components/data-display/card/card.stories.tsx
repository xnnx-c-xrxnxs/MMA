import type { Meta, StoryObj } from '@storybook/react';
import { CheckIcon, CloseIcon, FileIcon, HelpIcon, SummaryIcon } from '../../../icons';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardIcon,
  CardRow,
  CardSection,
  CardTitle,
} from './card';

const meta: Meta<typeof Card> = {
  title: 'Data Display/Card',
  component: Card,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Project Atlas</CardTitle>
        <CardDescription>Last updated 2 days ago</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Tracking 14 active issues across 3 milestones.</p>
      </CardContent>
    </Card>
  ),
};

export const HeaderOnly: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Quick stats</CardTitle>
        <CardDescription>No body content needed.</CardDescription>
      </CardHeader>
    </Card>
  ),
};

export const ContentOnly: Story = {
  render: () => (
    <Card className="w-80">
      <CardContent className="pt-6">
        <p className="text-sm">A bare card body without a header.</p>
      </CardContent>
    </Card>
  ),
};

export const ResultsAndInstructions: Story = {
  render: () => (
    <div className="w-80">
      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0 border-b border-border px-5 py-4">
          <CardIcon aria-hidden>
            <SummaryIcon size={20} />
          </CardIcon>
          <CardTitle>Results Summary</CardTitle>
        </CardHeader>

        <CardSection className="space-y-4 px-5 py-6">
          <CardRow icon={<FileIcon size={16} className="text-secondary-600" />} label="Total Retrieved" value="1,245" />
          <CardRow icon={<CheckIcon size={16} className="text-success-text" />} label="Total Included" value="186" />
          <CardRow icon={<CloseIcon size={16} className="text-danger-text" />} label="Total Excluded" value="1,050" />
          <CardRow icon={<HelpIcon size={16} className="text-warning-text" />} label="Needs Review" value="12" />
        </CardSection>
      </Card>
    </div>
  ),
};

export const Dark: Story = {
  render: () => (
    <div className="dark bg-background p-4">
      <Card className="w-80">
        <CardHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-4">
          <CardIcon aria-hidden>
            <span className="text-sm">D</span>
          </CardIcon>
          <CardTitle>Results Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <CardRow label="Total Retrieved" value="1,245" />
          <CardRow label="Total Included" value="186" />
        </CardContent>
      </Card>
    </div>
  ),
};
