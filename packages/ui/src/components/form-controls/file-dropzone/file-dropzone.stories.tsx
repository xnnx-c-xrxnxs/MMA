import type { Meta, StoryObj } from '@storybook/react';
import { FileDropzone } from './file-dropzone';

const meta: Meta<typeof FileDropzone> = {
  title: 'Form Controls/FileDropzone',
  component: FileDropzone,
  tags: ['autodocs'],
  args: {
    onFileSelected: (file: File) => alert(`Picked: ${file.name}`),
  },
};

export default meta;
type Story = StoryObj<typeof FileDropzone>;

export const Default: Story = {
  render: (args) => (
    <div className="w-96">
      <FileDropzone {...args} hint="PNG or JPG, up to 5MB" accept="image/*" />
    </div>
  ),
};

export const PdfOnly: Story = {
  render: (args) => (
    <div className="w-96">
      <FileDropzone {...args} accept="application/pdf" label="Drop a PDF" hint="Up to 10MB" />
    </div>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <div className="w-96">
      <FileDropzone {...args} disabled />
    </div>
  ),
};
