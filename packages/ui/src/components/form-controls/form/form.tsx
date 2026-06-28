'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as LabelPrimitive from '@radix-ui/react-label';
import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';
import {
  Controller,
  type ControllerProps,
  type DefaultValues,
  type FieldPath,
  type FieldValues,
  FormProvider,
  type Path,
  type PathValue,
  type Resolver,
  type SubmitErrorHandler,
  type SubmitHandler,
  type UseFormProps,
  type UseFormReturn,
  useForm,
  useFormContext,
  useFormState,
} from 'react-hook-form';
import { type ZodType } from 'zod';
import { cn } from '../../../lib/utils';
import { Button } from '../button';
import { Input } from '../input';
import { Label } from '../label';
import { Select } from '../select';
import type {
  FormStructure,
  StructuredFormField,
  StructuredFormSection,
  StructuredFormTextKind,
} from './structure';

const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>');
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue);

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = React.useId();
    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn('space-y-2', className)} {...props} />
      </FormItemContext.Provider>
    );
  },
);
FormItem.displayName = 'FormItem';

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();
  return (
    <Label
      ref={ref}
      className={cn(error && 'text-destructive', className)}
      htmlFor={formItemId}
      {...props}
    />
  );
});
FormLabel.displayName = 'FormLabel';

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={!error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`}
      aria-invalid={!!error}
      {...props}
    />
  );
});
FormControl.displayName = 'FormControl';

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField();
  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
});
FormDescription.displayName = 'FormDescription';

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? '') : children;
  if (!body) {
    return null;
  }
  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn('text-sm font-medium text-destructive', className)}
      {...props}
    >
      {body}
    </p>
  );
});
FormMessage.displayName = 'FormMessage';

type ManagedFormSubmit<TValues extends FieldValues> = (
  values: TValues,
  methods: UseFormReturn<TValues>,
) => void | Promise<void>;

type ManagedFormChildren<TValues extends FieldValues> =
  | React.ReactNode
  | ((methods: UseFormReturn<TValues>) => React.ReactNode);

type ManagedFormProps<TValues extends FieldValues> = {
  schema: ZodType<TValues>;
  defaultValues?: DefaultValues<TValues>;
  onSubmit: ManagedFormSubmit<TValues>;
  onInvalid?: SubmitErrorHandler<TValues>;
  children: ManagedFormChildren<TValues>;
  id?: string;
  className?: string;
  mode?: UseFormProps<TValues>['mode'];
  reValidateMode?: UseFormProps<TValues>['reValidateMode'];
  shouldFocusError?: UseFormProps<TValues>['shouldFocusError'];
};

function ManagedForm<TValues extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  onInvalid,
  children,
  id,
  className,
  mode,
  reValidateMode,
  shouldFocusError,
}: ManagedFormProps<TValues>) {
  const form = useForm<TValues>({
    resolver: zodResolver(schema as never) as Resolver<TValues>,
    defaultValues,
    mode,
    reValidateMode,
    shouldFocusError,
  });

  const handleSubmit: SubmitHandler<TValues> = async (values) => {
    await onSubmit(values, form);
  };

  return (
    <Form {...form}>
      <form id={id} className={className} onSubmit={form.handleSubmit(handleSubmit, onInvalid)}>
        {typeof children === 'function' ? children(form) : children}
      </form>
    </Form>
  );
}

type StructuredFormFieldRenderArgs<TValues extends FieldValues> = {
  field: StructuredFormField<TValues>;
  form: UseFormReturn<TValues>;
};

type StructuredFormProps<TValues extends FieldValues> = Omit<
  ManagedFormProps<TValues>,
  'children' | 'className'
> & {
  structure: FormStructure<TValues>;
  className?: string;
  sectionClassName?: string;
  rowClassName?: string;
  renderCustomField?: (args: StructuredFormFieldRenderArgs<TValues>) => React.ReactNode;
  /**
   * Optional footer content rendered after all form sections.
   *
   * Use this slot to place submit/cancel actions (for example, the primary
   * submit `<Button type="submit" />`) and any form-level status messages.
   *
   * If provided as a function, it receives `UseFormReturn` so callers can wire
   * button/loading/error states from `formState`.
   */
  footer?: React.ReactNode | ((methods: UseFormReturn<TValues>) => React.ReactNode);
};

const textFieldTypeMap: Record<StructuredFormTextKind, React.HTMLInputTypeAttribute> = {
  text: 'text',
  email: 'email',
  password: 'password',
  number: 'number',
};

function renderSectionTitle<TValues extends FieldValues>(section: StructuredFormSection<TValues>) {
  if (!section.title && !section.description) {
    return null;
  }

  return (
    <div className="space-y-1">
      {section.title ? <h3 className="text-sm font-semibold text-foreground">{section.title}</h3> : null}
      {section.description ? (
        <p className="text-sm text-muted-foreground">{section.description}</p>
      ) : null}
    </div>
  );
}

function StructuredForm<TValues extends FieldValues>({
  structure,
  renderCustomField,
  footer,
  className,
  sectionClassName,
  rowClassName,
  ...props
}: StructuredFormProps<TValues>) {
  const renderFooter = (form: UseFormReturn<TValues>) => {
    if (typeof footer === 'function') {
      return footer(form);
    }

    if (footer) {
      return footer;
    }

    return (
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Submitting...' : 'Submit'}
      </Button>
    );
  };

  return (
    <ManagedForm {...props} className={cn('space-y-6', className)}>
      {(form) => (
        <>
          {structure.map((section, sectionIndex) => (
            <section
              key={section.id ?? `section-${sectionIndex}`}
              className={cn('space-y-4', sectionClassName, section.className)}
            >
              {renderSectionTitle(section)}
              <div className="space-y-4">
                {section.rows.map((row, rowIndex) => (
                  <div
                    key={row.id ?? `row-${sectionIndex}-${rowIndex}`}
                    className={cn(
                      'grid gap-4',
                      row.fields.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1',
                      rowClassName,
                      row.className,
                    )}
                  >
                    {row.fields.map((field, fieldIndex) => {
                      const key = field.id ?? `${String(field.name)}-${fieldIndex}`;

                      if (field.kind === 'custom') {
                        const customNode = field.render
                          ? field.render(form)
                          : renderCustomField?.({ field, form });

                        if (!customNode) {
                          return null;
                        }

                        return (
                          <div key={key} className={cn('md:col-span-2', field.className)}>
                            {customNode}
                          </div>
                        );
                      }

                      const name = field.name as Path<TValues>;

                      return (
                        <FormField
                          key={key}
                          control={form.control}
                          name={name}
                          render={({ field: rhfField }) => {
                            if (field.kind === 'checkbox') {
                              return (
                                <FormItem className={cn('space-y-3', field.className)}>
                                  <div className="flex items-start gap-3">
                                    <FormControl>
                                      <input
                                        type="checkbox"
                                        checked={Boolean(rhfField.value)}
                                        onBlur={rhfField.onBlur}
                                        onChange={(event) => {
                                          rhfField.onChange(event.target.checked);
                                        }}
                                        name={rhfField.name}
                                        ref={rhfField.ref}
                                        disabled={field.disabled}
                                        className="mt-1 h-4 w-4 rounded border border-input text-brand shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                      />
                                    </FormControl>
                                    <div className="space-y-1">
                                      <FormLabel>{field.label}</FormLabel>
                                      {field.description ? (
                                        <FormDescription>{field.description}</FormDescription>
                                      ) : null}
                                      <FormMessage />
                                    </div>
                                  </div>
                                </FormItem>
                              );
                            }

                            return (
                              <FormItem className={field.className}>
                                <FormLabel>{field.label}</FormLabel>
                                <FormControl>
                                  {field.kind === 'select' ? (
                                    <Select
                                      value={String(rhfField.value ?? '')}
                                      onBlur={rhfField.onBlur}
                                      onChange={rhfField.onChange}
                                      name={rhfField.name}
                                      ref={rhfField.ref}
                                      disabled={field.disabled}
                                    >
                                      {field.placeholder ? (
                                        <option value="" disabled>
                                          {field.placeholder}
                                        </option>
                                      ) : null}
                                      {field.options.map((option) => (
                                        <option
                                          key={`${field.name}-${option.value}`}
                                          value={option.value}
                                          disabled={option.disabled}
                                        >
                                          {option.label}
                                        </option>
                                      ))}
                                    </Select>
                                  ) : field.kind === 'textarea' ? (
                                    <textarea
                                      value={String(rhfField.value ?? '')}
                                      onBlur={rhfField.onBlur}
                                      onChange={rhfField.onChange}
                                      name={rhfField.name}
                                      ref={rhfField.ref}
                                      placeholder={field.placeholder}
                                      disabled={field.disabled}
                                      rows={field.rows ?? 4}
                                      className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                  ) : (
                                    <Input
                                      type={textFieldTypeMap[field.kind]}
                                      placeholder={field.placeholder}
                                      disabled={field.disabled}
                                      value={
                                        rhfField.value === undefined || rhfField.value === null
                                          ? ''
                                          : String(rhfField.value)
                                      }
                                      onBlur={rhfField.onBlur}
                                      onChange={(event) => {
                                        if (field.kind === 'number') {
                                          const nextValue = event.target.value;
                                          if (nextValue === '') {
                                            rhfField.onChange(undefined);
                                            return;
                                          }

                                          const parsed = Number(nextValue);
                                          rhfField.onChange(
                                            Number.isNaN(parsed)
                                              ? undefined
                                              : (parsed as PathValue<
                                                TValues,
                                                Path<TValues>
                                              >),
                                          );
                                          return;
                                        }

                                        rhfField.onChange(event.target.value);
                                      }}
                                      name={rhfField.name}
                                      ref={rhfField.ref}
                                    />
                                  )}
                                </FormControl>
                                {field.description ? (
                                  <FormDescription>{field.description}</FormDescription>
                                ) : null}
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          ))}
          {renderFooter(form)}
        </>
      )}
    </ManagedForm>
  );
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  ManagedForm,
  type ManagedFormProps,
  StructuredForm,
  type StructuredFormProps,
  useFormField
};
