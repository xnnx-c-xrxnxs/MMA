'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';

export interface FileDropzoneProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onDrop'> {
  /** Called when the user selects (or drops) a file. */
  onFileSelected: (file: File) => void;
  /** MIME types to accept, e.g. 'image/*', 'application/pdf'. */
  accept?: string;
  /** Maximum file size in bytes. */
  maxSize?: number;
  /** Disable interaction. */
  disabled?: boolean;
  /** Optional label rendered inside the drop area. */
  label?: React.ReactNode;
  /** Optional secondary hint, e.g. "PNG or JPG, up to 5MB". */
  hint?: React.ReactNode;
  /** Called with a human-readable validation error if the picked file fails accept/maxSize checks. */
  onValidationError?: (message: string) => void;
}

/**
 * Accessible file picker with drag-and-drop. Calls `onFileSelected` with the
 * picked `File`. Pair with `useFileUpload()` from `@old-st/client-common` to
 * upload the file directly to S3 via a presigned URL.
 */
export const FileDropzone = React.forwardRef<HTMLDivElement, FileDropzoneProps>(
  (
    {
      onFileSelected,
      accept,
      maxSize,
      disabled,
      label = 'Drop a file here, or click to browse',
      hint,
      onValidationError,
      className,
      ...props
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    const validate = React.useCallback(
      (file: File): boolean => {
        if (maxSize && file.size > maxSize) {
          onValidationError?.(`File is larger than ${Math.round(maxSize / 1024)}KB`);
          return false;
        }
        if (accept) {
          const types = accept.split(',').map((t) => t.trim());
          const ok = types.some((t) => {
            if (t.endsWith('/*')) {
              return file.type.startsWith(t.slice(0, -1));
            }
            return file.type === t || file.name.toLowerCase().endsWith(t.replace(/^\./, '').toLowerCase());
          });
          if (!ok) {
            onValidationError?.(`File type not accepted (expected ${accept})`);
            return false;
          }
        }
        return true;
      },
      [accept, maxSize, onValidationError],
    );

    const pick = (file: File) => {
      if (validate(file)) onFileSelected(file);
    };

    const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
      const file = e.target.files?.[0];
      if (file) pick(file);
      // reset so the same file can be selected twice in a row
      e.target.value = '';
    };

    const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files?.[0];
      if (file) pick(file);
    };

    const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
      e.preventDefault();
      if (disabled) return;
      setIsDragging(true);
    };

    const onDragLeave: React.DragEventHandler<HTMLDivElement> = () => {
      setIsDragging(false);
    };

    const onClick = () => {
      if (!disabled) inputRef.current?.click();
    };

    const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    };

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          'flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-6 text-center text-sm transition-colors',
          'border-input bg-background text-muted-foreground',
          'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isDragging && 'border-primary bg-accent/40 text-foreground',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
        {...props}
      >
        <span className="font-medium text-foreground">{label}</span>
        {hint && <span className="text-xs">{hint}</span>}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={onChange}
          className="sr-only"
        />
      </div>
    );
  },
);
FileDropzone.displayName = 'FileDropzone';
