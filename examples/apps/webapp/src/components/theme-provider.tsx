'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * Webapp ThemeProvider — thin wrapper around next-themes.
 *
 * - `attribute="class"` sets `class="dark"` on `<html>`, picked up by the
 *   `@custom-variant dark` rule in `globals.css`.
 * - `defaultTheme="system"` respects the user's OS setting on first visit.
 * - `enableSystem` keeps the system option in `<ThemeToggle>`.
 * - `disableTransitionOnChange` prevents flicker when toggling.
 */
export function ThemeProvider(
  props: ComponentProps<typeof NextThemesProvider>,
) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    />
  );
}
