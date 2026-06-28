import type { Meta, StoryObj } from '@storybook/react';
import * as Icons from './icons';
import type { IIcon } from './icon.types';

type IconComponent = (props: IIcon) => React.ReactElement;

const AllIconsGrid = ({ size, color, color2 }: IIcon) => (
  <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4 p-4">
    {(Object.entries(Icons) as [string, IconComponent][]).map(([name, Icon]) => (
      <div key={name} className="flex flex-col items-center gap-2 rounded-md border p-3 text-center">
        <Icon size={size} color={color} color2={color2} aria-label={name} />
        <span className="text-xs text-muted-foreground">{name.replace('Icon', '')}</span>
      </div>
    ))}
  </div>
);

const meta: Meta<typeof AllIconsGrid> = {
  title: 'Icons/All Icons',
  component: AllIconsGrid,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    size: { control: { type: 'range', min: 12, max: 48, step: 4 } },
    color: { control: 'color' },
    // color2 drives --icon-color-2 CSS custom property for two-color icons.
    // Single-color icons ignore this prop — it has no visible effect on them.
    color2: { control: 'color' },
  },
  args: { size: 24 },
};

export default meta;
type Story = StoryObj<typeof AllIconsGrid>;

export const Grid: Story = {};

export const Large: Story = { args: { size: 32 } };

export const Colored: Story = { args: { size: 24, color: 'hsl(220 90% 56%)' } };

export const NavigationIcons: Story = {
  render: ({ size }) => (
    <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4 p-4">
      {(
        [
          'AddIcon', 'ArrowDownIcon', 'ArrowLeftIcon', 'ArrowRightIcon', 'ArrowUpIcon',
          'ChevronDownIcon', 'ChevronLeftIcon', 'ChevronRightIcon', 'ChevronUpIcon',
          'CloseIcon', 'MoreHorizIcon', 'MoreIcon', 'RefreshIcon', 'SearchIcon', 'SortIcon',
        ] as const
      ).map((name) => {
        const Icon = Icons[name] as IconComponent;
        return (
          <div key={name} className="flex flex-col items-center gap-2 rounded-md border p-3 text-center">
            <Icon size={size} aria-label={name} />
            <span className="text-xs text-muted-foreground">{name.replace('Icon', '')}</span>
          </div>
        );
      })}
    </div>
  ),
  args: { size: 24 },
};

export const StatusIcons: Story = {
  render: ({ size }) => (
    <div className="flex flex-wrap gap-6 p-4">
      <div className="flex flex-col items-center gap-2">
        <Icons.ErrorIcon size={size} className="text-destructive" aria-label="Error" />
        <span className="text-xs">Error</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icons.WarningIcon size={size} className="text-warning" aria-label="Warning" />
        <span className="text-xs">Warning</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icons.SuccessIcon size={size} className="text-success" aria-label="Success" />
        <span className="text-xs">Success</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icons.InfoIcon size={size} className="text-brand" aria-label="Info" />
        <span className="text-xs">Info</span>
      </div>
    </div>
  ),
  args: { size: 32 },
};

export const InputIcons: Story = {
  render: ({ size }) => (
    <div className="flex flex-wrap gap-6 p-4">
      <div className="flex flex-col items-center gap-2">
        <Icons.CheckboxOffIcon size={size} aria-label="Checkbox Off" />
        <span className="text-xs">CheckboxOff</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icons.CheckboxOnIcon size={size} aria-label="Checkbox On" />
        <span className="text-xs">CheckboxOn</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icons.CheckboxIndeterminateIcon size={size} aria-label="Checkbox Indeterminate" />
        <span className="text-xs">CheckboxIndeterminate</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icons.RadioOffIcon size={size} aria-label="Radio Off" />
        <span className="text-xs">RadioOff</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icons.RadioOnIcon size={size} aria-label="Radio On" />
        <span className="text-xs">RadioOn</span>
      </div>
    </div>
  ),
  args: { size: 32 },
};

export const FileIcons: Story = {
  render: ({ size }) => (
    <div className="flex flex-wrap gap-6 p-4">
      {(
        ['AiIcon', 'DbIcon', 'FileIcon', 'RecordsIcon', 'SummaryIcon'] as const
      ).map((name) => {
        const Icon = Icons[name] as IconComponent;
        return (
          <div key={name} className="flex flex-col items-center gap-2">
            <Icon size={size} aria-label={name} />
            <span className="text-xs text-muted-foreground">{name.replace('Icon', '')}</span>
          </div>
        );
      })}
    </div>
  ),
  args: { size: 32 },
};
