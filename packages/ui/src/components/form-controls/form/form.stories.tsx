import type { Meta, StoryObj } from '@storybook/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  ManagedForm,
  StructuredForm,
} from './form';
import type { FormStructure } from './structure';
import { Input } from '../input';
import { Button } from '../button';

interface FormValues {
  email: string;
}

function ExampleForm({ withError = false }: { withError?: boolean }) {
  const form = useForm<FormValues>({
    defaultValues: { email: withError ? '' : 'ada@example.com' },
  });

  return (
    <Form {...form}>
      <form
        className="w-80 space-y-4"
        onSubmit={form.handleSubmit(() => {
          /* no-op */
        })}
      >
        <FormField
          control={form.control}
          name="email"
          rules={{ required: 'Email is required' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" {...field} />
              </FormControl>
              <FormDescription>We never share your email.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="brand">
          Submit
        </Button>
      </form>
    </Form>
  );
}

const managedSchema = z.object({
  email: z.string().email('Enter a valid email'),
  notes: z.string().min(3, 'Notes are required'),
  category: z.enum(['general', 'billing']),
  agreed: z.boolean().refine((value) => value, 'You must agree before submitting'),
});

type ManagedValues = z.input<typeof managedSchema>;

const managedStructure: FormStructure<ManagedValues> = [
  {
    title: 'Managed Form',
    description: 'Internal RHF setup with schema + structure rendering.',
    rows: [
      {
        fields: [
          {
            kind: 'email',
            name: 'email',
            label: 'Email',
            placeholder: 'you@example.com',
            description: 'Used for follow-up communication.',
          },
          {
            kind: 'select',
            name: 'category',
            label: 'Category',
            placeholder: 'Select one',
            options: [
              { label: 'General', value: 'general' },
              { label: 'Billing', value: 'billing' },
            ],
          },
        ],
      },
      {
        fields: [
          {
            kind: 'textarea',
            name: 'notes',
            label: 'Notes',
            placeholder: 'Share context for your request',
          },
          {
            kind: 'checkbox',
            name: 'agreed',
            label: 'I agree to the terms',
            description: 'This is required before submission.',
          },
        ],
      },
    ],
  },
];

function ManagedFormExample() {
  return (
    <ManagedForm<ManagedValues>
      schema={managedSchema}
      defaultValues={{ email: '', notes: '', category: 'general', agreed: false }}
      onSubmit={() => {
        // no-op in story
      }}
      className="space-y-4"
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="you@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" variant="brand">
            Submit
          </Button>
        </>
      )}
    </ManagedForm>
  );
}

function StructuredFormExample() {
  return (
    <StructuredForm<ManagedValues>
      schema={managedSchema}
      defaultValues={{ email: '', notes: '', category: 'general', agreed: false }}
      structure={managedStructure}
      onSubmit={() => {
        // no-op in story
      }}
      footer={<Button type="submit" variant="brand">Submit</Button>}
    />
  );
}

const meta: Meta<typeof ExampleForm> = {
  title: 'Form Controls/Form',
  component: ExampleForm,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ExampleForm>;

export const Default: Story = {};
export const WithError: Story = { args: { withError: true } };
export const Managed: StoryObj<typeof ManagedFormExample> = {
  render: () => <ManagedFormExample />,
};
export const Structured: StoryObj<typeof StructuredFormExample> = {
  render: () => <StructuredFormExample />,
};
