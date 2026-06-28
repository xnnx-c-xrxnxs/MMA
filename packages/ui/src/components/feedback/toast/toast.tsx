'use client';

import { Toaster as SonnerToaster, toast } from 'sonner';
import type { ComponentProps } from 'react';

type ToasterProps = ComponentProps<typeof SonnerToaster>;

/**
 * Toast container. Mount once near the root (Providers).
 * Toasts are emitted via the `toast` function exported below.
 */
function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
