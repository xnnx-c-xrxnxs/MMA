import * as React from 'react';
import { cn } from '../../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Optional inline error message rendered below the input. When set, the
   * input is marked `aria-invalid` and gets a danger-colored border.
   */
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    return (
      <>
        <input
          id={inputId}
          type={type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            error &&
              'border-danger-text focus-visible:ring-danger-text',
            className,
          )}
          ref={ref}
          {...props}
        />
        {error ? (
          <p id={errorId} className="mt-1.5 text-xs font-medium text-danger-text">
            {error}
          </p>
        ) : null}
      </>
    );
  },
);
Input.displayName = 'Input';

export { Input };
