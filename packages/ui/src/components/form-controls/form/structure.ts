import type { ReactNode } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';

export type StructuredFormTextKind = 'text' | 'email' | 'password' | 'number';

export type StructuredFormFieldOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type StructuredFormFieldBase<TValues extends FieldValues> = {
  id?: string;
  name: Path<TValues>;
  label: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export type StructuredFormTextField<TValues extends FieldValues> = StructuredFormFieldBase<TValues> & {
  kind: StructuredFormTextKind;
};

export type StructuredFormTextareaField<TValues extends FieldValues> =
  StructuredFormFieldBase<TValues> & {
    kind: 'textarea';
    rows?: number;
  };

export type StructuredFormSelectField<TValues extends FieldValues> = StructuredFormFieldBase<TValues> & {
  kind: 'select';
  options: StructuredFormFieldOption[];
};

export type StructuredFormCheckboxField<TValues extends FieldValues> =
  StructuredFormFieldBase<TValues> & {
    kind: 'checkbox';
  };

export type StructuredFormCustomField<TValues extends FieldValues> = {
  id?: string;
  kind: 'custom';
  name: Path<TValues>;
  className?: string;
  render: (form: UseFormReturn<TValues>) => ReactNode;
};

export type StructuredFormField<TValues extends FieldValues> =
  | StructuredFormTextField<TValues>
  | StructuredFormTextareaField<TValues>
  | StructuredFormSelectField<TValues>
  | StructuredFormCheckboxField<TValues>
  | StructuredFormCustomField<TValues>;

export type StructuredFormRow<TValues extends FieldValues> = {
  id?: string;
  className?: string;
  fields: StructuredFormField<TValues>[];
};

export type StructuredFormSection<TValues extends FieldValues> = {
  id?: string;
  title?: string;
  description?: string;
  className?: string;
  rows: StructuredFormRow<TValues>[];
};

export type FormStructure<TValues extends FieldValues> = StructuredFormSection<TValues>[];
