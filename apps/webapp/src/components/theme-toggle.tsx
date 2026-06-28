'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@mma/ui';

/**
 * Three-state theme toggle: light → dark → system → light...
 * Avoids hydration mismatch by mounting only after the client picks up
 * the user's stored preference.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Render an aria-hidden placeholder of the same size to avoid layout shift.
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-hidden
        tabIndex={-1}
        data-testid="theme-toggle-placeholder"
      >
        <span style={{ width: 20, height: 20, display: 'inline-block' }} />
      </Button>
    );
  }

  const next =
    theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  const label =
    theme === 'system'
      ? `Theme: system (${resolvedTheme})`
      : `Theme: ${theme}`;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme. Current: ${label}`}
      title={label}
      data-testid="theme-toggle"
    >
      {theme === 'light' && <SunIcon />}
      {theme === 'dark' && <MoonIcon />}
      {theme === 'system' && <SystemIcon />}
    </Button>
  );
}

function SunIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
