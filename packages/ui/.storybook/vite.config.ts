import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Storybook reads this Vite config when starting `nx run ui:storybook`.
 * The Tailwind v4 plugin compiles the @theme/.dark blocks from
 * apps/webapp/src/app/globals.css (re-imported by ./preview.css).
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
