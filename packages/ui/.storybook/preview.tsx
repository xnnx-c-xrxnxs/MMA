import * as React from 'react';
import type { Preview } from '@storybook/react';
import { withThemeByClassName } from '@storybook/addon-themes';

// Tailwind v4 stylesheet — generated tokens (light + dark) live here so
// stories render with the same CSS variables the webapp ships.
import './preview.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
    a11y: {
      // Surface critical + serious axe violations in the addon panel.
      config: { rules: [] },
      options: { runOnly: ['wcag2a', 'wcag2aa'] },
    },
    layout: 'centered',
  },
  decorators: [
    // `<ThemeToggle>` in the webapp toggles `class="dark"` on <html> via
    // next-themes. We mirror that mechanism here so dark-mode tokens kick in.
    withThemeByClassName({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'light',
      parentSelector: 'html',
    }),
    (Story) => (
      <div className="bg-background text-foreground p-6 min-w-[320px]">
        <Story />
      </div>
    ),
  ],
};

export default preview;
