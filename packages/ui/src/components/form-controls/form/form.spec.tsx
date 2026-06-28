import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
  ManagedForm,
  StructuredForm,
} from './form';
import type { FormStructure } from './structure';
import { Input } from '../input';

interface Values {
  email: string;
}

function Harness() {
  const form = useForm<Values>({ defaultValues: { email: '' } });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => undefined)}>
        <FormField
          control={form.control}
          name="email"
          rules={{ required: 'Email is required' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>Helper text</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Submit</button>
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

const managedSubmitSchema = z.object({
  email: z.string().email('Enter a valid email'),
});

type ManagedValues = z.input<typeof managedSchema>;

function ManagedHarness({
  onSubmit,
}: {
  onSubmit: (values: z.output<typeof managedSubmitSchema>) => void;
}) {
  return (
    <ManagedForm<{ email: string }>
      schema={managedSubmitSchema}
      defaultValues={{ email: '' }}
      onSubmit={async (values) => {
        onSubmit(values);
      }}
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
          <button type="submit">Submit managed</button>
        </>
      )}
    </ManagedForm>
  );
}

const structuredForm: FormStructure<ManagedValues> = [
  {
    title: 'Structured section',
    rows: [
      {
        fields: [
          {
            kind: 'email',
            name: 'email',
            label: 'Email',
          },
          {
            kind: 'select',
            name: 'category',
            label: 'Category',
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
          },
          {
            kind: 'checkbox',
            name: 'agreed',
            label: 'Agreement',
          },
        ],
      },
    ],
  },
];

describe('Form', () => {
  it('wires label htmlFor to the input id from FormItem context', () => {
    render(<Harness />);
    const label = screen.getByText('Email');
    const input = screen.getByRole('textbox');
    expect(label).toHaveAttribute('for', input.id);
  });

  it('shows the validation error message after submitting an empty required field', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });
  });

  it('marks the input aria-invalid on validation failure', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('ManagedForm wires schema validation and submits parsed values', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(<ManagedHarness onSubmit={onSubmit} />);

    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Submit managed' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'ada@example.com',
      });
    });
  });

  it('StructuredForm renders field kinds and shows schema errors', async () => {
    const user = userEvent.setup();
    render(
      <StructuredForm<ManagedValues>
        schema={managedSchema}
        defaultValues={{ email: '', notes: '', category: 'general', agreed: false }}
        structure={structuredForm}
        onSubmit={async () => undefined}
        footer={<button type="submit">Submit structured</button>}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Agreement' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Submit structured' }));

    await waitFor(() => {
      expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
      expect(screen.getByText('Notes are required')).toBeInTheDocument();
      expect(screen.getByText('You must agree before submitting')).toBeInTheDocument();
    });
  });
});
